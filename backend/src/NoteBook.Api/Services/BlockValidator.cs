using System.Text.Json;

namespace NoteBook.Api.Services;

public static class BlockValidator {
    public static (bool IsValid, string? Error) Validate(string type, string contentJson) {
        if (string.IsNullOrWhiteSpace(contentJson)) {
            return (false, "Content cannot be empty");
        }

        JsonDocument doc;
        try {
            doc = JsonDocument.Parse(contentJson);
        } catch {
            return (false, "Malformed JSON content");
        }

        using (doc) {
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) {
                return (false, "Content must be a JSON object");
            }

            if (type.ToLower() == "text") {
                if (root.TryGetProperty("level", out var levelProp)) {
                    var lvl = levelProp.GetString();
                    var allowed = new[] { "paragraph", "h1", "h2", "h3" };
                    if (lvl != null && !allowed.Contains(lvl)) {
                        return (false, $"Invalid text level: {lvl}");
                    }
                }
            } else if (type.ToLower() == "table") {
                if (!root.TryGetProperty("columns", out var colsProp) || colsProp.ValueKind != JsonValueKind.Array) {
                    return (false, "Table block requires a 'columns' array");
                }
                if (!root.TryGetProperty("rows", out var rowsProp) || rowsProp.ValueKind != JsonValueKind.Array) {
                    return (false, "Table block requires a 'rows' array");
                }

                int expectedCols = colsProp.GetArrayLength();
                foreach (var row in rowsProp.EnumerateArray()) {
                    if (row.ValueKind != JsonValueKind.Array) {
                        return (false, "Each table row must be an array");
                    }
                    if (row.GetArrayLength() != expectedCols) {
                        return (false, $"Table row cell count ({row.GetArrayLength()}) does not match columns length ({expectedCols})");
                    }
                }
            } else if (type.ToLower() == "checklist") {
                if (!root.TryGetProperty("items", out var itemsProp) || itemsProp.ValueKind != JsonValueKind.Array) {
                    return (false, "Checklist block requires an 'items' array");
                }
            } else if (type.ToLower() == "image") {
                if (!root.TryGetProperty("url", out var urlProp) || urlProp.ValueKind != JsonValueKind.String) {
                    return (false, "Image block requires a 'url' string");
                }
            }
        }

        return (true, null);
    }
}
