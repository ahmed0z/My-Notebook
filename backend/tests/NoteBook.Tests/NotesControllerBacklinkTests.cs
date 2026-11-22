using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Xunit;

namespace NoteBook.Tests;

public class NotesControllerBacklinkTests {
    private async Task<HttpClient> GetAuthenticatedClientAsync() {
        var factory = new CustomWebApplicationFactory();
        var client = factory.CreateClient();

        var username = "user_" + Guid.NewGuid().ToString("N")[..8];
        var setupRes = await client.PostAsJsonAsync("/api/auth/setup", new { Username = username, Password = "Password123!" });
        var auth = await setupRes.Content.ReadFromJsonAsync<AuthTokenResponse>();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }

    [Fact]
    public async Task GetBacklinks_ReturnsReferencingNotes() {
        var client = await GetAuthenticatedClientAsync();

        // Create Note A (Target)
        var resA = await client.PostAsJsonAsync("/api/notes", new { Title = "Design Spec", Color = "#ffffff" });
        var noteA = await resA.Content.ReadFromJsonAsync<NoteDto>();

        // Create Note B (Source)
        var resB = await client.PostAsJsonAsync("/api/notes", new { Title = "Implementation Plan", Color = "#ffffff" });
        var noteB = await resB.Content.ReadFromJsonAsync<NoteDto>();

        // Add block to Note B referencing Note A
        await client.PostAsJsonAsync($"/api/notes/{noteB!.Id}/blocks", new {
            Type = "text",
            ContentJson = "{\"text\":\"Refer to [[Design Spec]] for architecture.\",\"level\":\"paragraph\"}",
            Position = 0
        });

        // Query backlinks of Note A
        var backlinks = await client.GetFromJsonAsync<List<NoteDto>>($"/api/notes/{noteA!.Id}/backlinks");

        Assert.NotNull(backlinks);
        Assert.Single(backlinks);
        Assert.Equal(noteB.Id, backlinks[0].Id);
        Assert.Equal("Implementation Plan", backlinks[0].Title);
    }

    [Fact]
    public async Task GetBacklinks_CircularLinks_DoesNotInfiniteLoop() {
        var client = await GetAuthenticatedClientAsync();

        // Note A links to Note B
        var resA = await client.PostAsJsonAsync("/api/notes", new { Title = "Alpha Note", Color = "#ffffff" });
        var noteA = await resA.Content.ReadFromJsonAsync<NoteDto>();

        // Note B links to Note A
        var resB = await client.PostAsJsonAsync("/api/notes", new { Title = "Beta Note", Color = "#ffffff" });
        var noteB = await resB.Content.ReadFromJsonAsync<NoteDto>();

        await client.PostAsJsonAsync($"/api/notes/{noteA!.Id}/blocks", new {
            Type = "text",
            ContentJson = "{\"text\":\"Check out [[Beta Note]]\",\"level\":\"paragraph\"}",
            Position = 0
        });

        await client.PostAsJsonAsync($"/api/notes/{noteB!.Id}/blocks", new {
            Type = "text",
            ContentJson = "{\"text\":\"Check out [[Alpha Note]]\",\"level\":\"paragraph\"}",
            Position = 0
        });

        // Both calls should succeed without looping
        var backlinksA = await client.GetFromJsonAsync<List<NoteDto>>($"/api/notes/{noteA.Id}/backlinks");
        var backlinksB = await client.GetFromJsonAsync<List<NoteDto>>($"/api/notes/{noteB.Id}/backlinks");

        Assert.NotNull(backlinksA);
        Assert.Single(backlinksA);
        Assert.Equal(noteB.Id, backlinksA[0].Id);

        Assert.NotNull(backlinksB);
        Assert.Single(backlinksB);
        Assert.Equal(noteA.Id, backlinksB[0].Id);
    }

    [Fact]
    public async Task GetBacklinks_UpdatesWhenBlockIsPatched() {
        var client = await GetAuthenticatedClientAsync();

        var resA = await client.PostAsJsonAsync("/api/notes", new { Title = "Target Note", Color = "#ffffff" });
        var noteA = await resA.Content.ReadFromJsonAsync<NoteDto>();

        var resB = await client.PostAsJsonAsync("/api/notes", new { Title = "Source Note", Color = "#ffffff" });
        var noteB = await resB.Content.ReadFromJsonAsync<NoteDto>();

        var blockRes = await client.PostAsJsonAsync($"/api/notes/{noteB!.Id}/blocks", new {
            Type = "text",
            ContentJson = "{\"text\":\"Link to [[Target Note]]\",\"level\":\"paragraph\"}",
            Position = 0
        });
        var block = await blockRes.Content.ReadFromJsonAsync<BlockDto>();

        var backlinksBefore = await client.GetFromJsonAsync<List<NoteDto>>($"/api/notes/{noteA!.Id}/backlinks");
        Assert.Single(backlinksBefore!);

        // Patch block in Note B to remove the link
        var patchRes = await client.PatchAsJsonAsync($"/api/blocks/{block!.Id}", new {
            ContentJson = "{\"text\":\"No links here anymore\",\"level\":\"paragraph\"}"
        });
        Assert.Equal(HttpStatusCode.OK, patchRes.StatusCode);

        var backlinksAfter = await client.GetFromJsonAsync<List<NoteDto>>($"/api/notes/{noteA.Id}/backlinks");
        Assert.NotNull(backlinksAfter);
        Assert.Empty(backlinksAfter);
    }

    [Fact]
    public async Task GetBacklinks_UpdatesWhenBlockIsDeleted() {
        var client = await GetAuthenticatedClientAsync();

        var resA = await client.PostAsJsonAsync("/api/notes", new { Title = "Deleted Block Target", Color = "#ffffff" });
        var noteA = await resA.Content.ReadFromJsonAsync<NoteDto>();

        var resB = await client.PostAsJsonAsync("/api/notes", new { Title = "Deleted Block Source", Color = "#ffffff" });
        var noteB = await resB.Content.ReadFromJsonAsync<NoteDto>();

        var blockRes = await client.PostAsJsonAsync($"/api/notes/{noteB!.Id}/blocks", new {
            Type = "text",
            ContentJson = "{\"text\":\"Temporary link [[Deleted Block Target]]\",\"level\":\"paragraph\"}",
            Position = 0
        });
        var block = await blockRes.Content.ReadFromJsonAsync<BlockDto>();

        var backlinksBefore = await client.GetFromJsonAsync<List<NoteDto>>($"/api/notes/{noteA!.Id}/backlinks");
        Assert.Single(backlinksBefore!);

        // Delete the block
        var delRes = await client.DeleteAsync($"/api/blocks/{block!.Id}");
        Assert.Equal(HttpStatusCode.NoContent, delRes.StatusCode);

        var backlinksAfter = await client.GetFromJsonAsync<List<NoteDto>>($"/api/notes/{noteA.Id}/backlinks");
        Assert.NotNull(backlinksAfter);
        Assert.Empty(backlinksAfter);
    }

    [Fact]
    public async Task GetBacklinks_MatchesByTitle_WhenTargetNoteCreatedAfterLink() {
        var client = await GetAuthenticatedClientAsync();

        // Note A links to "Future Note" before it exists
        var resA = await client.PostAsJsonAsync("/api/notes", new { Title = "Early Note", Color = "#ffffff" });
        var noteA = await resA.Content.ReadFromJsonAsync<NoteDto>();

        await client.PostAsJsonAsync($"/api/notes/{noteA!.Id}/blocks", new {
            Type = "text",
            ContentJson = "{\"text\":\"Looking ahead to [[Future Note]].\",\"level\":\"paragraph\"}",
            Position = 0
        });

        // Now create Future Note
        var resB = await client.PostAsJsonAsync("/api/notes", new { Title = "Future Note", Color = "#ffffff" });
        var noteB = await resB.Content.ReadFromJsonAsync<NoteDto>();

        // Backlinks of Note B should include Note A
        var backlinks = await client.GetFromJsonAsync<List<NoteDto>>($"/api/notes/{noteB!.Id}/backlinks");
        Assert.NotNull(backlinks);
        Assert.Single(backlinks);
        Assert.Equal(noteA.Id, backlinks[0].Id);
    }

    [Fact]
    public async Task GetBacklinks_WhenNoteDoesNotExist_ReturnsNotFound() {
        var client = await GetAuthenticatedClientAsync();

        var res = await client.GetAsync($"/api/notes/{Guid.NewGuid()}/backlinks");
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task GetBacklinks_MultipleReferencesFromSameNote_ReturnsReferencingNoteOnce() {
        var client = await GetAuthenticatedClientAsync();

        var resA = await client.PostAsJsonAsync("/api/notes", new { Title = "Common Target", Color = "#ffffff" });
        var noteA = await resA.Content.ReadFromJsonAsync<NoteDto>();

        var resB = await client.PostAsJsonAsync("/api/notes", new { Title = "Multi Reference Source", Color = "#ffffff" });
        var noteB = await resB.Content.ReadFromJsonAsync<NoteDto>();

        // Block 1 links to Common Target
        await client.PostAsJsonAsync($"/api/notes/{noteB!.Id}/blocks", new {
            Type = "text",
            ContentJson = "{\"text\":\"Block 1 mentions [[Common Target]].\",\"level\":\"paragraph\"}",
            Position = 0
        });

        // Block 2 also links to Common Target
        await client.PostAsJsonAsync($"/api/notes/{noteB.Id}/blocks", new {
            Type = "text",
            ContentJson = "{\"text\":\"Block 2 also mentions [[Common Target]].\",\"level\":\"paragraph\"}",
            Position = 1
        });

        var backlinks = await client.GetFromJsonAsync<List<NoteDto>>($"/api/notes/{noteA!.Id}/backlinks");
        Assert.NotNull(backlinks);
        Assert.Single(backlinks);
        Assert.Equal(noteB.Id, backlinks[0].Id);
    }

    [Fact]
    public async Task GetBacklinks_RenamingTargetNote_UpdatesBacklinksAppropriately() {
        var client = await GetAuthenticatedClientAsync();

        var resA = await client.PostAsJsonAsync("/api/notes", new { Title = "Referencing Note", Color = "#ffffff" });
        var noteA = await resA.Content.ReadFromJsonAsync<NoteDto>();

        var resB = await client.PostAsJsonAsync("/api/notes", new { Title = "Initial Spec", Color = "#ffffff" });
        var noteB = await resB.Content.ReadFromJsonAsync<NoteDto>();

        var blockRes = await client.PostAsJsonAsync($"/api/notes/{noteA!.Id}/blocks", new {
            Type = "text",
            ContentJson = "{\"text\":\"Refer to [[Initial Spec]] for specs.\",\"level\":\"paragraph\"}",
            Position = 0
        });
        var block = await blockRes.Content.ReadFromJsonAsync<BlockDto>();

        // Backlinks of Note B has Note A
        var backlinksBefore = await client.GetFromJsonAsync<List<NoteDto>>($"/api/notes/{noteB!.Id}/backlinks");
        Assert.Single(backlinksBefore!);
        Assert.Equal(noteA.Id, backlinksBefore![0].Id);

        // Rename Note B to "Renamed Spec"
        var updateRes = await client.PutAsJsonAsync($"/api/notes/{noteB.Id}", new { Title = "Renamed Spec" });
        Assert.Equal(HttpStatusCode.OK, updateRes.StatusCode);

        // Note B's backlinks should now be empty because Note A still links to "Initial Spec"
        var backlinksAfterRename = await client.GetFromJsonAsync<List<NoteDto>>($"/api/notes/{noteB.Id}/backlinks");
        Assert.NotNull(backlinksAfterRename);
        Assert.Empty(backlinksAfterRename);

        // Update Note A's block to link to "Renamed Spec"
        await client.PatchAsJsonAsync($"/api/blocks/{block!.Id}", new {
            ContentJson = "{\"text\":\"Now updated to [[Renamed Spec]].\",\"level\":\"paragraph\"}"
        });

        // Backlinks of Note B should now contain Note A again
        var backlinksAfterBlockUpdate = await client.GetFromJsonAsync<List<NoteDto>>($"/api/notes/{noteB.Id}/backlinks");
        Assert.NotNull(backlinksAfterBlockUpdate);
        Assert.Single(backlinksAfterBlockUpdate);
        Assert.Equal(noteA.Id, backlinksAfterBlockUpdate[0].Id);
    }

    [Fact]
    public async Task GetBacklinks_DeletingTargetNote_ReturnsNotFoundAndAllowsNewNoteToReceiveBacklinks() {
        var client = await GetAuthenticatedClientAsync();

        var resA = await client.PostAsJsonAsync("/api/notes", new { Title = "Persistent Note", Color = "#ffffff" });
        var noteA = await resA.Content.ReadFromJsonAsync<NoteDto>();

        var resB = await client.PostAsJsonAsync("/api/notes", new { Title = "Temporary Spec", Color = "#ffffff" });
        var noteB = await resB.Content.ReadFromJsonAsync<NoteDto>();

        await client.PostAsJsonAsync($"/api/notes/{noteA!.Id}/blocks", new {
            Type = "text",
            ContentJson = "{\"text\":\"Links to [[Temporary Spec]].\",\"level\":\"paragraph\"}",
            Position = 0
        });

        var backlinksInitial = await client.GetFromJsonAsync<List<NoteDto>>($"/api/notes/{noteB!.Id}/backlinks");
        Assert.Single(backlinksInitial!);

        // Delete Note B
        var delRes = await client.DeleteAsync($"/api/notes/{noteB.Id}");
        Assert.Equal(HttpStatusCode.NoContent, delRes.StatusCode);

        // Backlinks on deleted note returns 404
        var deletedBacklinkRes = await client.GetAsync($"/api/notes/{noteB.Id}/backlinks");
        Assert.Equal(HttpStatusCode.NotFound, deletedBacklinkRes.StatusCode);

        // Recreate note with same title "Temporary Spec"
        var resC = await client.PostAsJsonAsync("/api/notes", new { Title = "Temporary Spec", Color = "#ffffff" });
        var noteC = await resC.Content.ReadFromJsonAsync<NoteDto>();

        // Note C should now have Note A in its backlinks
        var backlinksRecreated = await client.GetFromJsonAsync<List<NoteDto>>($"/api/notes/{noteC!.Id}/backlinks");
        Assert.NotNull(backlinksRecreated);
        Assert.Single(backlinksRecreated);
        Assert.Equal(noteA.Id, backlinksRecreated[0].Id);
    }

    [Fact]
    public async Task GetBacklinks_MultiUserIsolation_DoesNotCrossResolveBetweenUsers() {
        var factory = new CustomWebApplicationFactory();
        var client1 = factory.CreateClient();
        var client2 = factory.CreateClient();

        // Setup User 1
        var setupRes = await client1.PostAsJsonAsync("/api/auth/setup", new { Username = "user1", Password = "Password1!" });
        var auth1 = await setupRes.Content.ReadFromJsonAsync<AuthTokenResponse>();
        client1.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth1!.Token);

        // User 1 creates User 2
        var createRes = await client1.PostAsJsonAsync("/api/auth/users", new { Username = "user2", Password = "Password2!" });
        Assert.Equal(HttpStatusCode.OK, createRes.StatusCode);

        // User 2 logs in
        var login2Res = await client2.PostAsJsonAsync("/api/auth/login", new { Username = "user2", Password = "Password2!" });
        var auth2 = await login2Res.Content.ReadFromJsonAsync<AuthTokenResponse>();
        client2.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth2!.Token);

        // User 1 creates note "Confidential Strategy"
        var res1 = await client1.PostAsJsonAsync("/api/notes", new { Title = "Confidential Strategy", Color = "#ffffff" });
        var noteUser1 = await res1.Content.ReadFromJsonAsync<NoteDto>();

        // User 2 creates note "Public Research" referencing [[Confidential Strategy]]
        var res2 = await client2.PostAsJsonAsync("/api/notes", new { Title = "Public Research", Color = "#ffffff" });
        var noteUser2 = await res2.Content.ReadFromJsonAsync<NoteDto>();

        await client2.PostAsJsonAsync($"/api/notes/{noteUser2!.Id}/blocks", new {
            Type = "text",
            ContentJson = "{\"text\":\"Referencing [[Confidential Strategy]].\",\"level\":\"paragraph\"}",
            Position = 0
        });

        // User 1 checks backlinks on "Confidential Strategy" - should be EMPTY (User 2 cannot link into User 1's notes)
        var backlinksUser1 = await client1.GetFromJsonAsync<List<NoteDto>>($"/api/notes/{noteUser1!.Id}/backlinks");
        Assert.NotNull(backlinksUser1);
        Assert.Empty(backlinksUser1);

        // User 2 creates their own note titled "Confidential Strategy"
        var res2Own = await client2.PostAsJsonAsync("/api/notes", new { Title = "Confidential Strategy", Color = "#ffffff" });
        var noteUser2Own = await res2Own.Content.ReadFromJsonAsync<NoteDto>();

        // User 2's "Confidential Strategy" should resolve User 2's "Public Research"
        var backlinksUser2 = await client2.GetFromJsonAsync<List<NoteDto>>($"/api/notes/{noteUser2Own!.Id}/backlinks");
        Assert.NotNull(backlinksUser2);
        Assert.Single(backlinksUser2);
        Assert.Equal(noteUser2.Id, backlinksUser2[0].Id);
    }

    private record AuthTokenResponse(string Token, string Username);
    public record NoteDto(Guid Id, string Title, string Color, int Position, bool IsPinned, bool IsArchived, DateTime CreatedAt, DateTime UpdatedAt, List<BlockDto>? Blocks);
    public record BlockDto(Guid Id, Guid NoteId, string Type, string ContentJson, int Position, DateTime CreatedAt, DateTime UpdatedAt);
}
