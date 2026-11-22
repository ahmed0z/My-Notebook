namespace NoteBook.Api.Models;

public class NoteLink {
    public Guid Id { get; set; }
    public Guid SourceNoteId { get; set; }
    public Note? SourceNote { get; set; }
    public Guid? TargetNoteId { get; set; }
    public Note? TargetNote { get; set; }
    public string LinkTitle { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
