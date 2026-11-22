using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NoteBook.Api.Data;
using NoteBook.Api.DTOs;
using NoteBook.Api.Services;

namespace NoteBook.Api.Controllers;

[ApiController]
[Route("api/blocks")]
[Authorize]
public class BlocksController : ControllerBase {
    private readonly AppDbContext _context;
    private readonly ILinkParserService _linkParserService;

    public BlocksController(AppDbContext context, ILinkParserService linkParserService) {
        _context = context;
        _linkParserService = linkParserService;
    }

    private Guid GetCurrentUserId() {
        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(idStr, out var id) ? id : Guid.Empty;
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> PutBlock(Guid id, [FromBody] PatchBlockRequest request) {
        return await PatchBlock(id, request);
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> PatchBlock(Guid id, [FromBody] PatchBlockRequest request) {
        var userId = GetCurrentUserId();
        var block = await _context.Blocks.Include(b => b.Note).FirstOrDefaultAsync(b => b.Id == id);
        if (block == null || block.Note == null || block.Note.UserId != userId) {
            return NotFound(new { error = "Block not found" });
        }

        if (request.ContentJson != null) {
            var validation = BlockValidator.Validate(block.Type, request.ContentJson);
            if (!validation.IsValid) {
                return BadRequest(new { error = validation.Error });
            }
            block.ContentJson = request.ContentJson;
        }

        if (request.Position.HasValue) {
            block.Position = request.Position.Value;
        }

        block.UpdatedAt = DateTime.UtcNow;

        var note = block.Note;
        note.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        if (request.ContentJson != null) {
            await _linkParserService.SyncNoteLinksAsync(block.NoteId);
        }

        return Ok(new BlockResponse(block.Id, block.NoteId, block.Type, block.ContentJson, block.Position, block.CreatedAt, block.UpdatedAt));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteBlock(Guid id) {
        var userId = GetCurrentUserId();
        var block = await _context.Blocks.Include(b => b.Note).FirstOrDefaultAsync(b => b.Id == id);
        if (block == null || block.Note == null || block.Note.UserId != userId) {
            return NotFound(new { error = "Block not found" });
        }

        var noteId = block.NoteId;
        var note = block.Note;
        note.UpdatedAt = DateTime.UtcNow;

        _context.Blocks.Remove(block);
        await _context.SaveChangesAsync();

        try {
            await _linkParserService.SyncNoteLinksAsync(noteId);
        } catch {
            // non-fatal if links sync encounters schema issue
        }

        return NoContent();
    }
}
