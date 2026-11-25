# Design: Notion-Identical Simple Table Block

## 1. Intent & Why

My-NoteBook's web `TableBlock` currently suffers from both functional bugs and structural UI mismatches compared to Notion's Simple Table block:
1. `BlockEditorModal.tsx` reconstructs table `parsedContent` with only `columns` and `rows`, silently stripping `columnWidths` and `rowHeights` on every render so column/row resizing never persists visually.
2. The table renders inside a `rounded-xl` shadowed card with a permanent `40px` right-hand action column (`+` / `Trash2`), an inline `+ New` footer row inside the table grid, `"Empty"` placeholders in every cell, permanent resize pill indicators, and input-style focus rings.
3. Cells lack `Tab`/`Shift+Tab` and Arrow-key navigation, commit changes only on blur instead of live input, override `Enter` to move down a row instead of inserting a newline inside the cell, and retain `contenteditable` focus during mouse drag-selection so `Delete`/`Backspace` fails to clear selected cell ranges.

This design replaces the custom card-style table with an authentic Notion Simple Table implementation in `apps/web`: identical visual styling, outside-edge hover `+` bars, row/column hover pill handles (`⋮⋮` / `⋯`) with contextual menus and drag-to-reorder, full-height blue hover column-resize lines, a top-right **Options** menu (**Header row**, **Header column**, **Fit to page width**, **Copy table**), unified rectangular range selection, and exact Notion keyboard & clipboard interactions.

---

## 2. Goals, Non-Goals, & Anti-Goals

### Goals
1. **Fix Persistence Bug in `BlockEditorModal.tsx`**: Preserve all `TableBlockContent` fields (`columns`, `rows`, `columnWidths`, `rowHeights`, `hasHeaderRow`, `hasHeaderColumn`, `fitToWidth`) when rendering and converting blocks.
2. **Exact Notion Simple Table Visuals**:
   - Crisp, flat `1px` hairline grid (`border-collapse`) in Notion light (`rgba(55, 53, 47, 0.09)` / `#E9E9E7`) and dark (`rgba(255, 255, 255, 0.094)`) tones, sharp corners (`rounded-none` or `2px`), no card shadow, no permanent right action column, and no inline `+ New` row inside the grid.
   - Blank empty cells (no repeating `"Empty"` placeholder text).
   - Clean seamless `contentEditable` cells with no inner hover/focus border rings.
   - Optional **Header row** (defaults to `true` for backward compatibility) and **Header column** (defaults to `false`) with subtle header fill (`rgba(55, 53, 47, 0.03)` light / `rgba(255, 255, 255, 0.03)` dark) and medium/semibold text (`font-medium`).
3. **Outside-Edge Hover `+` Bars & Corner Add**:
   - Slender hover bar along the **right edge** (`+` adds a column), **bottom edge** (`+` adds a row), and **bottom-right corner** (`+` adds both a row and a column).
   - Positioned outside the table grid without altering table column/row geometry or clipping inside `overflow-x-auto`.
4. **Row & Column Hover Pill Handles (`⋮⋮` / `⋯`), Drag Reorder, & Contextual Menus**:
   - Hovering a row reveals a vertical `⋮⋮` pill handle on the left edge; hovering a column reveals a horizontal `⋯` / rotated-`⋮⋮` pill handle on the top edge.
   - Dragging a row or column handle reorders that row/column (including syncing `columnWidths` / `rowHeights`).
   - Clicking a row handle opens the **Row Menu**: Insert above, Insert below, Duplicate, Clear contents, Delete row (disabled when only 1 body row and no header row, or enforced minimum 1 row total — see Section 5.4).
   - Clicking a column handle opens the **Column Menu**: Insert left, Insert right, Duplicate, Sort A→Z, Sort Z→A, Clear contents, Delete column (disabled when 1 column).
5. **Top-Right Hover Options Bar**:
   - Hovering the table reveals a subtle floating **Options** trigger above the top-right of the visible table wrapper with:
     - **Header row** toggle switch
     - **Header column** toggle switch
     - **Fit to page width** toggle switch (`fitToWidth`)
     - **Copy table** (copies TSV)
     - **Clear contents** / **Delete block** (if callback provided, or clear contents)
6. **Full-Height Blue Hover Column Resize**:
   - Column divider lines appear as normal `1px` borders when idle; hovering a vertical column divider anywhere along its height highlights a `2px` Notion blue (`#2383E2`) full-height line with `col-resize` cursor. Dragging updates `columnWidths[ci]` (clamped `60px..800px`); double-clicking resets to default (`150px`).
   - Optional row height resize or auto-height: rows default to `height: auto; min-height: 32px` so multi-line text wraps naturally without clipping.
7. **Exact Notion Keyboard Navigation & Cell Editing**:
   - `Enter` inside a cell inserts a newline (`\n`) at the caret (both body cells and header cells, or single-line/multi-line uniformly like Notion Simple Tables).
   - `Tab` moves focus to the next cell (wrapping to column 0 of the next row; pressing `Tab` in the very last cell appends a new row and focuses its first cell).
   - `Shift + Tab` moves focus to the previous cell (wrapping to the last column of the previous row).
   - Arrow keys (`ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`) navigate within cell text normally and move to the adjacent cell when the caret is at the corresponding boundary (start/end of text, or first/last visual line).
   - `Escape` exits active cell editing (blurring to cell/table selection) or clears active multi-cell selection.
   - Live input syncing (`onInput` debounced/synchronized cleanly without clobbering `contentEditable` caret position).
8. **Unified Rectangular Range Selection & Clipboard**:
   - Dragging across cells (or `Shift + Click`) selects a rectangular range with a single unified `2px solid #2383E2` outer perimeter border and `rgba(35, 131, 226, 0.12)` background fill, automatically blurring the active `contentEditable` cell so keyboard shortcuts (`Delete`/`Backspace` to clear, `Ctrl/Cmd+C` to copy TSV, typing to replace/clear, `Ctrl/Cmd+A` to select the whole table) work reliably.
   - Preserve existing RFC 4180 TSV / CSV / HTML smart-paste behavior from `clipboardTableParser.ts`.

### Non-Goals
- Database features (column types like Select/Date/Formula, filtering, views, linked records).
- Modifying `MobileTableBlock.tsx` (React Native mobile keeps its existing UI while safely ignoring new optional JSON fields).
- Changing backend API endpoints or PostgreSQL schema (`Block.ContentJson` already stores arbitrary JSONB validated for `columns` and `rows` in `BlockValidator.cs`).

### Anti-Goals
- Adding TipTap/ProseMirror or third-party spreadsheet libraries that break `TableBlockContent` JSON parity.
- Keeping permanent action columns, inline `+ New` rows, card shadows, or `"Empty"` cell placeholders inside the grid.

---

## 3. Constraints

- **Schema & Backend Compatibility**: `BlockValidator.cs` requires `columns: string[]` and `rows: string[][]` where every row has `columns.length` elements. `packages/shared/src/validation/blockValidator.ts` must accept the new optional properties (`hasHeaderRow`, `hasHeaderColumn`, `fitToWidth`).
- **Existing Block Wrapper**: `BlockEditorModal.tsx` wraps every block in a `flex items-start gap-1` row with a block-level `⋮⋮` drag handle on the far left. `TableBlock` handles must not overlap or trigger the outer block's drag-and-drop (`draggable` drag events on row/col handles must call `e.stopPropagation()` or use pointer/mouse events rather than HTML5 `draggable` so they never hijack `BlockEditorModal`'s block reordering!).
- **Dark & Light Themes + Note Card Background Colors**: All grid borders, header tints, hover pills, and popovers must use Tailwind `dark:` variants and translucent `rgba`/stone tokens that look crisp on white, dark, and colored note backgrounds (`modalBg`).

---

## 4. Approaches Considered

### Approach 1: Rebuilt Custom `TableBlock` with Notion Overlay Chrome (Selected)
Rebuild `TableBlock.tsx` in pure React + Tailwind, fix `BlockEditorModal.tsx` prop preservation, and extend `TableBlockContent` with optional Notion display flags (`hasHeaderRow`, `hasHeaderColumn`, `fitToWidth`).
- **Tradeoffs**: Zero new dependencies, 100% compatible with existing JSON schema, TSV/HTML paste parser, backend validation, and mobile app; requires clean React state/ref management for `contentEditable` caret preservation and pointer-based row/column drag reordering.

### Approach 2: Embed TipTap / ProseMirror Table Extension
Adopt `@tiptap/react` + `@tiptap/extension-table` inside `TableBlock`.
- **Tradeoffs**: Built-in ProseMirror cell selection, *but* incompatible with `columns`/`rows` JSON storage, mobile parity, and `clipboardTableParser.ts`, adds large dependencies, and still requires building all Notion hover handles, `+` bars, and Options menus from scratch. Rejected.

---

## 5. Detailed Design

### 5.1 Shared Data Model & Validation
In `packages/shared/src/types/block.ts`:
```ts
export interface TableBlockContent {
  columns: string[];
  rows: string[][];
  columnWidths?: number[];
  rowHeights?: number[];
  hasHeaderRow?: boolean;    // default true when omitted (preserves existing notes)
  hasHeaderColumn?: boolean; // default false when omitted
  fitToWidth?: boolean;      // default false when omitted
}
```
In `packages/shared/src/validation/blockValidator.ts`:
- Validate optional `hasHeaderRow`, `hasHeaderColumn`, and `fitToWidth` as `boolean` if defined.
- Keep `columnWidths` and `rowHeights` validation unchanged.
- Note: `BlockEditorModal.tsx` currently creates new table blocks via toolbar/slash command with `columns: ['Column 1', 'Column 2']` (or `extraContent.columns`) and `rows: [['', '']]`. For newly inserted blank tables in `BlockEditorModal.tsx`, initialize with `columns: ['', ''], rows: [['', ''], ['', '']], hasHeaderRow: true, hasHeaderColumn: false, fitToWidth: false` (Wait: check `BlockEditorModal.test.tsx` — update that test if default text changes, OR keep `columns: ['', '']`? Let's keep `columns: ['', '']`? Wait: in Notion, newly inserted Simple Tables have 3 columns × 2 rows of blank cells, or 2×2 blank cells with blank headers — let's check: keeping `columns: ['', '']` and `rows: [['', '']]` or `columns: ['Column 1', 'Column 2']`? In Notion, cells are blank `['', '']`! Let's specify blank cells `columns: ['', ''], rows: [['', '']]` with `hasHeaderRow: true` for new tables so they visually match Notion's clean empty grid, and update `BlockEditorModal.test.tsx` accordingly).

### 5.2 `BlockEditorModal.tsx` Fix
In `BlockEditorModal.tsx` (lines 918–922):
- Preserve all optional `TableBlockContent` fields instead of recreating `{ columns, rows }`:
```ts
} else if (block.type === 'table') {
  parsedContent = {
    ...parsedContent,
    columns: Array.isArray(parsedContent.columns) && parsedContent.columns.length ? parsedContent.columns : ['', ''],
    rows: Array.isArray(parsedContent.rows) && parsedContent.rows.length ? parsedContent.rows : [['', '']],
  };
}
```
- Also in `handleConvertBlock` (lines 504–507 & 529–533), keep existing behavior intact.

### 5.3 Layout, Scroll Container, & Gutter Geometry
To ensure outside-edge handles and `+` bars are never clipped by horizontal scrolling and column handles scroll horizontally in sync with their columns:
- Outer wrapper (`tableRef`, `relative group/table my-2 select-none`):
  - Contains the **floating top-right Options bar** (positioned at `right-0 -top-7`, visible on `group-hover/table` or when the Options menu is open, so it stays pinned to the visible container edge regardless of horizontal scroll).
  - Contains the horizontal scroll container (`w-full overflow-x-auto custom-scrollbar`):
    - Inside the scroll container, render an inner positioning frame (`relative inline-block pt-4 pl-4 pr-6 pb-6` — or `min-w-full` when `fitToWidth` is true):
      - `pt-4`: `16px` top gutter for column pill handles (`⋯`).
      - `pl-4`: `16px` left gutter for row pill handles (`⋮⋮`).
      - `pr-6`: `24px` right gutter for the vertical `+` add-column bar and corner `+`.
      - `pb-6`: `24px` bottom gutter for the horizontal `+` add-row bar and corner `+`.
    - Inside this inner frame sits the `<table>` (`border-collapse table-fixed`) plus the hover handles/bars anchored directly to the table's edges!
- **Width calculation**:
  - When `fitToWidth` is `false` (default): `<table style={{ width: `${totalColWidth}px` }}>` where `totalColWidth = activeColWidths.reduce((a, b) => a + b, 0)`. `<colgroup>` assigns exact `px` widths to each column.
  - When `fitToWidth` is `true`: `<table style={{ width: '100%', minWidth: `${totalColWidth}px` }}>` (and inner frame gets `w-full`), allowing columns to stretch proportionally to fill the note column width while honoring minimum column widths.

### 5.4 Grid Visual Styling & Header Row / Header Column Semantics
- **Table & Cell Borders**:
  - Single crisp `1px solid` hairline border on all cells: `border border-stone-200/90 dark:border-stone-700/70` (using `rgba(55,53,47,0.09)` / `rgba(255,255,255,0.094)` aesthetic).
  - No `rounded-xl` outer container, no box-shadow, no permanent right action column, no inline `+ New` `<tr>`.
- **Header Row (`hasHeaderRow !== false`)**:
  - Row index `-1` (`<thead>` rendering `columns`) renders as a header row when `hasHeaderRow` is `true` (default): subtle background tint `bg-stone-100/70 dark:bg-white/[0.04]` and `font-medium text-stone-800 dark:text-stone-100`.
  - When `hasHeaderRow` is `false`: row `-1` renders with normal body cell styling (no header tint, normal `font-normal`), while still remaining row index `-1` in `columns` so the JSON shape and backend validation remain unchanged!
- **Header Column (`hasHeaderColumn === true`)**:
  - Column index `0` across all rows gets the same header tint `bg-stone-100/70 dark:bg-white/[0.04]` and `font-medium`.
- **Row Styling**:
  - Rows use `minHeight: ${rowH}px; height: auto` (`rowH` defaults to `32px`), cells align `align-top`, padding `px-2.5 py-1.5` (`6px 10px` — matching Notion's `7px 9px` compact density), `text-sm leading-[1.45]`.
  - Empty cells have **no placeholder** (`""`), showing a clean blank cell just like Notion.

### 5.5 Outside-Edge `+` Bars (Add Row, Add Column, Corner)
Rendered strictly outside the `<table>` grid inside the inner positioning frame (using `position: absolute` relative to the table box):
1. **Right `+` Bar**: Anchored to the right edge of the `<table>` (`top: 16px` to `bottom: 24px`, `width: 16px`, `left: calc(100% - 20px)` or directly adjacent to `<table>` in a `flex items-stretch` wrapper!).
   - *Cleaner layout*: Wrap `<table>` + Right `+` bar in a `flex items-stretch` row, and place Bottom `+` bar + Corner `+` in a `flex items-center` row directly underneath `<table>`! That way the `+` bars match the table's exact live height and width automatically with zero manual pixel math!
   - Appearance: `opacity-0` until hovered directly or table hovered (subtle `opacity-0 group-hover/table:opacity-40 hover:!opacity-100`), light pill/bar (`bg-stone-200/70 dark:bg-stone-800/80 hover:bg-stone-300/80 dark:hover:bg-stone-700`) with centered `+` icon (`12px`).
   - Clicking Right `+` appends a column (`''` header, `''` in each row, `150px` width) and focuses its top cell.
   - Clicking Bottom `+` appends a row (`''` in each col) and focuses its first cell.
   - Clicking Corner `+` (`16px × 16px` at bottom-right intersection, visible on hover over corner/bars) appends both a row and a column.

### 5.6 Row & Column Hover Pill Handles, Pointer Drag-Reorder, & Menus
- **Row Pill Handle (`⋮⋮`)**:
  - Rendered on the left edge of each row (`-left-2.5 top-1/2 -translate-y-1/2`, `w-3.5 h-5`, `rounded`, visible when hovering that row or when that row's menu is open).
  - **Pointer Drag Reordering** (NOT HTML5 `draggable` so it never triggers `BlockEditorModal`'s block drag-and-drop):
    - `onMouseDown`: records start `Y`; if pointer moves `> 4px` vertically, enters row-drag mode, tracks target drop index by comparing `clientY` to row bounding rects, shows a `2px solid #2383E2` horizontal drop indicator line between rows, and on `mouseup` reorders `rows` (and `rowHeights` if present) — or swaps with `columns` if dragging into/out of row `-1`!
    - If `mouseup` occurs without drag movement (`<= 4px`), selects the entire row (`selectedRange`) and opens the **Row Context Menu**:
      - **Insert above** (if row `-1` and `hasHeaderRow` is true, inserts above as new header or shifts; simplest & cleanest: for body rows `0..n-1`, Insert above inserts at `ri`, Insert below inserts at `ri + 1`; for row `-1`, Insert below inserts at body row `0`, Insert above inserts a new top row in `columns` and pushes old `columns` to `rows[0]`).
      - **Insert below**
      - **Duplicate**
      - **Clear contents**
      - **Delete** (disabled if total rows `columns + rows` would drop below 1, or if `rows.length === 0`; wait: since `BlockValidator.cs` requires `columns` non-empty and allows empty `rows` OR `TableBlock` requires at least 1 body row? Let's check: `BlockValidator.cs` allows `rows: []`, `TableBlock` currently treats `rows` as at least 1 row (`rows.length <= 1` guard in `deleteRow`). Keeping at least 1 row in `rows` when `columns` is row 0 means minimum 2 total rows unless `rows` can be empty; wait: in Notion, you can delete down to a 1-row table! If `rows.length === 1` and user deletes row `-1`, `rows[0]` promotes to `columns` and `rows` becomes `[]` — OR keep minimum 1 body row when `hasHeaderRow` is true, and allow deleting row 0 down to 1 total row! Let's check `TableBlock.test.tsx`: existing test tests `rows.length <= 1` guard? Wait: `TableBlock.test.tsx` tests deleting row 1 of 2 rows. Keeping minimum 1 total row (if `columns` is row 0 and `rows` has `>= 0` rows, Wait: `BlockEditorModal.tsx` line 921 falls back to `[['', '']]` if `rows.length === 0`! Good catch! So keep minimum `rows.length >= 1`, or fix line 921 fallback to `Array.isArray(parsedContent.rows)` allowing `[]` — actually keeping `rows.length >= 1`? No, if `BlockEditorModal.tsx` uses `Array.isArray(parsedContent.rows) ? parsedContent.rows : [['', '']]` then even a 1-row table works! Even safer: if `rows.length === 0` is allowed, `rows` can be empty, OR keep at least 1 row in `rows` and allow deleting down to `rows.length === 1` (i.e. 1 header + 1 body = 2 rows minimum, or 1 row if header disabled). Keeping `totalRows > 1` where deleting row `-1` promotes `rows[0]` to `columns` and deleting the last body row is disabled if `rows.length === 0` works seamlessly!). Let's explicitly enforce: total rows (`1 + rows.length`) must stay `>= 1`; if `rows.length === 0` is allowed, `BlockEditorModal.tsx` must check `Array.isArray(parsedContent.rows)` instead of `parsedContent.rows.length`.
- **Column Pill Handle (`⋯`)**:
  - Rendered centered above each column (`-top-2.5 left-1/2 -translate-x-1/2`, `h-3.5 w-6`, `rounded`, visible when hovering that column or when its menu is open).
  - **Pointer Drag Reordering**:
    - `onMouseDown`: records start `X`; if pointer moves `> 4px` horizontally, enters column-drag mode, compares `clientX` to column bounding rects, draws a `2px solid #2383E2` vertical drop indicator line between columns, and on `mouseup` reorders `columns`, every row's cells, and `columnWidths`.
    - On click (`<= 4px` drag), selects the entire column (`selectedRange`) and opens the **Column Context Menu**:
      - **Insert left**
      - **Insert right**
      - **Duplicate**
      - **Sort ascending (A → Z)** (sorts `rows`, keeping `columns` fixed if `hasHeaderRow`, or sorting all rows if `!hasHeaderRow`!)
      - **Sort descending (Z → A)**
      - **Clear contents**
      - **Delete** (disabled when `columns.length <= 1`)

### 5.7 Full-Height Column Resize Dividers
- Render a vertical resize hit-area (`w-2 -right-1 top-0 bottom-0 cursor-col-resize z-20`) spanning the **entire height of the `<table>`** for each column (attached to the header cell `th` or positioned per column divider across `tableHeight`, e.g., on every cell's right border or as full-height vertical overlay strips aligned with column right edges).
  - *Implementation detail*: Rendering full-height overlay strips at each column's cumulative right offset (`left: sum(widths[0..ci]) - 3px`, `top: 0`, `bottom: 0`, `width: 6px`) inside the `table` container ensures hovering ANY row along a column border lights up the **entire vertical border** in `2px` `#2383E2` blue, exactly like Notion!
  - Double-click resets that column's width to `150px`.
  - Dragging clamps width to `[60, 800]` px and commits `columnWidths` on `mouseup`.

### 5.8 Cell Editing, Caret Preservation, & Keyboard Navigation
- **`EditableCell` Rewrite**:
  - Never pass `dangerouslySetInnerHTML` on re-render while typing (which destroys caret position and breaks newlines!). Instead, set `ref.current.innerText` / text content imperatively on mount and when external `value` changes *while `document.activeElement !== ref.current`* (plus normalize `\r\n` to `\n`).
  - Call `onChange(text)` on `onInput` (or live sync with parent state without mutating DOM back into the focused element) AND ensure `onBlur` flushes any diff so autosave and `Ctrl+C`/toolbar actions always see the latest cell text immediately!
- **Keyboard Behavior**:
  - `Enter` (without Shift, and `Shift + Enter`): Inserts a newline inside the cell (native `contentEditable` behavior; do NOT `preventDefault()` to jump rows, matching Notion Simple Tables).
  - `Tab`: `e.preventDefault()`, moves focus to `(r, c + 1)`, or `(r + 1, 0)` at end of row; at the very last cell `(rows.length - 1, columns.length - 1)`, appends a new blank row and focuses `(rows.length, 0)`.
  - `Shift + Tab`: `e.preventDefault()`, moves focus to `(r, c - 1)`, or `(r - 1, columns.length - 1)` at start of row.
  - `ArrowLeft` / `ArrowRight`: If caret is at offset `0` (collapsed) on `ArrowLeft`, move to previous cell (caret at end); if caret is at text end (collapsed) on `ArrowRight`, move to next cell (caret at start). Otherwise let browser move caret inside cell text.
  - `ArrowUp` / `ArrowDown`: If caret is on the first visual line of the cell on `ArrowUp` (detected via `Range.getClientRects()` vs element top padding or single-line check), move to `(r - 1, c)`; if caret is on the last visual line on `ArrowDown`, move to `(r + 1, c)`.
  - `Escape`:
    - If focused inside a cell (`isEditingCell`): blur the cell and set `selectedRange` to that single cell `{ start: { row: r, col: c }, end: { row: r, col: c } }` (matching Notion's Esc-to-select-cell behavior!).
    - If `selectedRange` is active and not editing: clear `selectedRange` (`null`).

### 5.9 Range Selection & Clipboard
- **Mouse Drag Selection**:
  - `onMouseDown` on a cell records `dragStartRef` without clearing focus immediately; if the mouse moves into a **different cell** (`onMouseEnter` while `isSelecting`), blur any active `contentEditable` (`(document.activeElement as HTMLElement)?.blur()`), clear browser text selection (`window.getSelection()?.removeAllRanges()`), and update `selectedRange`.
  - `Shift + Click` extends `selectedRange` from anchor cell (or active cell) to clicked cell and blurs `contentEditable`.
- **Unified Selection Visual**:
  - Selected cells get `bg-[#2383E2]/10 dark:bg-[#2383E2]/20` tint.
  - Only the **outer edges** of the rectangular `selectedRange` (`r === minR`, `r === maxR`, `c === minC`, `c === maxC`) draw a crisp `2px` `#2383E2` border (using `box-shadow` inset edges per side so cell layout never shifts!).
- **Keyboard Actions on `selectedRange` (when not editing text)**:
  - `Backspace` / `Delete`: Clears all selected cells (`columns` and `rows` in range).
  - `Ctrl/Cmd + C`: Copies selected range as RFC 4180 TSV.
  - `Ctrl/Cmd + X`: Copies selected range as TSV and clears selected cells.
  - `Ctrl/Cmd + A`: Inside an editing cell, first selects all text inside that cell; pressing `Ctrl/Cmd + A` again (or when a cell/range is selected) selects the entire table.
  - Printable key press while a single cell is selected (not editing): focuses that cell and starts typing.
- **Smart Paste (`handlePaste`)**:
  - Preserves existing `parseClipboardTableData` behavior:
    - Single-line or plain multiline text without tabs/HTML-table while inside a focused cell pastes natively into that cell.
    - TSV / CSV / HTML table pastes into the grid starting at the active cell (or top-left of `selectedRange`), expanding rows/columns dynamically as needed.

---

## 6. What's Left to the Builder

- Exact Tailwind utility classes and micro-animation timings for popovers and hover transitions.
- Edge-case helper decomposition (e.g., splitting `TableMenus.tsx` or keeping subcomponents cleanly organized inside `apps/web/src/components/editor/blocks/`).
- Updating existing test cases in `apps/web/tests/TableBlock.test.tsx` and `apps/web/tests/BlockEditorModal.test.tsx` that asserted old chrome (`+ New` button, `Enter` moving to next row, `Column 1` default text, or old selection CSS classes) and adding comprehensive tests for all new Notion interactions.
