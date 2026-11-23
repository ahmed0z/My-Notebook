# Design: Google Keep Compact Floating Mode, Master Sidebar Integration, Full Width Sizing & Multi-line Table Cells

## 1. Intent & The Why

In recent updates, the note editor was converted to an embedded full-screen view (`isEmbedded={true}`) to accommodate the master sidebar. While this kept the sidebar visible, it destroyed the popular Google Keep-style compact floating card experience where notes open as an elevated card with blurred sides over the active workspace. Furthermore, in full width mode, image block backgrounds and tables stretch uncontrollably across the entire screen, and table cells do not support multi-line text editing.

This design restores the classic compact floating modal with blurred sides while keeping the master sidebar docked and fully interactive on the left edge. It provides an independent toggle between compact floating mode and full mode, constrains image and table blocks to their natural content dimensions, and brings Notion-grade multi-line cell editing to tables.

---

## 2. Goals, Non-Goals, & Anti-Goals

### Goals
1. **Compact Floating Modal with Canvas Blur**: Open notes as a floating, centered card (`max-w-4xl`, `rounded-2xl`, soft drop-shadow) with a blurred backdrop (`backdrop-blur-sm bg-black/40`) constrained strictly to the main canvas area (right of the master sidebar).
2. **Stationary Master Sidebar**: Keep the left master sidebar (`SideMenu`) fully docked, visible, and unblurred on the left edge of the screen in both compact and full modes.
3. **In-Modal Note Switching**: When clicking any note item in the master sidebar while a note is currently open, switch the active note directly inside the open editor modal without closing or re-opening.
4. **Independent View Mode vs. Content Width**:
   - **View Mode Toggle**: Header button toggles between Compact Floating Card and Full Canvas Workspace.
   - **Content Width Toggle**: Three-dot menu toggles between Centered Readable Column (`max-w-4xl mx-auto`) and Edge-to-Edge (`max-w-full px-8 sm:px-12`). Both modes operate independently (e.g. Full Canvas can have a readable centered column, just like Notion).
5. **Bounded Image Block Sizing**: Prevent image blocks from stretching their container backgrounds and borders across 100% of the screen; the image preview container must hug the image (`max-w-fit mx-auto`).
6. **Natural Table Sizing**: Remove forced `minWidth: 100%` on table blocks so tables strictly match the sum of their defined column widths.
7. **Multi-line Table Cells**: Enable multi-row editing inside table cells using `Shift+Enter` for newlines and `Enter` for row navigation, with dynamic row `min-height`, `whitespace-pre-wrap`, and TSV clipboard quote preservation.

### Non-Goals
- Changing the storage schema or API contracts for notes, blocks, or spaces.
- Replacing or modifying the mobile drawer navigation behavior.
- Replacing the block editor system.

### Anti-Goals
- Full-viewport modal overlays (`fixed inset-0`) that dim, blur, or block the master sidebar.
- Completely unmounting `HomePage` / `ArchivePage` when in compact modal mode.
- Clamping or distorting image aspect ratios.

---

## 3. Constraints

- **Responsive Breakpoints**: On mobile devices (`< 768px`), the master sidebar is a slide-over drawer and the modal is full-screen (`rounded-none`). On desktop (`md:` and above), the sidebar is docked (`md:pl-64`) and the modal floats over the main canvas.
- **Autosave & Concurrency**: Switching notes via the sidebar must properly flush pending debounced saves of the outgoing note before loading the incoming note.
- **Clipboard Interoperability**: Multi-line table cell contents must adhere to RFC 4180 / TSV escaping (surrounding multi-line text in double quotes) to ensure seamless copy/paste to and from Excel and Google Sheets.

---

## 4. Approaches Considered

### Approach 1: Canvas-Layered Workspace Modal (Selected)
- **Architecture**: `App.tsx` retains the active page (`HomePage`/`ArchivePage`) in the canvas area. When `selectedNote` is present, `BlockEditorModal` is layered inside the canvas container right of the sidebar (`flex-1`).
- **Compact Mode**: In compact mode, the modal renders a backdrop with `backdrop-blur-sm bg-black/40` scoped to the canvas, centering the card with `max-w-4xl`, `rounded-2xl`, and elevation shadows.
- **Full Mode**: In full mode, the backdrop is omitted and the card expands to fill the entire workspace canvas (`w-full h-full rounded-none border-0`).
- **Sidebar Integration**: The master `SideMenu` remains untouched in the outer flex layout, allowing direct clicks on notes that update `selectedNote`.
- **Tradeoffs**: Clean separation between navigation and content, smooth transitions, zero coordinate math, and rock-solid responsiveness.

### Approach 2: Viewport-Wide Fixed Overlay with Dynamic Sidebar Offset
- **Architecture**: Keep `BlockEditorModal` rendered as `fixed inset-0` at the root, applying dynamic margin/left offsets (`md:left-64` when sidebar is open) and clipping the backdrop.
- **Tradeoffs**: Complex responsive edge cases on resize, z-index collisions between modal backdrops and sidebar popovers, and layout jumps during transitions. Rejected.

---

## 5. Detailed Component Specifications

### 5.1 `App.tsx` & Workspace Layout
- Retain `HomePage`, `ArchivePage`, and `SettingsPage` mounted in `<div className="flex-1 w-full h-full overflow-y-auto custom-scrollbar">`.
- When `selectedNote` is non-null:
  - Render `BlockEditorModal` within the workspace container (`flex-1 h-full min-w-0 relative flex flex-col overflow-hidden`).
  - Pass `onClose={() => setSelectedNote(null)}`.
  - Pass `isMasterSidebarOpen={sideMenuOpen}` and `onToggleMasterSidebar={toggleSideMenu}`.
- In `SideMenu`:
  - When clicking a note item (`onSelectNote`), if `selectedNote` is already set, update `selectedNote` directly with the newly selected note. The editor will detect the change in `note.id` and re-load blocks cleanly.

### 5.2 `BlockEditorModal.tsx`
- **State Management**:
  - `isFullscreen`: Controls modal presentation mode (Compact floating card vs. Full workspace canvas). Initialized from user settings (`defaultView === 'fullscreen'`) or `localStorage.getItem('notebook_note_fullscreen')`.
  - `isFullWidth`: Controls text/block content layout width (`max-w-4xl mx-auto` vs. `w-full max-w-full px-8`). Initialized from `localStorage.getItem('notebook_note_full_width')`.
  - These two states are independent: Full canvas mode defaults to a centered readable column (`isFullWidth === false`) unless explicitly toggled to full width.
  - Listen for changes to `note.id` to reset blocks and reload cleanly when switched from the sidebar.
- **Compact Mode Rendering**:
  - Floating container: centered over the canvas area with `absolute inset-0 z-30 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/40 backdrop-blur-sm transition-all`.
  - Card container: `relative w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl border border-stone-200/80 dark:border-stone-800 flex flex-col overflow-hidden` with `backgroundColor: modalBg`.
  - Clicking the backdrop (`onClick={onClose}`) or pressing `Escape` closes the card.
- **Full Mode Rendering**:
  - Expanded container: `relative w-full h-full rounded-none border-0 shadow-none flex flex-col overflow-hidden`.
  - Backing overlay is omitted so the canvas is fully occupied.
- **Header Controls**:
  - View mode toggle button (`Maximize2` / `Minimize2`): Toggles `isFullscreen` (Compact floating card vs. Full canvas workspace).
  - Note Actions menu ("..."): Contains the "Full width" toggle switch, controlling `isFullWidth`.
  - Breadcrumb and close (`X`) buttons remain accessible and responsive.
- **Navigation Clean-up**:
  - Master `SideMenu` is docked and active in both compact and full modes. `InNoteSidebar` is omitted/hidden inside `BlockEditorModal` to prevent duplicate sidebars.

### 5.3 `ImageBlock.tsx`
- **Container Sizing**:
  - Update loaded image container from `w-full flex justify-center ... bg-stone-100 dark:bg-stone-800/50` to fit the image:
    `inline-flex max-w-fit mx-auto overflow-hidden rounded-xl bg-stone-100 dark:bg-stone-800/50 border border-stone-200/60 dark:border-stone-700/60`.
  - In full-width mode, the background box and border wrap tightly around the image instead of sprawling across 100% of the screen.

### 5.4 `TableBlock.tsx`
- **Table Container Sizing**:
  - Remove `minWidth: '100%'` from the `<table style={{ ... }}>` element.
  - Set table element width strictly to `${activeColWidths.reduce((a, b) => a + b, 0) + 40}px`.
  - The outer scroll wrapper (`overflow-x-auto`) ensures horizontal scrolling if columns exceed the visible container width, while remaining compact if columns are small.
- **EditableCell Multi-line Editing**:
  - Key down handling:
    - `Shift + Enter`: Insert a newline (`\n`) at the current selection without blurring or submitting.
    - `Enter` (without Shift): Prevent default, save cell content, and navigate focus to the cell directly below in the next row (or add a new row if on the last row, or blur).
  - Styling:
    - Apply `whitespace-pre-wrap break-words min-h-[1.75rem]` to allow natural text wrapping and multi-line rendering.
    - Sync DOM using `innerText` or escaped HTML with `<br>` representation to preserve newlines across renders.
  - Column Headers (`<th>`):
    - Remain single-line column titles. Pressing `Enter` commits the rename and moves focus to the first row of that column. `Shift + Enter` does not insert newlines in headers.
- **Row Heights**:
  - In `<tbody>`, change `tr` and `td` from rigid fixed `height: ${rowH}px` to `minHeight: ${rowH}px` with `height: auto`, allowing rows to expand smoothly as multi-line text is typed.
- **Clipboard & Paste Handling**:
  - When focus is inside an active cell (`EditableCell`), pasting plain text containing newlines inserts the text directly into that cell without triggering whole-table replacement.
  - Pasting structured tabular data (TSV with tabs or HTML `<table>`) or pasting when no cell is focused continues to trigger whole-table replacement / smart paste.
  - `escapeTsvCell`: Wrap values containing `\n` or `\r` in double quotes: `"${val.replace(/"/g, '""')}"`.
  - `parseClipboardTableData`: Parse RFC 4180 quoted fields with newlines inside cells without breaking rows.

---

## 6. What's Left to the Builder

- Exact animation transition duration classes (`duration-200` vs `duration-300`).
- Fine-tuning focus traversal between cells on `Enter` vs `Tab`.
- Updating existing test assertions in `apps/web/tests/BlockEditorModal.test.tsx` and `apps/web/tests/TableBlock.test.tsx` to reflect the new DOM structure and multi-line cell behaviors.
