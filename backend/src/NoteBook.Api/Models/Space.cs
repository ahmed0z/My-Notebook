namespace NoteBook.Api.Models;

public class Space {
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public Guid? ParentSpaceId { get; set; }
    public Space? ParentSpace { get; set; }
    public List<Space> SubSpaces { get; set; } = new();
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public int Position { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<Note> Notes { get; set; } = new();
}
