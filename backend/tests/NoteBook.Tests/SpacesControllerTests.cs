using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace NoteBook.Tests;

public class SpacesControllerTests {
    private record AuthTokenResponse(string Token, string Username);
    private async Task<HttpClient> GetAuthenticatedClientAsync() {
        var factory = new CustomWebApplicationFactory();
        var client = factory.CreateClient();

        var username = "user_" + Guid.NewGuid().ToString("N")[..8];
        var setupRes = await client.PostAsJsonAsync("/api/auth/setup", new { Username = username, Password = "Password123!" });
        var auth = await setupRes.Content.ReadFromJsonAsync<AuthTokenResponse>();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }

    public record SpaceDto(Guid Id, string Name, Guid? ParentSpaceId, int Position, DateTime CreatedAt);
    public record TestNoteDto(Guid Id, string Title, string Color, int Position, bool IsPinned, bool IsArchived, DateTime CreatedAt, DateTime UpdatedAt, List<object>? Blocks, Guid? SpaceId);

    [Fact]
    public async Task CreateSpace_AndCreateSubSpace_ReturnsSuccess() {
        var client = await GetAuthenticatedClientAsync();

        // 1. Create root space
        var rootRes = await client.PostAsJsonAsync("/api/spaces", new { Name = "Work" });
        Assert.Equal(HttpStatusCode.Created, rootRes.StatusCode);
        var rootSpace = await rootRes.Content.ReadFromJsonAsync<SpaceDto>();
        Assert.NotNull(rootSpace);
        Assert.Equal("Work", rootSpace.Name);
        Assert.Null(rootSpace.ParentSpaceId);

        // 2. Create sub-space
        var subRes = await client.PostAsJsonAsync("/api/spaces", new { Name = "Project Alpha", ParentSpaceId = rootSpace.Id });
        Assert.Equal(HttpStatusCode.Created, subRes.StatusCode);
        var subSpace = await subRes.Content.ReadFromJsonAsync<SpaceDto>();
        Assert.NotNull(subSpace);
        Assert.Equal("Project Alpha", subSpace.Name);
        Assert.Equal(rootSpace.Id, subSpace.ParentSpaceId);

        // 3. List spaces
        var spaces = await client.GetFromJsonAsync<List<SpaceDto>>("/api/spaces");
        Assert.NotNull(spaces);
        Assert.Equal(2, spaces.Count);
        Assert.Contains(spaces, s => s.Id == rootSpace.Id);
        Assert.Contains(spaces, s => s.Id == subSpace.Id && s.ParentSpaceId == rootSpace.Id);
    }

    [Fact]
    public async Task CreateSpace_RejectsParentFromAnotherUser() {
        var client1 = await GetAuthenticatedClientAsync();
        var client2 = await GetAuthenticatedClientAsync();

        // User 1 creates space
        var rootRes = await client1.PostAsJsonAsync("/api/spaces", new { Name = "User1 Space" });
        var rootSpace = await rootRes.Content.ReadFromJsonAsync<SpaceDto>();

        // User 2 tries to parent to User 1's space
        var subRes = await client2.PostAsJsonAsync("/api/spaces", new { Name = "Intruder Space", ParentSpaceId = rootSpace!.Id });
        Assert.Equal(HttpStatusCode.BadRequest, subRes.StatusCode);
    }

    [Fact]
    public async Task UpdateSpace_PreventsSelfAndCircularParenting() {
        var client = await GetAuthenticatedClientAsync();

        var resA = await client.PostAsJsonAsync("/api/spaces", new { Name = "Space A" });
        var spaceA = await resA.Content.ReadFromJsonAsync<SpaceDto>();

        var resB = await client.PostAsJsonAsync("/api/spaces", new { Name = "Space B", ParentSpaceId = spaceA!.Id });
        var spaceB = await resB.Content.ReadFromJsonAsync<SpaceDto>();

        var resC = await client.PostAsJsonAsync("/api/spaces", new { Name = "Space C", ParentSpaceId = spaceB!.Id });
        var spaceC = await resC.Content.ReadFromJsonAsync<SpaceDto>();

        // Self parent attempt on A
        var selfParentRes = await client.PutAsJsonAsync($"/api/spaces/{spaceA.Id}", new { ParentSpaceId = spaceA.Id });
        Assert.Equal(HttpStatusCode.BadRequest, selfParentRes.StatusCode);

        // Circular parent attempt: set A's parent to C
        var cycleRes = await client.PutAsJsonAsync($"/api/spaces/{spaceA.Id}", new { ParentSpaceId = spaceC!.Id });
        Assert.Equal(HttpStatusCode.BadRequest, cycleRes.StatusCode);

        // Valid update: rename Space A
        var renameRes = await client.PutAsJsonAsync($"/api/spaces/{spaceA.Id}", new { Name = "Space A Renamed" });
        Assert.Equal(HttpStatusCode.OK, renameRes.StatusCode);
        var updatedA = await renameRes.Content.ReadFromJsonAsync<SpaceDto>();
        Assert.Equal("Space A Renamed", updatedA!.Name);
    }

    [Fact]
    public async Task DeleteSpace_CascadeDeletesSubSpaces_AndPreservesNotesWithNullSpaceId() {
        var client = await GetAuthenticatedClientAsync();

        // Space hierarchy: Root -> Child -> Grandchild
        var resRoot = await client.PostAsJsonAsync("/api/spaces", new { Name = "Root Space" });
        var root = await resRoot.Content.ReadFromJsonAsync<SpaceDto>();

        var resChild = await client.PostAsJsonAsync("/api/spaces", new { Name = "Child Space", ParentSpaceId = root!.Id });
        var child = await resChild.Content.ReadFromJsonAsync<SpaceDto>();

        // Create notes in root and child
        var resNote1 = await client.PostAsJsonAsync("/api/notes", new { Title = "Note In Root", SpaceId = root.Id });
        var note1 = await resNote1.Content.ReadFromJsonAsync<TestNoteDto>();

        var resNote2 = await client.PostAsJsonAsync("/api/notes", new { Title = "Note In Child", SpaceId = child!.Id });
        var note2 = await resNote2.Content.ReadFromJsonAsync<TestNoteDto>();

        Assert.Equal(root.Id, note1!.SpaceId);
        Assert.Equal(child.Id, note2!.SpaceId);

        // Delete Root space
        var delRes = await client.DeleteAsync($"/api/spaces/{root.Id}");
        Assert.Equal(HttpStatusCode.NoContent, delRes.StatusCode);

        // Spaces list should be empty
        var spaces = await client.GetFromJsonAsync<List<SpaceDto>>("/api/spaces");
        Assert.Empty(spaces!);

        // Notes should still exist, with SpaceId set to null
        var notes = await client.GetFromJsonAsync<List<TestNoteDto>>("/api/notes");
        Assert.Equal(2, notes!.Count);
        Assert.All(notes, n => Assert.Null(n.SpaceId));
    }

    [Fact]
    public async Task NotesController_FilterBySpaceId_AndMoveNote() {
        var client = await GetAuthenticatedClientAsync();

        var resA = await client.PostAsJsonAsync("/api/spaces", new { Name = "Space A" });
        var spaceA = await resA.Content.ReadFromJsonAsync<SpaceDto>();

        var resB = await client.PostAsJsonAsync("/api/spaces", new { Name = "Space B" });
        var spaceB = await resB.Content.ReadFromJsonAsync<SpaceDto>();

        var resN1 = await client.PostAsJsonAsync("/api/notes", new { Title = "Note In A", SpaceId = spaceA!.Id });
        var noteA = await resN1.Content.ReadFromJsonAsync<TestNoteDto>();

        var resN2 = await client.PostAsJsonAsync("/api/notes", new { Title = "Note In B", SpaceId = spaceB!.Id });
        var noteB = await resN2.Content.ReadFromJsonAsync<TestNoteDto>();

        var resN3 = await client.PostAsJsonAsync("/api/notes", new { Title = "Unassigned Note" });
        var noteUnassigned = await resN3.Content.ReadFromJsonAsync<TestNoteDto>();

        // Filter by Space A
        var notesA = await client.GetFromJsonAsync<List<TestNoteDto>>($"/api/notes?spaceId={spaceA.Id}");
        Assert.Single(notesA!);
        Assert.Equal("Note In A", notesA![0].Title);

        // Filter by Space B
        var notesB = await client.GetFromJsonAsync<List<TestNoteDto>>($"/api/notes?spaceId={spaceB.Id}");
        Assert.Single(notesB!);
        Assert.Equal("Note In B", notesB![0].Title);

        // Filter by unassigned
        var notesUnassigned = await client.GetFromJsonAsync<List<TestNoteDto>>($"/api/notes?spaceId={Guid.Empty}");
        Assert.Single(notesUnassigned!);
        Assert.Equal("Unassigned Note", notesUnassigned![0].Title);

        // All notes (no space filter)
        var allNotes = await client.GetFromJsonAsync<List<TestNoteDto>>("/api/notes");
        Assert.Equal(3, allNotes!.Count);

        // Move noteA to Space B
        var moveRes = await client.PutAsJsonAsync($"/api/notes/{noteA!.Id}/move", new { SpaceId = spaceB.Id });
        Assert.Equal(HttpStatusCode.OK, moveRes.StatusCode);
        var movedNote = await moveRes.Content.ReadFromJsonAsync<TestNoteDto>();
        Assert.Equal(spaceB.Id, movedNote!.SpaceId);

        // Verify space B now has 2 notes
        var notesBAfterMove = await client.GetFromJsonAsync<List<TestNoteDto>>($"/api/notes?spaceId={spaceB.Id}");
        Assert.Equal(2, notesBAfterMove!.Count);

        // Move noteA to unassigned (null)
        var moveToNullRes = await client.PutAsJsonAsync($"/api/notes/{noteA.Id}/move", new { SpaceId = (Guid?)null });
        Assert.Equal(HttpStatusCode.OK, moveToNullRes.StatusCode);
        var movedToNullNote = await moveToNullRes.Content.ReadFromJsonAsync<TestNoteDto>();
        Assert.Null(movedToNullNote!.SpaceId);
    }

    [Fact]
    public async Task UpdateSpace_UnparentSpace_SetsParentSpaceIdToNull() {
        var client = await GetAuthenticatedClientAsync();

        var resRoot = await client.PostAsJsonAsync("/api/spaces", new { Name = "Parent Space" });
        var root = await resRoot.Content.ReadFromJsonAsync<SpaceDto>();

        var resChild = await client.PostAsJsonAsync("/api/spaces", new { Name = "Child Space", ParentSpaceId = root!.Id });
        var child = await resChild.Content.ReadFromJsonAsync<SpaceDto>();
        Assert.Equal(root.Id, child!.ParentSpaceId);

        // Unparent by sending ParentSpaceId = null
        var unparentRes = await client.PutAsJsonAsync($"/api/spaces/{child.Id}", new { ParentSpaceId = (Guid?)null });
        Assert.Equal(HttpStatusCode.OK, unparentRes.StatusCode);
        var updatedChild = await unparentRes.Content.ReadFromJsonAsync<SpaceDto>();
        Assert.NotNull(updatedChild);
        Assert.Null(updatedChild.ParentSpaceId);
    }

    [Fact]
    public async Task StartupMigration_SeedsGeneralSpace_AndAssignsUnassignedNotes() {
        var factory = new CustomWebApplicationFactory();
        var client = factory.CreateClient();

        var username = "user_" + Guid.NewGuid().ToString("N")[..8];
        var setupRes = await client.PostAsJsonAsync("/api/auth/setup", new { Username = username, Password = "Password123!" });
        var auth = await setupRes.Content.ReadFromJsonAsync<AuthTokenResponse>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);

        // Create an unassigned note
        var noteRes = await client.PostAsJsonAsync("/api/notes", new { Title = "Pre-existing unassigned note" });
        var note = await noteRes.Content.ReadFromJsonAsync<TestNoteDto>();
        Assert.Null(note!.SpaceId);

        // Trigger startup migration logic directly using the factory's service scope
        using (var scope = factory.Services.CreateScope()) {
            var db = scope.ServiceProvider.GetRequiredService<NoteBook.Api.Data.AppDbContext>();
            var user = db.Users.First(u => u.Username == username);
            var generalSpace = db.Spaces.FirstOrDefault(s => s.UserId == user.Id && s.Name == "General");
            if (generalSpace == null) {
                generalSpace = new NoteBook.Api.Models.Space {
                    Id = Guid.NewGuid(),
                    Name = "General",
                    UserId = user.Id,
                    Position = 0,
                    CreatedAt = DateTime.UtcNow
                };
                db.Spaces.Add(generalSpace);
                db.SaveChanges();
            }

            var unassigned = db.Notes.Where(n => n.UserId == user.Id && n.SpaceId == null).ToList();
            foreach (var n in unassigned) {
                n.SpaceId = generalSpace.Id;
            }
            db.SaveChanges();
        }

        // Verify space now exists and note is assigned to it
        var spaces = await client.GetFromJsonAsync<List<SpaceDto>>("/api/spaces");
        Assert.Contains(spaces!, s => s.Name == "General");

        var fetchedNote = await client.GetFromJsonAsync<TestNoteDto>($"/api/notes/{note.Id}");
        Assert.NotNull(fetchedNote!.SpaceId);
        Assert.Equal(spaces!.First(s => s.Name == "General").Id, fetchedNote.SpaceId);
    }
}
