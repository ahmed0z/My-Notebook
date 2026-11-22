using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NoteBook.Api.Services;

namespace NoteBook.Api.Controllers;

[ApiController]
[Route("api/uploads")]
[Authorize]
public class UploadsController : ControllerBase {
    private readonly IFileStorageService _storageService;

    public UploadsController(IFileStorageService storageService) {
        _storageService = storageService;
    }

    [HttpPost]
    public async Task<IActionResult> UploadImage(IFormFile? file) {
        if (!Request.HasFormContentType) {
            return BadRequest(new { error = "Request must be multipart/form-data" });
        }

        var uploadedFile = file ?? Request.Form.Files.FirstOrDefault();
        if (uploadedFile == null || uploadedFile.Length == 0) {
            return BadRequest(new { error = "No file uploaded or file is empty" });
        }

        if (uploadedFile.Length > _storageService.MaxFileSizeBytes) {
            return BadRequest(new { error = $"File size exceeds {_storageService.MaxFileSizeBytes / (1024 * 1024)} MB limit" });
        }

        var extension = Path.GetExtension(uploadedFile.FileName)?.ToLowerInvariant();
        var allowed = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp" };
        if (string.IsNullOrWhiteSpace(extension) || !allowed.Contains(extension)) {
            return BadRequest(new { error = "Invalid file type. Only image files (jpg, jpeg, png, gif, webp, bmp) are allowed" });
        }

        try {
            await using var stream = uploadedFile.OpenReadStream();
            var result = await _storageService.SaveFileAsync(
                stream,
                uploadedFile.FileName,
                uploadedFile.ContentType,
                HttpContext.RequestAborted);

            return Ok(new {
                url = result.Url,
                filename = result.Filename,
                sizeBytes = result.SizeBytes
            });
        }
        catch (FileTooLargeException ex) {
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidFileTypeException ex) {
            return BadRequest(new { error = ex.Message });
        }
        catch (StorageQuotaExceededException ex) {
            return StatusCode(StatusCodes.Status507InsufficientStorage, new { error = ex.Message });
        }
        catch (ArgumentException ex) {
            return BadRequest(new { error = ex.Message });
        }
    }
}
