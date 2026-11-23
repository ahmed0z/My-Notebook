# In-Note Collapsible Sidebar, Adaptive Footprint, Three-Dot Menu, and Smart Excel Paste

**Date**: 2026-11-23  
**Status**: Ready for Approval  
**Design System**: Material Design 3 (M3)  

---

## 1. Intent & The Why

Users currently experience three primary points of friction when editing notes:
1. **Isolated Context**: When a note is opened in the editor modal, the folder hierarchy and surrounding notes disappear. To jump to another note or reference other documents in the same folder, users must close the editor, navigate the home grid, and open another note.
2. **Cramped Wide View & Cluttered Header**: In full-screen mode, the note is artificially capped at a narrow `max-w-4xl` (896px), leaving large empty gutters on wide desktop displays. Conversely, note actions (pin, palette, folder, delete, fullscreen, close) clutter the header as individual icon buttons, lacking an archive option.
3. **Friction with Tabular Data**: Copying rows and columns from Excel or Google Sheets pastes as raw unformatted plaintext. Users must manually create table blocks cell-by-cell.

This project enhances the note editor with a Notion-inspired collapsible folder tree, an adaptive responsive layout (spacious in full mode, neatly docked in compact mode), a consolidated Material Design 3 three-dot action menu, and intelligent Excel/Sheets table paste detection.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **In-Note Collapsible Sidebar**: Render a collapsible hierarchical folder tree inside the note editor showing folders (spaces) and their contained notes.
- **Adaptive Footprints**:
  - Full Mode: Expand note width to use up to 95% of viewport width (or `max-w-7xl`) for an expansive workspace.
  - Compact Mode: Dock the folder sidebar and note content side-by-side with a clear gutter/gap (no overlapping). Expand the compact modal container width gracefully when the sidebar is open (`max-w-5xl`) to prevent cramped text.
- **M3 Three-Dot Overflow Menu**: Consolidate secondary note actions into an accessible M3 dropdown menu containing **Delete Note**, **Archive / Unarchive Note**, and **Change Folder**.
- **Smart Excel / Sheets Paste**:
  - Automatically detect clipboard tab-separated values (TSV) or HTML `<table>` data.
  - When pasted on the canvas or an empty block, automatically create a structured `TableBlock`.
  - When pasted inside an active table cell, intelligently populate the grid starting at that cell.
- **Material Design 3 Alignment**: Use M3 token semantics, elevation levels, 48px touch targets, rounded corners, and clear state layers (hover, active, selected).

### Non-Goals
- Changing the primary home screen note grid or archiving page layout.
- Replacing the server-side API schema (existing `NoteDto`, `SpaceDto`, and `BlockDto` endpoints are sufficient).
- Building full spreadsheet formula calculation engines (e.g. SUM, AVERAGE); tables remain structured text grids.

### Anti-Goals
- Overlapping the sidebar on top of note content in compact mode (the user explicitly requires side-by-side separation with visible space between them).
- Forcing the user to keep the sidebar open (it must be easily toggleable and memorize its open/closed state).
- Breaking existing markdown text pasting or single-line clipboard pastes.

---

## 3. Approaches Considered

### Approach 1: Integrated In-Modal Sidebar & Smart Paste Handler *(Selected)*
- **Description**: Implement a modular `InNoteSidebar` component directly inside `BlockEditorModal.tsx`. Expand modal boundaries and inner content containers adaptively based on fullscreen and sidebar toggle state. Add an M3 three-dot action menu and a dedicated clipboard parser utility.
- **Pros**: Maintains existing `App.tsx` architecture, preserves backward-compatible prop interfaces, delivers exact user requirements, and works seamlessly across compact and fullscreen views.
- **Cons**: Requires careful responsive CSS calculations for compact mode modal sizing.

### Approach 2: Full-Page Workspace Router Conversion
- **Description**: Re-architect the application so opening a note navigates to a persistent full-page route `/note/:id`, eliminating the modal structure entirely.
- **Pros**: Matches Notion's URL-driven page model.
- **Cons**: Massive architectural change to `App.tsx`, breaks quick dialog previews from `NoteCard`, and requires extensive refactoring of routing and history state.

**Decision**: Approach 1 was chosen by the user for its modularity, low risk, and direct fit with the current architecture.

---

## 4. Detailed Specification & Builder Decisions

### 4.1 In-Note Collapsible Folder Tree Sidebar (`InNoteSidebar.tsx`)

#### Layout & Hierarchy
- The sidebar sits on the left side of the note editing area.
- Renders hierarchical spaces using the existing parent-child tree algorithm (`buildSpaceTree`), plus a top-level **"General (No Folder)"** bucket for unfiled notes.
- Each folder displays:
  - Expand/collapse chevron (`ChevronRight` / `ChevronDown`)
  - Folder icon (`Folder` / `FolderOpen`)
  - Folder name
  - Count of active child notes in this space (`note.spaceId === space.id && !note.isArchived`)
  - Nested list of notes (title, active indicator)
- Clicking a note switches the editor immediately to that note via `onOpenNote(noteId)`.
- The active note is highlighted using M3 `secondary-container` token styling (subtle accent background and bold text).

*Builder Call on Archived Notes in Sidebar*: The sidebar displays active workspace notes (`!note.isArchived`). If an archived note is opened from `ArchivePage`, the sidebar displays an "Archived Note" read-only badge indicating it is archived, and leaves active folder trees uncluttered.

#### Toggle Behavior
- A toggle button in the note header (`PanelLeft` icon) allows opening and collapsing the sidebar.
- State is stored in local storage (`notebook_in_note_sidebar_open`) so user preference persists across notes.

---

### 4.2 Adaptive Footprint: Full Mode vs. Compact Mode

#### Full Mode (`isFullscreen === true`)
- Container fills `fixed inset-0 w-full h-full`.
- The inner editor container changes from `max-w-4xl mx-auto` to `w-full max-w-7xl mx-auto px-6 lg:px-12`.
- When the sidebar is expanded:
  - Sidebar width: `w-64` (256px) fixed width, border-r, scrollable.
  - Editor canvas: `flex-1 min-w-0` taking the remaining wide width.
- When the sidebar is collapsed:
  - Sidebar width: `0` (hidden).
  - Editor canvas: full width up to `max-w-7xl`.

#### Compact Mode (`isFullscreen === false`)
- Modal is centered on desktop: `fixed inset-0 flex items-center justify-center p-4`.
- Adaptive container width:
  - Sidebar **collapsed**: `max-w-3xl` (existing standard width).
  - Sidebar **expanded**: `max-w-5xl` (widened to accommodate both side-by-side with clear gutter space).
- Container layout:
  - A subtle divider line and a 16px gutter (`gap-4`) separates the sidebar and note editor canvas.
  - **No overlap on Desktop/Tablet**: The sidebar sits adjacent to note content with comfortable spacing.
  - *Builder Call on Narrow Mobile Viewports (< 640px)*: On screens smaller than 640px (smartphones) where 256px + note width cannot physically coexist side-by-side, the sidebar collapses by default and opens as a temporary off-canvas drawer with backdrop, preventing overflow while desktop/tablet retain the strict side-by-side layout.

---

### 4.3 Material Design 3 Three-Dot Action Menu (`NoteActionsMenu.tsx`)

#### Header Refactor
The modal header is simplified to follow M3 Top App Bar standards:
- **Left**: Sidebar toggle button (`PanelLeft`), Note title input.
- **Right**:
  - Pin toggle button (`Pin`, filled when active)
  - Color palette button (`Palette`)
  - **Three-Dot Menu (`MoreVertical` / `•••`)**:
    - Trigger: M3 Standard Icon Button (`p-2 rounded-full hover:bg-stone-200/60 dark:hover:bg-stone-800`).
    - Menu Surface: M3 Elevation-2 popup (`rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xl bg-white dark:bg-stone-900 p-1.5 min-w-[180px]`).
    - Items:
      1. **Change Folder** (`FolderInput` icon): Opens the space picker dropdown to reassign the note's folder.
      2. **Archive Note / Unarchive Note** (`Archive` icon):
         - *Builder Call on Archive Lifecycle*: Clicking "Archive Note" toggles `isArchived = true` via `ApiClient.updateNote`, updates parent state optimistically, closes the editor modal, and shows a toast. If viewing a note already archived, the item renders as "Unarchive Note" and restores the note to active.
      3. **Delete Note** (`Trash2` icon): Styled with M3 `error` token (`text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40`), confirms and deletes.
  - Fullscreen / Compact toggle (`Maximize2` / `Minimize2`).
  - Close button (`X`).

---

### 4.4 Smart Excel / Google Sheets Table Paste Detection

#### Parsing Utility (`clipboardTableParser.ts`)
1. **Detection Logic**:
   - Inspect clipboard `text/plain` and `text/html`.
   - **TSV Detection**: Contains at least one tab character (`\t`) AND at least one newline (`\n` or `\r\n`), with consistent column counts across rows.
   - **HTML Table Detection**: Contains `<table>`, `<tr>`, and `<td>` or `<th>` tags.
   - Parses clipboard into a raw 2D grid matrix `rawGrid: string[][]`.

2. *Builder Call on Table Paste Insertion*:
   - **Scenario A (Canvas or Empty/Text Block)**:
     - First row of `rawGrid` becomes `columns: string[]`.
     - Subsequent rows become `rows: string[][]`. If only 1 row was copied, it creates columns with empty row 1.
     - Spawns a new `TableBlock` and clears empty placeholder.
   - **Scenario B (Inside Existing Table Cell)**:
     - All rows (including row 0) are treated as cell data.
     - Content is pasted starting from active cell `(startRow, startCol)`.
     - If pasted data exceeds current table bounds, existing rows and columns expand dynamically (new column headers default to `Column N`).

---

## 5. Accessibility & Responsive Specifications

- **Touch Targets**: Minimum 48x48px interactive target areas for all icon buttons and menu items.
- **Keyboard Navigation**:
  - `Escape`: Closes the 3-dot menu or space picker first; second press exits fullscreen; third closes modal.
  - Arrow keys: Navigate between folder tree items and menu options.
  - `Enter` / `Space`: Activates selected folder or note.
- **Screen Reader Semantics**:
  - Sidebar tagged with `role="navigation"` and `aria-label="Note folders and pages"`.
  - Three-dot menu tagged with `aria-haspopup="true"` and `aria-expanded`.
  - Contrast ratios conform to WCAG 2.1 AA (4.5:1 for normal text).

---

## 6. What's Left to the Builder

- Exact icon assets from `lucide-react` (`PanelLeft`, `Folder`, `FolderOpen`, `MoreVertical`, `Archive`, `Trash2`, `FolderInput`).
- Debounce timers on clipboard paste events to avoid double-firing.
- Unit tests for `clipboardTableParser` covering TSV edge cases, blank lines, and quotes.
- Component integration tests for `BlockEditorModal` in compact vs. fullscreen modes.
