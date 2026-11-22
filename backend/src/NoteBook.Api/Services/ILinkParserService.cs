namespace NoteBook.Api.Services;

public interface ILinkParserService {
    List<string> ExtractLinks(string? content);
    Task SyncNoteLinksAsync(Guid noteId, CancellationToken ct = default);
    Task ResolveTargetLinksForNoteAsync(Guid noteId, string noteTitle, CancellationToken ct = default);
}
