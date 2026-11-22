namespace NoteBook.Api.DTOs;

public record SetupRequest(string Username, string Password, string? Email = null);
public record LoginRequest(string Username, string Password);
public record AuthResponse(string Token, string Username, string? Email = null);
public record StatusResponse(bool IsConfigured);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public record CreateUserRequest(string Username, string Password, string? Email = null);
public record ForgotPasswordRequest(string Email);
public record ForgotPasswordResponse(bool Success, string Message, string? DevCode = null);
public record ResetPasswordWithCodeRequest(string Email, string Code, string NewPassword);
public record UpdateEmailRequest(string Email);
