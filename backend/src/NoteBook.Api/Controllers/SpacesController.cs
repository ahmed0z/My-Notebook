using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NoteBook.Api.Data;
using NoteBook.Api.DTOs;
using NoteBook.Api.Models;

namespace NoteBook.Api.Controllers;

[ApiController]
[Route("api/spaces")]
[Authorize]
public class SpacesController : ControllerBase {
    private readonly AppDbContext _context;

    public SpacesController(AppDbContext context) {
        _context = context;
    }

    private Guid GetCurrentUserId() {
        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(idStr, out var id) ? id : Guid.Empty;
    }

    [HttpGet]
    public async Task<IActionResult> GetSpaces() {
        var userId = GetCurrentUserId();
        var spaces = await _context.Spaces
            .Where(s => s.UserId == userId)
            .OrderBy(s => s.Position)
            .ThenBy(s => s.CreatedAt)
            .Select(s => new SpaceResponse(s.Id, s.Name, s.ParentSpaceId, s.Position, s.CreatedAt))
            .ToListAsync();

        return Ok(spaces);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetSpaceById(Guid id) {
        var userId = GetCurrentUserId();
        var space = await _context.Spaces
            .FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId);

        if (space == null) {
            return NotFound(new { error = "Space not found" });
        }

        return Ok(new SpaceResponse(space.Id, space.Name, space.ParentSpaceId, space.Position, space.CreatedAt));
    }

    [HttpPost]
    public async Task<IActionResult> CreateSpace([FromBody] CreateSpaceRequest request) {
        var userId = GetCurrentUserId();

        if (string.IsNullOrWhiteSpace(request.Name)) {
            return BadRequest(new { error = "Space name is required" });
        }

        if (request.ParentSpaceId.HasValue && request.ParentSpaceId.Value != Guid.Empty) {
            var parentExists = await _context.Spaces
                .AnyAsync(s => s.Id == request.ParentSpaceId.Value && s.UserId == userId);
            if (!parentExists) {
                return BadRequest(new { error = "Parent space not found" });
            }
        }

        var parentId = (request.ParentSpaceId.HasValue && request.ParentSpaceId.Value != Guid.Empty)
            ? request.ParentSpaceId
            : null;

        var maxPosition = await _context.Spaces
            .Where(s => s.UserId == userId && s.ParentSpaceId == parentId)
            .MaxAsync(s => (int?)s.Position) ?? -1;

        var space = new Space {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            ParentSpaceId = parentId,
            UserId = userId,
            Position = maxPosition + 1,
            CreatedAt = DateTime.UtcNow
        };

        _context.Spaces.Add(space);
        await _context.SaveChangesAsync();

        var response = new SpaceResponse(space.Id, space.Name, space.ParentSpaceId, space.Position, space.CreatedAt);
        return CreatedAtAction(nameof(GetSpaceById), new { id = space.Id }, response);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateSpace(Guid id, [FromBody] JsonElement body) {
        var userId = GetCurrentUserId();
        var space = await _context.Spaces
            .FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId);

        if (space == null) {
            return NotFound(new { error = "Space not found" });
        }

        if (body.TryGetProperty("name", out var nameProp) || body.TryGetProperty("Name", out nameProp)) {
            if (nameProp.ValueKind == JsonValueKind.String) {
                var nameVal = nameProp.GetString();
                if (string.IsNullOrWhiteSpace(nameVal)) {
                    return BadRequest(new { error = "Space name cannot be empty" });
                }
                space.Name = nameVal.Trim();
            } else if (nameProp.ValueKind == JsonValueKind.Null) {
                return BadRequest(new { error = "Space name cannot be empty" });
            }
        }

        if (body.TryGetProperty("position", out var posProp) || body.TryGetProperty("Position", out posProp)) {
            if (posProp.ValueKind == JsonValueKind.Number && posProp.TryGetInt32(out var pos)) {
                space.Position = pos;
            }
        }

        bool clearParent = false;
        if ((body.TryGetProperty("clearParent", out var cpProp) || body.TryGetProperty("ClearParent", out cpProp))
            && (cpProp.ValueKind == JsonValueKind.True || (cpProp.ValueKind == JsonValueKind.String && cpProp.GetString()?.ToLower() == "true"))) {
            clearParent = true;
        }

        bool hasParentProp = body.TryGetProperty("parentSpaceId", out var parentProp) || body.TryGetProperty("ParentSpaceId", out parentProp);
        if (hasParentProp) {
            if (parentProp.ValueKind == JsonValueKind.Null) {
                clearParent = true;
            } else if (parentProp.ValueKind == JsonValueKind.String) {
                var parentStr = parentProp.GetString();
                if (string.IsNullOrWhiteSpace(parentStr)) {
                    clearParent = true;
                } else if (Guid.TryParse(parentStr, out var parentGuid)) {
                    if (parentGuid == Guid.Empty) {
                        clearParent = true;
                    } else {
                        var targetParentId = parentGuid;
                        if (targetParentId == id) {
                            return BadRequest(new { error = "A space cannot be its own parent" });
                        }

                        var parent = await _context.Spaces
                            .FirstOrDefaultAsync(s => s.Id == targetParentId && s.UserId == userId);

                        if (parent == null) {
                            return BadRequest(new { error = "Parent space not found" });
                        }

                        // Check for circular reference: traverse upwards from target parent
                        var curr = parent;
                        HashSet<Guid> visited = new();
                        while (curr.ParentSpaceId.HasValue) {
                            if (!visited.Add(curr.Id) || curr.ParentSpaceId.Value == id) {
                                return BadRequest(new { error = "Circular parent space reference is not allowed" });
                            }
                            curr = await _context.Spaces
                                .FirstOrDefaultAsync(s => s.Id == curr.ParentSpaceId.Value && s.UserId == userId);
                            if (curr == null) break;
                        }

                        space.ParentSpaceId = targetParentId;
                    }
                } else {
                    return BadRequest(new { error = "Invalid parentSpaceId" });
                }
            }
        }

        if (clearParent) {
            space.ParentSpaceId = null;
        }

        await _context.SaveChangesAsync();

        return Ok(new SpaceResponse(space.Id, space.Name, space.ParentSpaceId, space.Position, space.CreatedAt));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteSpace(Guid id) {
        var userId = GetCurrentUserId();
        var space = await _context.Spaces
            .FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId);

        if (space == null) {
            return NotFound(new { error = "Space not found" });
        }

        // Collect all descendant spaces belonging to this user
        var allUserSpaces = await _context.Spaces
            .Where(s => s.UserId == userId)
            .ToListAsync();

        var toDeleteIds = new HashSet<Guid> { id };
        bool addedAny;
        do {
            addedAny = false;
            foreach (var s in allUserSpaces) {
                if (s.ParentSpaceId.HasValue && toDeleteIds.Contains(s.ParentSpaceId.Value) && !toDeleteIds.Contains(s.Id)) {
                    toDeleteIds.Add(s.Id);
                    addedAny = true;
                }
            }
        } while (addedAny);

        // Detach notes associated with the space or any child spaces (preserving user notes)
        var notesToDetach = await _context.Notes
            .Where(n => n.UserId == userId && n.SpaceId.HasValue && toDeleteIds.Contains(n.SpaceId.Value))
            .ToListAsync();

        foreach (var note in notesToDetach) {
            note.SpaceId = null;
        }

        // Remove deleted spaces
        var spacesToRemove = allUserSpaces.Where(s => toDeleteIds.Contains(s.Id)).ToList();
        _context.Spaces.RemoveRange(spacesToRemove);

        await _context.SaveChangesAsync();
        return NoContent();
    }
}
