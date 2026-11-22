using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NoteBook.Api.Data;
using NoteBook.Api.DTOs;
using NoteBook.Api.Models;
using NoteBook.Api.Services;

namespace NoteBook.Api.Controllers;

[ApiController]
[Route("api/notes")]
[Authorize]
public class NotesController : ControllerBase {
    private readonly AppDbContext _context;
    private readonly ILinkParserService _linkParserService;
    private readonly ILogger<NotesController>? _logger;

    public NotesController(AppDbContext context, ILinkParserService linkParserService, ILogger<NotesController>? logger = null) {
        _context = context;
        _linkParserService = linkParserService;
        _logger = logger;
    }

    private Guid GetCurrentUserId() {
        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(idStr, out var id) ? id : Guid.Empty;
    }

    [HttpGet]
    public async Task<IActionResult> GetNotes([FromQuery] Guid? spaceId = null) {
        var userId = GetCurrentUserId();
        var query = _context.Notes
            .Where(n => n.UserId == userId);

        if (spaceId.HasValue) {
            if (spaceId.Value == Guid.Empty) {
                query = query.Where(n => n.SpaceId == null);
            } else {
                query = query.Where(n => n.SpaceId == spaceId.Value);
            }
        }

        var notes = await query
            .Include(n => n.Blocks.OrderBy(b => b.Position))
            .OrderByDescending(n => n.IsPinned)
            .ThenBy(n => n.Position)
            .ThenByDescending(n => n.UpdatedAt)
            .Select(n => new NoteResponse(
                n.Id,
                n.Title,
                n.Color,
                n.Position,
                n.IsPinned,
                n.IsArchived,
                n.CreatedAt,
                n.UpdatedAt,
                n.Blocks.OrderBy(b => b.Position).Take(3).Select(b => new BlockResponse(b.Id, b.NoteId, b.Type, b.ContentJson, b.Position, b.CreatedAt, b.UpdatedAt)).ToList(),
                n.SpaceId
            ))
            .ToListAsync();

        return Ok(notes);
    }

    [HttpPost]
    public async Task<IActionResult> CreateNote([FromBody] CreateNoteRequest request) {
        var userId = GetCurrentUserId();

        Guid? targetSpaceId = null;
        if (request.SpaceId.HasValue && request.SpaceId.Value != Guid.Empty) {
            var spaceExists = await _context.Spaces
                .AnyAsync(s => s.Id == request.SpaceId.Value && s.UserId == userId);
            if (!spaceExists) {
                return BadRequest(new { error = "Target space not found" });
            }
            targetSpaceId = request.SpaceId.Value;
        }

        var maxPosition = await _context.Notes
            .Where(n => n.UserId == userId)
            .MaxAsync(n => (int?)n.Position) ?? -1;
        var note = new Note {
            Id = Guid.NewGuid(),
            UserId = userId,
            Title = request.Title?.Trim() ?? string.Empty,
            Color = string.IsNullOrWhiteSpace(request.Color) ? "#ffffff" : request.Color,
            Position = maxPosition + 1,
            IsPinned = false,
            IsArchived = false,
            SpaceId = targetSpaceId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Notes.Add(note);
        await _context.SaveChangesAsync();

        await _linkParserService.ResolveTargetLinksForNoteAsync(note.Id, note.Title);

        var response = new NoteResponse(
            note.Id,
            note.Title,
            note.Color,
            note.Position,
            note.IsPinned,
            note.IsArchived,
            note.CreatedAt,
            note.UpdatedAt,
            new List<BlockResponse>(),
            note.SpaceId
        );

        return CreatedAtAction(nameof(GetNoteById), new { id = note.Id }, response);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetNoteById(Guid id) {
        var userId = GetCurrentUserId();
        var note = await _context.Notes
            .Include(n => n.Blocks.OrderBy(b => b.Position))
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);

        if (note == null) {
            return NotFound(new { error = "Note not found" });
        }

        var response = new NoteResponse(
            note.Id,
            note.Title,
            note.Color,
            note.Position,
            note.IsPinned,
            note.IsArchived,
            note.CreatedAt,
            note.UpdatedAt,
            note.Blocks.Select(b => new BlockResponse(b.Id, b.NoteId, b.Type, b.ContentJson, b.Position, b.CreatedAt, b.UpdatedAt)).ToList(),
            note.SpaceId
        );

        return Ok(response);
    }

    [HttpGet("{id:guid}/backlinks")]
    public async Task<IActionResult> GetBacklinks(Guid id) {
        var userId = GetCurrentUserId();
        var targetNote = await _context.Notes.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);
        if (targetNote == null) {
            return NotFound(new { error = "Note not found" });
        }

        var sourceNoteIds = await _context.NoteLinks
            .Where(nl => nl.TargetNoteId == id)
            .Select(nl => nl.SourceNoteId)
            .Distinct()
            .ToListAsync();

        if (sourceNoteIds.Count == 0) {
            return Ok(Array.Empty<NoteResponse>());
        }

        var referencingNotes = await _context.Notes
            .Where(n => sourceNoteIds.Contains(n.Id) && n.UserId == userId)
            .OrderByDescending(n => n.UpdatedAt)
            .Select(n => new NoteResponse(
                n.Id,
                n.Title,
                n.Color,
                n.Position,
                n.IsPinned,
                n.IsArchived,
                n.CreatedAt,
                n.UpdatedAt,
                n.Blocks.OrderBy(b => b.Position).Take(3).Select(b => new BlockResponse(b.Id, b.NoteId, b.Type, b.ContentJson, b.Position, b.CreatedAt, b.UpdatedAt)).ToList(),
                n.SpaceId
            ))
            .ToListAsync();

        return Ok(referencingNotes);
    }

    [HttpPut("{id:guid}/move")]
    public async Task<IActionResult> MoveNote(Guid id, [FromBody] MoveNoteRequest request) {
        var userId = GetCurrentUserId();
        var note = await _context.Notes.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);
        if (note == null) {
            return NotFound(new { error = "Note not found" });
        }

        if (request.SpaceId.HasValue && request.SpaceId.Value != Guid.Empty) {
            var spaceExists = await _context.Spaces
                .AnyAsync(s => s.Id == request.SpaceId.Value && s.UserId == userId);
            if (!spaceExists) {
                return BadRequest(new { error = "Target space not found" });
            }
            note.SpaceId = request.SpaceId.Value;
        } else {
            note.SpaceId = null;
        }

        note.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new NoteResponse(
            note.Id,
            note.Title,
            note.Color,
            note.Position,
            note.IsPinned,
            note.IsArchived,
            note.CreatedAt,
            note.UpdatedAt,
            null,
            note.SpaceId
        ));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateNote(Guid id, [FromBody] UpdateNoteRequest request) {
        var userId = GetCurrentUserId();
        var note = await _context.Notes.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);
        if (note == null) {
            return NotFound(new { error = "Note not found" });
        }

        if (request.SpaceId.HasValue) {
            if (request.SpaceId.Value == Guid.Empty) {
                note.SpaceId = null;
            } else {
                var spaceExists = await _context.Spaces
                    .AnyAsync(s => s.Id == request.SpaceId.Value && s.UserId == userId);
                if (!spaceExists) {
                    return BadRequest(new { error = "Target space not found" });
                }
                note.SpaceId = request.SpaceId.Value;
            }
        }

        var oldTitle = note.Title;
        if (request.Title != null) note.Title = request.Title.Trim();
        if (request.Color != null) note.Color = request.Color;
        if (request.Position.HasValue) note.Position = request.Position.Value;
        if (request.IsPinned.HasValue) note.IsPinned = request.IsPinned.Value;
        if (request.IsArchived.HasValue) note.IsArchived = request.IsArchived.Value;
        note.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        if (request.Title != null && !string.Equals(oldTitle, note.Title, StringComparison.OrdinalIgnoreCase)) {
            // Detach links that were pointing to this note under its old title (scoped to authenticated user)
            var staleLinks = await _context.NoteLinks
                .Include(nl => nl.SourceNote)
                .Where(nl => nl.TargetNoteId == note.Id && nl.LinkTitle.ToLower() != note.Title.ToLower() && nl.SourceNote != null && nl.SourceNote.UserId == userId)
                .ToListAsync();

            if (staleLinks.Count > 0) {
                foreach (var stale in staleLinks) {
                    stale.TargetNoteId = null;
                }
                await _context.SaveChangesAsync();
            }

            // Resolve any unlinked links matching the new title
            await _linkParserService.ResolveTargetLinksForNoteAsync(note.Id, note.Title);
        }

        return Ok(new NoteResponse(note.Id, note.Title, note.Color, note.Position, note.IsPinned, note.IsArchived, note.CreatedAt, note.UpdatedAt, null, note.SpaceId));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteNote(Guid id) {
        var userId = GetCurrentUserId();
        var note = await _context.Notes.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);
        if (note == null) {
            return NotFound(new { error = "Note not found" });
        }

        try {
            // Detach incoming links and remove outgoing links belonging to this user
            var relatedLinks = await _context.NoteLinks
                .Include(nl => nl.SourceNote)
                .Where(nl => (nl.TargetNoteId == id && nl.SourceNote != null && nl.SourceNote.UserId == userId) || nl.SourceNoteId == id)
                .ToListAsync();
            foreach (var link in relatedLinks) {
                if (link.TargetNoteId == id) {
                    link.TargetNoteId = null;
                }
                if (link.SourceNoteId == id) {
                    _context.NoteLinks.Remove(link);
                }
            }
            await _context.SaveChangesAsync();
        } catch (Exception ex) {
            _logger?.LogWarning(ex, "NoteLinks cleanup ignored on delete note {Id}", id);
        }

        try {
            // Explicitly remove all blocks for this note to guarantee no foreign key constraint violations
            var blocks = await _context.Blocks.Where(b => b.NoteId == id).ToListAsync();
            if (blocks.Count > 0) {
                _context.Blocks.RemoveRange(blocks);
                await _context.SaveChangesAsync();
            }
        } catch (Exception ex) {
            _logger?.LogWarning(ex, "Blocks cleanup error on delete note {Id}", id);
        }

        _context.Notes.Remove(note);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:guid}/blocks")]
    public async Task<IActionResult> AddBlock(Guid id, [FromBody] CreateBlockRequest request) {
        var userId = GetCurrentUserId();
        var note = await _context.Notes.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);
        if (note == null) {
            return NotFound(new { error = "Note not found" });
        }

        var contentJson = string.IsNullOrWhiteSpace(request.ContentJson) ? "{}" : request.ContentJson;
        var validation = BlockValidator.Validate(request.Type, contentJson);
        if (!validation.IsValid) {
            return BadRequest(new { error = validation.Error });
        }

        var block = new Block {
            Id = Guid.NewGuid(),
            NoteId = id,
            Type = request.Type,
            ContentJson = contentJson,
            Position = request.Position,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Blocks.Add(block);
        note.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _linkParserService.SyncNoteLinksAsync(id);

        var response = new BlockResponse(block.Id, block.NoteId, block.Type, block.ContentJson, block.Position, block.CreatedAt, block.UpdatedAt);
        return Created($"/api/blocks/{block.Id}", response);
    }

    [HttpPut("{id:guid}/blocks/reorder")]
    public async Task<IActionResult> ReorderBlocks(Guid id, [FromBody] ReorderBlocksRequest request) {
        var userId = GetCurrentUserId();
        var note = await _context.Notes.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);
        if (note == null) {
            return NotFound(new { error = "Note not found" });
        }

        var blocks = await _context.Blocks.Where(b => b.NoteId == id).ToListAsync();
        if (request.BlockIds == null || request.BlockIds.Length == 0) {
            return BadRequest(new { error = "BlockIds array is required" });
        }

        for (int i = 0; i < request.BlockIds.Length; i++) {
            var blockId = request.BlockIds[i];
            var block = blocks.FirstOrDefault(b => b.Id == blockId);
            if (block != null) {
                block.Position = i;
                block.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _context.SaveChangesAsync();
        return Ok(new { success = true });
    }
}
