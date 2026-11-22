# Note-Taking App — Multi-User Spaces, Notion Editor & UI Refinements Design

**Date:** 2026-11-18  
**Author:** Antigravity Team  
**Status:** In Review (Approach A Selected)  

---

## 1. Intent and Why

During user testing of the deployed personal note-taking application on MonsterASP, six immediate UX and stability improvements were requested:
1. **Custom App Scrollbar:** Replace default browser scrollbars with thin, rounded scrollbars matching the stone light/dark color palette.
2. **Functional Deletion (Outside & Inside):** Ensure delete buttons on the note card and inside the note modal work reliably and update the UI immediately without database errors.
3. **Native Notion-Style Table Block:** Redesign the table block from an Excel-like bordered grid into a seamless document block that blends into the note aesthetics, while supporting bi-directional clipboard interop with Excel and Google Sheets.
4. **Real-Time Reactive UI Updates:** Prevent the need for manual page refreshes when creating, editing, re-ordering, coloring, or deleting notes and blocks.
5. **Floating/Sticky Editor Toolbar:** Keep block creation tools accessible when scrolling through long notes without obscuring note contents.
6. **Horizontal Color Palette:** Render the color swatch selector as a sleek, single horizontal pill row rather than a vertical stack.

Alongside these refinements, the user approved **Approach A (Native Integrated Upgrade)** to introduce production multi-tenancy (user self-registration and profile management) and hierarchical Spaces for note organization.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Seamless UI Refresh:** All note mutations (creation, title edit, block addition/deletion, color change, pinning, deletion) update local React state immediately and keep the card grid perfectly synchronized.
- **Reliable Deletion:** Deleting notes (from NoteCard or within BlockEditorModal) and blocks works reliably on both PostgreSQL backend and frontend, with optimistic UI updates.
- **Notion Table & Excel Interop:** An integrated, minimalist table block supporting keyboard tab navigation and standard TSV (`\t`, `\n`) clipboard copy-paste to and from Microsoft Excel and Google Sheets.
- **Sleek Floating Toolbar:** A sticky/floating toolbar pinned to the top of the editor viewport with smooth backdrop blur.
- **Horizontal Color Swatches:** A compact horizontal rounded pill with 12 distinct Keep pastel swatches.
- **Multi-Tenant Row-Level Scoping:** EF Core Global Query Filters (`UserId`) ensuring transparent isolation so each user only queries and mutates their own notes and spaces.
- **Hierarchical Spaces:** A nested Spaces tree in a collapsible sidebar, allowing notes to belong to spaces and sub-spaces.

### Non-Goals
- Real-time operational transform (OT) / CRDT collaborative typing across simultaneous users (Phase 4).
- Heavy external spreadsheet dependencies (e.g. Handsontable) that bloat bundle size and break React Native mobile parity.

### Anti-Goals
- Dropping existing database data or requiring manual database schema interventions on MonsterASP.
- Introducing breaking changes to the React Native companion app.

---

## 3. Constraints

- **MonsterASP Environment:** 256 MB RAM ceiling and 1 GB PostgreSQL database limit. All database migrations must be idempotent SQL (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) executed on application startup in `Program.cs`.
- **Performance:** Debounced auto-save (800ms) with zero UI lag during typing.
- **Theme Support:** Full support for both Light and Dark modes across all redesigned components.

---

## 4. Approaches Considered

- **Approach A: Native Integrated Upgrade (Selected):** Implement multi-tenant EF Core query filters, Spaces hierarchy, native TSV clipboard table interop, sticky floating toolbar, and centralized state management in `App.tsx` / `HomePage.tsx`. Delivers maximum performance and 100% web/mobile feature parity within memory bounds.
- **Approach B: Two-Stage Phased Rollout:** Split UI polish and Multi-tenancy into separate phases. Rejected because notes state management and sidebar navigation touch the exact same components twice.
- **Approach C: Third-Party Component Integration:** Use pre-packaged spreadsheet libraries. Rejected due to heavy memory overhead and lack of React Native support.

---

## 5. Detailed Architecture & Specifications

### 5.1 Database Schema & Multi-Tenancy (`NoteBook.Api`)
- **Entities Updated with `UserId`:**
  - `Note`: Add `Guid UserId` foreign key to `User`, `Guid? SpaceId` foreign key to `Space`.
  - `Block`: Retains `NoteId` foreign key (scoped transitively through `Note`).
  - `NoteLink`: Retains `SourceNoteId` foreign key (scoped transitively through `Note`).
- **New Entity: `Space`:**
  - `Id` (Guid, PK)
  - `UserId` (Guid, FK to User)
  - `Name` (string, max 100)
  - `Icon` (string, max 20, default '📁')
  - `ParentSpaceId` (Guid?, self-referential FK to Space)
  - `Position` (int)
  - `CreatedAt`, `UpdatedAt` (DateTime)
- **EF Core Scoping:**
  - Register `ICurrentUserService` retrieving `UserId` from the JWT `sub` claim.
  - In `AppDbContext.OnModelCreating`:
    - `modelBuilder.Entity<Note>().HasQueryFilter(n => n.UserId == _currentUserService.UserId);`
    - `modelBuilder.Entity<Space>().HasQueryFilter(s => s.UserId == _currentUserService.UserId);`
- **Idempotent Migration Script (`Program.cs`):**
  - Execute SQL on startup ensuring `"NoteLinks"` and `"Spaces"` tables exist, and `"UserId"` and `"SpaceId"` columns exist on `"Notes"`.

### 5.2 Authentication & User Registration Endpoints
- `POST /api/auth/register`: Public endpoint accepting `{ username, password }`. Validates uniqueness, hashes password with BCrypt, saves user, and returns JWT token + username.
- `PUT /api/auth/profile`: Authenticated endpoint allowing updating password.
- `GET /api/spaces`: List spaces for current user.
- `POST /api/spaces`: Create new space (`{ name, icon?, parentSpaceId? }`).
- `PUT /api/spaces/{id}`: Update space name/icon/parent.
- `DELETE /api/spaces/{id}`: Delete space (unlinks notes inside, setting `SpaceId = null`).

### 5.3 Web Frontend Real-Time State Management (`apps/web`)
- **Master State in `AppContent` (`App.tsx`):**
  - Maintain `notes: NoteDto[]` and `selectedNote: NoteDto | null` centrally.
  - `handleNoteUpdated(updated: NoteDto)`:
    - Updates `notes` list in real-time (`setNotes(prev => prev.map(n => n.id === updated.id ? { ...n, ...updated } : n))`).
    - Updates `selectedNote` if active.
  - `handleNoteCreated(newNote: NoteDto)`:
    - Adds to beginning of `notes`: `setNotes(prev => [newNote, ...prev])`.
    - Automatically opens in `BlockEditorModal`.
  - `handleNoteDeleted(noteId: string)`:
    - Removes from `notes`: `setNotes(prev => prev.filter(n => n.id !== noteId))`.
    - Closes `BlockEditorModal` if open.
  - When blocks are added, patched, or deleted inside `BlockEditorModal`, `onNoteUpdated({ ...note, blocks: newBlocks })` is called immediately so card previews on `HomePage` update in real time.

### 5.4 Deletion Reliability
- **Outside Delete (NoteCard):**
  - Clicking trash icon on card calls `handleDeleteNote` with optimistic removal from list, followed by `ApiClient.deleteNote(note.id)`.
- **Inside Delete (BlockEditorModal):**
  - Add red-accented `Trash2` icon in modal header alongside Pin and Close.
  - Clicking it prompts confirmation, calls `ApiClient.deleteNote(note.id)`, invokes `onNoteDeleted(note.id)`, and closes the modal.
- **Block Delete:**
  - Optimized optimistic removal from `blocks` array, immediate call to `onNoteUpdated`, and background call to `ApiClient.deleteBlock(blockId)`.

### 5.5 Notion-Style Table Block & Excel TSV Clipboard Interop
- **Aesthetics:**
  - Soft rounded container (`rounded-xl border border-stone-200/80 dark:border-stone-800 bg-white/40 dark:bg-stone-900/40 backdrop-blur-sm`).
  - Subtle header row with uppercase font, muted column delete icon on hover.
  - Minimal cell borders (`border-b border-r border-stone-200/40 dark:border-stone-800/40 last:border-r-0`).
  - Smooth cell inputs that blend naturally into the document typography.
  - Subtle "+ Add Row" and "+ Add Column" pill triggers.
- **Excel / Google Sheets Clipboard Interop:**
  - **Copy:** Copying table content formats rows and columns into standard Tab-Separated Values (`\t` for columns, `\n` for rows).
  - **Paste:** Pasting text containing tabs (`\t`) inside table cells parses the grid dimensions and populates or expands rectangular rows and columns automatically.

### 5.6 Floating Sticky Toolbar & Horizontal Color Swatch Bar
- **Floating Toolbar (`BlockEditorModal.tsx`):**
  - Positioned as a sticky top element (`sticky top-0 z-30 pt-2 pb-3 mb-2 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md border-b border-stone-200/50 dark:border-stone-800/50`).
  - Stays visible at the top of the modal window while scrolling through any length of note content.
- **Horizontal Color Swatches (`ColorPicker.tsx`):**
  - Single horizontal pill bar (`flex flex-row flex-nowrap items-center gap-1.5 px-2.5 py-1.5 rounded-full shadow-xl border border-stone-200/80 dark:border-stone-800 bg-white/95 dark:bg-stone-900/95`).
  - 12 circular swatches in one clean row with smooth scale transition.

### 5.7 Custom Scrollbars (`index.css`)
- Thin (6px) rounded scrollbars styled with `stone-400` (opacity 35%) in Light Mode and `stone-600` (opacity 40%) in Dark Mode.
- Applied across all `overflow-y-auto` and `overflow-x-auto` viewports.

---

## 6. What's Left to the Builder

- Exact icon selection for the Spaces sidebar tree.
- Animation timings (150ms-200ms) for modal and toolbar transitions.
- Keybinding bindings for tab navigation between table cells.
