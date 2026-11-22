using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using NoteBook.Api.Data;
using NoteBook.Api.DTOs;
using NoteBook.Api.Models;
using NoteBook.Api.Services;
using Xunit;

namespace NoteBook.Tests;

public class PasswordResetEmailTests {
    private class FakeEmailSender : IEmailSender {
        public List<(string Email, string Code, string Username)> SentEmails { get; } = new();
        public bool ReturnValue { get; set; } = true;

        public Task<bool> SendPasswordResetEmailAsync(string toEmail, string resetCode, string username) {
            SentEmails.Add((toEmail, resetCode, username));
            return Task.FromResult(ReturnValue);
        }
    }

    private (AppDbContext db, IConfiguration config) CreateInMemoryContext() {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new AppDbContext(options);

        var configValues = new Dictionary<string, string?> {
            { "Jwt:Key", "NoteBookSuperSecretKeyForDevelopment2026Secure123!" },
            { "Jwt:Issuer", "NoteBookApi" },
            { "Jwt:Audience", "NoteBookClient" },
            { "EnableDevResetCodes", "true" }
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(configValues).Build();

        return (db, config);
    }

    [Fact]
    public void SmtpEmailSender_GenerateHtmlBody_ContainsMaterial3AndCode() {
        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();
        var sender = new SmtpEmailSender(config, NullLogger<SmtpEmailSender>.Instance);

        var html = sender.GenerateHtmlBody("582914", "john_doe");

        Assert.Contains("582914", html);
        Assert.Contains("john_doe", html);
        Assert.Contains("15 minute", html);
        Assert.Contains("NoteBook", html);
        // Verify HTML card and typography styling
        Assert.Contains("font-family", html);
        Assert.Contains("border-radius", html);
        Assert.Contains("letter-spacing", html);
    }

    [Fact]
    public void SmtpEmailSender_GeneratePlainTextBody_ContainsCodeAndAdvisory() {
        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();
        var sender = new SmtpEmailSender(config, NullLogger<SmtpEmailSender>.Instance);

        var text = sender.GeneratePlainTextBody("582914", "john_doe");

        Assert.Contains("582914", text);
        Assert.Contains("john_doe", text);
        Assert.Contains("15 minutes", text);
    }

    [Fact]
    public async Task SmtpEmailSender_WhenUnconfigured_ReturnsTrueSafely() {
        var inMemorySettings = new Dictionary<string, string?> {
            { "Smtp:Host", "" }
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(inMemorySettings).Build();
        var sender = new SmtpEmailSender(config, NullLogger<SmtpEmailSender>.Instance);

        var result = await sender.SendPasswordResetEmailAsync("user@example.com", "123456", "user");
        Assert.True(result);
    }

    [Fact]
    public async Task SmtpEmailSender_WhenHostInvalid_ReturnsFalseGracefullyWithoutThrowing() {
        var inMemorySettings = new Dictionary<string, string?> {
            { "Smtp:Host", "127.0.0.1" },
            { "Smtp:Port", "65534" },
            { "Smtp:EnableSsl", "false" }
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(inMemorySettings).Build();
        var sender = new SmtpEmailSender(config, NullLogger<SmtpEmailSender>.Instance);

        var result = await sender.SendPasswordResetEmailAsync("user@example.com", "123456", "user");
        Assert.False(result);
    }

    [Fact]
    public async Task RequestPasswordReset_GeneratesSixDigitCodeAndCallsEmailSender() {
        var (db, config) = CreateInMemoryContext();
        var fakeSender = new FakeEmailSender();
        var authService = new AuthService(db, config, fakeSender);

        var user = new User {
            Id = Guid.NewGuid(),
            Username = "bob",
            Email = "bob@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password123!"),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var response = await authService.RequestPasswordResetAsync("bob@example.com");

        Assert.True(response.Success);

        var updatedUser = await db.Users.FindAsync(user.Id);
        Assert.NotNull(updatedUser);
        Assert.NotNull(updatedUser!.ResetCode);
        Assert.Equal(6, updatedUser.ResetCode.Length);
        Assert.True(int.TryParse(updatedUser.ResetCode, out _));
        Assert.NotNull(updatedUser.ResetCodeExpiresAt);
        Assert.True(updatedUser.ResetCodeExpiresAt > DateTime.UtcNow.AddMinutes(14));
        Assert.True(updatedUser.ResetCodeExpiresAt <= DateTime.UtcNow.AddMinutes(16));

        Assert.Single(fakeSender.SentEmails);
        Assert.Equal("bob@example.com", fakeSender.SentEmails[0].Email);
        Assert.Equal(updatedUser.ResetCode, fakeSender.SentEmails[0].Code);
        Assert.Equal("bob", fakeSender.SentEmails[0].Username);
    }

    [Fact]
    public async Task ResetPasswordWithCode_ValidCode_UpdatesPasswordAndAllowsLogin() {
        var (db, config) = CreateInMemoryContext();
        var fakeSender = new FakeEmailSender();
        var authService = new AuthService(db, config, fakeSender);

        var user = new User {
            Id = Guid.NewGuid(),
            Username = "alice",
            Email = "alice@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("OldSecret123!"),
            ResetCode = "482019",
            ResetCodeExpiresAt = DateTime.UtcNow.AddMinutes(15),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var success = await authService.ResetPasswordWithCodeAsync("alice@example.com", "482019", "NewSecret456!");
        Assert.True(success);

        var updatedUser = await db.Users.FindAsync(user.Id);
        Assert.NotNull(updatedUser);
        Assert.Null(updatedUser!.ResetCode);
        Assert.Null(updatedUser.ResetCodeExpiresAt);

        // Verify login with new password succeeds
        var loginRes = await authService.LoginAsync(new LoginRequest("alice", "NewSecret456!"));
        Assert.NotNull(loginRes);

        // Verify old password fails
        var oldLoginRes = await authService.LoginAsync(new LoginRequest("alice", "OldSecret123!"));
        Assert.Null(oldLoginRes);
    }

    [Fact]
    public async Task ResetPasswordWithCode_ExpiredCode_ReturnsFalse() {
        var (db, config) = CreateInMemoryContext();
        var fakeSender = new FakeEmailSender();
        var authService = new AuthService(db, config, fakeSender);

        var user = new User {
            Id = Guid.NewGuid(),
            Username = "expired_user",
            Email = "expired@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("OldSecret123!"),
            ResetCode = "482019",
            ResetCodeExpiresAt = DateTime.UtcNow.AddMinutes(-5),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var success = await authService.ResetPasswordWithCodeAsync("expired@example.com", "482019", "NewSecret456!");
        Assert.False(success);
    }

    [Fact]
    public async Task ResetPasswordWithCode_WrongCode_ReturnsFalse() {
        var (db, config) = CreateInMemoryContext();
        var fakeSender = new FakeEmailSender();
        var authService = new AuthService(db, config, fakeSender);

        var user = new User {
            Id = Guid.NewGuid(),
            Username = "wrong_code_user",
            Email = "wrong@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("OldSecret123!"),
            ResetCode = "482019",
            ResetCodeExpiresAt = DateTime.UtcNow.AddMinutes(15),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var success = await authService.ResetPasswordWithCodeAsync("wrong@example.com", "000000", "NewSecret456!");
        Assert.False(success);
    }

    [Fact]
    public async Task Integration_ForgotPassword_And_ResetPassword_ApiFlow() {
        var factory = new CustomWebApplicationFactory();
        var client = factory.CreateClient();

        // Register user
        var regRes = await client.PostAsJsonAsync("/api/auth/register", new {
            Username = "integration_pw_user",
            Email = "integration_pw@example.com",
            Password = "InitialPassword123!"
        });
        Assert.Equal(HttpStatusCode.OK, regRes.StatusCode);

        // Forgot password
        var forgotRes = await client.PostAsJsonAsync("/api/auth/forgot-password", new {
            Email = "integration_pw@example.com"
        });
        Assert.Equal(HttpStatusCode.OK, forgotRes.StatusCode);
        var forgotData = await forgotRes.Content.ReadFromJsonAsync<ForgotPasswordTestResponse>();
        Assert.NotNull(forgotData);
        Assert.True(forgotData.Success);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NoteBook.Api.Data.AppDbContext>();
        var user = await db.Users.FirstAsync(u => u.Email == "integration_pw@example.com");
        Assert.NotNull(user.ResetCode);

        // Reset password with code
        var resetRes = await client.PostAsJsonAsync("/api/auth/reset-password", new {
            Email = "integration_pw@example.com",
            Code = user.ResetCode,
            NewPassword = "BrandNewPassword789!"
        });
        Assert.Equal(HttpStatusCode.OK, resetRes.StatusCode);

        // Login with new password
        var loginRes = await client.PostAsJsonAsync("/api/auth/login", new {
            Username = "integration_pw@example.com",
            Password = "BrandNewPassword789!"
        });
        Assert.Equal(HttpStatusCode.OK, loginRes.StatusCode);

        // Login with old password fails
        var oldLoginRes = await client.PostAsJsonAsync("/api/auth/login", new {
            Username = "integration_pw@example.com",
            Password = "InitialPassword123!"
        });
        Assert.Equal(HttpStatusCode.Unauthorized, oldLoginRes.StatusCode);
    }

    private record ForgotPasswordTestResponse(bool Success, string Message);
}
