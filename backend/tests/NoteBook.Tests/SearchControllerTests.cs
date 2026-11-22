using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Xunit;

namespace NoteBook.Tests;

public class SearchControllerTests {
    private async Task<(HttpClient Client, CustomWebApplicationFactory Factory)> CreateAuthenticatedClientAsync() {
        var factory = new CustomWebApplicationFactory();
        var client = factory.CreateClient();

        var username = "user_" + Guid.NewGuid().ToString("N")[..8];
        var setupRes = await client.PostAsJsonAsync("/api/auth/setup", new { Username = username, Password = "Password123!" });
        var auth = await setupRes.Content.ReadFromJsonAsync<AuthTokenResponse>();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return (client, factory);
    }

    [Fact]
    public async Task Search_WithoutAuthorization_ReturnsUnauthorized() {
        var factory = new CustomWebApplicationFactory();
        var client = factory.CreateClient();

        var response = await client.GetAsync("/api/search?q=test");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public async Task Search_EmptyOrWhitespaceQuery_ReturnsEmptyList(string? query) {
        var (client, _) = await CreateAuthenticatedClientAsync();
        var url = query == null ? "/api/search" : $"/api/search?q={Uri.EscapeDataString(query)}";

        var response = await client.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var notes = await response.Content.ReadFromJsonAsync<List<NoteDto>>();
        Assert.NotNull(notes);
        Assert.Empty(notes);
    }

    [Fact]
    public async Task Search_MatchesNoteTitle_ReturnsMatchingNote() {
        var (client, _) = await CreateAuthenticatedClientAsync();

        var noteRes = await client.PostAsJsonAsync("/api/notes", new { Title = "Quarterly Roadmap 2026", Color = "#ffffff" });
        var createdNote = await noteRes.Content.ReadFromJsonAsync<NoteDto>();

        // Irrelevant note that should NOT match
        await client.PostAsJsonAsync("/api/notes", new { Title = "Grocery Shopping List", Color = "#ffffff" });

        var searchRes = await client.GetAsync("/api/search?q=Roadmap");
        Assert.Equal(HttpStatusCode.OK, searchRes.StatusCode);

        var results = await searchRes.Content.ReadFromJsonAsync<List<NoteDto>>();
        Assert.NotNull(results);
        Assert.Single(results);
        Assert.Equal(createdNote!.Id, results[0].Id);
        Assert.Equal("Quarterly Roadmap 2026", results[0].Title);
    }

    [Fact]
    public async Task Search_MatchesBlockContentJson_ReturnsMatchingNote() {
        var (client, _) = await CreateAuthenticatedClientAsync();

        var noteRes = await client.PostAsJsonAsync("/api/notes", new { Title = "Random Ideas", Color = "#ffffff" });
        var note = await noteRes.Content.ReadFromJsonAsync<NoteDto>();

        await client.PostAsJsonAsync($"/api/notes/{note!.Id}/blocks", new {
            Type = "text",
            ContentJson = "{\"text\":\"Discussion about Quantum Computing breakthroughs\",\"level\":\"paragraph\"}",
            Position = 0
        });

        // Another note without matching block content
        var otherRes = await client.PostAsJsonAsync("/api/notes", new { Title = "Cooking Recipes", Color = "#ffffff" });
        var otherNote = await otherRes.Content.ReadFromJsonAsync<NoteDto>();
        await client.PostAsJsonAsync($"/api/notes/{otherNote!.Id}/blocks", new {
            Type = "text",
            ContentJson = "{\"text\":\"Delicious pasta bolognese\",\"level\":\"paragraph\"}",
            Position = 0
        });

        var searchRes = await client.GetAsync("/api/search?q=Quantum");
        Assert.Equal(HttpStatusCode.OK, searchRes.StatusCode);

        var results = await searchRes.Content.ReadFromJsonAsync<List<NoteDto>>();
        Assert.NotNull(results);
        Assert.Single(results);
        Assert.Equal(note.Id, results[0].Id);
        Assert.NotNull(results[0].Blocks);
        Assert.NotEmpty(results[0].Blocks!);
    }

    [Fact]
    public async Task Search_IsCaseInsensitive_ForTitleAndBlocks() {
        var (client, _) = await CreateAuthenticatedClientAsync();

        var noteRes = await client.PostAsJsonAsync("/api/notes", new { Title = "UPPERCASE TITLE", Color = "#ffffff" });
        var note = await noteRes.Content.ReadFromJsonAsync<NoteDto>();
        await client.PostAsJsonAsync($"/api/notes/{note!.Id}/blocks", new {
            Type = "text",
            ContentJson = "{\"text\":\"MixedCase BlockContent Value\",\"level\":\"paragraph\"}",
            Position = 0
        });

        // Search with lowercase for uppercase title
        var titleSearch = await client.GetFromJsonAsync<List<NoteDto>>("/api/search?q=uppercase");
        Assert.NotNull(titleSearch);
        Assert.Contains(titleSearch, n => n.Id == note.Id);

        // Search with uppercase for mixed-case block content
        var blockSearch = await client.GetFromJsonAsync<List<NoteDto>>("/api/search?q=MIXEDCASE");
        Assert.NotNull(blockSearch);
        Assert.Contains(blockSearch, n => n.Id == note.Id);
    }

    [Fact]
    public async Task Search_ExcludesArchivedNotes() {
        var (client, _) = await CreateAuthenticatedClientAsync();

        var noteRes = await client.PostAsJsonAsync("/api/notes", new { Title = "Secret Archive Project", Color = "#ffffff" });
        var note = await noteRes.Content.ReadFromJsonAsync<NoteDto>();

        // Archive the note
        await client.PutAsJsonAsync($"/api/notes/{note!.Id}", new { IsArchived = true });

        var searchRes = await client.GetFromJsonAsync<List<NoteDto>>("/api/search?q=Secret");
        Assert.NotNull(searchRes);
        Assert.DoesNotContain(searchRes, n => n.Id == note.Id);
    }

    [Fact]
    public async Task Search_ReturnsNotesOrderedByUpdatedAtDescending() {
        var (client, _) = await CreateAuthenticatedClientAsync();

        var note1Res = await client.PostAsJsonAsync("/api/notes", new { Title = "Common Alpha Topic", Color = "#ffffff" });
        var note1 = await note1Res.Content.ReadFromJsonAsync<NoteDto>();

        // Brief delay or subsequent edit to ensure UpdatedAt timestamp differs
        await Task.Delay(50);

        var note2Res = await client.PostAsJsonAsync("/api/notes", new { Title = "Common Beta Topic", Color = "#ffffff" });
        var note2 = await note2Res.Content.ReadFromJsonAsync<NoteDto>();

        var searchRes = await client.GetFromJsonAsync<List<NoteDto>>("/api/search?q=Common");
        Assert.NotNull(searchRes);
        Assert.True(searchRes.Count >= 2);
        Assert.Equal(note2!.Id, searchRes[0].Id);
        Assert.Equal(note1!.Id, searchRes[1].Id);
    }

    [Fact]
    public async Task Search_PopulatesBlocksInReturnedNote() {
        var (client, _) = await CreateAuthenticatedClientAsync();

        var noteRes = await client.PostAsJsonAsync("/api/notes", new { Title = "Note With Multiple Blocks", Color = "#ffffff" });
        var note = await noteRes.Content.ReadFromJsonAsync<NoteDto>();

        await client.PostAsJsonAsync($"/api/notes/{note!.Id}/blocks", new {
            Type = "text",
            ContentJson = "{\"text\":\"First block matching SearchTarget\",\"level\":\"paragraph\"}",
            Position = 0
        });
        await client.PostAsJsonAsync($"/api/notes/{note.Id}/blocks", new {
            Type = "text",
            ContentJson = "{\"text\":\"Second block details\",\"level\":\"paragraph\"}",
            Position = 1
        });

        var results = await client.GetFromJsonAsync<List<NoteDto>>("/api/search?q=SearchTarget");
        Assert.NotNull(results);
        var matchingNote = results.FirstOrDefault(n => n.Id == note.Id);
        Assert.NotNull(matchingNote);
        Assert.NotNull(matchingNote.Blocks);
        Assert.Equal(2, matchingNote.Blocks.Count);
        Assert.Equal(0, matchingNote.Blocks[0].Position);
        Assert.Equal(1, matchingNote.Blocks[1].Position);
    }

    [Fact]
    public async Task Search_MatchesChecklistItemText_ReturnsMatchingNote() {
        var (client, _) = await CreateAuthenticatedClientAsync();

        var noteRes = await client.PostAsJsonAsync("/api/notes", new { Title = "Weekly Errands", Color = "#ffffff" });
        var note = await noteRes.Content.ReadFromJsonAsync<NoteDto>();

        await client.PostAsJsonAsync($"/api/notes/{note!.Id}/blocks", new {
            Type = "checklist",
            ContentJson = "{\"items\":[{\"id\":\"1\",\"text\":\"Buy organic groceries from farmers market\",\"checked\":false}]}",
            Position = 0
        });

        var results = await client.GetFromJsonAsync<List<NoteDto>>("/api/search?q=groceries");
        Assert.NotNull(results);
        Assert.Contains(results, n => n.Id == note.Id);
    }

    [Fact]
    public async Task Search_MatchesTableCellText_ReturnsMatchingNote() {
        var (client, _) = await CreateAuthenticatedClientAsync();

        var noteRes = await client.PostAsJsonAsync("/api/notes", new { Title = "Staff Directory", Color = "#ffffff" });
        var note = await noteRes.Content.ReadFromJsonAsync<NoteDto>();

        await client.PostAsJsonAsync($"/api/notes/{note!.Id}/blocks", new {
            Type = "table",
            ContentJson = "{\"columns\":[\"Name\",\"Role\"],\"rows\":[[\"Alice\",\"Lead Systems Engineer\"]]}",
            Position = 0
        });

        var results = await client.GetFromJsonAsync<List<NoteDto>>("/api/search?q=Engineer");
        Assert.NotNull(results);
        Assert.Contains(results, n => n.Id == note.Id);
    }

    private record AuthTokenResponse(string Token, string Username);
    public record NoteDto(Guid Id, string Title, string Color, int Position, bool IsPinned, bool IsArchived, DateTime CreatedAt, DateTime UpdatedAt, List<BlockDto>? Blocks);
    public record BlockDto(Guid Id, Guid NoteId, string Type, string ContentJson, int Position, DateTime CreatedAt, DateTime UpdatedAt);
}
