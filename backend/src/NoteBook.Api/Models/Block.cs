namespace NoteBook.Api.Models;

public class Block {
    public Guid Id { get; set; }
    public Guid NoteId { get; set; }
    public Note? Note { get; set; }
    public string Type { get; set; } = "text";
    public string ContentJson { get; set; } = "{}";
    public int Position { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
