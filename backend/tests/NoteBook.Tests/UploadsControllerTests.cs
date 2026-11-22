using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NoteBook.Api.DTOs;
using NoteBook.Api.Services;
using Xunit;

namespace NoteBook.Tests;

public class UploadsControllerTests : IDisposable {
    private readonly string _tempUploadsDir;

    public UploadsControllerTests() {
        _tempUploadsDir = Path.Combine(Path.GetTempPath(), "notebook_test_uploads_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_tempUploadsDir);
    }

    public void Dispose() {
        try {
            if (Directory.Exists(_tempUploadsDir)) {
                Directory.Delete(_tempUploadsDir, true);
            }
        } catch {
            // Ignore cleanup errors
        }
    }

    private WebApplicationFactory<Program> CreateFactoryWithCustomConfig(Dictionary<string, string?> configOverrides) {
        return new CustomWebApplicationFactory().WithWebHostBuilder(builder => {
            builder.ConfigureAppConfiguration((context, config) => {
                config.AddInMemoryCollection(configOverrides);
            });
        });
    }

    private async Task<(HttpClient Client, WebApplicationFactory<Program> Factory)> GetAuthenticatedClientAsync(
        Dictionary<string, string?>? configOverrides = null) {
        var overrides = new Dictionary<string, string?> {
            ["Storage:UploadsPath"] = _tempUploadsDir
        };
        if (configOverrides != null) {
            foreach (var kvp in configOverrides) {
                overrides[kvp.Key] = kvp.Value;
            }
        }

        var factory = CreateFactoryWithCustomConfig(overrides);
        var client = factory.CreateClient();

        var username = "user_" + Guid.NewGuid().ToString("N")[..8];
        var setupRes = await client.PostAsJsonAsync("/api/auth/setup", new { Username = username, Password = "Password123!" });
        var auth = await setupRes.Content.ReadFromJsonAsync<AuthTokenResponse>();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return (client, factory);
    }

    [Fact]
    public async Task Upload_ValidImage_ReturnsOkWithMetadata_AndSavesFile() {
        var (client, factory) = await GetAuthenticatedClientAsync();
        using (factory) {
            using var form = new MultipartFormDataContent();
            var imageBytes = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00 }; // PNG header
            var fileContent = new ByteArrayContent(imageBytes);
            fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
            form.Add(fileContent, "file", "test.png");

            var res = await client.PostAsync("/api/uploads", form);

            Assert.True(res.IsSuccessStatusCode, $"Expected success status code, got {res.StatusCode}");
            var body = await res.Content.ReadFromJsonAsync<JsonElement>();
            Assert.True(body.TryGetProperty("url", out var urlProp));
            Assert.True(body.TryGetProperty("filename", out var filenameProp));
            Assert.True(body.TryGetProperty("sizeBytes", out var sizeProp));

            var url = urlProp.GetString();
            Assert.NotNull(url);
            Assert.StartsWith("/uploads/", url);
            Assert.EndsWith(".png", url);
            Assert.Equal(imageBytes.Length, sizeProp.GetInt64());

            // Verify file can be retrieved via static file route
            var getFileRes = await client.GetAsync(url);
            Assert.Equal(HttpStatusCode.OK, getFileRes.StatusCode);
            Assert.Equal("image/png", getFileRes.Content.Headers.ContentType?.MediaType);
        }
    }

    [Fact]
    public async Task Upload_Unauthenticated_ReturnsUnauthorized() {
        var factory = CreateFactoryWithCustomConfig(new Dictionary<string, string?> {
            ["Storage:UploadsPath"] = _tempUploadsDir
        });
        using (factory) {
            var client = factory.CreateClient();
            using var form = new MultipartFormDataContent();
            form.Add(new ByteArrayContent(new byte[] { 1, 2, 3 }), "file", "test.png");

            var res = await client.PostAsync("/api/uploads", form);
            Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        }
    }

    [Fact]
    public async Task Upload_EmptyFile_ReturnsBadRequest() {
        var (client, factory) = await GetAuthenticatedClientAsync();
        using (factory) {
            using var form = new MultipartFormDataContent();
            var emptyContent = new ByteArrayContent(Array.Empty<byte>());
            emptyContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
            form.Add(emptyContent, "file", "empty.png");

            var res = await client.PostAsync("/api/uploads", form);
            Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        }
    }

    [Fact]
    public async Task Upload_NonImageFile_ReturnsBadRequest() {
        var (client, factory) = await GetAuthenticatedClientAsync();
        using (factory) {
            using var form = new MultipartFormDataContent();
            var textContent = new ByteArrayContent("Hello text file"u8.ToArray());
            textContent.Headers.ContentType = new MediaTypeHeaderValue("text/plain");
            form.Add(textContent, "file", "notes.txt");

            var res = await client.PostAsync("/api/uploads", form);
            Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        }
    }

    [Fact]
    public async Task Upload_SvgFile_ReturnsBadRequest_PreventingStoredXss() {
        var (client, factory) = await GetAuthenticatedClientAsync();
        using (factory) {
            using var form = new MultipartFormDataContent();
            var svgContent = new ByteArrayContent("<svg><script>alert('XSS')</script></svg>"u8.ToArray());
            svgContent.Headers.ContentType = new MediaTypeHeaderValue("image/svg+xml");
            form.Add(svgContent, "file", "malicious.svg");

            var res = await client.PostAsync("/api/uploads", form);
            Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        }
    }

    [Fact]
    public async Task Upload_FileExceeding10MB_ReturnsBadRequest() {
        var (client, factory) = await GetAuthenticatedClientAsync();
        using (factory) {
            using var form = new MultipartFormDataContent();
            // 10 MB + 1 byte
            var largeStream = new MemoryStream(new byte[10 * 1024 * 1024 + 1]);
            var streamContent = new StreamContent(largeStream);
            streamContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
            form.Add(streamContent, "file", "large.jpg");

            var res = await client.PostAsync("/api/uploads", form);
            Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        }
    }

    [Fact]
    public async Task Upload_WhenStorageQuotaExceeded_ReturnsInsufficientStorage() {
        // Quota set to 100 bytes
        var config = new Dictionary<string, string?> {
            ["Storage:MaxQuotaBytes"] = "100"
        };
        var (client, factory) = await GetAuthenticatedClientAsync(config);
        using (factory) {
            using var form = new MultipartFormDataContent();
            // File is 200 bytes, exceeding the 100 byte quota
            var fileContent = new ByteArrayContent(new byte[200]);
            fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
            form.Add(fileContent, "file", "too_large_for_quota.png");

            var res = await client.PostAsync("/api/uploads", form);
            // 507 Insufficient Storage
            Assert.Equal(HttpStatusCode.InsufficientStorage, res.StatusCode);
        }
    }

    [Fact]
    public void BlockValidator_ImageBlock_ValidatesUrlPresence() {
        var valid = BlockValidator.Validate("image", "{\"url\":\"/uploads/photo.jpg\",\"caption\":\"Sunset\"}");
        Assert.True(valid.IsValid);

        var invalidMissingUrl = BlockValidator.Validate("image", "{\"caption\":\"No URL\"}");
        Assert.False(invalidMissingUrl.IsValid);

        var validEmptyUrl = BlockValidator.Validate("image", "{\"url\":\"\"}");
        Assert.True(validEmptyUrl.IsValid);

        var invalidNonStringUrl = BlockValidator.Validate("image", "{\"url\":12345}");
        Assert.False(invalidNonStringUrl.IsValid);
    }

    private record AuthTokenResponse(string Token, string Username);
}
