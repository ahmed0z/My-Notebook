using Microsoft.EntityFrameworkCore;
using NoteBook.Api.Data;
using NoteBook.Api.Models;
using NoteBook.Api.Services;
using Xunit;

namespace NoteBook.Tests;

public class LinkParserServiceTests {
    private AppDbContext CreateDbContext() {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public void ExtractLinks_SingleLink_ReturnsTitle() {
        var db = CreateDbContext();
        var service = new LinkParserService(db);

        var result = service.ExtractLinks("Here is a link to [[My Note]]");

        Assert.Single(result);
        Assert.Equal("My Note", result[0]);
    }

    [Fact]
    public void ExtractLinks_MultipleLinks_ReturnsAllTitles() {
        var db = CreateDbContext();
        var service = new LinkParserService(db);

        var result = service.ExtractLinks("See [[Project Alpha]], [[Project Beta]], and [[Project Gamma]].");

        Assert.Equal(3, result.Count);
        Assert.Contains("Project Alpha", result);
        Assert.Contains("Project Beta", result);
        Assert.Contains("Project Gamma", result);
    }

    [Fact]
    public void ExtractLinks_ObsidianPipedAlias_ReturnsNoteTitleOnly() {
        var db = CreateDbContext();
        var service = new LinkParserService(db);

        var result = service.ExtractLinks("Click [[Project Alpha|Custom Alias]] for details.");

        Assert.Single(result);
        Assert.Equal("Project Alpha", result[0]);
    }

    [Fact]
    public void ExtractLinks_EmptyAndWhitespaceBrackets_ReturnsEmpty() {
        var db = CreateDbContext();
        var service = new LinkParserService(db);

        var result = service.ExtractLinks("Empty [[]] and whitespace [[   ]] and tabs [[ \t\n ]].");

        Assert.Empty(result);
    }

    [Fact]
    public void ExtractLinks_MalformedBrackets_IgnoresInvalid() {
        var db = CreateDbContext();
        var service = new LinkParserService(db);

        var result = service.ExtractLinks("Broken [[unclosed and [single] and normal text but valid [[Valid Note]].");

        Assert.Single(result);
        Assert.Equal("Valid Note", result[0]);
    }

    [Fact]
    public void ExtractLinks_CaseInsensitiveDeduplication_ReturnsDistinctTitle() {
        var db = CreateDbContext();
        var service = new LinkParserService(db);

        var result = service.ExtractLinks("Duplicate [[Project Alpha]] and [[project alpha]] and [[PROJECT ALPHA]].");

        Assert.Single(result);
        Assert.Equal("Project Alpha", result[0]);
    }

    [Fact]
    public void ExtractLinks_FromTextJsonBlock_ExtractsLinks() {
        var db = CreateDbContext();
        var service = new LinkParserService(db);

        var json = "{\"text\":\"Read [[Getting Started]] first.\",\"level\":\"paragraph\"}";
        var result = service.ExtractLinks(json);

        Assert.Single(result);
        Assert.Equal("Getting Started", result[0]);
    }

    [Fact]
    public void ExtractLinks_FromTableJsonBlock_ExtractsLinksFromColumnsAndRows() {
        var db = CreateDbContext();
        var service = new LinkParserService(db);

        var json = "{\"columns\":[\"[[Feature Matrix]]\",\"Status\"],\"rows\":[[\"[[Auth Module]]\",\"Done\"],[\"[[Link Parser]]\",\"WIP\"]]}";
        var result = service.ExtractLinks(json);

        Assert.Equal(3, result.Count);
        Assert.Contains("Feature Matrix", result);
        Assert.Contains("Auth Module", result);
        Assert.Contains("Link Parser", result);
    }

    [Fact]
    public void ExtractLinks_FromChecklistJsonBlock_ExtractsLinksFromItems() {
        var db = CreateDbContext();
        var service = new LinkParserService(db);

        var json = "{\"items\":[{\"text\":\"Finish [[Task One]]\",\"checked\":true},{\"text\":\"Review [[Task Two]]\",\"checked\":false}]}";
        var result = service.ExtractLinks(json);

        Assert.Equal(2, result.Count);
        Assert.Contains("Task One", result);
        Assert.Contains("Task Two", result);
    }

    [Fact]
    public async Task SyncNoteLinksAsync_ResolvesTargetNoteId_CaseInsensitive() {
        var db = CreateDbContext();
        var service = new LinkParserService(db);

        var targetNote = new Note {
            Id = Guid.NewGuid(),
            Title = "Architecture Design",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        var sourceNote = new Note {
            Id = Guid.NewGuid(),
            Title = "Dev Log",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        var block = new Block {
            Id = Guid.NewGuid(),
            NoteId = sourceNote.Id,
            Type = "text",
            ContentJson = "{\"text\":\"Refer to [[architecture design]] for details.\",\"level\":\"paragraph\"}",
            Position = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        db.Notes.AddRange(targetNote, sourceNote);
        db.Blocks.Add(block);
        await db.SaveChangesAsync();

        await service.SyncNoteLinksAsync(sourceNote.Id);

        var links = await db.NoteLinks.Where(nl => nl.SourceNoteId == sourceNote.Id).ToListAsync();
        Assert.Single(links);
        Assert.Equal(targetNote.Id, links[0].TargetNoteId);
        Assert.Equal("architecture design", links[0].LinkTitle);
    }

    [Fact]
    public async Task SyncNoteLinksAsync_TargetNoteDoesNotExist_SetsTargetNoteIdToNull() {
        var db = CreateDbContext();
        var service = new LinkParserService(db);

        var sourceNote = new Note {
            Id = Guid.NewGuid(),
            Title = "Source Note",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        var block = new Block {
            Id = Guid.NewGuid(),
            NoteId = sourceNote.Id,
            Type = "text",
            ContentJson = "{\"text\":\"Refer to [[Future Work]].\",\"level\":\"paragraph\"}",
            Position = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        db.Notes.Add(sourceNote);
        db.Blocks.Add(block);
        await db.SaveChangesAsync();

        await service.SyncNoteLinksAsync(sourceNote.Id);

        var links = await db.NoteLinks.Where(nl => nl.SourceNoteId == sourceNote.Id).ToListAsync();
        Assert.Single(links);
        Assert.Null(links[0].TargetNoteId);
        Assert.Equal("Future Work", links[0].LinkTitle);
    }

    [Fact]
    public async Task SyncNoteLinksAsync_ClearsObsoleteLinks_WhenBlocksChange() {
        var db = CreateDbContext();
        var service = new LinkParserService(db);

        var sourceNote = new Note {
            Id = Guid.NewGuid(),
            Title = "Notes Note",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        var block = new Block {
            Id = Guid.NewGuid(),
            NoteId = sourceNote.Id,
            Type = "text",
            ContentJson = "{\"text\":\"Linking to [[Old Topic]].\",\"level\":\"paragraph\"}",
            Position = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        db.Notes.Add(sourceNote);
        db.Blocks.Add(block);
        await db.SaveChangesAsync();

        await service.SyncNoteLinksAsync(sourceNote.Id);
        var initialLinks = await db.NoteLinks.Where(nl => nl.SourceNoteId == sourceNote.Id).ToListAsync();
        Assert.Single(initialLinks);
        Assert.Equal("Old Topic", initialLinks[0].LinkTitle);

        // Update block to new link
        block.ContentJson = "{\"text\":\"Now linking to [[New Topic]].\",\"level\":\"paragraph\"}";
        await db.SaveChangesAsync();

        await service.SyncNoteLinksAsync(sourceNote.Id);
        var updatedLinks = await db.NoteLinks.Where(nl => nl.SourceNoteId == sourceNote.Id).ToListAsync();
        Assert.Single(updatedLinks);
        Assert.Equal("New Topic", updatedLinks[0].LinkTitle);
    }

    [Fact]
    public void ExtractLinks_Exceeding200Chars_IsIgnored() {
        var db = CreateDbContext();
        var service = new LinkParserService(db);

        var longTitle = new string('A', 201);
        var text = $"Link to [[{longTitle}]] and [[Valid Short Title]]";

        var result = service.ExtractLinks(text);

        Assert.Single(result);
        Assert.Equal("Valid Short Title", result[0]);
    }

    [Fact]
    public async Task SyncNoteLinksAsync_Diffing_PreservesExistingRecordIdAndCreatedAt() {
        var db = CreateDbContext();
        var service = new LinkParserService(db);

        var sourceNote = new Note {
            Id = Guid.NewGuid(),
            Title = "Source Note",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        var block = new Block {
            Id = Guid.NewGuid(),
            NoteId = sourceNote.Id,
            Type = "text",
            ContentJson = "{\"text\":\"Link to [[Stable Topic]] and [[Removable Topic]].\",\"level\":\"paragraph\"}",
            Position = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        db.Notes.Add(sourceNote);
        db.Blocks.Add(block);
        await db.SaveChangesAsync();

        await service.SyncNoteLinksAsync(sourceNote.Id);
        var initialLinks = await db.NoteLinks.Where(nl => nl.SourceNoteId == sourceNote.Id).ToListAsync();
        Assert.Equal(2, initialLinks.Count);

        var stableLinkInitial = initialLinks.Single(l => l.LinkTitle == "Stable Topic");
        var initialId = stableLinkInitial.Id;
        var initialCreatedAt = stableLinkInitial.CreatedAt;

        // Block updated: "Removable Topic" removed, "Brand New Topic" added, "Stable Topic" kept
        block.ContentJson = "{\"text\":\"Link to [[Stable Topic]] and [[Brand New Topic]].\",\"level\":\"paragraph\"}";
        await db.SaveChangesAsync();

        await service.SyncNoteLinksAsync(sourceNote.Id);
        var updatedLinks = await db.NoteLinks.Where(nl => nl.SourceNoteId == sourceNote.Id).ToListAsync();
        Assert.Equal(2, updatedLinks.Count);

        var stableLinkAfter = updatedLinks.Single(l => l.LinkTitle == "Stable Topic");
        Assert.Equal(initialId, stableLinkAfter.Id);
        Assert.Equal(initialCreatedAt, stableLinkAfter.CreatedAt);

        Assert.Contains(updatedLinks, l => l.LinkTitle == "Brand New Topic");
        Assert.DoesNotContain(updatedLinks, l => l.LinkTitle == "Removable Topic");
    }
}
