namespace NoteBook.Api.DTOs;

public record SetupRequest(string Username, string Password, string? Email = null);
public record LoginRequest(string Username, string Password);
public record AuthResponse(string Token, string Username, string? Email = null, string? AvatarUrl = null);
public record StatusResponse(bool IsConfigured);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public record CreateUserRequest(string Username, string Password, string? Email = null);
public record ForgotPasswordRequest(string Email);
public record ForgotPasswordResponse(bool Success, string Message);
public record ResetPasswordWithCodeRequest(string Email, string Code, string NewPassword);
public record UpdateEmailRequest(string Email);
public record RegisterRequest(string Username, string Email, string Password);
public record RegisterResult(bool Success, AuthResponse? Response = null, string? Error = null, bool IsConflict = false);
public record UserProfileResponse(Guid Id, string Username, string? Email, string? AvatarUrl, DateTime CreatedAt);
public record UpdateProfileRequest(string? Username = null, string? AvatarUrl = null, string? Email = null);
public record UpdateProfileResult(bool Success, AuthResponse? Response = null, string? Error = null, bool IsConflict = false);
