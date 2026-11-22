# Note-Taking App — Phase 2: Rich Media, Obsidian Note Linking & Dark Mode Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the core note-taking app with Obsidian-style bidirectional note linking (`[[note title]]`), automatic backlink calculation, image upload blocks with disk quota protection for MonsterASP's 5 GB limit, PostgreSQL full-text search, and a comprehensive Dark Mode across Web and Mobile.

**Architecture:** A bidirectional link parser extracting `[[...]]` references upon block save into a `NoteLink` join table; a backlink query endpoint; local static file storage in `App_Data/uploads` with quota enforcement (safe 3.5 GB threshold); PostgreSQL full-text search indexing on note titles and JSONB block contents; and a unified Dark Mode system using Tailwind CSS (`class` strategy) with localStorage persistence for Web, and React Native ThemeContext with Expo SecureStore persistence for Mobile.

**Tech Stack:** ASP.NET Core Web API, EF Core, PostgreSQL (Full-Text Search & GIN indexes), React, Tailwind CSS, React Native (Expo), Lucide Icons, Vitest, xUnit.

**Spec:** [docs/superpowers/specs/2026-11-17-note-taking-app-design.md](file:///workspace/My-NoteBook/docs/superpowers/specs/2026-11-17-note-taking-app-design.md)

## Global Constraints

- MonsterASP total disk limit is 5 GB; total upload storage must be monitored and capped with warning thresholds (3.5 GB safe limit).
- All image uploads must be streamed directly to avoid in-memory byte buffer spikes (staying under 256 MB RAM limit). Max image size: 10 MB.
- Bidirectional links use the Obsidian syntax `[[Target Note Title]]`.
- Links must automatically update or gracefully display broken state if a target note title changes or is deleted.
- Dark mode must persist across page reloads (Web: localStorage) and app relaunches (Mobile: SecureStore / AsyncStorage), defaulting to system color scheme if not explicitly chosen.
- Keep card pastel colors must have tasteful dark-palette equivalents or colored subtle borders in dark mode for optimal legibility.

## Review Focus

1. **Circular note linking:** Notes linking to each other in cycles (`Note A -> Note B -> Note A`); backlinks query must query directly without recursive traversal causing infinite loops.
2. **5 GB disk space exhaustion:** Large image upload attempting to push disk over capacity; backend must validate remaining storage before saving stream to disk and reject with 507 Insufficient Storage.
3. **Renaming a linked note:** When Note A is renamed, existing `[[Old Name]]` text in other notes must either auto-migrate or show broken link styling.
4. **Image memory spike during upload:** Large camera photos (10MB+) loaded entirely into memory crashing the 256 MB app pool; streaming directly to file system is required.
5. **Dark mode flash of unstyled content (FOUC):** Web app must initialize theme before render or during initial load without flashing bright white in dark mode.

---

### Task 1: Image Upload Backend & Disk Quota Guard

**Files:**
- Create: `backend/src/NoteBook.Api/Services/IFileStorageService.cs`
- Create: `backend/src/NoteBook.Api/Services/LocalFileStorageService.cs`
- Create: `backend/src/NoteBook.Api/Controllers/UploadsController.cs`
- Create: `packages/shared/src/types/imageBlock.ts`
- Modify: `packages/shared/src/types/block.ts`
- Modify: `packages/shared/src/validation/blockValidator.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `backend/src/NoteBook.Api/Program.cs`
- Test: `backend/tests/NoteBook.Tests/UploadsControllerTests.cs`
- Test: `packages/shared/tests/blockValidator.test.ts`

**Interfaces:**
- Consumes: Multipart form file stream, `App_Data/uploads` directory
- Produces:
  - `POST /api/uploads` -> `{ url: string, filename: string, sizeBytes: number }`
  - Block type `'image'` with content: `{ url: string, caption?: string, width?: number, height?: number }`
  - Rejects files if storage exceeds 3.5 GB threshold with HTTP 507 Insufficient Storage.
  - Rejects files exceeding 10 MB with HTTP 400 Bad Request.

- [x] **Step 1: Write failing tests for ImageBlock type validation and UploadsController storage quota**
- [x] **Step 2: Run tests to verify they fail**
- [x] **Step 3: Implement IFileStorageService, LocalFileStorageService, and UploadsController with quota enforcement**
- [x] **Step 4: Run tests to verify they pass**
- [x] **Step 5: Commit**

---

### Task 2: Image Block UI in Web and React Native

**Files:**
- Create: `apps/web/src/components/editor/blocks/ImageBlock.tsx`
- Create: `apps/mobile/src/components/editor/MobileImageBlock.tsx`
- Modify: `apps/web/src/components/editor/BlockEditorModal.tsx`
- Modify: `apps/web/src/components/editor/EditorToolbar.tsx`
- Modify: `apps/mobile/src/components/editor/MobileBlockEditor.tsx`
- Modify: `apps/mobile/src/components/editor/BlockToolbar.tsx`
- Test: `apps/web/tests/ImageBlock.test.tsx`
- Test: `apps/mobile/tests/MobileImageBlock.test.ts`

**Interfaces:**
- Consumes: `POST /api/uploads`, `ImageBlockContent`
- Produces: Web & mobile image rendering with file picker/uploader, caption editing, preview, and delete block action.

- [ ] **Step 1: Write component tests for Web ImageBlock and MobileImageBlock**
- [ ] **Step 2: Run tests to verify they fail**
- [ ] **Step 3: Implement Web ImageBlock with drag-and-drop / file selector and MobileImageBlock**
- [ ] **Step 4: Run tests to verify they pass**
- [ ] **Step 5: Commit**

---

### Task 3: Obsidian Note Linking Parser & Backlink Data Layer

**Files:**
- Create: `backend/src/NoteBook.Api/Models/NoteLink.cs`
- Create: `backend/src/NoteBook.Api/Services/ILinkParserService.cs`
- Create: `backend/src/NoteBook.Api/Services/LinkParserService.cs`
- Modify: `backend/src/NoteBook.Api/Data/AppDbContext.cs`
- Modify: `backend/src/NoteBook.Api/Controllers/NotesController.cs`
- Modify: `backend/src/NoteBook.Api/Controllers/BlocksController.cs`
- Test: `backend/tests/NoteBook.Tests/LinkParserServiceTests.cs`
- Test: `backend/tests/NoteBook.Tests/NotesControllerBacklinkTests.cs`

**Interfaces:**
- Consumes: Text block content strings with `[[Target Note Title]]` syntax
- Produces:
  - Auto-extracted `NoteLink` records (`SourceNoteId`, `TargetNoteId`, `LinkTitle`)
  - `GET /api/notes/{id}/backlinks` -> `NoteDto[]` returning notes referencing `{id}`
  - Synchronizes links on block creation/update/deletion.

- [ ] **Step 1: Write unit tests for LinkParserService regex extraction and backlinks endpoint**
- [ ] **Step 2: Run tests to verify they fail**
- [ ] **Step 3: Implement LinkParserService, NoteLink entity, DbContext mapping, and backlinks endpoint**
- [ ] **Step 4: Run tests to verify they pass**
- [ ] **Step 5: Commit**

---

### Task 4: Interactive Note Linking & Backlinks Drawer

**Files:**
- Create: `apps/web/src/components/editor/BacklinksPanel.tsx`
- Create: `apps/web/src/components/editor/NoteAutocomplete.tsx`
- Create: `apps/mobile/src/components/editor/MobileBacklinksModal.tsx`
- Modify: `apps/web/src/components/editor/BlockEditorModal.tsx`
- Modify: `apps/web/src/components/editor/blocks/TextBlock.tsx`
- Modify: `apps/mobile/src/components/editor/MobileBlockEditor.tsx`
- Modify: `apps/mobile/src/components/editor/MobileTextBlock.tsx`
- Test: `apps/web/tests/BacklinksPanel.test.tsx`
- Test: `apps/mobile/tests/MobileBacklinks.test.ts`

**Interfaces:**
- Consumes: `GET /api/notes/{id}/backlinks`, notes list
- Produces:
  - Inline autocomplete suggestion popup when typing `[[` in text blocks
  - Clickable `[[...]]` links that open the target note in editor
  - Backlinks panel at the bottom of the editor showing all notes linking here.

- [ ] **Step 1: Write component tests for BacklinksPanel and note link navigation**
- [ ] **Step 2: Run tests to verify they fail**
- [ ] **Step 3: Implement NoteAutocomplete, BacklinksPanel, and link navigation in Web and Mobile**
- [ ] **Step 4: Run tests to verify they pass**
- [ ] **Step 5: Commit**

---

### Task 5: Full-Text Search across Notes & Block Contents

**Files:**
- Create: `backend/src/NoteBook.Api/Controllers/SearchController.cs`
- Modify: `backend/src/NoteBook.Api/Data/AppDbContext.cs`
- Create: `apps/web/src/components/SearchBar.tsx`
- Create: `apps/mobile/src/components/MobileSearchBar.tsx`
- Modify: `apps/web/src/pages/HomePage.tsx`
- Modify: `apps/mobile/src/screens/NotesGridScreen.tsx`
- Test: `backend/tests/NoteBook.Tests/SearchControllerTests.cs`
- Test: `apps/web/tests/SearchBar.test.tsx`

**Interfaces:**
- Consumes: Search query string
- Produces: `GET /api/search?q={query}` -> `NoteDto[]` with matching titles or block content highlights.

- [ ] **Step 1: Write search controller integration tests and SearchBar tests**
- [ ] **Step 2: Run tests to verify they fail**
- [ ] **Step 3: Implement SearchController (searching title and JSONB block contents) and SearchBar components**
- [ ] **Step 4: Run tests to verify they pass**
- [ ] **Step 5: Commit**

---

### Task 6: Comprehensive Dark Mode System for Web and Mobile

**Files:**
- Web:
  - Create: `apps/web/src/context/ThemeContext.tsx`
  - Modify: `apps/web/tailwind.config.js` (enable `darkMode: 'class'`)
  - Modify: `apps/web/src/App.tsx` (wrap in ThemeProvider)
  - Modify: `apps/web/src/components/Header.tsx` (theme toggle button with Sun / Moon icons)
  - Modify: `apps/web/src/components/NoteCard.tsx` (dark mode card styling & dark pastel tones)
  - Modify: `apps/web/src/components/editor/BlockEditorModal.tsx` (dark mode editor surfaces)
  - Modify: `apps/web/src/components/editor/EditorToolbar.tsx` (dark mode toolbar buttons)
  - Modify: `apps/web/src/pages/HomePage.tsx` (dark background)
  - Modify: `apps/web/src/pages/LoginPage.tsx` (dark surfaces)
  - Modify: `apps/web/src/pages/SetupPage.tsx` (dark surfaces)
  - Test: `apps/web/tests/ThemeContext.test.tsx`
- Mobile:
  - Create: `apps/mobile/src/context/ThemeContext.tsx`
  - Modify: `apps/mobile/App.tsx` (wrap in ThemeProvider, dynamic StatusBar style)
  - Modify: `apps/mobile/src/screens/NotesGridScreen.tsx` (theme toggle button & dark styling)
  - Modify: `apps/mobile/src/screens/NoteDetailScreen.tsx` (dark styling)
  - Modify: `apps/mobile/src/screens/LoginScreen.tsx` (dark styling)
  - Modify: `apps/mobile/src/components/MobileNoteCard.tsx` (dark mode card styling)
  - Modify: `apps/mobile/src/components/editor/MobileBlockEditor.tsx` (dark mode editor styling)
  - Test: `apps/mobile/tests/ThemeContext.test.ts`

**Interfaces:**
- Consumes: User preference or system color scheme (`'light' | 'dark' | 'system'`)
- Produces:
  - Persisted theme state in `localStorage` (Web) and `SecureStore` (Mobile)
  - Seamless toggle button between Light and Dark mode
  - High-contrast, polished dark aesthetics across all screens, cards, modals, and toolbars.

- [ ] **Step 1: Write unit tests for ThemeContext (initialization, toggle, persistence)**
- [ ] **Step 2: Run tests to verify they fail**
- [ ] **Step 3: Implement ThemeContext, Tailwind class toggle, and dark styling across Web and Mobile**
- [ ] **Step 4: Run tests to verify they pass**
- [ ] **Step 5: Commit**
