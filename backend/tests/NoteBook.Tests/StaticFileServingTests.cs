using System.Net;
using Xunit;

namespace NoteBook.Tests;

public class StaticFileServingTests {
    [Fact]
    public async Task Get_ClientRoute_ReturnsIndexHtml() {
        var factory = new CustomWebApplicationFactory();
        var client = factory.CreateClient();

        var res = await client.GetAsync("/notes/some-id");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal("text/html", res.Content.Headers.ContentType?.MediaType);
    }
}
