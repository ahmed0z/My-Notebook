using NoteBook.Api.DTOs;

namespace NoteBook.Api.Services;

public interface IAuthService {
    Task<bool> IsConfiguredAsync();
    Task<AuthResponse?> SetupAsync(SetupRequest request);
    Task<AuthResponse?> LoginAsync(LoginRequest request);
    Task<bool> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword);
    Task<AuthResponse?> CreateUserAsync(string username, string password, string? email = null);
    Task<ForgotPasswordResponse> RequestPasswordResetAsync(string email);
    Task<bool> ResetPasswordWithCodeAsync(string email, string code, string newPassword);
    Task<bool> UpdateEmailAsync(Guid userId, string email);
}
