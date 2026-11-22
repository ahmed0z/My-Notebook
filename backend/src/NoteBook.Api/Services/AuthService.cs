using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using NoteBook.Api.Data;
using NoteBook.Api.DTOs;
using NoteBook.Api.Models;

namespace NoteBook.Api.Services;

public class AuthService : IAuthService {
    public static readonly Guid SingletonUserId = Guid.Parse("00000000-0000-0000-0000-000000000001");
    private static readonly System.ComponentModel.DataAnnotations.EmailAddressAttribute EmailValidator = new();

    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly IEmailSender _emailSender;

    public AuthService(AppDbContext context, IConfiguration configuration, IEmailSender emailSender) {
        _context = context;
        _configuration = configuration;
        _emailSender = emailSender;
    }

    public async Task<bool> IsConfiguredAsync() {
        return await _context.Users.AnyAsync();
    }

    public async Task<AuthResponse?> SetupAsync(SetupRequest request) {
        if (await _context.Users.AnyAsync()) {
            return null; // Already configured
        }

        var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
        var user = new User {
            Id = SingletonUserId,
            Username = request.Username.Trim(),
            Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim().ToLower(),
            PasswordHash = passwordHash,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        try {
            _context.Users.Add(user);
            await _context.SaveChangesAsync();
        } catch (DbUpdateException) {
            return null; // Concurrency race condition prevented by singleton ID
        }

        var token = GenerateJwtToken(user);
        return new AuthResponse(token, user.Username, user.Email, user.AvatarUrl);
    }

    public async Task<AuthResponse?> LoginAsync(LoginRequest request) {
        var login = request.Username.Trim().ToLower();
        var user = await _context.Users.FirstOrDefaultAsync(u =>
            u.Username.ToLower() == login || (u.Email != null && u.Email.ToLower() == login)
        );
        if (user == null) {
            return null;
        }

        bool valid = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
        if (!valid) {
            return null;
        }

        var token = GenerateJwtToken(user);
        return new AuthResponse(token, user.Username, user.Email, user.AvatarUrl);
    }

    public async Task<bool> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword) {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) {
            return false;
        }

        bool valid = BCrypt.Net.BCrypt.Verify(currentPassword, user.PasswordHash);
        if (!valid) {
            return false;
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<AuthResponse?> CreateUserAsync(string username, string password, string? email = null) {
        var trimmed = username.Trim();
        var exists = await _context.Users.AnyAsync(u => u.Username.ToLower() == trimmed.ToLower());
        if (exists) {
            return null;
        }

        string? normalizedEmail = null;
        if (!string.IsNullOrWhiteSpace(email)) {
            normalizedEmail = email.Trim().ToLower();
            var emailExists = await _context.Users.AnyAsync(u => u.Email != null && u.Email.ToLower() == normalizedEmail);
            if (emailExists) {
                return null;
            }
        }

        var passwordHash = BCrypt.Net.BCrypt.HashPassword(password);
        var user = new User {
            Id = Guid.NewGuid(),
            Username = trimmed,
            Email = normalizedEmail,
            PasswordHash = passwordHash,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);

        var defaultSpace = new Space {
            Id = Guid.NewGuid(),
            Name = "General",
            UserId = user.Id,
            Position = 0,
            CreatedAt = DateTime.UtcNow
        };
        _context.Spaces.Add(defaultSpace);

        await _context.SaveChangesAsync();

        var token = GenerateJwtToken(user);
        return new AuthResponse(token, user.Username, user.Email, user.AvatarUrl);
    }

    public async Task<RegisterResult> RegisterAsync(RegisterRequest request) {
        if (request == null) {
            return new RegisterResult(false, null, "Request body is required");
        }

        if (string.IsNullOrWhiteSpace(request.Username) || request.Username.Trim().Length < 3) {
            return new RegisterResult(false, null, "Username must be at least 3 characters");
        }

        if (string.IsNullOrWhiteSpace(request.Email)) {
            return new RegisterResult(false, null, "Email is required");
        }

        if (!IsValidEmail(request.Email)) {
            return new RegisterResult(false, null, "A valid email address is required");
        }

        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6) {
            return new RegisterResult(false, null, "Password must be at least 6 characters");
        }

        var trimmedUsername = request.Username.Trim();
        var usernameExists = await _context.Users.AnyAsync(u => u.Username.ToLower() == trimmedUsername.ToLower());
        if (usernameExists) {
            return new RegisterResult(false, null, "Username already exists", IsConflict: true);
        }

        var normalizedEmail = request.Email.Trim().ToLower();
        var emailExists = await _context.Users.AnyAsync(u => u.Email != null && u.Email.ToLower() == normalizedEmail);
        if (emailExists) {
            return new RegisterResult(false, null, "Email already in use", IsConflict: true);
        }

        var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
        var user = new User {
            Id = Guid.NewGuid(),
            Username = trimmedUsername,
            Email = normalizedEmail,
            PasswordHash = passwordHash,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);

        var defaultSpace = new Space {
            Id = Guid.NewGuid(),
            Name = "General",
            UserId = user.Id,
            Position = 0,
            CreatedAt = DateTime.UtcNow
        };
        _context.Spaces.Add(defaultSpace);

        try {
            await _context.SaveChangesAsync();
        } catch (DbUpdateException) {
            return new RegisterResult(false, null, "User already exists or database conflict", IsConflict: true);
        }

        var token = GenerateJwtToken(user);
        return new RegisterResult(true, new AuthResponse(token, user.Username, user.Email, user.AvatarUrl));
    }

    private static bool IsValidEmail(string email) {
        if (string.IsNullOrWhiteSpace(email)) return false;
        var trimmed = email.Trim();
        if (!EmailValidator.IsValid(trimmed)) return false;
        var atIndex = trimmed.IndexOf('@');
        if (atIndex <= 0 || atIndex >= trimmed.Length - 1) return false;
        var domain = trimmed[(atIndex + 1)..];
        return domain.Contains('.') && !domain.StartsWith('.') && !domain.EndsWith('.');
    }

    public async Task<ForgotPasswordResponse> RequestPasswordResetAsync(string email) {
        var trimmed = email.Trim().ToLower();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email != null && u.Email.ToLower() == trimmed);
        if (user == null) {
            return new ForgotPasswordResponse(true, "If an account with that email exists, a reset code has been sent.");
        }

        var code = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
        user.ResetCode = code;
        user.ResetCodeExpiresAt = DateTime.UtcNow.AddMinutes(15);
        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _emailSender.SendPasswordResetEmailAsync(user.Email!, code, user.Username);

        return new ForgotPasswordResponse(true, "If an account with that email exists, a reset code has been sent.");
    }

    public async Task<ForgotPasswordResponse> RequestPasswordCodeForUserAsync(Guid userId) {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) {
            return new ForgotPasswordResponse(false, "User not found.");
        }

        if (string.IsNullOrWhiteSpace(user.Email)) {
            return new ForgotPasswordResponse(false, "Please set an email address on your profile first to receive verification codes.");
        }

        var code = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
        user.ResetCode = code;
        user.ResetCodeExpiresAt = DateTime.UtcNow.AddMinutes(15);
        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _emailSender.SendPasswordResetEmailAsync(user.Email, code, user.Username);

        return new ForgotPasswordResponse(true, $"A 6-digit verification code has been sent to {user.Email}.");
    }

    public async Task<bool> ResetPasswordWithCodeAsync(string email, string code, string newPassword) {
        var trimmed = email.Trim().ToLower();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email != null && u.Email.ToLower() == trimmed);
        if (user == null || string.IsNullOrWhiteSpace(user.ResetCode) || user.ResetCodeExpiresAt == null) {
            return false;
        }

        if (user.ResetCodeExpiresAt.Value < DateTime.UtcNow) {
            return false;
        }

        if (user.ResetCode.Trim() != code.Trim()) {
            return false;
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        user.ResetCode = null;
        user.ResetCodeExpiresAt = null;
        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> UpdateEmailAsync(Guid userId, string email) {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return false;

        var trimmed = email.Trim().ToLower();
        var inUse = await _context.Users.AnyAsync(u => u.Id != userId && u.Email != null && u.Email.ToLower() == trimmed);
        if (inUse) return false;

        user.Email = trimmed;
        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<UserProfileResponse?> GetProfileAsync(Guid userId) {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return null;
        return new UserProfileResponse(user.Id, user.Username, user.Email, user.AvatarUrl, user.CreatedAt);
    }

    public async Task<UpdateProfileResult> UpdateProfileAsync(Guid userId, UpdateProfileRequest request) {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return new UpdateProfileResult(false, null, "User not found");

        if (!string.IsNullOrWhiteSpace(request.Username)) {
            var trimmedUsername = request.Username.Trim();
            if (trimmedUsername.Length < 3) {
                return new UpdateProfileResult(false, null, "Username must be at least 3 characters");
            }
            if (!string.Equals(user.Username, trimmedUsername, StringComparison.OrdinalIgnoreCase)) {
                var taken = await _context.Users.AnyAsync(u => u.Id != userId && u.Username.ToLower() == trimmedUsername.ToLower());
                if (taken) {
                    return new UpdateProfileResult(false, null, "Username already taken", IsConflict: true);
                }
                user.Username = trimmedUsername;
            }
        }

        if (request.AvatarUrl != null) {
            user.AvatarUrl = string.IsNullOrWhiteSpace(request.AvatarUrl) ? null : request.AvatarUrl.Trim();
        }

        if (request.Email != null) {
            var trimmedEmail = request.Email.Trim().ToLower();
            if (string.IsNullOrWhiteSpace(trimmedEmail)) {
                user.Email = null;
            } else {
                if (!IsValidEmail(trimmedEmail)) {
                    return new UpdateProfileResult(false, null, "A valid email address is required");
                }
                var emailTaken = await _context.Users.AnyAsync(u => u.Id != userId && u.Email != null && u.Email.ToLower() == trimmedEmail);
                if (emailTaken) {
                    return new UpdateProfileResult(false, null, "Email already in use", IsConflict: true);
                }
                user.Email = trimmedEmail;
            }
        }

        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var token = GenerateJwtToken(user);
        return new UpdateProfileResult(true, new AuthResponse(token, user.Username, user.Email, user.AvatarUrl));
    }

    private string GenerateJwtToken(User user) {
        var secret = _configuration["Jwt:Key"] ?? "NoteBookSuperSecretKeyForDevelopment2026Secure123!";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[] {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username)
        };

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"] ?? "NoteBookApi",
            audience: _configuration["Jwt:Audience"] ?? "NoteBookClient",
            claims: claims,
            expires: DateTime.UtcNow.AddDays(30),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
