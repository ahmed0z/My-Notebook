namespace NoteBook.Api.Services;

public class LocalFileStorageService : IFileStorageService {
    public const long DefaultSafeQuotaLimitBytes = 3758096384L; // 3.5 GB safe limit
    public const long DefaultMaxFileSizeBytes = 10485760L;       // 10 MB per file limit

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase) {
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"
    };

    private readonly string _uploadsDirectory;
    private readonly long _maxStorageQuotaBytes;
    private readonly long _maxFileSizeBytes;

    public long MaxStorageQuotaBytes => _maxStorageQuotaBytes;
    public long MaxFileSizeBytes => _maxFileSizeBytes;

    public LocalFileStorageService(IWebHostEnvironment env, IConfiguration configuration) {
        _uploadsDirectory = configuration["Storage:UploadsPath"]
            ?? Path.Combine(env.ContentRootPath, "App_Data", "uploads");

        _maxStorageQuotaBytes = configuration.GetValue<long?>("Storage:MaxQuotaBytes")
            ?? DefaultSafeQuotaLimitBytes;

        _maxFileSizeBytes = configuration.GetValue<long?>("Storage:MaxFileSizeBytes")
            ?? DefaultMaxFileSizeBytes;

        if (!Directory.Exists(_uploadsDirectory)) {
            Directory.CreateDirectory(_uploadsDirectory);
        }
    }

    public Task<long> GetCurrentStorageUsageBytesAsync() {
        if (!Directory.Exists(_uploadsDirectory)) {
            return Task.FromResult(0L);
        }

        var dirInfo = new DirectoryInfo(_uploadsDirectory);
        long total = 0;
        foreach (var file in dirInfo.EnumerateFiles("*", SearchOption.AllDirectories)) {
            try {
                total += file.Length;
            } catch {
                // Ignore transient file lock / deletion errors
            }
        }

        return Task.FromResult(total);
    }

    public async Task<FileUploadResult> SaveFileAsync(
        Stream fileStream,
        string originalFileName,
        string? contentType,
        CancellationToken cancellationToken = default)
    {
        if (fileStream == null) {
            throw new ArgumentNullException(nameof(fileStream));
        }

        var extension = Path.GetExtension(originalFileName)?.ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(extension) || !AllowedExtensions.Contains(extension)) {
            throw new InvalidFileTypeException($"Invalid file type '{extension}'. Allowed extensions: {string.Join(", ", AllowedExtensions)}");
        }

        if (!Directory.Exists(_uploadsDirectory)) {
            Directory.CreateDirectory(_uploadsDirectory);
        }

        long currentUsage = await GetCurrentStorageUsageBytesAsync();
        if (currentUsage >= _maxStorageQuotaBytes) {
            throw new StorageQuotaExceededException("Storage quota exceeded (3.5 GB limit).");
        }

        var uniqueFilename = $"{Guid.NewGuid():N}{extension}";
        var destinationPath = Path.Combine(_uploadsDirectory, uniqueFilename);

        long totalBytesWritten = 0;
        try {
            await using (var outputStream = new FileStream(destinationPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 64 * 1024, useAsync: true)) {
                var buffer = new byte[64 * 1024];
                int bytesRead;

                while ((bytesRead = await fileStream.ReadAsync(buffer, 0, buffer.Length, cancellationToken)) > 0) {
                    totalBytesWritten += bytesRead;

                    if (totalBytesWritten > _maxFileSizeBytes) {
                        throw new FileTooLargeException($"File size exceeds {_maxFileSizeBytes / (1024 * 1024)} MB limit.");
                    }

                    if (currentUsage + totalBytesWritten > _maxStorageQuotaBytes) {
                        throw new StorageQuotaExceededException("Storage quota exceeded (3.5 GB limit).");
                    }

                    await outputStream.WriteAsync(buffer.AsMemory(0, bytesRead), cancellationToken);
                }
            }

            if (totalBytesWritten == 0) {
                throw new ArgumentException("Uploaded file is empty.");
            }
        }
        catch {
            if (File.Exists(destinationPath)) {
                try {
                    File.Delete(destinationPath);
                } catch {
                    // Ignore deletion error
                }
            }
            throw;
        }

        return new FileUploadResult($"/uploads/{uniqueFilename}", uniqueFilename, totalBytesWritten);
    }

    public Task<bool> DeleteFileAsync(string filename) {
        var safeFilename = Path.GetFileName(filename);
        var path = Path.Combine(_uploadsDirectory, safeFilename);
        if (File.Exists(path)) {
            try {
                File.Delete(path);
                return Task.FromResult(true);
            } catch {
                return Task.FromResult(false);
            }
        }
        return Task.FromResult(false);
    }

    public string GetPhysicalPath(string filename) {
        var safeFilename = Path.GetFileName(filename);
        return Path.Combine(_uploadsDirectory, safeFilename);
    }
}
