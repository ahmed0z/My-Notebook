namespace NoteBook.Api.Services;

public record FileUploadResult(string Url, string Filename, long SizeBytes);

public class StorageQuotaExceededException : Exception {
    public StorageQuotaExceededException(string message) : base(message) { }
}

public class FileTooLargeException : Exception {
    public FileTooLargeException(string message) : base(message) { }
}

public class InvalidFileTypeException : Exception {
    public InvalidFileTypeException(string message) : base(message) { }
}

public interface IFileStorageService {
    long MaxStorageQuotaBytes { get; }
    long MaxFileSizeBytes { get; }
    Task<long> GetCurrentStorageUsageBytesAsync();
    Task<FileUploadResult> SaveFileAsync(Stream fileStream, string originalFileName, string? contentType, CancellationToken cancellationToken = default);
    Task<bool> DeleteFileAsync(string filename);
    string GetPhysicalPath(string filename);
}
