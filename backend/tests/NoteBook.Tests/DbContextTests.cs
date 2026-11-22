using Microsoft.EntityFrameworkCore;
using NoteBook.Api.Data;
using NoteBook.Api.Models;
using Xunit;

namespace NoteBook.Tests;

public class DbContextTests {
    [Fact]
    public async Task CanInsertAndRetrieveNoteWithBlocks() {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        using var context = new AppDbContext(options);
        var note = new Note { Id = Guid.NewGuid(), Title = "Shopping", Color = "#f28b82", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        var block = new Block { Id = Guid.NewGuid(), NoteId = note.Id, Type = "checklist", ContentJson = "{\"items\":[]}", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        context.Notes.Add(note);
        context.Blocks.Add(block);
        await context.SaveChangesAsync();

        var retrieved = await context.Notes.Include(n => n.Blocks).FirstOrDefaultAsync(n => n.Id == note.Id);
        Assert.NotNull(retrieved);
        Assert.Single(retrieved.Blocks);
    }

    [Fact]
    public void CanEnsureDatabaseCreated() {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        using var context = new AppDbContext(options);
        var created = context.Database.EnsureCreated();
        Assert.True(created);
    }
}
