# NoteBook Big Patch Updates — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 11 feature groups across the web app, mobile app, and backend: inline toolbar, slash-command keyboard nav, Notion-style tables with clipboard, block drag-drop indicator, todo card styling, minimal backlinks, side menu + settings, dark toggle in settings, default view option, user management, and multi-space support.

**Architecture:** The app is a monorepo with a .NET 8 API (PostgreSQL), a React/Vite web app, and a React Native (Expo) mobile app sharing types via `@notebook/shared`. Features are divided into frontend-only UI changes (Tasks 1–6) and features that need backend+shared+frontend changes (Tasks 7–11). All frontend changes apply to both web and mobile to keep parity.

**Tech Stack:** TypeScript, React 18, Tailwind CSS (web), React Native/Expo (mobile), .NET 8 / EF Core / PostgreSQL (backend), `@notebook/shared` for DTO types.

**Spec:** User request in conversation (no separate spec file).

## Global Constraints

- Both web and mobile apps must receive equivalent changes for every feature.
- Existing tests must continue to pass after each task.
- No new npm/NuGet dependencies unless strictly necessary — prefer native platform APIs.
- The backend currently uses a **single-user** singleton design (`AuthService.SingletonUserId`). Multi-user and multi-space features extend this to true multi-user, requiring DB migrations.
- Notes currently have no `UserId` or `SpaceId` — both must be added with nullable FKs for backward compatibility.

## Review Focus

1. **Multi-user data isolation** — after adding `UserId` to `Note`, all note queries must filter by the authenticated user's ID; a missing `.Where(n => n.UserId == userId)` leaks another user's data.
2. **Space deletion cascade** — deleting a space that contains notes must cascade-delete notes and their blocks, or move them to a default space. Test both paths.
3. **Table clipboard paste** — pasting from Excel can include `\r\n`, tabs, and quoted cells with commas. The TSV parser must handle all three.
4. **Drag-drop indicator edge cases** — dragging to position 0 (before first block) and to the end (after last block) must both show the indicator line and produce correct reorder.
5. **Password change with active sessions** — changing a user's password should not invalidate existing JWT tokens (by design), but the UI should warn the user.

---

### Task 1: Inline Floating Toolbar (Web + Mobile)

**Goal:** Move the floating toolbar from an absolute-bottom overlay into the note body, rendering it inline after the last block so it scrolls with content.

**Files:**
- Modify: `apps/web/src/components/editor/BlockEditorModal.tsx:640-647` — move toolbar from absolute position to inline
- Modify: `apps/mobile/src/components/editor/MobileBlockEditor.tsx:101` — toolbar already inline; adjust styling

**Interfaces:**
- Consumes: `EditorToolbar` and `BlockToolbar` components (unchanged API)
- Produces: No interface changes; visual-only change

- [ ] **Step 1: Web — Move toolbar inline**

In `BlockEditorModal.tsx`, remove the `absolute bottom-5 left-1/2 -translate-x-1/2 z-40` wrapper (lines 641-647). Instead, render `<EditorToolbar>` inside the scrollable block list div, after the canvas click area and before the `<BacklinksPanel>`. Wrap it in a `<div className="flex justify-center py-4">`.

- [ ] **Step 2: Mobile — Already inline; refine spacing**

The mobile `BlockToolbar` is already rendered at the top of the block list. Move it to render _after_ the block list (after the blocks loop) with `marginTop: 12`. This matches the web's new inline position.

- [ ] **Step 3: Verify toolbar scrolls with content in both apps**

Build web: `cd apps/web && npx vite build`
Expected: Build succeeds, no errors.

- [ ] **Step 4: Commit**
```bash
git add apps/web/src/components/editor/BlockEditorModal.tsx apps/mobile/src/components/editor/MobileBlockEditor.tsx
git commit -m "feat: move floating toolbar inline into note body"
```

---

### Task 2: Slash Command Keyboard Navigation Fix (Web)

**Goal:** Ensure slash command menu items can be navigated with Arrow Up/Down and selected with Enter while keeping the text cursor in the input field. The current implementation already does this — verify and ensure no event conflicts.

**Files:**
- Modify: `apps/web/src/components/editor/SlashCommandMenu.tsx` — improve scroll-into-view for selected item

**Interfaces:**
- Consumes: `SlashCommandMenuProps` (unchanged)
- Produces: `SlashCommandMenu` (unchanged API)

- [ ] **Step 1: Add scroll-into-view on selection change**

In `SlashCommandMenu.tsx`, after `setSelectedIndex` changes, use a ref array on the buttons and call `scrollIntoView({ block: 'nearest' })` on the selected item. Add `itemRefs` as `useRef<(HTMLButtonElement | null)[]>([])` and assign refs in the map.

- [ ] **Step 2: Verify keyboard navigation**

Build: `cd apps/web && npx vite build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/components/editor/SlashCommandMenu.tsx
git commit -m "feat: improve slash command keyboard nav with scroll-into-view"
```

---

### Task 3: Notion-Style Table with Clipboard Support (Web + Mobile)

**Goal:** Restructure TableBlock to use a real `<table>` with selectable cells (no `<input>` wrappers), support copy to Excel (via TSV in clipboard) and paste from Excel (detect TSV/CSV on paste).

**Files:**
- Modify: `apps/web/src/components/editor/blocks/TableBlock.tsx` — rewrite with contentEditable cells + clipboard handlers
- Modify: `apps/mobile/src/components/editor/MobileTableBlock.tsx` — add delete row/column buttons, improve styling
- Modify: `packages/shared/src/types/block.ts` — no schema change needed (columns/rows structure is fine)

**Interfaces:**
- Consumes: `TableBlockContent { columns: string[]; rows: string[][] }`
- Produces: Same shape, same `onChange` callback

- [ ] **Step 1: Web — Rewrite TableBlock with contentEditable cells**

Replace `<input>` elements in both header and body cells with `<td contentEditable>` elements. Use `onBlur` to capture final value. Add `user-select: text` CSS so cells are selectable and copyable. Wrap the table in a container with `onPaste` handler.

- [ ] **Step 2: Web — Add clipboard paste handler**

Add `onPaste` handler on the table container that:
1. Reads `e.clipboardData.getData('text/plain')`
2. Splits by `\n` for rows, `\t` for columns
3. If the result has ≥2 columns or ≥2 rows, treat as table data
4. Replaces current table content by calling `onChange({ columns, rows })`

- [ ] **Step 3: Web — Add copy handler**

Add a toolbar button (or context-menu-aware `onCopy`) that serializes the table as TSV (`\t`-separated columns, `\n`-separated rows) and writes it to clipboard via `navigator.clipboard.writeText()`.

- [ ] **Step 4: Web — Add delete row and delete column buttons**

Keep existing delete row/column logic. Add a header row option menu (click column header → delete column). Style to match Notion: minimal borders, hover highlights on rows.

- [ ] **Step 5: Mobile — Add delete row/column support and style refresh**

In `MobileTableBlock.tsx`, add swipe-to-delete or a small × button on each row and column. Update styles to use minimal borders matching the web table.

- [ ] **Step 6: Build and verify**

```bash
cd apps/web && npx vite build
```
Expected: Build succeeds.

- [ ] **Step 7: Commit**
```bash
git add apps/web/src/components/editor/blocks/TableBlock.tsx apps/mobile/src/components/editor/MobileTableBlock.tsx
git commit -m "feat: Notion-style table with clipboard copy/paste support"
```

---

### Task 4: Block Drag-Drop Indicator Line (Web)

**Goal:** When dragging a block, show a thin colored line at the drop position instead of just reducing opacity on the dragged block.

**Files:**
- Modify: `apps/web/src/components/editor/BlockEditorModal.tsx` — add `dragOverIndex` state and indicator line rendering

**Interfaces:**
- Consumes: Existing drag/drop handlers
- Produces: Visual-only; no interface change

- [ ] **Step 1: Add `dragOverIndex` state**

Add `const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)` alongside `draggedIndex`. In `handleDragOver`, call `setDragOverIndex(index)`. In `handleDrop` and `handleDragEnd`, clear both states.

- [ ] **Step 2: Add `onDragEnd` handler**

Add `onDragEnd` to the draggable div that resets `setDraggedIndex(null)` and `setDragOverIndex(null)`.

- [ ] **Step 3: Render indicator line**

Before each block div, render a conditional indicator:
```tsx
{dragOverIndex === idx && draggedIndex !== null && draggedIndex !== idx && (
  <div className="h-0.5 bg-blue-500 rounded-full mx-2 my-0.5 transition-all" />
)}
```

- [ ] **Step 4: Build and verify**

```bash
cd apps/web && npx vite build
```
Expected: Build succeeds.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/components/editor/BlockEditorModal.tsx
git commit -m "feat: show thin indicator line during block drag-drop"
```

---

### Task 5: Todo Checkbox Card Preview Styling (Web + Mobile)

**Goal:** Match the in-note todo/checklist preview on `NoteCard` to use curved corners without a light background — matching the note card's own style.

**Files:**
- Modify: `apps/web/src/components/NoteCard.tsx:69-78` — update checklist preview styling
- Modify: `apps/mobile/src/components/MobileNoteCard.tsx` — equivalent change

**Interfaces:**
- Consumes: `NoteDto` with blocks
- Produces: Visual-only

- [ ] **Step 1: Web — Update checklist preview in NoteCard**

In `NoteCard.tsx`, change the checklist checkbox span (line 72) from `rounded border` with `bg-stone-700` to `rounded-md` with no background fill. Remove the filled background on checked state; use only a checkmark icon or stroke. The container div should not have its own background — it inherits from the card.

- [ ] **Step 2: Mobile — Update MobileNoteCard checklist preview**

Read `MobileNoteCard.tsx` and apply equivalent styling: rounded corners on checkbox, no separate background container.

- [ ] **Step 3: Build and verify**

```bash
cd apps/web && npx vite build
```
Expected: Build succeeds.

- [ ] **Step 4: Commit**
```bash
git add apps/web/src/components/NoteCard.tsx apps/mobile/src/components/MobileNoteCard.tsx
git commit -m "feat: style todo preview with curved corners, no background"
```

---

### Task 6: Minimal Backlinks Section (Web + Mobile)

**Goal:** Reduce the backlinks area to a compact, collapsible single-line with a count badge, expandable on click.

**Files:**
- Modify: `apps/web/src/components/editor/BacklinksPanel.tsx` — add collapsed state, compact rendering
- Modify: `apps/mobile/src/components/editor/MobileBlockEditor.tsx` — make backlinks button smaller
- Modify: `apps/mobile/src/components/editor/MobileBacklinksModal.tsx` — reduce modal height

**Interfaces:**
- Consumes: `BacklinksPanelProps` (unchanged)
- Produces: Same component, visual change only

- [ ] **Step 1: Web — Add collapsed state to BacklinksPanel**

Add `const [isExpanded, setIsExpanded] = useState(false)`. When collapsed, render only: a single row with the link icon, "Backlinks" text, count badge, and a chevron. When expanded, show the full list. The collapsed state should take minimal vertical space (~36px).

- [ ] **Step 2: Web — Style collapsed state**

Replace the `mt-8 pt-4` classes with `mt-4 pt-2`. The collapsed row: `flex items-center gap-2 cursor-pointer py-1 px-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800`. Count badge: `text-[10px] bg-stone-200 dark:bg-stone-700 px-1.5 py-0.5 rounded-full`.

- [ ] **Step 3: Mobile — Reduce backlinks button size**

In `MobileBlockEditor.tsx`, reduce the backlinks button to `paddingVertical: 4, fontSize: 11`. In `MobileBacklinksModal.tsx`, reduce `maxHeight` from `'75%'` to `'50%'`.

- [ ] **Step 4: Build and verify**

```bash
cd apps/web && npx vite build
```
Expected: Build succeeds.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/components/editor/BacklinksPanel.tsx apps/mobile/src/components/editor/MobileBlockEditor.tsx apps/mobile/src/components/editor/MobileBacklinksModal.tsx
git commit -m "feat: minimal collapsible backlinks section"
```

---

### Task 7: Side Menu with Archive & Settings (Web + Mobile)

**Goal:** Add a collapsible side menu containing navigation to Archive page and Settings page. The header logo/brand becomes a hamburger toggle for the side menu.

**Files:**
- Create: `apps/web/src/components/SideMenu.tsx` — collapsible sidebar component
- Create: `apps/web/src/pages/ArchivePage.tsx` — shows archived notes
- Create: `apps/web/src/pages/SettingsPage.tsx` — settings hub
- Modify: `apps/web/src/App.tsx` — add routing state for pages, render SideMenu
- Modify: `apps/web/src/components/Header.tsx` — add hamburger menu button
- Modify: `apps/web/src/pages/HomePage.tsx` — receive page navigation callbacks
- Create: `apps/mobile/src/screens/SettingsScreen.tsx` — settings for mobile
- Create: `apps/mobile/src/screens/ArchiveScreen.tsx` — archived notes for mobile
- Modify: `apps/mobile/App.tsx` — add screen navigation state

**Interfaces:**
- Produces:
  - `SideMenu`: `React.FC<{ isOpen: boolean; onClose: () => void; onNavigate: (page: string) => void; currentPage: string }>`
  - `ArchivePage`: `React.FC<{ onSelectNote: (note: NoteDto) => void }>`
  - `SettingsPage`: `React.FC<{ onBack: () => void }>`

- [ ] **Step 1: Create SideMenu component (web)**

Create `apps/web/src/components/SideMenu.tsx`. Render as an overlay panel sliding in from the left with items: "Notes" (home icon), "Archive" (archive icon), "Settings" (gear icon). Include collapse button. Use `transform translateX` for slide animation.

- [ ] **Step 2: Create ArchivePage (web)**

Create `apps/web/src/pages/ArchivePage.tsx`. Fetch notes filtered by `isArchived === true` (use `ApiClient.getNotes()` and filter client-side, or add a query param — client-side filter is simpler). Render using `NoteGrid`.

- [ ] **Step 3: Create SettingsPage stub (web)**

Create `apps/web/src/pages/SettingsPage.tsx`. For now render a container with "Settings" header and placeholder sections for: Theme, Default View, Account. These will be filled in Tasks 8-10.

- [ ] **Step 4: Wire SideMenu into App.tsx (web)**

Add `activePage` state to `AppContent` (`'home' | 'archive' | 'settings'`). Add `sideMenuOpen` state. Render `<SideMenu>` at the top level. Update Header to include a hamburger button that toggles `sideMenuOpen`. Conditionally render `HomePage`, `ArchivePage`, or `SettingsPage` based on `activePage`.

- [ ] **Step 5: Create ArchiveScreen and SettingsScreen (mobile)**

Create `apps/mobile/src/screens/ArchiveScreen.tsx` — mirrors ArchivePage.
Create `apps/mobile/src/screens/SettingsScreen.tsx` — settings stub.

- [ ] **Step 6: Wire navigation into mobile App.tsx**

Add `activeScreen` state to `AppContent`. Add a simple bottom tab or hamburger menu to `NotesGridScreen` for navigating to Archive and Settings.

- [ ] **Step 7: Build and verify**

```bash
cd apps/web && npx vite build
```
Expected: Build succeeds.

- [ ] **Step 8: Commit**
```bash
git add apps/web/src/components/SideMenu.tsx apps/web/src/pages/ArchivePage.tsx apps/web/src/pages/SettingsPage.tsx apps/web/src/App.tsx apps/web/src/components/Header.tsx apps/mobile/src/screens/SettingsScreen.tsx apps/mobile/src/screens/ArchiveScreen.tsx apps/mobile/App.tsx
git commit -m "feat: add side menu with archive and settings navigation"
```

---

### Task 8: Dark Mode Toggle in Settings (Web + Mobile)

**Goal:** Add a dark/light/system theme toggle inside the Settings page while keeping the existing toggle in the header/title bar.

**Files:**
- Modify: `apps/web/src/pages/SettingsPage.tsx` — add theme section
- Modify: `apps/mobile/src/screens/SettingsScreen.tsx` — add theme section

**Interfaces:**
- Consumes: `useTheme()` from `ThemeContext` (existing)
- Produces: No new interfaces

- [ ] **Step 1: Web — Add theme toggle section in SettingsPage**

Import `useTheme`. Render a "Theme" section with three radio-style buttons: Light, Dark, System. Highlight the active one. Call `setTheme('light' | 'dark' | 'system')` on click.

- [ ] **Step 2: Mobile — Add theme toggle section in SettingsScreen**

Same as web: three options rendered as `TouchableOpacity` buttons with active indicator.

- [ ] **Step 3: Build and verify**

```bash
cd apps/web && npx vite build
```
Expected: Build succeeds.

- [ ] **Step 4: Commit**
```bash
git add apps/web/src/pages/SettingsPage.tsx apps/mobile/src/screens/SettingsScreen.tsx
git commit -m "feat: add dark mode toggle in settings page"
```

---

### Task 9: Default Opening View Setting (Web + Mobile)

**Goal:** Add a setting to choose whether the app opens in full-screen or compact (modal) view when opening a note.

**Files:**
- Modify: `apps/web/src/context/ThemeContext.tsx` — add `defaultView` to context (or create a new `SettingsContext`)
- Create: `apps/web/src/context/SettingsContext.tsx` — settings context with `defaultView: 'fullscreen' | 'compact'`
- Modify: `apps/web/src/components/editor/BlockEditorModal.tsx` — read `defaultView` from context to initialize `isFullscreen`
- Modify: `apps/web/src/pages/SettingsPage.tsx` — add default view section
- Modify: `apps/web/src/App.tsx` — wrap with `SettingsProvider`
- Create: `apps/mobile/src/context/SettingsContext.tsx` — same for mobile
- Modify: `apps/mobile/src/screens/SettingsScreen.tsx` — add default view option
- Modify: `apps/mobile/App.tsx` — wrap with `SettingsProvider`

**Interfaces:**
- Produces:
  - `SettingsContext`: `{ defaultView: 'fullscreen' | 'compact'; setDefaultView: (v) => void }`
  - Stored in `localStorage` (web) / `AsyncStorage` (mobile) under key `notebook_default_view`

- [ ] **Step 1: Create SettingsContext (web)**

Create `apps/web/src/context/SettingsContext.tsx` with `defaultView` state, persisted to `localStorage`. Provide `SettingsProvider` and `useSettings` hook.

- [ ] **Step 2: Wire SettingsProvider into App.tsx (web)**

Wrap `<AppContent>` with `<SettingsProvider>`.

- [ ] **Step 3: Use defaultView in BlockEditorModal (web)**

Change `useState(false)` for `isFullscreen` to `useState(defaultView === 'fullscreen')` using `useSettings()`.

- [ ] **Step 4: Add default view option in SettingsPage (web)**

Render two options: "Full Screen" and "Compact". Highlight active.

- [ ] **Step 5: Repeat for mobile**

Create `apps/mobile/src/context/SettingsContext.tsx`, wire into `App.tsx`, use in `NoteDetailScreen`, add to `SettingsScreen`.

- [ ] **Step 6: Build and verify**

```bash
cd apps/web && npx vite build
```
Expected: Build succeeds.

- [ ] **Step 7: Commit**
```bash
git add apps/web/src/context/SettingsContext.tsx apps/web/src/pages/SettingsPage.tsx apps/web/src/App.tsx apps/web/src/components/editor/BlockEditorModal.tsx apps/mobile/src/context/SettingsContext.tsx apps/mobile/src/screens/SettingsScreen.tsx apps/mobile/App.tsx
git commit -m "feat: add default opening view setting (fullscreen/compact)"
```

---

### Task 10: User Management — Change Password & Add Users (Backend + Web + Mobile)

**Goal:** Allow the current user to change their password and add new users (each with their own isolated data). This requires migrating from the singleton user design to true multi-user.

**Files:**
- Modify: `backend/src/NoteBook.Api/Models/Note.cs` — add `UserId` FK
- Modify: `backend/src/NoteBook.Api/Data/AppDbContext.cs` — add User→Note relationship
- Modify: `backend/src/NoteBook.Api/Controllers/AuthController.cs` — add `PUT /api/auth/password`, `POST /api/auth/users`
- Modify: `backend/src/NoteBook.Api/Services/AuthService.cs` — add `ChangePasswordAsync`, `CreateUserAsync`
- Modify: `backend/src/NoteBook.Api/Services/IAuthService.cs` — new method signatures
- Modify: `backend/src/NoteBook.Api/DTOs/AuthDtos.cs` — add new request/response types
- Modify: `backend/src/NoteBook.Api/Controllers/NotesController.cs` — filter notes by `UserId`
- Modify: `backend/src/NoteBook.Api/Program.cs` — migration logic for adding `UserId` column
- Modify: `apps/web/src/api/client.ts` — add `changePassword()`, `createUser()` API methods
- Modify: `apps/web/src/pages/SettingsPage.tsx` — add Account section
- Modify: `apps/mobile/src/api/mobileClient.ts` — add `changePassword()`, `createUser()`
- Modify: `apps/mobile/src/screens/SettingsScreen.tsx` — add Account section

**Interfaces:**
- Produces:
  - `PUT /api/auth/password` — `{ currentPassword, newPassword }` → `{ success: true }`
  - `POST /api/auth/users` — `{ username, password }` → `{ id, username }` (admin-only)
  - `Note.UserId: Guid` — FK to `User.Id`

- [ ] **Step 1: Backend — Add UserId to Note model**

In `Note.cs`, add `public Guid UserId { get; set; }` and `public User? User { get; set; }`. In `AppDbContext.OnModelCreating`, add the relationship and index.

- [ ] **Step 2: Backend — Migration logic in Program.cs**

After `db.Database.EnsureCreated()`, execute raw SQL to:
1. Add `UserId` column if not exists (nullable initially)
2. Set all existing notes' `UserId` to the first user's ID
3. Make `UserId` NOT NULL
4. Add FK constraint and index

- [ ] **Step 3: Backend — Filter notes by authenticated user**

In `NotesController.cs`, extract `userId` from JWT claims (`ClaimTypes.NameIdentifier`). Add `.Where(n => n.UserId == userId)` to all note queries. Set `UserId` on new notes.

- [ ] **Step 4: Backend — Add ChangePassword endpoint**

In `IAuthService`, add `Task<bool> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword)`.
In `AuthService`, implement: find user, verify current password with BCrypt, hash new password, save.
In `AuthController`, add `[HttpPut("password")] [Authorize]` that extracts userId from claims and calls service.

- [ ] **Step 5: Backend — Add CreateUser endpoint**

In `IAuthService`, add `Task<AuthResponse?> CreateUserAsync(string username, string password)`.
In `AuthService`, implement: check username uniqueness, create user with new GUID, hash password, save.
In `AuthController`, add `[HttpPost("users")] [Authorize]` endpoint.
Add DTOs: `ChangePasswordRequest(string CurrentPassword, string NewPassword)`, `CreateUserRequest(string Username, string Password)`.

- [ ] **Step 6: Web — Add API methods and Settings UI**

In `client.ts`, add `changePassword(current, newPw)` and `createUser(username, password)`.
In `SettingsPage.tsx`, add "Account" section with:
- Change password form (current + new + confirm)
- Add user form (username + password)

- [ ] **Step 7: Mobile — Add API methods and Settings UI**

Same as web but in `mobileClient.ts` and `SettingsScreen.tsx`.

- [ ] **Step 8: Build and verify**

```bash
cd apps/web && npx vite build
```
Expected: Build succeeds.

- [ ] **Step 9: Commit**
```bash
git add backend/src apps/web/src apps/mobile/src packages/shared/src
git commit -m "feat: user management — change password, add users, per-user data isolation"
```

---

### Task 11: Multiple Spaces with Sub-Spaces (Backend + Shared + Web + Mobile)

**Goal:** Add a Space entity with parent-child hierarchy. Each user can have multiple spaces and sub-spaces, each containing its own notes. Notes can be moved between spaces.

**Files:**
- Create: `backend/src/NoteBook.Api/Models/Space.cs` — `{ Id, Name, ParentSpaceId?, UserId, Position, CreatedAt }`
- Modify: `backend/src/NoteBook.Api/Models/Note.cs` — add `SpaceId` FK
- Modify: `backend/src/NoteBook.Api/Data/AppDbContext.cs` — add `DbSet<Space>`, configure relationships
- Create: `backend/src/NoteBook.Api/Controllers/SpacesController.cs` — CRUD + tree endpoints
- Create: `backend/src/NoteBook.Api/DTOs/SpaceDtos.cs` — request/response records
- Modify: `backend/src/NoteBook.Api/Controllers/NotesController.cs` — filter by `spaceId` query param, move note endpoint
- Modify: `backend/src/NoteBook.Api/Program.cs` — migration logic for Space table + Note.SpaceId
- Modify: `packages/shared/src/types/note.ts` — add `spaceId?: string` to `NoteDto`
- Create: `packages/shared/src/types/space.ts` — `SpaceDto` interface
- Modify: `packages/shared/src/index.ts` — export SpaceDto
- Modify: `apps/web/src/api/client.ts` — add space API methods
- Create: `apps/web/src/components/SpaceSelector.tsx` — space tree in side menu
- Modify: `apps/web/src/components/SideMenu.tsx` — embed SpaceSelector
- Modify: `apps/web/src/App.tsx` — add `activeSpaceId` state, pass to pages
- Modify: `apps/web/src/pages/HomePage.tsx` — receive and use `spaceId` filter
- Modify: `apps/mobile/src/api/mobileClient.ts` — add space API methods
- Create: `apps/mobile/src/components/SpaceSelector.tsx` — space picker for mobile
- Modify: `apps/mobile/src/screens/NotesGridScreen.tsx` — space filter
- Modify: `apps/mobile/App.tsx` — space state

**Interfaces:**
- Produces:
  - `Space` model: `{ Id: Guid, Name: string, ParentSpaceId: Guid?, UserId: Guid, Position: int, CreatedAt: DateTime }`
  - `GET /api/spaces` → `SpaceDto[]` (flat list; client builds tree from `parentSpaceId`)
  - `POST /api/spaces` → `SpaceDto`
  - `PUT /api/spaces/{id}` → `SpaceDto`
  - `DELETE /api/spaces/{id}` → 204 (cascade deletes child spaces and their notes)
  - `PUT /api/notes/{id}/move` → `{ spaceId: Guid }` moves a note to a different space
  - `GET /api/notes?spaceId={id}` → filters notes by space
  - `SpaceDto`: `{ id: string; name: string; parentSpaceId: string | null; position: number; createdAt: string }`

- [ ] **Step 1: Backend — Create Space model**

Create `backend/src/NoteBook.Api/Models/Space.cs` with `Id`, `Name`, `ParentSpaceId`, `UserId`, `Position`, `CreatedAt` properties. Add self-referencing FK for parent.

- [ ] **Step 2: Backend — Add SpaceId to Note, update DbContext**

Add `public Guid? SpaceId { get; set; }` and `public Space? Space { get; set; }` to `Note.cs`. In `AppDbContext`, add `DbSet<Space>`, configure Space entity with indexes and cascades.

- [ ] **Step 3: Backend — Migration logic in Program.cs**

Add SQL to create `Spaces` table if not exists. Add `SpaceId` column to `Notes` if not exists. Create a default "General" space for each user and assign all existing notes to it.

- [ ] **Step 4: Backend — Create SpacesController**

CRUD endpoints: GET all (filtered by user), POST create, PUT update (name, parent, position), DELETE (cascade delete child spaces → notes → blocks). Create DTOs.

- [ ] **Step 5: Backend — Add space filtering to NotesController**

Add optional `[FromQuery] Guid? spaceId` to `GetNotes()`. If provided, filter by it. Add `PUT /api/notes/{id}/move` endpoint that changes `SpaceId`.

- [ ] **Step 6: Shared — Add SpaceDto**

Create `packages/shared/src/types/space.ts` with `SpaceDto` interface. Export from `index.ts`. Add `spaceId?: string` to `NoteDto`.

- [ ] **Step 7: Web — Add space API methods and SpaceSelector**

In `client.ts`, add `getSpaces()`, `createSpace()`, `updateSpace()`, `deleteSpace()`, `moveNote()`.
Create `apps/web/src/components/SpaceSelector.tsx` — renders a tree of spaces with expand/collapse, add button, context menu (rename, delete). Embeds inside `SideMenu.tsx`.

- [ ] **Step 8: Web — Wire space selection into App**

Add `activeSpaceId` state to `AppContent`. Pass to `HomePage` as a filter. When creating notes, include `spaceId`. Add space param to `loadNotes`.

- [ ] **Step 9: Mobile — Add space API methods and SpaceSelector**

Mirror web changes in `mobileClient.ts`. Create `apps/mobile/src/components/SpaceSelector.tsx`. Add space picker to `NotesGridScreen` or as a drawer/tab.

- [ ] **Step 10: Build shared package**

```bash
cd packages/shared && npx tsc
```
Expected: Compiles successfully.

- [ ] **Step 11: Build and verify web**

```bash
cd apps/web && npx vite build
```
Expected: Build succeeds.

- [ ] **Step 12: Commit**
```bash
git add backend/src packages/shared/src apps/web/src apps/mobile/src
git commit -m "feat: multiple spaces with sub-spaces, note movement between spaces"
```

---
