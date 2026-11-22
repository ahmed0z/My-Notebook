using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Xunit;

namespace NoteBook.Tests;

public class NotesControllerTests {
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
    public async Task CreateNote_AndRetrieveList_WorksCorrectly() {
        var client = await GetAuthenticatedClientAsync();
        var res = await client.PostAsJsonAsync("/api/notes", new { Title = "My Note", Color = "#fff475" });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);

        var list = await client.GetFromJsonAsync<List<NoteDto>>("/api/notes");
        Assert.NotNull(list);
        Assert.Contains(list, n => n.Title == "My Note");
    }

    [Fact]
    public async Task PatchBlock_UpdatesContentAndReturnsOk() {
        var client = await GetAuthenticatedClientAsync();
        var noteRes = await client.PostAsJsonAsync("/api/notes", new { Title = "Test Note", Color = "#ffffff" });
        var note = await noteRes.Content.ReadFromJsonAsync<NoteDto>();

        var blockRes = await client.PostAsJsonAsync($"/api/notes/{note!.Id}/blocks", new { Type = "text", ContentJson = "{\"text\":\"Draft\",\"level\":\"paragraph\"}", Position = 0 });
        var block = await blockRes.Content.ReadFromJsonAsync<BlockDto>();

        var patchRes = await client.PatchAsJsonAsync($"/api/blocks/{block!.Id}", new { ContentJson = "{\"text\":\"Updated text\",\"level\":\"paragraph\"}" });
        Assert.Equal(HttpStatusCode.OK, patchRes.StatusCode);

        var getNote = await client.GetFromJsonAsync<NoteDto>($"/api/notes/{note.Id}");
        Assert.NotNull(getNote);
        Assert.Contains("Updated text", getNote.Blocks![0].ContentJson);
    }

    [Fact]
    public async Task ReorderBlocks_UpdatesPositionsAtomically() {
        var client = await GetAuthenticatedClientAsync();
        var noteRes = await client.PostAsJsonAsync("/api/notes", new { Title = "Reorder Note", Color = "#ffffff" });
        var note = await noteRes.Content.ReadFromJsonAsync<NoteDto>();

        var b1Res = await client.PostAsJsonAsync($"/api/notes/{note!.Id}/blocks", new { Type = "text", ContentJson = "{\"text\":\"Block 1\",\"level\":\"paragraph\"}", Position = 0 });
        var b2Res = await client.PostAsJsonAsync($"/api/notes/{note.Id}/blocks", new { Type = "text", ContentJson = "{\"text\":\"Block 2\",\"level\":\"paragraph\"}", Position = 1 });
        var b1 = await b1Res.Content.ReadFromJsonAsync<BlockDto>();
        var b2 = await b2Res.Content.ReadFromJsonAsync<BlockDto>();

        var reorderRes = await client.PutAsJsonAsync($"/api/notes/{note.Id}/blocks/reorder", new { BlockIds = new[] { b2!.Id, b1!.Id } });
        Assert.Equal(HttpStatusCode.OK, reorderRes.StatusCode);

        var getNote = await client.GetFromJsonAsync<NoteDto>($"/api/notes/{note.Id}");
        Assert.Equal(b2.Id, getNote!.Blocks![0].Id);
        Assert.Equal(0, getNote.Blocks[0].Position);
        Assert.Equal(b1.Id, getNote.Blocks[1].Id);
        Assert.Equal(1, getNote.Blocks[1].Position);
    }

    [Fact]
    public async Task PatchBlock_RejectsMalformedTable_WithBadRequest() {
        var client = await GetAuthenticatedClientAsync();
        var noteRes = await client.PostAsJsonAsync("/api/notes", new { Title = "Table Note", Color = "#ffffff" });
        var note = await noteRes.Content.ReadFromJsonAsync<NoteDto>();

        var blockRes = await client.PostAsJsonAsync($"/api/notes/{note!.Id}/blocks", new { Type = "table", ContentJson = "{\"columns\":[\"Col 1\",\"Col 2\"],\"rows\":[[\"A\",\"B\"]]}", Position = 0 });
        var block = await blockRes.Content.ReadFromJsonAsync<BlockDto>();

        // Malformed table: 2 columns, but row only has 1 cell
        var badPatchRes = await client.PatchAsJsonAsync($"/api/blocks/{block!.Id}", new { ContentJson = "{\"columns\":[\"Col 1\",\"Col 2\"],\"rows\":[[\"Only One Cell\"]]}" });
        Assert.Equal(HttpStatusCode.BadRequest, badPatchRes.StatusCode);
    }

    [Fact]
    public async Task GetNotes_IncludesBlocksForCardPreviews() {
        var client = await GetAuthenticatedClientAsync();
        var noteRes = await client.PostAsJsonAsync("/api/notes", new { Title = "Preview Note", Color = "#ffffff" });
        var note = await noteRes.Content.ReadFromJsonAsync<NoteDto>();

        await client.PostAsJsonAsync($"/api/notes/{note!.Id}/blocks", new { Type = "text", ContentJson = "{\"text\":\"Hello preview\",\"level\":\"paragraph\"}", Position = 0 });

        var list = await client.GetFromJsonAsync<List<NoteDto>>("/api/notes");
        var found = list!.FirstOrDefault(n => n.Id == note.Id);
        Assert.NotNull(found);
        Assert.NotNull(found.Blocks);
        Assert.NotEmpty(found.Blocks);
    }

    [Fact]
    public async Task MultiUser_DataIsolation_PreventsCrossUserAccess() {
        var factory = new CustomWebApplicationFactory();
        var client1 = factory.CreateClient();
        var client2 = factory.CreateClient();

        // 1. Setup User 1
        var setupRes = await client1.PostAsJsonAsync("/api/auth/setup", new { Username = "user1", Password = "Password1!" });
        var auth1 = await setupRes.Content.ReadFromJsonAsync<AuthTokenResponse>();
        client1.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth1!.Token);

        // 2. User 1 creates User 2
        var createRes = await client1.PostAsJsonAsync("/api/auth/users", new { Username = "user2", Password = "Password2!" });
        Assert.Equal(HttpStatusCode.OK, createRes.StatusCode);

        // 3. User 2 logs in
        var login2Res = await client2.PostAsJsonAsync("/api/auth/login", new { Username = "user2", Password = "Password2!" });
        Assert.Equal(HttpStatusCode.OK, login2Res.StatusCode);
        var auth2 = await login2Res.Content.ReadFromJsonAsync<AuthTokenResponse>();
        client2.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth2!.Token);

        // 4. User 1 creates Note 1
        var note1Res = await client1.PostAsJsonAsync("/api/notes", new { Title = "User 1 Secret Note", Color = "#ffffff" });
        var note1 = await note1Res.Content.ReadFromJsonAsync<NoteDto>();

        // 5. User 2 creates Note 2
        var note2Res = await client2.PostAsJsonAsync("/api/notes", new { Title = "User 2 Project Note", Color = "#ffffff" });
        var note2 = await note2Res.Content.ReadFromJsonAsync<NoteDto>();

        // 6. User 1 lists notes -> only sees Note 1
        var list1 = await client1.GetFromJsonAsync<List<NoteDto>>("/api/notes");
        Assert.NotNull(list1);
        Assert.Contains(list1, n => n.Id == note1!.Id);
        Assert.DoesNotContain(list1, n => n.Id == note2!.Id);

        // 7. User 2 lists notes -> only sees Note 2
        var list2 = await client2.GetFromJsonAsync<List<NoteDto>>("/api/notes");
        Assert.NotNull(list2);
        Assert.Contains(list2, n => n.Id == note2!.Id);
        Assert.DoesNotContain(list2, n => n.Id == note1!.Id);

        // 8. Cross-user GetById returns 404
        var crossGet1 = await client1.GetAsync($"/api/notes/{note2!.Id}");
        Assert.Equal(HttpStatusCode.NotFound, crossGet1.StatusCode);

        var crossGet2 = await client2.GetAsync($"/api/notes/{note1!.Id}");
        Assert.Equal(HttpStatusCode.NotFound, crossGet2.StatusCode);

        // 9. Cross-user Update returns 404
        var crossUpdate = await client1.PutAsJsonAsync($"/api/notes/{note2.Id}", new { Title = "Hacked Title" });
        Assert.Equal(HttpStatusCode.NotFound, crossUpdate.StatusCode);

        // 10. Cross-user Delete returns 404
        var crossDelete = await client1.DeleteAsync($"/api/notes/{note2.Id}");
        Assert.Equal(HttpStatusCode.NotFound, crossDelete.StatusCode);

        // 11. Cross-user Search isolation
        var searchUser1 = await client1.GetFromJsonAsync<List<NoteDto>>("/api/search?q=Secret");
        Assert.NotNull(searchUser1);
        Assert.Contains(searchUser1, n => n.Id == note1.Id);

        var searchUser2NoSecret = await client2.GetFromJsonAsync<List<NoteDto>>("/api/search?q=Secret");
        Assert.NotNull(searchUser2NoSecret);
        Assert.Empty(searchUser2NoSecret);

        var searchUser2Project = await client2.GetFromJsonAsync<List<NoteDto>>("/api/search?q=Project");
        Assert.NotNull(searchUser2Project);
        Assert.Contains(searchUser2Project, n => n.Id == note2.Id);

        var searchUser1NoProject = await client1.GetFromJsonAsync<List<NoteDto>>("/api/search?q=Project");
        Assert.NotNull(searchUser1NoProject);
        Assert.Empty(searchUser1NoProject);
    }

    private record AuthTokenResponse(string Token, string Username);
    public record NoteDto(Guid Id, string Title, string Color, int Position, bool IsPinned, bool IsArchived, DateTime CreatedAt, DateTime UpdatedAt, List<BlockDto>? Blocks);
    public record BlockDto(Guid Id, Guid NoteId, string Type, string ContentJson, int Position, DateTime CreatedAt, DateTime UpdatedAt);
}
