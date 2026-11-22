namespace NoteBook.Api.DTOs;

public record CreateBlockRequest(string Type, string ContentJson, int Position);
public record PatchBlockRequest(string? ContentJson, int? Position);
public record BlockResponse(Guid Id, Guid NoteId, string Type, string ContentJson, int Position, DateTime CreatedAt, DateTime UpdatedAt);
