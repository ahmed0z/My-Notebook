# Note-Taking App — Phase 1: Core App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a personal note-taking app featuring a Google Keep-style card grid and a Notion-style block editor (text, checklist, table) running on MonsterASP free tier, with a unified ASP.NET Core API serving a React web app and a companion React Native Android app.

**Architecture:** A monorepo hosting an ASP.NET Core Web API backend with PostgreSQL, a shared TypeScript contract package, a React (Vite + Tailwind) web SPA served from the .NET host `wwwroot`, and an Expo React Native Android mobile app with an in-house block editor. Changes auto-save via debounced REST calls to granular block endpoints.

**Tech Stack:** ASP.NET Core 8+, Entity Framework Core, PostgreSQL (Npgsql), React 18+, TypeScript, Tailwind CSS, TipTap / ProseMirror, React Native (Expo), React Navigation, Vitest, xUnit.

**Spec:** [docs/superpowers/specs/2026-11-17-note-taking-app-design.md](file:///workspace/My-NoteBook/docs/superpowers/specs/2026-11-17-note-taking-app-design.md)

## Global Constraints

- Backend and frontend must be served from 1 website on MonsterASP free plan (256 MB RAM limit).
- Database is a single PostgreSQL instance with 1 GB storage limit.
- Single-user mode for Phase 1 with one-time setup screen that locks after registration.
- Auto-save via debounced API calls (~1-2 seconds after keystroke) targeting individual blocks (`PATCH /api/blocks/:id`).
- Android mobile app built with React Native (not Capacitor) producing a sideloadable APK.
- Block content stored as JSONB with schemas for text, checklist, and table.

## Review Focus

1. **Cold-start timeout handling:** Client-side network requests after app pool recycling take 5-10s; app must show unobtrusive loading indicators rather than throwing unhandled connection errors.
2. **Concurrent block auto-save ordering:** Fast typing across multiple blocks could cause out-of-order writes; API client must queue or correlate block patches with sequence/timestamps.
3. **Table block JSONB malformation:** Corrupted table column/row dimensions in JSON payload; backend validation must ensure rectangular 2D arrays before saving.
4. **First-run setup race condition:** Calling `/api/auth/setup` simultaneously from multiple tabs; backend must enforce atomic check-and-lock at the database constraint level.
5. **Mobile keyboard obscuring active block:** In React Native block editor, virtual keyboard popping up can obscure cursor; `KeyboardAvoidingView` or `react-native-keyboard-controller` must keep focused block visible.

---

### Task 1: Monorepo Scaffolding & Shared TypeScript Package

**Files:**
- Create: `package.json`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types/note.ts`
- Create: `packages/shared/src/types/block.ts`
- Create: `packages/shared/src/types/auth.ts`
- Create: `packages/shared/src/validation/blockValidator.ts`
- Create: `packages/shared/src/index.ts`
- Test: `packages/shared/tests/blockValidator.test.ts`

**Interfaces:**
- Consumes: None (root foundational task)
- Produces:
  ```typescript
  export type BlockType = 'text' | 'checklist' | 'table';
  export interface TextBlockContent { text: string; level: 'paragraph' | 'h1' | 'h2' | 'h3'; }
  export interface ChecklistItem { id: string; text: string; checked: boolean; }
  export interface ChecklistBlockContent { items: ChecklistItem[]; }
  export interface TableBlockContent { columns: string[]; rows: string[][]; }
  export type BlockContent = TextBlockContent | ChecklistBlockContent | TableBlockContent;
  export interface BlockDto { id: string; noteId: string; type: BlockType; content: BlockContent; position: number; createdAt: string; updatedAt: string; }
  export interface NoteDto { id: string; title: string; color: string; position: number; isPinned: boolean; isArchived: boolean; createdAt: string; updatedAt: string; blocks?: BlockDto[]; }
  export function validateBlockContent(type: BlockType, content: unknown): { valid: boolean; error?: string };
  ```

- [ ] **Step 1: Write the failing tests for block content validation**

`packages/shared/tests/blockValidator.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { validateBlockContent } from '../src/validation/blockValidator';

describe('validateBlockContent', () => {
  it('validates a valid text block', () => {
    const res = validateBlockContent('text', { text: 'Hello', level: 'paragraph' });
    expect(res.valid).toBe(true);
  });
  it('rejects text block with invalid level', () => {
    const res = validateBlockContent('text', { text: 'Hello', level: 'h5' });
    expect(res.valid).toBe(false);
  });
  it('validates checklist block with items', () => {
    const res = validateBlockContent('checklist', { items: [{ id: '1', text: 'Task', checked: false }] });
    expect(res.valid).toBe(true);
  });
  it('rejects malformed table block with non-matching row columns', () => {
    const res = validateBlockContent('table', { columns: ['A', 'B'], rows: [['1']] });
    expect(res.valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix packages/shared test`
Expected: FAIL (files and modules not found)

- [ ] **Step 3: Implement npm workspace and shared package**

Setup root `package.json` with npm workspaces (`["packages/*", "apps/*"]`). In `packages/shared`, define models and `validateBlockContent` checking schema types and table dimension equality.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix packages/shared test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json packages/shared
git commit -m "feat(shared): add typescript models and block validation"
```

---

### Task 2: ASP.NET Core Project Scaffolding & PostgreSQL Entities

**Files:**
- Create: `backend/NoteBook.sln`
- Create: `backend/src/NoteBook.Api/NoteBook.Api.csproj`
- Create: `backend/src/NoteBook.Api/Models/User.cs`
- Create: `backend/src/NoteBook.Api/Models/Note.cs`
- Create: `backend/src/NoteBook.Api/Models/Block.cs`
- Create: `backend/src/NoteBook.Api/Data/AppDbContext.cs`
- Create: `backend/src/NoteBook.Api/Program.cs`
- Create: `backend/tests/NoteBook.Tests/NoteBook.Tests.csproj`
- Test: `backend/tests/NoteBook.Tests/DbContextTests.cs`

**Interfaces:**
- Consumes: PostgreSQL database connection string, JSONB column conventions
- Produces: `AppDbContext` with `Users`, `Notes`, `Blocks` DbSets.
  ```csharp
  public class Note {
      public Guid Id { get; set; }
      public string Title { get; set; } = string.Empty;
      public string Color { get; set; } = "#ffffff";
      public int Position { get; set; }
      public bool IsPinned { get; set; }
      public bool IsArchived { get; set; }
      public DateTime CreatedAt { get; set; }
      public DateTime UpdatedAt { get; set; }
      public List<Block> Blocks { get; set; } = new();
  }
  public class Block {
      public Guid Id { get; set; }
      public Guid NoteId { get; set; }
      public Note? Note { get; set; }
      public string Type { get; set; } = "text";
      public string ContentJson { get; set; } = "{}"; // mapped to jsonb
      public int Position { get; set; }
      public DateTime CreatedAt { get; set; }
      public DateTime UpdatedAt { get; set; }
  }
  ```

- [ ] **Step 1: Write failing DbContext test**

`backend/tests/NoteBook.Tests/DbContextTests.cs`:
```csharp
using Microsoft.EntityFrameworkCore;
using NoteBook.Api.Data;
using NoteBook.Api.Models;
using Xunit;

public class DbContextTests {
    [Fact]
    public async Task CanInsertAndRetrieveNoteWithBlocks() {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: "TestDb")
            .Options;

        using var context = new AppDbContext(options);
        var note = new Note { Id = Guid.NewGuid(), Title = "Shopping", Color = "#f28b82" };
        var block = new Block { Id = Guid.NewGuid(), NoteId = note.Id, Type = "checklist", ContentJson = "{\"items\":[]}" };
        context.Notes.Add(note);
        context.Blocks.Add(block);
        await context.SaveChangesAsync();

        var retrieved = await context.Notes.Include(n => n.Blocks).FirstOrDefaultAsync(n => n.Id == note.Id);
        Assert.NotNull(retrieved);
        Assert.Single(retrieved.Blocks);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test backend/tests/NoteBook.Tests`
Expected: FAIL (project/classes not implemented)

- [ ] **Step 3: Scaffold .NET Web API and implement models & DbContext**

Create `backend/src/NoteBook.Api` targeting `net8.0` with `Npgsql.EntityFrameworkCore.PostgreSQL`, configure `AppDbContext` entity mapping with JSONB column type for `ContentJson`.

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test backend/tests/NoteBook.Tests`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat(api): scaffold ASP.NET Core API and EF Core entities"
```

---

### Task 3: Authentication & One-Time Setup Service

**Files:**
- Create: `backend/src/NoteBook.Api/Services/IAuthService.cs`
- Create: `backend/src/NoteBook.Api/Services/AuthService.cs`
- Create: `backend/src/NoteBook.Api/Controllers/AuthController.cs`
- Create: `backend/src/NoteBook.Api/DTOs/AuthDtos.cs`
- Modify: `backend/src/NoteBook.Api/Program.cs` (JWT configuration)
- Test: `backend/tests/NoteBook.Tests/AuthControllerTests.cs`

**Interfaces:**
- Consumes: `AppDbContext`
- Produces:
  - `POST /api/auth/setup` -> `{ token: string, username: string }` (returns 400/409 if user already exists)
  - `POST /api/auth/login` -> `{ token: string, username: string }`
  - `GET /api/auth/status` -> `{ isConfigured: boolean }`

- [ ] **Step 1: Write integration test for Auth & Setup lock**

`backend/tests/NoteBook.Tests/AuthControllerTests.cs`:
```csharp
[Fact]
public async Task Setup_CreatesUserFirstTime_AndRejectsSubsequentCalls() {
    var factory = new CustomWebApplicationFactory();
    var client = factory.CreateClient();

    var setupRes = await client.PostAsJsonAsync("/api/auth/setup", new { Username = "owner", Password = "SecurePassword123!" });
    Assert.Equal(HttpStatusCode.OK, setupRes.StatusCode);

    var secondRes = await client.PostAsJsonAsync("/api/auth/setup", new { Username = "attacker", Password = "HackedPassword123!" });
    Assert.Equal(HttpStatusCode.Conflict, secondRes.StatusCode);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test backend/tests/NoteBook.Tests --filter FullyQualifiedName~AuthControllerTests`
Expected: FAIL (endpoints do not exist)

- [ ] **Step 3: Implement AuthService and AuthController**

Implement BCrypt / PBKDF2 password hashing in `AuthService`. Enforce that `/api/auth/setup` checks if `context.Users.Any()` and throws 409 Conflict if true. Issue JWT signed with configured key.

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test backend/tests/NoteBook.Tests --filter FullyQualifiedName~AuthControllerTests`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat(auth): implement JWT auth and one-time locked setup endpoint"
```

---

### Task 4: Notes and Blocks RESTful API Endpoints

**Files:**
- Create: `backend/src/NoteBook.Api/Controllers/NotesController.cs`
- Create: `backend/src/NoteBook.Api/Controllers/BlocksController.cs`
- Create: `backend/src/NoteBook.Api/DTOs/NoteDtos.cs`
- Create: `backend/src/NoteBook.Api/DTOs/BlockDtos.cs`
- Modify: `backend/src/NoteBook.Api/Program.cs` (authorize endpoints)
- Test: `backend/tests/NoteBook.Tests/NotesControllerTests.cs`
- Test: `backend/tests/NoteBook.Tests/BlocksControllerTests.cs`

**Interfaces:**
- Consumes: Authenticated JWT claims, `AppDbContext`
- Produces:
  - `GET /api/notes` (lists all notes with metadata, sorted by position/pinned)
  - `POST /api/notes` (creates note with optional initial blocks)
  - `GET /api/notes/{id}` (retrieves note with all blocks ordered by position)
  - `PUT /api/notes/{id}` (updates title, color, isPinned, isArchived, position)
  - `DELETE /api/notes/{id}` (cascades delete to blocks)
  - `POST /api/notes/{id}/blocks` (appends block)
  - `PATCH /api/blocks/{id}` (updates block contentJson or position, auto-save target)
  - `DELETE /api/blocks/{id}` (deletes block)
  - `PUT /api/notes/{id}/blocks/reorder` (accepts `{ blockIds: Guid[] }` and updates positions atomically)

- [ ] **Step 1: Write integration tests for Note CRUD and Block PATCH**

`backend/tests/NoteBook.Tests/NotesControllerTests.cs`:
```csharp
[Fact]
public async Task PatchBlock_UpdatesContentAndReturnsOk() {
    var client = await GetAuthenticatedClientAsync();
    var noteRes = await client.PostAsJsonAsync("/api/notes", new { Title = "Test Note", Color = "#ffffff" });
    var note = await noteRes.Content.ReadFromJsonAsync<NoteDto>();

    var blockRes = await client.PostAsJsonAsync($"/api/notes/{note.Id}/blocks", new { Type = "text", ContentJson = "{\"text\":\"Draft\",\"level\":\"paragraph\"}", Position = 0 });
    var block = await blockRes.Content.ReadFromJsonAsync<BlockDto>();

    var patchRes = await client.PatchAsJsonAsync($"/api/blocks/{block.Id}", new { ContentJson = "{\"text\":\"Updated text\",\"level\":\"paragraph\"}" });
    Assert.Equal(HttpStatusCode.OK, patchRes.StatusCode);

    var getNote = await client.GetFromJsonAsync<NoteDto>($"/api/notes/{note.Id}");
    Assert.Contains("Updated text", getNote.Blocks[0].ContentJson);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test backend/tests/NoteBook.Tests --filter FullyQualifiedName~NotesControllerTests`
Expected: FAIL

- [ ] **Step 3: Implement NotesController and BlocksController**

Implement controllers with `[Authorize]` attribute. Implement validation to reject malformed content JSON.

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test backend/tests/NoteBook.Tests --filter FullyQualifiedName~NotesControllerTests`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat(api): implement notes and blocks REST controllers with auto-save support"
```

---

### Task 5: Web Frontend Shell & Keep-Style Masonry Card Grid

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tailwind.config.js`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/api/client.ts`
- Create: `apps/web/src/context/AuthContext.tsx`
- Create: `apps/web/src/components/NoteCard.tsx`
- Create: `apps/web/src/components/NoteGrid.tsx`
- Create: `apps/web/src/components/ColorPicker.tsx`
- Create: `apps/web/src/components/QuickCaptureBar.tsx`
- Create: `apps/web/src/pages/HomePage.tsx`
- Create: `apps/web/src/pages/SetupPage.tsx`
- Create: `apps/web/src/pages/LoginPage.tsx`
- Test: `apps/web/tests/NoteGrid.test.tsx`

**Interfaces:**
- Consumes: `packages/shared`, Backend API (`/api/auth/*`, `/api/notes`)
- Produces: Responsive SPA with masonry layout (Tailwind CSS columns or CSS grid), card coloring, pinned/other grouping, search bar filter.

- [ ] **Step 1: Write test for NoteGrid rendering**

`apps/web/tests/NoteGrid.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NoteGrid } from '../src/components/NoteGrid';
import { NoteDto } from '@notebook/shared';

describe('NoteGrid', () => {
  it('renders pinned and unpinned note sections correctly', () => {
    const notes: NoteDto[] = [
      { id: '1', title: 'Pinned Note', color: '#fff', position: 0, isPinned: true, isArchived: false, createdAt: '', updatedAt: '' },
      { id: '2', title: 'Regular Note', color: '#ffc', position: 1, isPinned: false, isArchived: false, createdAt: '', updatedAt: '' }
    ];
    render(<NoteGrid notes={notes} onSelectNote={() => {}} />);
    expect(screen.getByText('Pinned Note')).toBeInTheDocument();
    expect(screen.getByText('Regular Note')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix apps/web test`
Expected: FAIL

- [ ] **Step 3: Implement Web App UI and Keep Grid**

Build Vite + React app. Implement `AuthContext` to check `/api/auth/status`. If not configured, route to `SetupPage`. Implement `NoteGrid` with CSS column-count masonry layout, card color backgrounds (pastel Keep colors), and quick capture component.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix apps/web test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/
git commit -m "feat(web): add masonry card grid, quick capture, and auth screens"
```

---

### Task 6: Web Block Editor with TipTap & Debounced Auto-Save

**Files:**
- Create: `apps/web/src/components/editor/BlockEditorModal.tsx`
- Create: `apps/web/src/components/editor/useAutosave.ts`
- Create: `apps/web/src/components/editor/blocks/TextBlock.tsx`
- Create: `apps/web/src/components/editor/blocks/ChecklistBlock.tsx`
- Create: `apps/web/src/components/editor/blocks/TableBlock.tsx`
- Create: `apps/web/src/components/editor/EditorToolbar.tsx`
- Test: `apps/web/tests/useAutosave.test.ts`
- Test: `apps/web/tests/BlockEditorModal.test.tsx`

**Interfaces:**
- Consumes: NoteDto, BlockDto from `@notebook/shared`, `/api/blocks/{id}` PATCH endpoint
- Produces: Notion-style modal/page editor supporting text formatting (H1/H2/H3/p), checklist item addition/toggle, table column/row insertion, and automatic 1.5s debounced PATCH calls with an indicator ("Saving...", "All changes saved").

- [ ] **Step 1: Write test for debounced autosave hook**

`apps/web/tests/useAutosave.test.ts`:
```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useAutosave } from '../src/components/editor/useAutosave';

describe('useAutosave', () => {
  it('triggers save callback only after debounce delay', () => {
    vi.useFakeTimers();
    const saveMock = vi.fn();
    const { result, rerender } = renderHook(({ val }) => useAutosave(val, saveMock, 1000), { initialProps: { val: 'initial' } });

    rerender({ val: 'change 1' });
    rerender({ val: 'change 2' });
    expect(saveMock).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(1000); });
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenCalledWith('change 2');
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix apps/web test tests/useAutosave.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Block Editor & Debounced Auto-Save**

Create `useAutosave` hook with debounce logic and saving status state. Implement `BlockEditorModal` integrating TipTap/custom blocks for text, checklist items, and interactive tables.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix apps/web test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/
git commit -m "feat(web): implement Notion-style block editor with debounced auto-save"
```

---

### Task 7: Static Files Serving & MonsterASP Deployment Bundle

**Files:**
- Modify: `backend/src/NoteBook.Api/Program.cs`
- Create: `scripts/build-deploy.sh`
- Create: `backend/src/NoteBook.Api/web.config`
- Test: `backend/tests/NoteBook.Tests/StaticFileServingTests.cs`

**Interfaces:**
- Consumes: Built assets from `apps/web/dist`
- Produces: Single ASP.NET Core deployable artifact where `GET /` serves `index.html`, API is served under `/api/*`, and client-side routing routes back to `index.html`.

- [ ] **Step 1: Write integration test for static file & fallback serving**

`backend/tests/NoteBook.Tests/StaticFileServingTests.cs`:
```csharp
[Fact]
public async Task Get_ClientRoute_ReturnsIndexHtml() {
    var factory = new CustomWebApplicationFactory();
    var client = factory.CreateClient();

    var res = await client.GetAsync("/notes/some-id");
    Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    Assert.Equal("text/html", res.Content.Headers.ContentType?.MediaType);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test backend/tests/NoteBook.Tests --filter FullyQualifiedName~StaticFileServingTests`
Expected: FAIL

- [ ] **Step 3: Configure SPA fallback and static files in Program.cs & build script**

Configure `app.UseDefaultFiles(); app.UseStaticFiles(); app.MapFallbackToFile("index.html");`. Write `scripts/build-deploy.sh` to compile web frontend into `backend/src/NoteBook.Api/wwwroot` and publish .NET app with Release configuration. Add IIS `web.config` for MonsterASP out-of-process/in-process hosting.

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test backend/tests/NoteBook.Tests --filter FullyQualifiedName~StaticFileServingTests`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/ scripts/
git commit -m "feat(deploy): configure SPA static hosting and deployment script for MonsterASP"
```

---

### Task 8: React Native Mobile App Scaffolding & Shared API Client

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/src/api/mobileClient.ts`
- Create: `apps/mobile/src/storage/authStorage.ts`
- Create: `apps/mobile/src/screens/LoginScreen.tsx`
- Create: `apps/mobile/src/screens/NotesGridScreen.tsx`
- Create: `apps/mobile/src/components/MobileNoteCard.tsx`
- Create: `apps/mobile/App.tsx`
- Test: `apps/mobile/tests/authStorage.test.ts`

**Interfaces:**
- Consumes: `@notebook/shared`, Expo SecureStore, Backend API URL
- Produces: Sideloadable Android app with Keep-style card grid, search bar, and secure JWT token persistence.

- [ ] **Step 1: Write unit test for mobile auth token storage**

`apps/mobile/tests/authStorage.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { saveToken, getToken, clearToken } from '../src/storage/authStorage';

vi.mock('expo-secure-store', () => {
  const store: Record<string, string> = {};
  return {
    setItemAsync: vi.fn(async (k, v) => { store[k] = v; }),
    getItemAsync: vi.fn(async (k) => store[k] ?? null),
    deleteItemAsync: vi.fn(async (k) => { delete store[k]; })
  };
});

describe('authStorage', () => {
  it('saves and retrieves jwt securely', async () => {
    await saveToken('token-123');
    const token = await getToken();
    expect(token).toBe('token-123');
    await clearToken();
    expect(await getToken()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix apps/mobile test`
Expected: FAIL

- [ ] **Step 3: Scaffold Expo React Native app and auth storage**

Scaffold Expo app, install `@react-navigation/native`, `react-native-gesture-handler`, and `expo-secure-store`. Implement `mobileClient` attaching JWT header and pointing to configured backend URL.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix apps/mobile test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/
git commit -m "feat(mobile): scaffold React Native app with secure auth and card grid"
```

---

### Task 9: React Native Custom Rich Block Editor & APK Build Setup

**Files:**
- Create: `apps/mobile/src/screens/NoteDetailScreen.tsx`
- Create: `apps/mobile/src/components/editor/MobileBlockEditor.tsx`
- Create: `apps/mobile/src/components/editor/MobileTextBlock.tsx`
- Create: `apps/mobile/src/components/editor/MobileChecklistBlock.tsx`
- Create: `apps/mobile/src/components/editor/MobileTableBlock.tsx`
- Create: `apps/mobile/src/components/editor/BlockToolbar.tsx`
- Create: `apps/mobile/eas.json`
- Test: `apps/mobile/tests/MobileBlockEditor.test.ts`

**Interfaces:**
- Consumes: NoteDto & BlockDto, `react-native-gesture-handler`, `react-native-reanimated`
- Produces: Touch-optimized block editor with:
  - Text block with level toggles (H1, H2, H3, paragraph)
  - Checklist block with checkbox toggling and item insertion
  - Table block with cell editing and add row/col actions
  - Drag handles for block reordering
  - Debounced auto-save to `/api/blocks/{id}`
  - EAS Build profile configured to generate standalone `.apk` for direct sideloading.

- [ ] **Step 1: Write unit test for mobile block state reducer**

`apps/mobile/tests/MobileBlockEditor.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { blockReducer, reorderBlocks } from '../src/components/editor/blockReducer';
import { BlockDto } from '@notebook/shared';

describe('blockReducer', () => {
  it('reorders blocks correctly when dragged', () => {
    const blocks: BlockDto[] = [
      { id: '1', noteId: 'n', type: 'text', content: { text: 'A', level: 'paragraph' }, position: 0, createdAt: '', updatedAt: '' },
      { id: '2', noteId: 'n', type: 'text', content: { text: 'B', level: 'paragraph' }, position: 1, createdAt: '', updatedAt: '' }
    ];
    const reordered = reorderBlocks(blocks, 0, 1);
    expect(reordered[0].id).toBe('2');
    expect(reordered[0].position).toBe(0);
    expect(reordered[1].id).toBe('1');
    expect(reordered[1].position).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix apps/mobile test tests/MobileBlockEditor.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Mobile Block Editor components and EAS config**

Implement `blockReducer`, `MobileBlockEditor`, custom blocks using `TextInput`, `KeyboardAvoidingView`, and drag reorder. Create `eas.json` with `preview` build profile configured for `buildType: "apk"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix apps/mobile test tests/MobileBlockEditor.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/
git commit -m "feat(mobile): implement rich block editor and APK build configuration"
```
