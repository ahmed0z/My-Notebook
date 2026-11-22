namespace NoteBook.Api.DTOs;

public record CreateSpaceRequest(string Name, Guid? ParentSpaceId = null);
public record UpdateSpaceRequest(string? Name, Guid? ParentSpaceId = null, int? Position = null, bool ClearParent = false);
public record SpaceResponse(Guid Id, string Name, Guid? ParentSpaceId, int Position, DateTime CreatedAt);
public record MoveNoteRequest(Guid? SpaceId);
