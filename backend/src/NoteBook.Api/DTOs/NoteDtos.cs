namespace NoteBook.Api.DTOs;

public record CreateNoteRequest(string Title, string? Color = null, Guid? SpaceId = null);
public record UpdateNoteRequest(string? Title, string? Color, int? Position, bool? IsPinned, bool? IsArchived, Guid? SpaceId = null);
public record NoteResponse(Guid Id, string Title, string Color, int Position, bool IsPinned, bool IsArchived, DateTime CreatedAt, DateTime UpdatedAt, List<BlockResponse>? Blocks, Guid? SpaceId = null);
public record ReorderBlocksRequest(Guid[] BlockIds);
