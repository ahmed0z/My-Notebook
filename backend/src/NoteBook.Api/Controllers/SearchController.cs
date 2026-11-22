using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NoteBook.Api.Data;
using NoteBook.Api.DTOs;
using NoteBook.Api.Models;

namespace NoteBook.Api.Controllers;

[ApiController]
[Route("api/search")]
[Authorize]
public class SearchController : ControllerBase {
    private readonly AppDbContext _context;

    public SearchController(AppDbContext context) {
        _context = context;
    }

    private Guid GetCurrentUserId() {
        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(idStr, out var id) ? id : Guid.Empty;
    }

    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] string? q) {
        if (string.IsNullOrWhiteSpace(q)) {
            return Ok(Array.Empty<NoteResponse>());
        }

        var userId = GetCurrentUserId();
        var query = q.Trim();
        IQueryable<Note> notesQuery;

        if (_context.Database.IsNpgsql()) {
            var escapedQuery = query.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
            var pattern = $"%{escapedQuery}%";
            var matchingNoteIdsFromBlocks = await _context.Blocks
                .FromSqlInterpolated($"SELECT b.* FROM \"Blocks\" b INNER JOIN \"Notes\" n ON b.\"NoteId\" = n.\"Id\" WHERE n.\"UserId\" = {userId} AND CAST(b.\"ContentJson\" AS text) ILIKE {pattern}")
                .Select(b => b.NoteId)
                .Distinct()
                .ToListAsync();

            notesQuery = _context.Notes
                .Where(n => n.UserId == userId && !n.IsArchived && (
                    EF.Functions.ILike(n.Title, pattern) ||
                    matchingNoteIdsFromBlocks.Contains(n.Id)
                ));
        } else {
            var lowerTerm = query.ToLower();
            notesQuery = _context.Notes
                .Where(n => n.UserId == userId && !n.IsArchived && (
                    n.Title.ToLower().Contains(lowerTerm) ||
                    n.Blocks.Any(b => b.ContentJson.ToLower().Contains(lowerTerm))
                ));
        }

        var results = await notesQuery
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
                n.Blocks.OrderBy(b => b.Position).Select(b => new BlockResponse(
                    b.Id,
                    b.NoteId,
                    b.Type,
                    b.ContentJson,
                    b.Position,
                    b.CreatedAt,
                    b.UpdatedAt
                )).ToList(),
                n.SpaceId
            ))
            .ToListAsync();

        return Ok(results);
    }
}
