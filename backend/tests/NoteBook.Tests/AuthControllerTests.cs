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
    public async Task GetProfile_WhenAuthenticated_ReturnsProfileWithAvatar() {
        var factory = new CustomWebApplicationFactory();
        var client = factory.CreateClient();

        var setupRes = await client.PostAsJsonAsync("/api/auth/setup", new { Username = "profile_user", Password = "Password123!" });
        var auth = await setupRes.Content.ReadFromJsonAsync<AuthTokenResponse>();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", auth!.Token);

        var profileRes = await client.GetAsync("/api/auth/profile");
        Assert.Equal(HttpStatusCode.OK, profileRes.StatusCode);
        var profile = await profileRes.Content.ReadFromJsonAsync<UserProfileTestResponse>();
        Assert.NotNull(profile);
        Assert.Equal("profile_user", profile.Username);
    }

    [Fact]
    public async Task UpdateProfile_WhenAuthenticated_UpdatesUsernameAndAvatar() {
        var factory = new CustomWebApplicationFactory();
        var client = factory.CreateClient();

        var setupRes = await client.PostAsJsonAsync("/api/auth/setup", new { Username = "initial_name", Password = "Password123!" });
        var auth = await setupRes.Content.ReadFromJsonAsync<AuthTokenResponse>();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", auth!.Token);

        var updateRes = await client.PutAsJsonAsync("/api/auth/profile", new {
            Username = "new_cool_name",
            AvatarUrl = "🎨",
            Email = "new_email@example.com"
        });
        Assert.Equal(HttpStatusCode.OK, updateRes.StatusCode);
        var updatedAuth = await updateRes.Content.ReadFromJsonAsync<AuthTokenResponse>();
        Assert.NotNull(updatedAuth);
        Assert.Equal("new_cool_name", updatedAuth.Username);
        Assert.Equal("🎨", updatedAuth.AvatarUrl);

        // Verify login with new username
        var loginRes = await client.PostAsJsonAsync("/api/auth/login", new {
            Username = "new_cool_name",
            Password = "Password123!"
        });
        Assert.Equal(HttpStatusCode.OK, loginRes.StatusCode);
    }

    [Fact]
    public async Task UpdateProfile_WhenDuplicateUsername_ReturnsConflict() {
        var factory = new CustomWebApplicationFactory();
        var client = factory.CreateClient();

        await client.PostAsJsonAsync("/api/auth/setup", new { Username = "user_one", Password = "Password123!" });
        var regRes = await client.PostAsJsonAsync("/api/auth/register", new {
            Username = "user_two",
            Email = "user_two@example.com",
            Password = "Password123!"
        });
        Assert.Equal(HttpStatusCode.OK, regRes.StatusCode);
        var authTwo = await regRes.Content.ReadFromJsonAsync<AuthTokenResponse>();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", authTwo!.Token);

        var conflictRes = await client.PutAsJsonAsync("/api/auth/profile", new {
            Username = "USER_ONE" // case insensitive duplicate
        });
        Assert.Equal(HttpStatusCode.Conflict, conflictRes.StatusCode);
    }

    [Fact]
    public async Task RequestPasswordCode_WhenAuthenticated_GeneratesResetCode() {
        var factory = new CustomWebApplicationFactory();
        var client = factory.CreateClient();

        var setupRes = await client.PostAsJsonAsync("/api/auth/setup", new {
            Username = "code_requester",
            Password = "Password123!",
            Email = "requester@example.com"
        });
        var auth = await setupRes.Content.ReadFromJsonAsync<AuthTokenResponse>();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", auth!.Token);

        var reqRes = await client.PostAsync("/api/auth/request-password-code", null);
        Assert.Equal(HttpStatusCode.OK, reqRes.StatusCode);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NoteBook.Api.Data.AppDbContext>();
        var user = await db.Users.FirstAsync(u => u.Username == "code_requester");
        Assert.NotNull(user.ResetCode);
        Assert.Equal(6, user.ResetCode.Length);
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

        // Retrieve code directly from DB (no devCode leakage in API response)
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NoteBook.Api.Data.AppDbContext>();
        var user = await db.Users.FirstAsync(u => u.Email == "testuser@example.com");
        Assert.NotNull(user.ResetCode);
        Assert.Equal(6, user.ResetCode.Length);

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
            Code = user.ResetCode,
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
    private record AuthTokenResponse(string Token, string Username, string? AvatarUrl = null);
    private record UserProfileTestResponse(Guid Id, string Username, string? Email, string? AvatarUrl, DateTime CreatedAt);
    private record ForgotPasswordTestResponse(bool Success, string Message);
}
