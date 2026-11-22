using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Xunit;

namespace NoteBook.Tests;

public class MultiTenantDataIsolationTests {
    private record AuthResponse(string Token, string Username, string? Email);
    private record SpaceDto(Guid Id, string Name, Guid? ParentSpaceId, int Position, DateTime CreatedAt);
    private record NoteDto(Guid Id, string Title, string Color, int Position, bool IsPinned, bool IsArchived, DateTime CreatedAt, DateTime UpdatedAt, List<BlockDto>? Blocks, Guid? SpaceId);
    private record BlockDto(Guid Id, Guid NoteId, string Type, string ContentJson, int Position, DateTime CreatedAt, DateTime UpdatedAt);
    private record ErrorResponse(string? Error);

    private static HttpClient CreateClientWithAuth(CustomWebApplicationFactory factory, string token) {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    [Fact]
    public async Task Register_ValidatesInput_AndRejectsInvalidRequests() {
        var factory = new CustomWebApplicationFactory();
        var client = factory.CreateClient();

        // 1. Username too short (< 3 chars)
        var shortUsernameRes = await client.PostAsJsonAsync("/api/auth/register", new {
            Username = "ab",
            Email = "valid@example.com",
            Password = "Password123!"
        });
        Assert.Equal(HttpStatusCode.BadRequest, shortUsernameRes.StatusCode);

        // 2. Missing/empty username
        var emptyUsernameRes = await client.PostAsJsonAsync("/api/auth/register", new {
            Username = "   ",
            Email = "valid@example.com",
            Password = "Password123!"
        });
        Assert.Equal(HttpStatusCode.BadRequest, emptyUsernameRes.StatusCode);

        // 3. Password too short (< 6 chars)
        var shortPasswordRes = await client.PostAsJsonAsync("/api/auth/register", new {
            Username = "validuser",
            Email = "valid@example.com",
            Password = "12345"
        });
        Assert.Equal(HttpStatusCode.BadRequest, shortPasswordRes.StatusCode);

        // 4. Invalid email format
        var badEmailRes = await client.PostAsJsonAsync("/api/auth/register", new {
            Username = "validuser",
            Email = "not-an-email",
            Password = "Password123!"
        });
        Assert.Equal(HttpStatusCode.BadRequest, badEmailRes.StatusCode);

        // 5. Empty email
        var emptyEmailRes = await client.PostAsJsonAsync("/api/auth/register", new {
            Username = "validuser",
            Email = "   ",
            Password = "Password123!"
        });
        Assert.Equal(HttpStatusCode.BadRequest, emptyEmailRes.StatusCode);
    }

    [Fact]
    public async Task Register_DuplicateUsernameOrEmail_ReturnsConflict() {
        var factory = new CustomWebApplicationFactory();
        var client = factory.CreateClient();

        // Register initial user
        var res1 = await client.PostAsJsonAsync("/api/auth/register", new {
            Username = "TenantUser1",
            Email = "user1@example.com",
            Password = "Password123!"
        });
        Assert.Equal(HttpStatusCode.OK, res1.StatusCode);

        // Duplicate username (case-insensitive)
        var dupUsernameRes = await client.PostAsJsonAsync("/api/auth/register", new {
            Username = "tenantuser1",
            Email = "user1_other@example.com",
            Password = "Password123!"
        });
        Assert.Equal(HttpStatusCode.Conflict, dupUsernameRes.StatusCode);
        var dupUserError = await dupUsernameRes.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.Equal("Username already exists", dupUserError?.Error);

        // Duplicate email (case-insensitive)
        var dupEmailRes = await client.PostAsJsonAsync("/api/auth/register", new {
            Username = "TenantUser2",
            Email = "USER1@EXAMPLE.COM",
            Password = "Password123!"
        });
        Assert.Equal(HttpStatusCode.Conflict, dupEmailRes.StatusCode);
        var dupEmailError = await dupEmailRes.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.Equal("Email already in use", dupEmailError?.Error);
    }

    [Fact]
    public async Task Register_AutomaticallyCreates_DefaultGeneralSpace() {
        var factory = new CustomWebApplicationFactory();
        var client = factory.CreateClient();

        var regRes = await client.PostAsJsonAsync("/api/auth/register", new {
            Username = "WorkspaceUser",
            Email = "workspace@example.com",
            Password = "Password123!"
        });
        Assert.Equal(HttpStatusCode.OK, regRes.StatusCode);
        var auth = await regRes.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth?.Token);

        var authClient = CreateClientWithAuth(factory, auth.Token);
        var spacesRes = await authClient.GetFromJsonAsync<List<SpaceDto>>("/api/spaces");
        Assert.NotNull(spacesRes);
        Assert.Single(spacesRes);
        Assert.Equal("General", spacesRes[0].Name);
        Assert.Equal(0, spacesRes[0].Position);
        Assert.Null(spacesRes[0].ParentSpaceId);
    }

    [Fact]
    public async Task MultiTenant_StrictDataIsolation_AcrossAllResources() {
        var factory = new CustomWebApplicationFactory();
        var anonClient = factory.CreateClient();

        // 1. User A registers via POST /api/auth/register
        var regARes = await anonClient.PostAsJsonAsync("/api/auth/register", new {
            Username = "UserA",
            Email = "usera@example.com",
            Password = "PasswordA123!"
        });
        Assert.Equal(HttpStatusCode.OK, regARes.StatusCode);
        var authA = await regARes.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(authA?.Token);
        var clientA = CreateClientWithAuth(factory, authA.Token);

        // 2. User B registers via POST /api/auth/register
        var regBRes = await anonClient.PostAsJsonAsync("/api/auth/register", new {
            Username = "UserB",
            Email = "userb@example.com",
            Password = "PasswordB123!"
        });
        Assert.Equal(HttpStatusCode.OK, regBRes.StatusCode);
        var authB = await regBRes.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(authB?.Token);
        var clientB = CreateClientWithAuth(factory, authB.Token);

        // 3. User A creates a space and a note with blocks
        var spaceARes = await clientA.PostAsJsonAsync("/api/spaces", new {
            Name = "User A Private Space"
        });
        Assert.Equal(HttpStatusCode.Created, spaceARes.StatusCode);
        var spaceA = await spaceARes.Content.ReadFromJsonAsync<SpaceDto>();
        Assert.NotNull(spaceA);

        var noteARes = await clientA.PostAsJsonAsync("/api/notes", new {
            Title = "User A Confidential Plan",
            Color = "#fef08a",
            SpaceId = spaceA.Id
        });
        Assert.Equal(HttpStatusCode.Created, noteARes.StatusCode);
        var noteA = await noteARes.Content.ReadFromJsonAsync<NoteDto>();
        Assert.NotNull(noteA);

        var blockARes = await clientA.PostAsJsonAsync($"/api/notes/{noteA.Id}/blocks", new {
            Type = "text",
            ContentJson = "{\"text\":\"User A Top Secret Details\",\"level\":\"paragraph\"}",
            Position = 0
        });
        Assert.Equal(HttpStatusCode.Created, blockARes.StatusCode);
        var blockA = await blockARes.Content.ReadFromJsonAsync<BlockDto>();
        Assert.NotNull(blockA);

        // User B creates their own note
        var noteBRes = await clientB.PostAsJsonAsync("/api/notes", new {
            Title = "User B Shopping List",
            Color = "#ffffff"
        });
        Assert.Equal(HttpStatusCode.Created, noteBRes.StatusCode);
        var noteB = await noteBRes.Content.ReadFromJsonAsync<NoteDto>();
        Assert.NotNull(noteB);

        // 4. User B calling GET /api/notes sees only User B's notes (not User A's)
        var notesB = await clientB.GetFromJsonAsync<List<NoteDto>>("/api/notes");
        Assert.NotNull(notesB);
        Assert.Contains(notesB, n => n.Id == noteB.Id);
        Assert.DoesNotContain(notesB, n => n.Id == noteA.Id);

        // 5. User B calling GET /api/notes/{userA_noteId} gets 404 NotFound
        var getOtherNoteRes = await clientB.GetAsync($"/api/notes/{noteA.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getOtherNoteRes.StatusCode);

        // 6. User B calling PUT /api/notes/{userA_noteId} gets 404 NotFound
        var putOtherNoteRes = await clientB.PutAsJsonAsync($"/api/notes/{noteA.Id}", new {
            Title = "Hacked Title"
        });
        Assert.Equal(HttpStatusCode.NotFound, putOtherNoteRes.StatusCode);

        // 7. User B calling DELETE /api/notes/{userA_noteId} gets 404 NotFound
        var deleteOtherNoteRes = await clientB.DeleteAsync($"/api/notes/{noteA.Id}");
        Assert.Equal(HttpStatusCode.NotFound, deleteOtherNoteRes.StatusCode);

        // User B calling PATCH/PUT /api/blocks/{userA_blockId} gets 404 NotFound
        var patchOtherBlockRes = await clientB.PatchAsJsonAsync($"/api/blocks/{blockA.Id}", new {
            ContentJson = "{\"text\":\"Malicious overwrite\",\"level\":\"paragraph\"}"
        });
        Assert.Equal(HttpStatusCode.NotFound, patchOtherBlockRes.StatusCode);

        // User B calling DELETE /api/blocks/{userA_blockId} gets 404 NotFound
        var deleteOtherBlockRes = await clientB.DeleteAsync($"/api/blocks/{blockA.Id}");
        Assert.Equal(HttpStatusCode.NotFound, deleteOtherBlockRes.StatusCode);

        // 8. User B calling GET /api/spaces sees only User B's spaces (not User A's)
        var spacesB = await clientB.GetFromJsonAsync<List<SpaceDto>>("/api/spaces");
        Assert.NotNull(spacesB);
        Assert.DoesNotContain(spacesB, s => s.Id == spaceA.Id);
        Assert.All(spacesB, s => Assert.NotEqual("User A Private Space", s.Name));

        // User B calling GET /api/spaces/{userA_spaceId} gets 404 NotFound
        var getOtherSpaceRes = await clientB.GetAsync($"/api/spaces/{spaceA.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getOtherSpaceRes.StatusCode);

        // 9. User B calling DELETE /api/spaces/{userA_spaceId} gets 404 NotFound
        var deleteOtherSpaceRes = await clientB.DeleteAsync($"/api/spaces/{spaceA.Id}");
        Assert.Equal(HttpStatusCode.NotFound, deleteOtherSpaceRes.StatusCode);

        // User B cannot move their note into User A's space (returns 400 BadRequest)
        var moveOtherSpaceRes = await clientB.PutAsJsonAsync($"/api/notes/{noteB.Id}/move", new {
            SpaceId = spaceA.Id
        });
        Assert.Equal(HttpStatusCode.BadRequest, moveOtherSpaceRes.StatusCode);

        // User B cannot create a sub-space under User A's space (returns 400 BadRequest)
        var subSpaceCrossTenantRes = await clientB.PostAsJsonAsync("/api/spaces", new {
            Name = "Illegal Sub Space",
            ParentSpaceId = spaceA.Id
        });
        Assert.Equal(HttpStatusCode.BadRequest, subSpaceCrossTenantRes.StatusCode);

        // Search isolation: User B searching for User A's secret content finds nothing
        var searchB = await clientB.GetFromJsonAsync<List<NoteDto>>("/api/search?q=Confidential");
        Assert.NotNull(searchB);
        Assert.Empty(searchB);

        var searchA = await clientA.GetFromJsonAsync<List<NoteDto>>("/api/search?q=Confidential");
        Assert.NotNull(searchA);
        Assert.Single(searchA);
        Assert.Equal(noteA.Id, searchA[0].Id);
    }
}
