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

    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;

    public AuthService(AppDbContext context, IConfiguration configuration) {
        _context = context;
        _configuration = configuration;
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
        return new AuthResponse(token, user.Username, user.Email);
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
        return new AuthResponse(token, user.Username, user.Email);
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
        return new AuthResponse(token, user.Username, user.Email);
    }

    public async Task<ForgotPasswordResponse> RequestPasswordResetAsync(string email) {
        var trimmed = email.Trim().ToLower();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email != null && u.Email.ToLower() == trimmed);
        if (user == null) {
            return new ForgotPasswordResponse(true, "If an account with that email exists, a reset code has been sent.");
        }

        var random = new Random();
        var code = random.Next(100000, 999999).ToString();
        user.ResetCode = code;
        user.ResetCodeExpiresAt = DateTime.UtcNow.AddMinutes(15);
        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return new ForgotPasswordResponse(true, "Reset code generated and valid for 15 minutes.", code);
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
