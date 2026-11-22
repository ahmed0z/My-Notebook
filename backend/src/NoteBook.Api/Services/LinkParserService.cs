using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using NoteBook.Api.Data;
using NoteBook.Api.Models;

namespace NoteBook.Api.Services;

public class LinkParserService : ILinkParserService {
    private static readonly Regex LinkRegex = new(@"\[\[([^\[\]\r\n]+)\]\]", RegexOptions.Compiled);
    private readonly AppDbContext _context;

    public LinkParserService(AppDbContext context) {
        _context = context;
    }

    public List<string> ExtractLinks(string? content) {
        if (string.IsNullOrWhiteSpace(content)) {
            return new List<string>();
        }

        var textFragments = new List<string>();

        var trimmed = content.TrimStart();
        if (trimmed.StartsWith('{') || trimmed.StartsWith('[')) {
            try {
                using var doc = JsonDocument.Parse(content);
                CollectStrings(doc.RootElement, textFragments);
            } catch (JsonException) {
                textFragments.Add(content);
            }
        } else {
            textFragments.Add(content);
        }

        var results = new List<string>();
        foreach (var fragment in textFragments) {
            var matches = LinkRegex.Matches(fragment);
            foreach (Match match in matches) {
                var raw = match.Groups[1].Value.Trim();
                if (raw.Contains('|')) {
                    raw = raw.Split('|')[0].Trim();
                }
                // Guard against empty titles and titles exceeding max database length (200 chars)
                if (!string.IsNullOrWhiteSpace(raw) && raw.Length <= 200) {
                    results.Add(raw);
                }
            }
        }

        return results.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    private static void CollectStrings(JsonElement element, List<string> target) {
        switch (element.ValueKind) {
            case JsonValueKind.String:
                var s = element.GetString();
                if (!string.IsNullOrWhiteSpace(s)) {
                    target.Add(s);
                }
                break;
            case JsonValueKind.Array:
                foreach (var item in element.EnumerateArray()) {
                    CollectStrings(item, target);
                }
                break;
            case JsonValueKind.Object:
                foreach (var prop in element.EnumerateObject()) {
                    CollectStrings(prop.Value, target);
                }
                break;
        }
    }

    public async Task SyncNoteLinksAsync(Guid noteId, CancellationToken ct = default) {
        var sourceNote = await _context.Notes.FindAsync(new object[] { noteId }, ct);
        if (sourceNote == null) {
            return;
        }

        var blocks = await _context.Blocks
            .Where(b => b.NoteId == noteId)
            .ToListAsync(ct);

        var linkTitles = blocks
            .SelectMany(b => ExtractLinks(b.ContentJson))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var existingLinks = await _context.NoteLinks
            .Where(nl => nl.SourceNoteId == noteId)
            .ToListAsync(ct);

        // If no links referenced in blocks, clean up any existing links and return without scanning notes
        if (linkTitles.Count == 0) {
            if (existingLinks.Count > 0) {
                _context.NoteLinks.RemoveRange(existingLinks);
                await _context.SaveChangesAsync(ct);
            }
            return;
        }

        // Avoid unbounded table scan: only fetch notes matching extracted link titles for the same user
        var lowerTitles = linkTitles.Select(t => t.ToLower()).ToList();
        var matchingNotes = await _context.Notes
            .Where(n => n.UserId == sourceNote.UserId && lowerTitles.Contains(n.Title.ToLower()))
            .Select(n => new { n.Id, n.Title })
            .ToListAsync(ct);

        var targetNoteMap = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        foreach (var note in matchingNotes) {
            var trimmedTitle = note.Title?.Trim();
            if (!string.IsNullOrWhiteSpace(trimmedTitle) && !targetNoteMap.ContainsKey(trimmedTitle)) {
                targetNoteMap[trimmedTitle] = note.Id;
            }
        }

        // Diffing: keep existing links (preserving Id and CreatedAt), remove unreferenced, add new
        var toDelete = new List<NoteLink>();
        var existingByTitle = new Dictionary<string, NoteLink>(StringComparer.OrdinalIgnoreCase);

        foreach (var existing in existingLinks) {
            var title = existing.LinkTitle.Trim();
            if (!linkTitles.Contains(title, StringComparer.OrdinalIgnoreCase) || existingByTitle.ContainsKey(title)) {
                toDelete.Add(existing);
            } else {
                existingByTitle[title] = existing;
            }
        }

        if (toDelete.Count > 0) {
            _context.NoteLinks.RemoveRange(toDelete);
        }

        var toAdd = new List<NoteLink>();
        foreach (var title in linkTitles) {
            Guid? targetId = targetNoteMap.TryGetValue(title, out var tid) ? tid : null;

            if (existingByTitle.TryGetValue(title, out var existing)) {
                // Preserve existing record (keeps Id and CreatedAt), update TargetNoteId if resolved state changed
                if (existing.TargetNoteId != targetId) {
                    existing.TargetNoteId = targetId;
                }
            } else {
                toAdd.Add(new NoteLink {
                    Id = Guid.NewGuid(),
                    SourceNoteId = noteId,
                    TargetNoteId = targetId,
                    LinkTitle = title,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        if (toAdd.Count > 0) {
            await _context.NoteLinks.AddRangeAsync(toAdd, ct);
        }

        await _context.SaveChangesAsync(ct);
    }

    public async Task ResolveTargetLinksForNoteAsync(Guid noteId, string noteTitle, CancellationToken ct = default) {
        if (string.IsNullOrWhiteSpace(noteTitle)) {
            return;
        }

        var targetNote = await _context.Notes.FindAsync(new object[] { noteId }, ct);
        if (targetNote == null) {
            return;
        }

        var lowerTitle = noteTitle.Trim().ToLower();

        // Only resolve unlinked links within the same user's notes so other users' links aren't stolen
        var unlinkedMatches = await _context.NoteLinks
            .Include(nl => nl.SourceNote)
            .Where(nl => nl.TargetNoteId == null && nl.LinkTitle.ToLower() == lowerTitle && nl.SourceNote != null && nl.SourceNote.UserId == targetNote.UserId)
            .ToListAsync(ct);

        foreach (var link in unlinkedMatches) {
            link.TargetNoteId = noteId;
        }

        if (unlinkedMatches.Count > 0) {
            await _context.SaveChangesAsync(ct);
        }
    }
}
