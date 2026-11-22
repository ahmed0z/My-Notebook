# Note-Taking App — Backend API & Shared Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the ASP.NET Web API backend and shared TypeScript package that both the web and mobile frontends will consume.

**Architecture:** RESTful API with JWT auth, EF Core + PostgreSQL, JSONB for block content. Blocks are independent sub-resources of notes with granular PATCH for auto-save. A shared TypeScript package provides types, API client, and validation for both frontends.

**Tech Stack:** .NET (latest stable LTS), ASP.NET Web API, Entity Framework Core, Npgsql (PostgreSQL), BCrypt.Net, System.IdentityModel.Tokens.Jwt, xUnit, WebApplicationFactory. TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-17-note-taking-app-design.md`

## Global Constraints

- MonsterASP free plan: 256 MB RAM, 1 GB database, 5 GB disk, app pool idles on inactivity
- PostgreSQL with JSONB for block content storage
- Single user, JWT authentication, one-time setup endpoint that locks after first use
- Auto-save via debounced PATCH on individual blocks (~1-2s debounce on client side)
- API and static files served from the same ASP.NET application
- No background processes or always-running features

## Review Focus

1. **Out-of-order PATCH requests:** Two rapid edits to the same block could arrive out of order; the API should use `UpdatedAt` to reject stale patches (409 Conflict), preventing silent data loss. → Test added to Task 4.
2. **Setup endpoint replay:** After initial setup, `POST /api/auth/setup` must return 403, not create a second user or overwrite the first. → Test added to Task 2.
3. **Block creation on nonexistent note:** `POST /api/notes/{nonexistent}/blocks` must return 404, not 500. → Test added to Task 4.
4. **JWT expiry handling:** A request with an expired token must return 401, not 500 or a data leak. → Test added to Task 2.
5. **Oversized block content:** A PATCH with a very large content payload (>1 MB) should be rejected with 413, protecting the 256 MB RAM limit. → Test added to Task 4.

---

### Task 1: Project Scaffolding & Database Models

**Files:**
- Create: `backend/MyNoteBook.Api/MyNoteBook.Api.csproj`
- Create: `backend/MyNoteBook.Api/Program.cs`
- Create: `backend/MyNoteBook.Api/appsettings.json`
- Create: `backend/MyNoteBook.Api/appsettings.Development.json`
- Create: `backend/MyNoteBook.Api/Models/User.cs`
- Create: `backend/MyNoteBook.Api/Models/Note.cs`
- Create: `backend/MyNoteBook.Api/Models/Block.cs`
- Create: `backend/MyNoteBook.Api/Data/AppDbContext.cs`
- Create: `backend/MyNoteBook.Api.Tests/MyNoteBook.Api.Tests.csproj`
- Create: `backend/MyNoteBook.Api.Tests/Data/AppDbContextTests.cs`
- Create: `backend/MyNoteBook.sln`

**Interfaces:**
- Consumes: nothing (first task)
- Produces:
  - `User { int Id, string Username, string PasswordHash, DateTime CreatedAt }`
  - `Note { Guid Id, string Title, string Color, int Position, bool IsPinned, bool IsArchived, DateTime CreatedAt, DateTime UpdatedAt, List<Block> Blocks }`
  - `Block { Guid Id, Guid NoteId, string Type, string Content, int Position, DateTime CreatedAt, DateTime UpdatedAt, Note Note }`
  - `AppDbContext : DbContext` with `DbSet<User> Users`, `DbSet<Note> Notes`, `DbSet<Block> Blocks`
  - Block.Content is `string` in C#, mapped to `jsonb` in PostgreSQL via `HasColumnType("jsonb")`
  - Note.Color defaults to `"default"`. Block.Type is one of `"text"`, `"checklist"`, `"table"`.

- [ ] **Step 1: Create the .NET solution and API project**

```bash
mkdir -p backend
cd backend
dotnet new sln -n MyNoteBook
dotnet new webapi -n MyNoteBook.Api --no-openapi
dotnet sln add MyNoteBook.Api
```

Add NuGet packages to `MyNoteBook.Api.csproj`:
- `Npgsql.EntityFrameworkCore.PostgreSQL`
- `BCrypt.Net-Next`
- `Microsoft.AspNetCore.Authentication.JwtBearer`

- [ ] **Step 2: Create the test project**

```bash
cd backend
dotnet new xunit -n MyNoteBook.Api.Tests
dotnet sln add MyNoteBook.Api.Tests
dotnet add MyNoteBook.Api.Tests reference MyNoteBook.Api
```

Add NuGet packages to `MyNoteBook.Api.Tests.csproj`:
- `Microsoft.AspNetCore.Mvc.Testing`
- `Microsoft.EntityFrameworkCore.InMemory`

- [ ] **Step 3: Write the failing test for database schema**

```csharp
// AppDbContextTests.cs
[Fact]
public async Task Database_CreatesSchema_WithAllTables()
{
    var context = CreateInMemoryContext();
    await context.Database.EnsureCreatedAsync();

    Assert.NotNull(context.Users);
    Assert.NotNull(context.Notes);
    Assert.NotNull(context.Blocks);
}

[Fact]
public async Task Note_HasManyBlocks_CascadeDelete()
{
    var context = CreateInMemoryContext();
    await context.Database.EnsureCreatedAsync();
    var note = new Note { Id = Guid.NewGuid(), Title = "Test" };
    var block = new Block { Id = Guid.NewGuid(), NoteId = note.Id, Type = "text", Content = "{\"text\":\"hello\",\"level\":\"paragraph\"}" };
    context.Notes.Add(note);
    context.Blocks.Add(block);
    await context.SaveChangesAsync();

    context.Notes.Remove(note);
    await context.SaveChangesAsync();

    Assert.Empty(await context.Blocks.ToListAsync());
}
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `dotnet test backend/MyNoteBook.Api.Tests --filter "AppDbContextTests" -v n`
Expected: FAIL — `User`, `Note`, `Block`, `AppDbContext` do not exist

- [ ] **Step 5: Implement the models and DbContext**

Create `User.cs`, `Note.cs`, `Block.cs` with the exact properties from the Interfaces block. Create `AppDbContext.cs` with `DbSet` for each entity. Configure in `OnModelCreating`:
- `Block.Content` → `HasColumnType("jsonb")` (PostgreSQL mapping; in-memory provider ignores this)
- `Note` → `Block` one-to-many with cascade delete
- `Block.Position` default value 0
- `Note.Color` default value `"default"`
- Unique index on `User.Username`

Wire up `AppDbContext` in `Program.cs` with PostgreSQL connection string from config.

- [ ] **Step 6: Run tests to verify they pass**

Run: `dotnet test backend/MyNoteBook.Api.Tests --filter "AppDbContextTests" -v n`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat: scaffold .NET project with EF Core models for User, Note, Block"
```

---

### Task 2: Authentication System

**Files:**
- Create: `backend/MyNoteBook.Api/DTOs/AuthDtos.cs`
- Create: `backend/MyNoteBook.Api/Services/AuthService.cs`
- Create: `backend/MyNoteBook.Api/Controllers/AuthController.cs`
- Modify: `backend/MyNoteBook.Api/Program.cs` (add JWT auth middleware)
- Create: `backend/MyNoteBook.Api.Tests/Controllers/AuthControllerTests.cs`
- Create: `backend/MyNoteBook.Api.Tests/TestWebApplicationFactory.cs`

**Interfaces:**
- Consumes: `AppDbContext`, `User` model (from Task 1)
- Produces:
  - `SetupRequest(string Username, string Password)` — record
  - `LoginRequest(string Username, string Password)` — record
  - `AuthResponse(string Token, DateTime ExpiresAt)` — record
  - `AuthService.SetupAsync(SetupRequest) → AuthResponse` — creates user if none exist, throws `InvalidOperationException` if user already exists
  - `AuthService.LoginAsync(LoginRequest) → AuthResponse` — verifies credentials, returns JWT, throws `UnauthorizedAccessException` on bad credentials
  - `POST /api/auth/setup` → 200 `AuthResponse` on success, 403 if already set up
  - `POST /api/auth/login` → 200 `AuthResponse` on success, 401 on bad credentials
  - `GET /api/auth/status` → 200 `{ isSetupComplete: bool }` — unauthenticated endpoint for the frontend to check if setup is needed
  - JWT claims: `sub` = user id, `username` = username
  - `TestWebApplicationFactory<TProgram>` — configures in-memory database, overrides JWT settings for testing

- [ ] **Step 1: Write the failing tests**

```csharp
// AuthControllerTests.cs
[Fact]
public async Task Setup_CreatesUser_ReturnsToken()
{
    var client = _factory.CreateClient();
    var response = await client.PostAsJsonAsync("/api/auth/setup",
        new { Username = "admin", Password = "securepass123" });

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
    Assert.NotNull(auth.Token);
    Assert.True(auth.ExpiresAt > DateTime.UtcNow);
}

[Fact]
public async Task Setup_WhenAlreadySetUp_Returns403()
{
    var client = _factory.CreateClient();
    await client.PostAsJsonAsync("/api/auth/setup",
        new { Username = "admin", Password = "pass123" });

    var response = await client.PostAsJsonAsync("/api/auth/setup",
        new { Username = "other", Password = "pass456" });

    Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
}

[Fact]
public async Task Login_WithValidCredentials_ReturnsToken()
{
    var client = _factory.CreateClient();
    await client.PostAsJsonAsync("/api/auth/setup",
        new { Username = "admin", Password = "pass123" });

    var response = await client.PostAsJsonAsync("/api/auth/login",
        new { Username = "admin", Password = "pass123" });

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
    Assert.NotNull(auth.Token);
}

[Fact]
public async Task Login_WithBadCredentials_Returns401()
{
    var client = _factory.CreateClient();
    await client.PostAsJsonAsync("/api/auth/setup",
        new { Username = "admin", Password = "pass123" });

    var response = await client.PostAsJsonAsync("/api/auth/login",
        new { Username = "admin", Password = "wrong" });

    Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
}

[Fact]
public async Task ProtectedEndpoint_WithExpiredToken_Returns401()
{
    // Create a JWT with exp in the past, send to GET /api/notes
    var client = _factory.CreateClient();
    client.DefaultRequestHeaders.Authorization =
        new AuthenticationHeaderValue("Bearer", CreateExpiredToken());

    var response = await client.GetAsync("/api/notes");

    Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
}

[Fact]
public async Task Status_BeforeSetup_ReturnsNotComplete()
{
    var client = _factory.CreateClient();
    var response = await client.GetAsync("/api/auth/status");

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var body = await response.Content.ReadFromJsonAsync<JsonElement>();
    Assert.False(body.GetProperty("isSetupComplete").GetBoolean());
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test backend/MyNoteBook.Api.Tests --filter "AuthControllerTests" -v n`
Expected: FAIL — controllers, services, DTOs not defined

- [ ] **Step 3: Implement AuthDtos, AuthService, AuthController, JWT middleware**

`AuthDtos.cs`: the three records from the Interfaces block.

`AuthService.cs`: inject `AppDbContext` and JWT settings. `SetupAsync` checks `Users.AnyAsync()` — if true, throw. Otherwise hash password with BCrypt, create user, generate JWT. `LoginAsync` finds user by username, verifies with BCrypt, generates JWT on success.

`AuthController.cs`: three endpoints mapping to service methods. `[AllowAnonymous]` on all three (setup, login, status).

`Program.cs`: configure `AddAuthentication` with `JwtBearerDefaults`, configure token validation parameters (issuer, audience, signing key from config). Add `UseAuthentication` + `UseAuthorization`. Add `[Authorize]` as default policy.

`TestWebApplicationFactory.cs`: inherit `WebApplicationFactory<Program>`, override `ConfigureWebHost` to replace PostgreSQL with in-memory database and set test JWT signing key.

- [ ] **Step 4: Run tests to verify they pass**

Run: `dotnet test backend/MyNoteBook.Api.Tests --filter "AuthControllerTests" -v n`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat: add JWT auth with one-time setup and login endpoints"
```

---

### Task 3: Note CRUD API

**Files:**
- Create: `backend/MyNoteBook.Api/DTOs/NoteDtos.cs`
- Create: `backend/MyNoteBook.Api/Controllers/NotesController.cs`
- Create: `backend/MyNoteBook.Api.Tests/Controllers/NotesControllerTests.cs`

**Interfaces:**
- Consumes: `AppDbContext`, `Note` model (Task 1), `TestWebApplicationFactory`, JWT auth (Task 2)
- Produces:
  - `CreateNoteRequest(string? Title, string? Color)` — record
  - `UpdateNoteRequest(string? Title, string? Color, bool? IsPinned, bool? IsArchived, int? Position)` — record
  - `NoteResponse(Guid Id, string Title, string Color, int Position, bool IsPinned, bool IsArchived, DateTime CreatedAt, DateTime UpdatedAt)` — record
  - `NoteDetailResponse(Guid Id, string Title, string Color, int Position, bool IsPinned, bool IsArchived, DateTime CreatedAt, DateTime UpdatedAt, List<BlockResponse> Blocks)` — record. Define `BlockResponse` as a forward declaration in `NoteDtos.cs` (same shape as Task 4's `BlockResponse`): `BlockResponse(Guid Id, Guid NoteId, string Type, string Content, int Position, DateTime CreatedAt, DateTime UpdatedAt)`. Task 4 moves this to `BlockDtos.cs` and removes the duplicate. Blocks list is empty for newly created notes.
  - `GET /api/notes` → 200 `NoteResponse[]` — returns all non-archived notes, ordered by IsPinned desc then Position asc
  - `GET /api/notes?archived=true` → 200 `NoteResponse[]` — returns archived notes
  - `POST /api/notes` → 201 `NoteDetailResponse` — creates note, auto-assigns Position
  - `GET /api/notes/{id}` → 200 `NoteDetailResponse` with blocks included
  - `PUT /api/notes/{id}` → 200 `NoteDetailResponse` — partial update (only non-null fields applied)
  - `DELETE /api/notes/{id}` → 204 — cascade deletes blocks

- [ ] **Step 1: Write the failing tests**

```csharp
// NotesControllerTests.cs — authenticated via helper that calls setup + login
[Fact]
public async Task CreateNote_ReturnsCreatedNote()
{
    var client = await CreateAuthenticatedClient();
    var response = await client.PostAsJsonAsync("/api/notes",
        new { Title = "My Note", Color = "blue" });

    Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    var note = await response.Content.ReadFromJsonAsync<NoteDetailResponse>();
    Assert.Equal("My Note", note.Title);
    Assert.Equal("blue", note.Color);
    Assert.NotEqual(Guid.Empty, note.Id);
}

[Fact]
public async Task ListNotes_ReturnsNonArchivedNotes_PinnedFirst()
{
    var client = await CreateAuthenticatedClient();
    await client.PostAsJsonAsync("/api/notes", new { Title = "Regular" });
    await client.PostAsJsonAsync("/api/notes", new { Title = "Pinned" });
    // Pin the second note
    var list = await client.GetFromJsonAsync<NoteResponse[]>("/api/notes");
    await client.PutAsJsonAsync($"/api/notes/{list[1].Id}", new { IsPinned = true });

    var response = await client.GetFromJsonAsync<NoteResponse[]>("/api/notes");

    Assert.Equal("Pinned", response[0].Title);
    Assert.Equal("Regular", response[1].Title);
}

[Fact]
public async Task GetNote_NonExistent_Returns404()
{
    var client = await CreateAuthenticatedClient();
    var response = await client.GetAsync($"/api/notes/{Guid.NewGuid()}");
    Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
}

[Fact]
public async Task DeleteNote_RemovesNote_Returns204()
{
    var client = await CreateAuthenticatedClient();
    var create = await client.PostAsJsonAsync("/api/notes", new { Title = "Delete Me" });
    var note = await create.Content.ReadFromJsonAsync<NoteDetailResponse>();

    var response = await client.DeleteAsync($"/api/notes/{note.Id}");

    Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    var get = await client.GetAsync($"/api/notes/{note.Id}");
    Assert.Equal(HttpStatusCode.NotFound, get.StatusCode);
}

[Fact]
public async Task Notes_WithoutAuth_Returns401()
{
    var client = _factory.CreateClient();
    var response = await client.GetAsync("/api/notes");
    Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test backend/MyNoteBook.Api.Tests --filter "NotesControllerTests" -v n`
Expected: FAIL

- [ ] **Step 3: Implement NoteDtos and NotesController**

`NoteDtos.cs`: records from the Interfaces block.

`NotesController.cs`: `[ApiController]`, `[Route("api/notes")]`, `[Authorize]`. Inject `AppDbContext`. Implement CRUD. For `PUT`, apply only non-null fields from `UpdateNoteRequest` and update `UpdatedAt`. For `POST`, auto-assign `Position` as `max(Position) + 1`. For `GET /{id}`, include `Blocks` ordered by `Position`. For `GET` list, filter by `archived` query param, order by `IsPinned desc, Position asc`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `dotnet test backend/MyNoteBook.Api.Tests --filter "NotesControllerTests" -v n`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat: add Note CRUD API with pin, archive, and ordering"
```

---

### Task 4: Block CRUD API with Auto-Save

**Files:**
- Create: `backend/MyNoteBook.Api/DTOs/BlockDtos.cs`
- Create: `backend/MyNoteBook.Api/Controllers/BlocksController.cs`
- Create: `backend/MyNoteBook.Api.Tests/Controllers/BlocksControllerTests.cs`

**Interfaces:**
- Consumes: `AppDbContext`, `Note`, `Block` models (Task 1), `TestWebApplicationFactory`, JWT auth (Task 2), `NoteDetailResponse` (Task 3)
- Produces:
  - `CreateBlockRequest(string Type, string Content, int? Position)` — record
  - `PatchBlockRequest(string? Content, int? Position)` — record. Includes `DateTime? UpdatedAt` for conflict detection.
  - `BlockResponse(Guid Id, Guid NoteId, string Type, string Content, int Position, DateTime CreatedAt, DateTime UpdatedAt)` — record
  - `ReorderBlocksRequest(List<Guid> BlockIds)` — record
  - `POST /api/notes/{noteId}/blocks` → 201 `BlockResponse`
  - `GET /api/notes/{noteId}/blocks` → 200 `BlockResponse[]` ordered by Position
  - `PATCH /api/blocks/{id}` → 200 `BlockResponse` — auto-save endpoint. If `PatchBlockRequest.UpdatedAt` is provided and older than the stored `UpdatedAt`, return 409 Conflict.
  - `DELETE /api/blocks/{id}` → 204
  - `PUT /api/notes/{noteId}/blocks/reorder` → 200 `BlockResponse[]` — receives ordered list of block IDs, updates positions
  - Request body size limit: 1 MB per request (enforced via `[RequestSizeLimit]`). Returns 413 if exceeded.

- [ ] **Step 1: Write the failing tests**

```csharp
// BlocksControllerTests.cs
[Fact]
public async Task CreateBlock_AddsTextBlock_ReturnsCreated()
{
    var client = await CreateAuthenticatedClient();
    var noteId = await CreateTestNote(client);

    var response = await client.PostAsJsonAsync($"/api/notes/{noteId}/blocks",
        new { Type = "text", Content = "{\"text\":\"Hello\",\"level\":\"paragraph\"}" });

    Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    var block = await response.Content.ReadFromJsonAsync<BlockResponse>();
    Assert.Equal("text", block.Type);
    Assert.Equal(noteId, block.NoteId);
}

[Fact]
public async Task CreateBlock_OnNonExistentNote_Returns404()
{
    var client = await CreateAuthenticatedClient();
    var response = await client.PostAsJsonAsync($"/api/notes/{Guid.NewGuid()}/blocks",
        new { Type = "text", Content = "{\"text\":\"Hi\",\"level\":\"paragraph\"}" });

    Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
}

[Fact]
public async Task PatchBlock_UpdatesContent_ReturnsUpdated()
{
    var client = await CreateAuthenticatedClient();
    var noteId = await CreateTestNote(client);
    var blockId = await CreateTestBlock(client, noteId);

    var response = await client.PatchAsJsonAsync($"/api/blocks/{blockId}",
        new { Content = "{\"text\":\"Updated\",\"level\":\"h1\"}" });

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var block = await response.Content.ReadFromJsonAsync<BlockResponse>();
    Assert.Contains("Updated", block.Content);
}

[Fact]
public async Task PatchBlock_WithStaleUpdatedAt_Returns409()
{
    var client = await CreateAuthenticatedClient();
    var noteId = await CreateTestNote(client);
    var blockId = await CreateTestBlock(client, noteId);

    // First patch succeeds
    await client.PatchAsJsonAsync($"/api/blocks/{blockId}",
        new { Content = "{\"text\":\"V2\",\"level\":\"paragraph\"}" });

    // Second patch with stale timestamp
    var staleTime = DateTime.UtcNow.AddMinutes(-5);
    var response = await client.PatchAsJsonAsync($"/api/blocks/{blockId}",
        new { Content = "{\"text\":\"Stale\",\"level\":\"paragraph\"}", UpdatedAt = staleTime });

    Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
}

[Fact]
public async Task PatchBlock_OversizedContent_Returns413()
{
    var client = await CreateAuthenticatedClient();
    var noteId = await CreateTestNote(client);
    var blockId = await CreateTestBlock(client, noteId);

    var hugeContent = new string('x', 1_100_000); // > 1MB
    var response = await client.PatchAsJsonAsync($"/api/blocks/{blockId}",
        new { Content = hugeContent });

    Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
}

[Fact]
public async Task ReorderBlocks_UpdatesPositions()
{
    var client = await CreateAuthenticatedClient();
    var noteId = await CreateTestNote(client);
    var id1 = await CreateTestBlock(client, noteId, "text");
    var id2 = await CreateTestBlock(client, noteId, "checklist");
    var id3 = await CreateTestBlock(client, noteId, "text");

    var response = await client.PutAsJsonAsync($"/api/notes/{noteId}/blocks/reorder",
        new { BlockIds = new[] { id3, id1, id2 } });

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var blocks = await response.Content.ReadFromJsonAsync<BlockResponse[]>();
    Assert.Equal(id3, blocks[0].Id);
    Assert.Equal(id1, blocks[1].Id);
    Assert.Equal(id2, blocks[2].Id);
}

[Fact]
public async Task DeleteBlock_RemovesBlock_Returns204()
{
    var client = await CreateAuthenticatedClient();
    var noteId = await CreateTestNote(client);
    var blockId = await CreateTestBlock(client, noteId);

    var response = await client.DeleteAsync($"/api/blocks/{blockId}");

    Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test backend/MyNoteBook.Api.Tests --filter "BlocksControllerTests" -v n`
Expected: FAIL

- [ ] **Step 3: Implement BlockDtos and BlocksController**

`BlockDtos.cs`: records from the Interfaces block.

`BlocksController.cs`: two route groups — `[Route("api/notes/{noteId}/blocks")]` for note-scoped actions, and `[Route("api/blocks")]` for direct block access. `[Authorize]`.

For `PATCH`: check `PatchBlockRequest.UpdatedAt` — if provided and before the stored `UpdatedAt`, return 409. Apply only non-null fields. Update `UpdatedAt` to `DateTime.UtcNow`.

For `POST`: verify note exists (404 if not). Auto-assign position as `max(Position) + 1` within the note.

For reorder: validate all block IDs belong to the note, update each block's `Position` to its index in the list.

Apply `[RequestSizeLimit(1_048_576)]` on `PATCH` and `POST` endpoints.

- [ ] **Step 4: Run tests to verify they pass**

Run: `dotnet test backend/MyNoteBook.Api.Tests --filter "BlocksControllerTests" -v n`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat: add Block CRUD API with auto-save PATCH and conflict detection"
```

---

### Task 5: Shared TypeScript Package

**Files:**
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/src/types.ts`
- Create: `shared/src/api-client.ts`
- Create: `shared/src/validation.ts`
- Create: `shared/src/constants.ts`
- Create: `shared/src/index.ts`
- Create: `shared/__tests__/validation.test.ts`
- Create: `shared/__tests__/api-client.test.ts`
- Create: `package.json` (monorepo root with npm workspaces)

**Interfaces:**
- Consumes: API contract from Tasks 2-4 (endpoint paths, DTOs)
- Produces:
  - `Note`, `Block`, `NoteDetail`, `CreateNoteRequest`, `UpdateNoteRequest`, `CreateBlockRequest`, `PatchBlockRequest`, `ReorderBlocksRequest`, `AuthResponse`, `SetupRequest`, `LoginRequest` — TypeScript types mirroring C# DTOs
  - `BlockType = "text" | "checklist" | "table"` — union type
  - `TextContent = { text: string; level: "paragraph" | "h1" | "h2" | "h3" }` — type
  - `ChecklistContent = { items: { text: string; checked: boolean }[] }` — type
  - `TableContent = { columns: string[]; rows: string[][] }` — type
  - `BlockContent = TextContent | ChecklistContent | TableContent` — discriminated by `Block.type`
  - `NoteColor` — union of allowed color strings
  - `NOTE_COLORS: NoteColor[]` — array constant
  - `MAX_BLOCK_CONTENT_SIZE = 1_000_000` — constant (bytes)
  - `ApiClient` class: constructor takes `baseUrl: string` and optional `token: string`. Methods:
    - `checkStatus(): Promise<{ isSetupComplete: boolean }>`
    - `setup(req: SetupRequest): Promise<AuthResponse>`
    - `login(req: LoginRequest): Promise<AuthResponse>`
    - `setToken(token: string): void`
    - `listNotes(archived?: boolean): Promise<Note[]>`
    - `createNote(req: CreateNoteRequest): Promise<NoteDetail>`
    - `getNote(id: string): Promise<NoteDetail>`
    - `updateNote(id: string, req: UpdateNoteRequest): Promise<NoteDetail>`
    - `deleteNote(id: string): Promise<void>`
    - `createBlock(noteId: string, req: CreateBlockRequest): Promise<Block>`
    - `patchBlock(id: string, req: PatchBlockRequest): Promise<Block>`
    - `deleteBlock(id: string): Promise<void>`
    - `reorderBlocks(noteId: string, blockIds: string[]): Promise<Block[]>`
  - `validateBlockContent(type: BlockType, content: string): { valid: boolean; error?: string }` — validates JSON structure matches block type
  - Package name: `@my-notebook/shared`

- [ ] **Step 1: Set up monorepo root and shared package**

Create root `package.json` with npm workspaces: `["shared", "web", "mobile"]`. Create `shared/package.json` with name `@my-notebook/shared`, TypeScript, and Vitest as devDependencies. Create `shared/tsconfig.json` targeting ES2020 with strict mode.

- [ ] **Step 2: Write the failing tests**

```typescript
// shared/__tests__/validation.test.ts
import { describe, it, expect } from "vitest";
import { validateBlockContent } from "../src/validation";

describe("validateBlockContent", () => {
  it("accepts valid text block", () => {
    const result = validateBlockContent("text",
      JSON.stringify({ text: "Hello", level: "paragraph" }));
    expect(result.valid).toBe(true);
  });

  it("rejects text block with invalid level", () => {
    const result = validateBlockContent("text",
      JSON.stringify({ text: "Hello", level: "h7" }));
    expect(result.valid).toBe(false);
  });

  it("accepts valid checklist block", () => {
    const result = validateBlockContent("checklist",
      JSON.stringify({ items: [{ text: "Todo", checked: false }] }));
    expect(result.valid).toBe(true);
  });

  it("rejects checklist with missing checked field", () => {
    const result = validateBlockContent("checklist",
      JSON.stringify({ items: [{ text: "Todo" }] }));
    expect(result.valid).toBe(false);
  });

  it("accepts valid table block", () => {
    const result = validateBlockContent("table",
      JSON.stringify({ columns: ["A", "B"], rows: [["1", "2"]] }));
    expect(result.valid).toBe(true);
  });

  it("rejects content exceeding size limit", () => {
    const result = validateBlockContent("text", "x".repeat(1_100_000));
    expect(result.valid).toBe(false);
    expect(result.error).toContain("size");
  });
});
```

```typescript
// shared/__tests__/api-client.test.ts
import { describe, it, expect, vi } from "vitest";
import { ApiClient } from "../src/api-client";

describe("ApiClient", () => {
  it("sets Authorization header after setToken", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: () => Promise.resolve([])
    });
    globalThis.fetch = fetchMock;

    const client = new ApiClient("http://localhost");
    client.setToken("test-jwt");
    await client.listNotes();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost/api/notes",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-jwt"
        })
      })
    );
  });

  it("throws on non-OK response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 401, json: () => Promise.resolve({})
    });

    const client = new ApiClient("http://localhost");
    await expect(client.login({ username: "a", password: "b" }))
      .rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd shared && npx vitest run`
Expected: FAIL — modules do not exist

- [ ] **Step 4: Implement types, constants, validation, and API client**

`types.ts`: all type definitions from the Interfaces block. Use interfaces for data shapes, type aliases for unions.

`constants.ts`: `NOTE_COLORS` (a curated array of modern color strings — builder picks the palette), `BLOCK_TYPES`, `MAX_BLOCK_CONTENT_SIZE`.

`validation.ts`: `validateBlockContent` — parse JSON, check size against `MAX_BLOCK_CONTENT_SIZE`, then validate structure per block type (text needs `text` string + `level` from allowed set; checklist needs `items` array where each item has `text` string + `checked` boolean; table needs `columns` string array + `rows` array of string arrays).

`api-client.ts`: `ApiClient` class using `fetch`. All methods construct the URL, set headers (including `Authorization: Bearer <token>` if set), call `fetch`, check `response.ok`, parse JSON. Methods for each endpoint from the Interfaces block.

`index.ts`: re-exports everything.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd shared && npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add shared/ package.json
git commit -m "feat: add shared TypeScript package with types, API client, and validation"
```

---

### Task 6: Static File Serving & Deployment Configuration

**Files:**
- Modify: `backend/MyNoteBook.Api/Program.cs` (add static file + SPA fallback middleware)
- Create: `backend/MyNoteBook.Api/web.config`
- Create: `backend/MyNoteBook.Api/wwwroot/.gitkeep`
- Create: `scripts/build-web.sh`
- Create: `backend/MyNoteBook.Api.Tests/StaticFileTests.cs`

**Interfaces:**
- Consumes: `Program.cs` (Task 1-2)
- Produces:
  - Static files served from `wwwroot/` at the root URL
  - `MapFallbackToFile("index.html")` for client-side routing — any non-API, non-file route returns `index.html`
  - `web.config` with IIS rewrite rules and configuration for MonsterASP deployment
  - `scripts/build-web.sh` — builds the React app and copies output to `backend/MyNoteBook.Api/wwwroot/`

- [ ] **Step 1: Write the failing test**

```csharp
// StaticFileTests.cs
[Fact]
public async Task NonApiRoute_FallsBackToIndexHtml()
{
    // Create a minimal index.html in wwwroot for the test
    var client = _factory.CreateClient();
    var response = await client.GetAsync("/some/client/route");

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var content = await response.Content.ReadAsStringAsync();
    Assert.Contains("html", content, StringComparison.OrdinalIgnoreCase);
}

[Fact]
public async Task ApiRoute_DoesNotFallBackToIndexHtml()
{
    var client = _factory.CreateClient();
    var response = await client.GetAsync("/api/nonexistent");

    Assert.NotEqual(HttpStatusCode.OK, response.StatusCode);
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test backend/MyNoteBook.Api.Tests --filter "StaticFileTests" -v n`
Expected: FAIL

- [ ] **Step 3: Implement static file serving and deployment config**

`Program.cs`: add `app.UseDefaultFiles()`, `app.UseStaticFiles()`, and `app.MapFallbackToFile("index.html")` — placed after `UseRouting` and `UseAuthorization` but before `app.Run()`. Ensure API routes (`/api/**`) are matched before the fallback.

`web.config`: IIS configuration for ASP.NET Core hosting on MonsterASP — `aspNetCore` hosting model, `stdoutLogEnabled` for diagnostics, appropriate handler mappings.

`wwwroot/.gitkeep`: placeholder so the directory exists in git. The React build output will go here.

`scripts/build-web.sh`: `cd web && npm run build && cp -r dist/* ../backend/MyNoteBook.Api/wwwroot/`

Create a test `wwwroot/index.html` in `TestWebApplicationFactory` for the static file test.

- [ ] **Step 4: Run tests to verify they pass**

Run: `dotnet test backend/MyNoteBook.Api.Tests --filter "StaticFileTests" -v n`
Expected: PASS

- [ ] **Step 5: Run all tests to verify nothing broke**

Run: `dotnet test backend/MyNoteBook.Api.Tests -v n`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add backend/ scripts/
git commit -m "feat: add static file serving with SPA fallback and IIS deployment config"
```
