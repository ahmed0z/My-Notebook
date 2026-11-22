using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace NoteBook.Tests;

public class AuthControllerTests {
    [Fact]
    public async Task Setup_CreatesUserFirstTime_AndRejectsSubsequentCalls() {
        var factory = new CustomWebApplicationFactory();
        var client = factory.CreateClient();

        var setupRes = await client.PostAsJsonAsync("/api/auth/setup", new { Username = "owner", Password = "SecurePassword123!" });
        Assert.Equal(HttpStatusCode.OK, setupRes.StatusCode);

        var secondRes = await client.PostAsJsonAsync("/api/auth/setup", new { Username = "attacker", Password = "HackedPassword123!" });
        Assert.Equal(HttpStatusCode.Conflict, secondRes.StatusCode);
    }

    [Fact]
    public async Task Status_ReturnsFalseBeforeSetup_AndTrueAfterSetup() {
        var factory = new CustomWebApplicationFactory();
        var client = factory.CreateClient();

        var statusRes1 = await client.GetFromJsonAsync<StatusResponse>("/api/auth/status");
        Assert.NotNull(statusRes1);
        Assert.False(statusRes1.IsConfigured);

        await client.PostAsJsonAsync("/api/auth/setup", new { Username = "owner", Password = "SecurePassword123!" });

        var statusRes2 = await client.GetFromJsonAsync<StatusResponse>("/api/auth/status");
        Assert.NotNull(statusRes2);
        Assert.True(statusRes2.IsConfigured);
    }

    [Fact]
    public async Task Login_WithValidCredentials_ReturnsToken() {
        var factory = new CustomWebApplicationFactory();
        var client = factory.CreateClient();

        await client.PostAsJsonAsync("/api/auth/setup", new { Username = "owner", Password = "SecurePassword123!" });

        var loginRes = await client.PostAsJsonAsync("/api/auth/login", new { Username = "owner", Password = "SecurePassword123!" });
        Assert.Equal(HttpStatusCode.OK, loginRes.StatusCode);

        var tokenRes = await loginRes.Content.ReadFromJsonAsync<AuthTokenResponse>();
        Assert.NotNull(tokenRes);
        Assert.NotEmpty(tokenRes.Token);
    }

    [Fact]
    public async Task ChangePassword_WithValidCredentials_SucceedsAndAllowsLoginWithNewPassword() {
        var factory = new CustomWebApplicationFactory();
        var client = factory.CreateClient();

        var setupRes = await client.PostAsJsonAsync("/api/auth/setup", new { Username = "admin", Password = "OldPassword123!" });
        var auth = await setupRes.Content.ReadFromJsonAsync<AuthTokenResponse>();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", auth!.Token);

        var changeRes = await client.PutAsJsonAsync("/api/auth/password", new {
            CurrentPassword = "OldPassword123!",
            NewPassword = "NewSecretPassword456!"
        });
        Assert.Equal(HttpStatusCode.OK, changeRes.StatusCode);

        // Old password should fail login
        var oldLoginRes = await client.PostAsJsonAsync("/api/auth/login", new { Username = "admin", Password = "OldPassword123!" });
        Assert.Equal(HttpStatusCode.Unauthorized, oldLoginRes.StatusCode);

        // New password should succeed login
        var newLoginRes = await client.PostAsJsonAsync("/api/auth/login", new { Username = "admin", Password = "NewSecretPassword456!" });
        Assert.Equal(HttpStatusCode.OK, newLoginRes.StatusCode);
    }

    [Fact]
    public async Task ChangePassword_WithWrongCurrentPassword_ReturnsBadRequest() {
        var factory = new CustomWebApplicationFactory();
        var client = factory.CreateClient();

        var setupRes = await client.PostAsJsonAsync("/api/auth/setup", new { Username = "admin", Password = "OldPassword123!" });
        var auth = await setupRes.Content.ReadFromJsonAsync<AuthTokenResponse>();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", auth!.Token);

        var changeRes = await client.PutAsJsonAsync("/api/auth/password", new {
            CurrentPassword = "WrongPassword!",
            NewPassword = "NewSecretPassword456!"
        });
        Assert.Equal(HttpStatusCode.BadRequest, changeRes.StatusCode);
    }

    [Fact]
    public async Task CreateUser_WhenAuthenticated_CreatesNewUserAndAllowsLogin() {
        var factory = new CustomWebApplicationFactory();
        var client = factory.CreateClient();

        var setupRes = await client.PostAsJsonAsync("/api/auth/setup", new { Username = "admin", Password = "OldPassword123!" });
        var auth = await setupRes.Content.ReadFromJsonAsync<AuthTokenResponse>();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", auth!.Token);

        var createRes = await client.PostAsJsonAsync("/api/auth/users", new {
            Username = "second_user",
            Password = "SecondPassword123!"
        });
        Assert.Equal(HttpStatusCode.OK, createRes.StatusCode);
        var createdUser = await createRes.Content.ReadFromJsonAsync<AuthTokenResponse>();
        Assert.NotNull(createdUser);
        Assert.Equal("second_user", createdUser.Username);

        // Second user can log in
        var secondLoginRes = await client.PostAsJsonAsync("/api/auth/login", new {
            Username = "second_user",
            Password = "SecondPassword123!"
        });
        Assert.Equal(HttpStatusCode.OK, secondLoginRes.StatusCode);

        // Verify default "General" space is seeded for new user
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NoteBook.Api.Data.AppDbContext>();
        var secondUser = await db.Users.FirstAsync(u => u.Username == "second_user");
        var userSpace = await db.Spaces.FirstOrDefaultAsync(s => s.UserId == secondUser.Id && s.Name == "General");
        Assert.NotNull(userSpace);
    }

    [Fact]
    public async Task CreateUser_WhenDuplicateUsername_ReturnsConflict() {
        var factory = new CustomWebApplicationFactory();
        var client = factory.CreateClient();

        var setupRes = await client.PostAsJsonAsync("/api/auth/setup", new { Username = "admin", Password = "OldPassword123!" });
        var auth = await setupRes.Content.ReadFromJsonAsync<AuthTokenResponse>();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", auth!.Token);

        var duplicateRes = await client.PostAsJsonAsync("/api/auth/users", new {
            Username = "ADMIN", // case-insensitive duplicate check
            Password = "AnotherPassword123!"
        });
        Assert.Equal(HttpStatusCode.Conflict, duplicateRes.StatusCode);
    }

    [Fact]
    public async Task CreateUser_WhenUnauthenticated_ReturnsUnauthorized() {
        var factory = new CustomWebApplicationFactory();
        var client = factory.CreateClient();

        var createRes = await client.PostAsJsonAsync("/api/auth/users", new {
            Username = "anonymous_attempt",
            Password = "Password123!"
        });
        Assert.Equal(HttpStatusCode.Unauthorized, createRes.StatusCode);
    }

    [Fact]
    public async Task ForgotPassword_GeneratesCode_AndAllowsPasswordReset() {
        var factory = new CustomWebApplicationFactory();
        var client = factory.CreateClient();

        // Setup user with email
        var setupRes = await client.PostAsJsonAsync("/api/auth/setup", new {
            Username = "user_with_email",
            Password = "InitialPassword123!",
            Email = "testuser@example.com"
        });
        Assert.Equal(HttpStatusCode.OK, setupRes.StatusCode);

        // Login with email succeeds
        var emailLoginRes = await client.PostAsJsonAsync("/api/auth/login", new {
            Username = "testuser@example.com",
            Password = "InitialPassword123!"
        });
        Assert.Equal(HttpStatusCode.OK, emailLoginRes.StatusCode);

        // Request password reset
        var forgotRes = await client.PostAsJsonAsync("/api/auth/forgot-password", new {
            Email = "testuser@example.com"
        });
        Assert.Equal(HttpStatusCode.OK, forgotRes.StatusCode);
        var forgotData = await forgotRes.Content.ReadFromJsonAsync<ForgotPasswordTestResponse>();
        Assert.NotNull(forgotData);
        Assert.True(forgotData.Success);
        Assert.NotNull(forgotData.DevCode);
        Assert.Equal(6, forgotData.DevCode.Length);

        // Try wrong code -> returns BadRequest
        var wrongCodeRes = await client.PostAsJsonAsync("/api/auth/reset-password", new {
            Email = "testuser@example.com",
            Code = "000000",
            NewPassword = "BrandNewPassword456!"
        });
        Assert.Equal(HttpStatusCode.BadRequest, wrongCodeRes.StatusCode);

        // Correct code -> returns OK
        var correctResetRes = await client.PostAsJsonAsync("/api/auth/reset-password", new {
            Email = "testuser@example.com",
            Code = forgotData.DevCode,
            NewPassword = "BrandNewPassword456!"
        });
        Assert.Equal(HttpStatusCode.OK, correctResetRes.StatusCode);

        // Can log in with new password
        var newLoginRes = await client.PostAsJsonAsync("/api/auth/login", new {
            Username = "testuser@example.com",
            Password = "BrandNewPassword456!"
        });
        Assert.Equal(HttpStatusCode.OK, newLoginRes.StatusCode);

        // Old password no longer works
        var oldLoginRes = await client.PostAsJsonAsync("/api/auth/login", new {
            Username = "testuser@example.com",
            Password = "InitialPassword123!"
        });
        Assert.Equal(HttpStatusCode.Unauthorized, oldLoginRes.StatusCode);
    }

    [Fact]
    public async Task UpdateEmail_WhenAuthenticated_UpdatesEmailSuccessfully() {
        var factory = new CustomWebApplicationFactory();
        var client = factory.CreateClient();

        var setupRes = await client.PostAsJsonAsync("/api/auth/setup", new { Username = "email_updater", Password = "Password123!" });
        var auth = await setupRes.Content.ReadFromJsonAsync<AuthTokenResponse>();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", auth!.Token);

        var updateEmailRes = await client.PutAsJsonAsync("/api/auth/email", new {
            Email = "updated_address@example.com"
        });
        Assert.Equal(HttpStatusCode.OK, updateEmailRes.StatusCode);

        // Can now log in with the new email
        var loginRes = await client.PostAsJsonAsync("/api/auth/login", new {
            Username = "updated_address@example.com",
            Password = "Password123!"
        });
        Assert.Equal(HttpStatusCode.OK, loginRes.StatusCode);
    }

    private record StatusResponse(bool IsConfigured);
    private record AuthTokenResponse(string Token, string Username);
    private record ForgotPasswordTestResponse(bool Success, string Message, string? DevCode);
}
