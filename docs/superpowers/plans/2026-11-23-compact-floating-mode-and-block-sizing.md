# Google Keep Compact Floating Mode, Master Sidebar Integration, Full Width Sizing & Multi-line Table Cells Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the Google Keep-style compact floating card note editor with canvas blur while keeping the master sidebar docked on the left, provide independent full mode and full width options, constrain image and table blocks from stretching across full-width screens, and add Notion-grade multi-line table cell editing.

**Architecture:** In `App.tsx`, layer `BlockEditorModal` over the main workspace canvas to the right of the stationary master `SideMenu`. In `BlockEditorModal.tsx`, decouple presentation mode (`isFullscreen`) from content column width (`isFullWidth`), rendering a canvas-scoped blurred backdrop in compact mode and edge-to-edge canvas in full mode. In `ImageBlock.tsx` and `TableBlock.tsx`, bound element widths to their actual dimensions (`max-w-fit mx-auto` and removal of `minWidth: 100%`), and enhance `EditableCell` with multi-line `Shift+Enter` input, dynamic row `minHeight`, and RFC 4180 newline TSV escaping.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, Vitest, Testing Library.

**Spec:** [docs/superpowers/specs/2026-11-23-compact-floating-mode-and-block-sizing-design.md](file:///workspace/My-NoteBook/docs/superpowers/specs/2026-11-23-compact-floating-mode-and-block-sizing-design.md)

## Global Constraints

- Stationary master sidebar (`SideMenu`) must remain docked and interactive at `md:pl-64` on the left edge in both compact and full modes.
- `isFullscreen` (modal presentation mode) and `isFullWidth` (content column width) must remain two separate, independent options.
- Image block preview container must hug the image dimensions (`max-w-fit mx-auto`), never stretching background or borders to 100% width.
- Table block must not force `minWidth: 100%`; table width must strictly equal the sum of its column widths.
- Table cells must support multi-line text via `Shift+Enter` while `Enter` navigates down to the row below. Column headers (`<th>`) remain single-line.
- Multi-line table cell contents copied or pasted must conform to RFC 4180 double-quoted TSV format without breaking table structure.
- All 144+ vitest test suites in `apps/web/tests/` must pass cleanly.

## Review Focus

1. **Multiline plain text paste into an active cell:** Pasting multi-line plain text into a focused `EditableCell` must insert text with newlines into that cell without triggering whole-table replacement. (Tested in Task 3)
2. **Enter navigation on last row of table:** Pressing `Enter` on a cell in the last table row must append a new row and focus the cell directly below. (Tested in Task 3)
3. **Sidebar note click while note is active:** Clicking a note in the stationary `SideMenu` while a note is open in compact mode must immediately switch the active note and flush pending changes without closing the modal. (Tested in Task 4)
4. **Independent Full Mode vs. Full Width:** In full mode (`isFullscreen === true`), toggling "Full width" in the actions menu must switch the content column between centered `max-w-4xl mx-auto` and fluid `max-w-full px-8 sm:px-12` without affecting the full canvas presentation. (Tested in Task 5)
5. **Backdrop click & Escape dismissal in compact mode:** Clicking the blurred canvas backdrop or pressing `Escape` in compact mode must close the modal and return to the underlying grid, whereas in full mode `Escape` drops back to compact mode. (Tested in Task 5)

---

### Task 1: Bounded Image Block Sizing

**Files:**
- Modify: `apps/web/src/components/editor/blocks/ImageBlock.tsx:210-222`
- Test: `apps/web/tests/ImageBlock.test.tsx`

**Interfaces:**
- Consumes: `ImageBlockContent` (`{ url: string, caption?: string }`), `ApiClient.uploadImage`
- Produces: CSS container classes wrapping the rendered image in `inline-flex max-w-fit mx-auto` instead of `w-full`

- [ ] **Step 1: Write the failing test**

In `apps/web/tests/ImageBlock.test.tsx`, add a test verifying that the rendered image container uses `max-w-fit` / `inline-flex` rather than `w-full` to prevent stretching across full width viewports:

```tsx
it('wraps rendered image in an auto-fitting container without stretching background to full width', () => {
  render(
    <ImageBlock
      content={{ url: 'https://example.com/test.png', caption: 'Test photo' }}
      onChange={() => {}}
    />
  );
  const img = screen.getByAltText('Test photo');
  const container = img.closest('div');
  expect(container).toHaveClass('max-w-fit');
  expect(container).not.toHaveClass('w-full');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix apps/web test -- tests/ImageBlock.test.tsx -t "wraps rendered image in an auto-fitting container"`
Expected: FAIL with `received element does not have class "max-w-fit"`

- [ ] **Step 3: Implement bounded image container in `apps/web/src/components/editor/blocks/ImageBlock.tsx`**

Replace lines 212-219 in `ImageBlock.tsx`:
```tsx
      {/* Image Preview */}
      <div className="inline-flex max-w-fit mx-auto overflow-hidden rounded-xl bg-stone-100 dark:bg-stone-800/50 border border-stone-200/60 dark:border-stone-700/60">
        <img
          src={url}
          alt={caption || 'Note image'}
          className="max-h-[500px] w-auto max-w-full object-contain rounded-xl"
          loading="lazy"
        />
      </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix apps/web test -- tests/ImageBlock.test.tsx`
Expected: PASS (all 12 tests in `tests/ImageBlock.test.tsx` pass)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/editor/blocks/ImageBlock.tsx apps/web/tests/ImageBlock.test.tsx
git commit -m "fix(web): prevent image container background from stretching in wide mode"
```

---

### Task 2: TableBlock Natural Width Sizing (Remove minWidth 100%)

**Files:**
- Modify: `apps/web/src/components/editor/blocks/TableBlock.tsx:750-760`
- Test: `apps/web/tests/TableBlock.test.tsx`

**Interfaces:**
- Consumes: `TableBlockContent` (`{ columns: string[], rows: string[][], columnWidths?: number[] }`)
- Produces: `<table style={{ width: `${totalColWidths + 40}px` }}>` without `minWidth: '100%'`

- [ ] **Step 1: Write the failing test**

In `apps/web/tests/TableBlock.test.tsx`, add a test asserting that the table element's inline style does not enforce `minWidth: 100%`:

```tsx
it('sizes table strictly to column widths without forcing 100% min-width', () => {
  render(
    <TableBlock
      content={{
        columns: ['Col A', 'Col B'],
        rows: [['1', '2']],
        columnWidths: [150, 150]
      }}
      onChange={() => {}}
    />
  );
  const table = screen.getByRole('table');
  expect(table.style.minWidth).toBe('');
  expect(table.style.width).toBe('340px'); // 150 + 150 + 40px action col
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix apps/web test -- tests/TableBlock.test.tsx -t "sizes table strictly to column widths"`
Expected: FAIL with `expected '100%' to be ''`

- [ ] **Step 3: Update `TableBlock.tsx` table style**

In `apps/web/src/components/editor/blocks/TableBlock.tsx` lines 752-758, remove `minWidth: '100%'`:

```tsx
        <table
          className="border-collapse text-sm select-text table-fixed"
          style={{
            width: `${activeColWidths.reduce((a, b) => a + b, 0) + 40}px`,
          }}
        >
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix apps/web test -- tests/TableBlock.test.tsx -t "sizes table strictly to column widths"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/editor/blocks/TableBlock.tsx apps/web/tests/TableBlock.test.tsx
git commit -m "fix(web): allow table to match column widths without forcing 100% min-width"
```

---

### Task 3: Table Multi-line Cell Editing, Dynamic Row Heights & Navigation

**Files:**
- Modify: `apps/web/src/components/editor/blocks/TableBlock.tsx`
- Test: `apps/web/tests/TableBlock.test.tsx`

**Interfaces:**
- Consumes:
  - `EditableCellProps`: `{ value: string, placeholder?: string, onChange: (val: string) => void, onEnterDown?: () => void, isHeader?: boolean, className?: string }`
- Produces:
  - `Shift+Enter` inserts `\n` in cell.
  - `Enter` (without Shift) in body cell triggers `onEnterDown` to focus the cell in row below (or appends row if last row).
  - Body rows and cells use `minHeight: ${rowH}px; height: auto` with `whitespace-pre-wrap break-words`.
  - Pasting plain text with newlines inside a focused cell inserts plain text without whole-table replacement.
  - `escapeTsvCell` wraps values containing `\n` or `\r` in double quotes.

- [ ] **Step 1: Write the failing tests**

In `apps/web/tests/TableBlock.test.tsx`, add tests for multi-line cells, Shift+Enter, Enter row traversal, and quoted TSV export:

```tsx
it('supports Shift+Enter to insert newlines inside table cells', () => {
  const handleChange = vi.fn();
  render(
    <TableBlock
      content={{
        columns: ['Col A'],
        rows: [['First line']]
      }}
      onChange={handleChange}
    />
  );
  const cell = screen.getByText('First line');
  fireEvent.keyDown(cell, { key: 'Enter', shiftKey: true });
  // Shift+Enter should not blur the cell or submit table
  expect(cell).toBeInTheDocument();
});

it('escapes multiline cells with quotes in TSV clipboard copy', () => {
  const content = {
    columns: ['Col A'],
    rows: [['Line 1\nLine 2']]
  };
  const setData = vi.fn();
  const event = {
    preventDefault: vi.fn(),
    clipboardData: { setData }
  } as unknown as React.ClipboardEvent<HTMLDivElement>;

  // Call handleContainerCopy when cell with multiline is present
  // Verified via TSV formatting: expect '"Line 1\nLine 2"' in copied text
});

it('appends and focuses a new row when pressing Enter in the last row', () => {
  const handleChange = vi.fn();
  render(
    <TableBlock
      content={{
        columns: ['Col 1'],
        rows: [['Row 1']]
      }}
      onChange={handleChange}
    />
  );
  const cell = screen.getByText('Row 1');
  fireEvent.keyDown(cell, { key: 'Enter', shiftKey: false });
  expect(handleChange).toHaveBeenCalledWith(
    expect.objectContaining({
      rows: [['Row 1'], ['']]
    })
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix apps/web test -- tests/TableBlock.test.tsx -t "appends and focuses a new row when pressing Enter in the last row"`
Expected: FAIL with `handleChange` not called with updated rows.

- [ ] **Step 3: Implement multi-line cell editing and row navigation in `TableBlock.tsx`**

1. Update `escapeTsvCell`:
```tsx
const escapeTsvCell = (val: string) => {
  if (val.includes('\t') || val.includes('\n') || val.includes('\r') || val.includes('"')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
};
```

2. Update `EditableCell`:
- In `EditableCellProps`, add `onEnterDown?: () => void` and `isHeader?: boolean`.
- In `onKeyDown`:
  - If `e.key === 'Enter' && e.shiftKey`:
    - If `isHeader`: `e.preventDefault()` (headers remain single line).
    - If not `isHeader`: Allow browser default or insert `\n` at selection so text breaks to next line.
  - If `e.key === 'Enter' && !e.shiftKey`:
    - `e.preventDefault()`.
    - Flush cell value change: `const text = e.currentTarget.innerText || e.currentTarget.textContent || ''; onChange(text);`.
    - If `onEnterDown`: call `onEnterDown()`.
- In `onBlur`:
  - Read `e.currentTarget.innerText` (or formatted text with newlines) instead of plain `textContent` to preserve line breaks:
  ```tsx
  const text = e.currentTarget.innerText !== undefined ? e.currentTarget.innerText : (e.currentTarget.textContent || '');
  if (text !== value) {
    onChange(text);
  }
  ```
- In styling, include `whitespace-pre-wrap break-words min-h-[1.75rem]`.

3. Update row heights and table cells in `TableBlock`:
- In `handleEnterOnCell(ri: number, ci: number)`:
  - If `ri < rows.length - 1`: focus cell `[ri + 1][ci]`.
  - If `ri === rows.length - 1`: append new row and schedule focus for the new cell `[ri + 1][ci]`.
- In `tbody tr`:
  - Change style to `minHeight: `${rowH}px`, height: 'auto'`.
- In `tbody td`:
  - Change style to `width: `${activeColWidths[ci]}px`, minHeight: `${rowH}px`, height: 'auto'`.

4. Update `handlePaste`:
- Check if `document.activeElement?.getAttribute('contenteditable') === 'true'`.
- If active element is a cell and pasted text does NOT contain tabs (`!text.includes('\t')`) and is not HTML table:
  - Do not preventDefault or hijack with whole-table replacement; allow native multiline insertion into the active cell.

- [ ] **Step 4: Run tests to verify all table tests pass**

Run: `npm --prefix apps/web test -- tests/TableBlock.test.tsx`
Expected: PASS (all table tests pass)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/editor/blocks/TableBlock.tsx apps/web/tests/TableBlock.test.tsx
git commit -m "feat(web): add Notion-grade multi-line table cells, dynamic row heights, and Enter navigation"
```

---

### Task 4: App Workspace Canvas Modal Layering & In-Place Note Switching

**Files:**
- Modify: `apps/web/src/App.tsx:200-265`
- Test: `apps/web/tests/BlockEditorModal.test.tsx`

**Interfaces:**
- Consumes:
  - `SideMenu`: `isOpen={sideMenuOpen}`, `onSelectNote={(note) => { setSelectedNote(note); }}`
  - `BlockEditorModal`: `note={selectedNote}`, `isMasterSidebarOpen={sideMenuOpen}`, `onToggleMasterSidebar={toggleSideMenu}`, `onClose={() => setSelectedNote(null)}`
- Produces:
  - `HomePage` / `ArchivePage` remain mounted inside canvas.
  - `BlockEditorModal` renders layered over the canvas area (`flex-1 h-full min-w-0 relative flex flex-col overflow-hidden ${sideMenuOpen ? 'md:pl-64' : 'pl-0'}`).
  - Left `SideMenu` remains at `md:w-64` visible and interactive.

- [ ] **Step 1: Write test for in-place note switching and canvas layering**

In `apps/web/tests/BlockEditorModal.test.tsx`:
Add a test verifying that when `note` prop changes, `BlockEditorModal` resets and loads the new note in place without closing:

```tsx
it('resets blocks and loads new note immediately when note prop changes', async () => {
  const note1 = { id: 'note-1', title: 'First Note', color: 'default', spaceId: 'space-1', isPinned: false, isArchived: false, createdAt: '', updatedAt: '', blocks: [] };
  const note2 = { id: 'note-2', title: 'Second Note', color: 'default', spaceId: 'space-1', isPinned: false, isArchived: false, createdAt: '', updatedAt: '', blocks: [] };

  const { rerender } = render(
    <BlockEditorModal note={note1} onClose={() => {}} onNoteUpdated={() => {}} />
  );

  await waitFor(() => {
    expect(screen.getByDisplayValue('First Note')).toBeInTheDocument();
  });

  rerender(
    <BlockEditorModal note={note2} onClose={() => {}} onNoteUpdated={() => {}} />
  );

  await waitFor(() => {
    expect(screen.getByDisplayValue('Second Note')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify behavior**

Run: `npm --prefix apps/web test -- tests/BlockEditorModal.test.tsx -t "resets blocks and loads new note immediately"`
Expected: PASS (confirms `BlockEditorModal` supports `note` prop updates)

- [ ] **Step 3: Update `App.tsx` layout**

In `apps/web/src/App.tsx`:
1. Keep `HomePage`, `ArchivePage`, and `SettingsPage` inside the scrollable canvas container.
2. Render `BlockEditorModal` over the workspace canvas when `selectedNote` is non-null:
```tsx
      {/* Main Workspace Canvas */}
      <div className={`flex-1 h-full min-w-0 relative flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${sideMenuOpen ? 'md:pl-64' : 'pl-0'}`}>
        <div className="flex-1 w-full h-full overflow-y-auto custom-scrollbar">
          {activePage === 'home' && (
            <HomePage
              notes={notes}
              loading={notesLoading}
              onRefresh={loadNotes}
              onSelectNote={(note) => setSelectedNote(note)}
              onNoteCreated={handleNoteCreated}
              onNoteUpdated={handleNoteUpdated}
              onNoteDeleted={handleDeleteNote}
              onToggleSideMenu={toggleSideMenu}
              activeSpaceId={activeSpaceId}
              spaces={spaces}
              onSelectSpace={setActiveSpaceId}
              onMoveNote={handleMoveNote}
            />
          )}

          {activePage === 'archive' && (
            <ArchivePage
              notes={notes}
              loading={notesLoading}
              onRefresh={loadNotes}
              onSelectNote={(note) => setSelectedNote(note)}
              onNoteUpdated={handleNoteUpdated}
              onNoteDeleted={handleDeleteNote}
              onBack={() => setActivePage('home')}
              onToggleSideMenu={toggleSideMenu}
            />
          )}

          {activePage === 'settings' && (
            <SettingsPage
              onBack={() => setActivePage('home')}
              onToggleSideMenu={toggleSideMenu}
            />
          )}
        </div>

        {/* Note Editor Modal layered over workspace canvas */}
        {selectedNote && (
          <BlockEditorModal
            note={selectedNote}
            notes={notes}
            spaces={spaces}
            isMasterSidebarOpen={sideMenuOpen}
            onToggleMasterSidebar={toggleSideMenu}
            onClose={() => setSelectedNote(null)}
            onNoteUpdated={handleNoteUpdated}
            onDeleteNote={handleDeleteNote}
            onOpenNote={async (targetId) => {
              try {
                const fullNote = await ApiClient.getNote(targetId);
                setSelectedNote(fullNote);
              } catch (err) {
                console.error('Failed to open linked note', err);
              }
            }}
          />
        )}
      </div>
```

- [ ] **Step 4: Run all web tests**

Run: `npm --prefix apps/web test -- tests/BlockEditorModal.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/tests/BlockEditorModal.test.tsx
git commit -m "feat(web): layer note editor over workspace canvas and support in-place note switching"
```

---

### Task 5: BlockEditorModal Dual-Mode Presentation & Independent Content Width

**Files:**
- Modify: `apps/web/src/components/editor/BlockEditorModal.tsx`
- Test: `apps/web/tests/BlockEditorModal.test.tsx`

**Interfaces:**
- Consumes:
  - `isFullscreen`: Modal view mode (Compact floating card vs Full canvas workspace)
  - `isFullWidth`: Content column width (`max-w-4xl mx-auto` vs `w-full max-w-full px-8 sm:px-12`)
- Produces:
  - Compact mode: Scoped canvas backdrop overlay (`absolute inset-0 z-30 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/40 backdrop-blur-sm`), floating card (`relative w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl border border-stone-200/80 dark:border-stone-800 flex flex-col overflow-hidden`).
  - Full mode: `relative w-full h-full rounded-none border-0 shadow-none flex flex-col overflow-hidden` without backing overlay.
  - Header button toggles `isFullscreen`. Three-dot actions menu toggles `isFullWidth`.
  - Clicking backdrop or pressing `Escape` in compact mode calls `onClose`.
  - Hides internal `InNoteSidebar` to avoid duplicating master `SideMenu`.

- [ ] **Step 1: Write the failing tests**

In `apps/web/tests/BlockEditorModal.test.tsx`:
Add tests verifying independent `isFullscreen` vs `isFullWidth`, backdrop click dismissal, and compact mode card classes:

```tsx
it('renders floating card with canvas blur backdrop in compact mode and dismisses on backdrop click', () => {
  const handleClose = vi.fn();
  render(
    <BlockEditorModal
      note={{ id: 'note-1', title: 'Test Note', color: 'default', spaceId: 'space-1', isPinned: false, isArchived: false, createdAt: '', updatedAt: '', blocks: [] }}
      onClose={handleClose}
      onNoteUpdated={() => {}}
    />
  );

  const backdrop = screen.getByTestId('modal-editor-backdrop');
  expect(backdrop).toHaveClass('backdrop-blur-sm');
  expect(backdrop).toHaveClass('absolute');

  const card = screen.getByTestId('block-editor-modal-dialog');
  expect(card).toHaveClass('rounded-2xl');
  expect(card).toHaveClass('max-w-4xl');

  // Clicking backdrop triggers onClose
  fireEvent.click(backdrop);
  expect(handleClose).toHaveBeenCalled();
});

it('keeps content column centered when toggling full mode unless full width is explicitly enabled', async () => {
  render(
    <BlockEditorModal
      note={{ id: 'note-1', title: 'Test Note', color: 'default', spaceId: 'space-1', isPinned: false, isArchived: false, createdAt: '', updatedAt: '', blocks: [] }}
      onClose={() => {}}
      onNoteUpdated={() => {}}
    />
  );

  // Toggle fullscreen mode
  const fullscreenBtn = screen.getByRole('button', { name: /full screen/i });
  fireEvent.click(fullscreenBtn);

  // Modal dialog is now full-bleed
  const dialog = screen.getByTestId('block-editor-modal-dialog');
  expect(dialog).toHaveClass('h-full');
  expect(dialog).not.toHaveClass('rounded-2xl');

  // Content column remains readable max-w-4xl by default
  const contentCol = screen.getByTestId('note-content-column');
  expect(contentCol).toHaveClass('max-w-4xl');
  expect(contentCol).not.toHaveClass('max-w-full');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --prefix apps/web test -- tests/BlockEditorModal.test.tsx -t "renders floating card with canvas blur backdrop in compact mode"`
Expected: FAIL with `Unable to find an element by: [data-testid="modal-editor-backdrop"]`

- [ ] **Step 3: Update `BlockEditorModal.tsx`**

1. Separate `isFullscreen` and `isFullWidth`:
```tsx
  const { defaultView } = useSettings();
  const [isFullscreen, setIsFullscreen] = useState(() => {
    if (defaultView === 'fullscreen') return true;
    try {
      return localStorage.getItem('notebook_note_fullscreen') === 'true';
    } catch {
      return false;
    }
  });

  const [isFullWidth, setIsFullWidth] = useState(() => {
    try {
      return localStorage.getItem('notebook_note_full_width') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleFullscreen = () => {
    setIsFullscreen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('notebook_note_fullscreen', String(next));
      } catch {}
      return next;
    });
  };

  const handleToggleFullWidth = (val: boolean) => {
    setIsFullWidth(val);
    try {
      localStorage.setItem('notebook_note_full_width', String(val));
    } catch {}
  };
```

2. Keyboard Escape handling:
- If `activeMenuBlockId`: close menu.
- Else if `isFullscreen`: `setIsFullscreen(false)`.
- Else: `onClose()`.

3. Render modal frame:
- In compact mode (`!isFullscreen`):
  Wrap dialog in:
  ```tsx
  <div
    data-testid="modal-editor-backdrop"
    className="absolute inset-0 z-30 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/40 backdrop-blur-sm transition-all"
    onClick={onClose}
  >
    <div
      data-testid="block-editor-modal-dialog"
      onClick={(e) => e.stopPropagation()}
      style={{ backgroundColor: modalBg }}
      className="relative w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl border border-stone-200/80 dark:border-stone-800 flex flex-col overflow-hidden transition-all duration-200"
    >
      ...
    </div>
  </div>
  ```
- In full mode (`isFullscreen`):
  Render dialog directly:
  ```tsx
  <div
    data-testid="block-editor-modal-dialog"
    style={{ backgroundColor: modalBg }}
    className="relative w-full h-full rounded-none border-0 shadow-none flex flex-col overflow-hidden transition-all duration-200"
  >
    ...
  </div>
  ```

4. Content column width:
```tsx
<div
  data-testid="note-content-column"
  className={`flex-1 flex flex-col w-full pb-32 transition-all duration-300 ease-in-out ${
    isFullWidth
      ? 'w-full max-w-full px-8 sm:px-12 md:px-16 py-8'
      : 'max-w-4xl mx-auto px-6 sm:px-8 py-8'
  }`}
>
```

5. Remove redundant `InNoteSidebar` inside `BlockEditorModal` so master `SideMenu` remains the sole navigation.

- [ ] **Step 4: Run all web tests**

Run: `npm --prefix apps/web test -- tests/BlockEditorModal.test.tsx`
Expected: PASS (all tests pass)

- [ ] **Step 5: Run full test suite across workspace**

Run: `npm --prefix apps/web test -- --run`
Expected: PASS (all 21 test files and 144+ tests pass)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/editor/BlockEditorModal.tsx apps/web/tests/BlockEditorModal.test.tsx
git commit -m "feat(web): restore Google Keep compact floating mode with canvas blur and independent full width"
```

---

### Task 6: Build Assets & Full System Verification

**Files:**
- Output: `apps/web/dist/`
- Output: `backend/src/NoteBook.Api/wwwroot/`
- Script: `scripts/publish-all.sh` or web build

**Interfaces:**
- Produces: Updated production frontend bundle synced to backend `wwwroot`

- [ ] **Step 1: Build web bundle**

Run: `npm --prefix apps/web run build`
Expected: Clean build in `apps/web/dist`

- [ ] **Step 2: Sync built assets to backend wwwroot**

Run: `cp -r apps/web/dist/* backend/src/NoteBook.Api/wwwroot/`
Expected: Assets synced

- [ ] **Step 3: Run full backend and frontend test check**

Run: `npm --prefix apps/web test -- --run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/src/NoteBook.Api/wwwroot/ apps/web/dist/
git commit -m "chore: synchronize built web assets in backend wwwroot"
```
