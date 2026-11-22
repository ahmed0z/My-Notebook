using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NoteBook.Api.DTOs;
using NoteBook.Api.Services;

namespace NoteBook.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase {
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService) {
        _authService = authService;
    }

    [HttpGet("status")]
    public async Task<IActionResult> GetStatus() {
        var isConfigured = await _authService.IsConfiguredAsync();
        return Ok(new StatusResponse(isConfigured));
    }

    [HttpPost("setup")]
    public async Task<IActionResult> Setup([FromBody] SetupRequest request) {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password)) {
            return BadRequest(new { error = "Username and password are required" });
        }

        var result = await _authService.SetupAsync(request);
        if (result == null) {
            return Conflict(new { error = "Setup already completed. Application is configured." });
        }

        return Ok(result);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request) {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password)) {
            return BadRequest(new { error = "Username and password are required" });
        }

        var result = await _authService.LoginAsync(request);
        if (result == null) {
            return Unauthorized(new { error = "Invalid credentials" });
        }

        return Ok(result);
    }

    [HttpPut("password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request) {
        if (string.IsNullOrWhiteSpace(request.CurrentPassword) || string.IsNullOrWhiteSpace(request.NewPassword)) {
            return BadRequest(new { error = "Current password and new password are required" });
        }

        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(idStr, out var userId)) {
            return Unauthorized(new { error = "User not authenticated" });
        }

        var success = await _authService.ChangePasswordAsync(userId, request.CurrentPassword, request.NewPassword);
        if (!success) {
            return BadRequest(new { error = "Invalid current password" });
        }

        return Ok(new { success = true });
    }

    [HttpPost("users")]
    [Authorize]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request) {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password)) {
            return BadRequest(new { error = "Username and password are required" });
        }

        var result = await _authService.CreateUserAsync(request.Username, request.Password, request.Email);
        if (result == null) {
            return Conflict(new { error = "Username or email already exists" });
        }

        return Ok(result);
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request) {
        if (string.IsNullOrWhiteSpace(request.Email)) {
            return BadRequest(new { error = "Email is required" });
        }

        var result = await _authService.RequestPasswordResetAsync(request.Email);
        return Ok(result);
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordWithCodeRequest request) {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.NewPassword)) {
            return BadRequest(new { error = "Email, code, and new password are required" });
        }

        var success = await _authService.ResetPasswordWithCodeAsync(request.Email, request.Code, request.NewPassword);
        if (!success) {
            return BadRequest(new { error = "Invalid or expired reset code" });
        }

        return Ok(new { success = true, message = "Password reset successfully. You can now log in." });
    }

    [HttpPut("email")]
    [Authorize]
    public async Task<IActionResult> UpdateEmail([FromBody] UpdateEmailRequest request) {
        if (string.IsNullOrWhiteSpace(request.Email)) {
            return BadRequest(new { error = "Email is required" });
        }

        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(idStr, out var userId)) {
            return Unauthorized(new { error = "User not authenticated" });
        }

        var success = await _authService.UpdateEmailAsync(userId, request.Email);
        if (!success) {
            return Conflict(new { error = "Email already in use or update failed" });
        }

        return Ok(new { success = true, email = request.Email.Trim().ToLower() });
    }
}
