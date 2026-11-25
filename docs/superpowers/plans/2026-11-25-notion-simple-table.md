# Notion-Identical Simple Table Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild My-NoteBook's web table block and its editor integration to match Notion's Simple Table visual design, outside-edge hover controls, keyboard navigation, range selection, and persistence behavior.

**Architecture:** Fix `BlockEditorModal.tsx` so optional `TableBlockContent` fields survive rendering, extend `TableBlockContent` in `@notebook/shared` with `hasHeaderRow`, `hasHeaderColumn`, and `fitToWidth`, and decompose `TableBlock` into focused modules (`tableUtils.ts` pure state/TSV/selection helpers, `TableCell.tsx` caret-safe `contentEditable` cell, `TableContextMenus.tsx` row/col/options popovers, and `TableBlock.tsx` grid & pointer-interaction orchestrator).

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, Vitest + React Testing Library (`jsdom`).

**Spec:** [2026-11-25-notion-simple-table-design.md](file:///workspace/My-NoteBook/docs/superpowers/specs/2026-11-25-notion-simple-table-design.md)

## Global Constraints

- **Zero new npm dependencies:** Build everything in pure React + Tailwind + Lucide icons already in `apps/web/package.json`.
- **Backend & mobile compatibility:** Preserve `columns: string[]` and `rows: string[][]` with `row.length === columns.length` in `TableBlockContent` (required by `BlockValidator.cs` and `MobileTableBlock.tsx`); do not modify `MobileTableBlock.tsx` or backend files.
- **No outer block drag hijacking:** Row/column reordering in `TableBlock` must use mouse/pointer events (not HTML5 `draggable`) and stop event propagation so `BlockEditorModal.tsx` block drag-and-drop never fires.
- **Clean Notion grid:** No rounded shadowed outer card, no permanent right action column, no inline `+ New` `<tr>`, no `"Empty"` placeholders inside blank cells, and no input focus rings inside cells.
- **Theme support:** Support both light and dark modes (`dark:` Tailwind variants) cleanly over colored note backgrounds.

## Review Focus

- **Live `contentEditable` input without caret reset:** Typing multi-line text in a focused `TableCell` triggers live `onChange` without overwriting `ref.current` DOM or jumping the caret, and immediate toolbar/copy actions see the latest text before blur.
- **Drag-selection blur handoff:** Starting `mousedown` inside an editable cell and dragging across cells blurs the active `contentEditable` element so `Delete`/`Backspace`, `Ctrl/Cmd+C`, and `Ctrl/Cmd+X` operate on `selectedRange` instead of failing silently.
- **Header-aware sort & minimum-size row/col deletion:** Sorting a column keeps row `-1` (`columns`) fixed when `hasHeaderRow !== false`, but includes row `-1` in the sort when `hasHeaderRow === false`; deleting row `-1` when `rows.length >= 1` promotes `rows[0]` to `columns`, while deleting the last remaining row or last remaining column is blocked.
- **Pointer reorder threshold vs click-menu:** Pointer movement `<= 4px` on a row/column handle opens its contextual menu and selects that row/column; movement `> 4px` reorders rows/columns along with `rowHeights`/`columnWidths` without opening the menu.
- **`BlockEditorModal` persistence of table metadata:** `columnWidths`, `rowHeights`, `hasHeaderRow`, `hasHeaderColumn`, and `fitToWidth` survive `BlockEditorModal` re-renders without resetting to defaults, and `rows: []` (1-row table) is preserved when present.

---

### Task 1: Extend `TableBlockContent` Schema & Validation in `@notebook/shared`

**Files:**
- Modify: `packages/shared/src/types/block.ts:20-25`
- Modify: `packages/shared/src/validation/blockValidator.ts:62-83`
- Test: `packages/shared/tests/blockValidator.test.ts`

**Interfaces:**
- Produces: `TableBlockContent` in `packages/shared/src/types/block.ts` with optional `hasHeaderRow?: boolean; hasHeaderColumn?: boolean; fitToWidth?: boolean;` and updated `validateBlockContent('table', content)` in `packages/shared/src/validation/blockValidator.ts`.

- [ ] **Step 1: Read `packages/shared/tests/blockValidator.test.ts` and write failing validation tests**

Add tests verifying `validateBlockContent('table', ...)` accepts optional boolean flags (`hasHeaderRow`, `hasHeaderColumn`, `fitToWidth`) and rejects non-boolean values for any of those three flags.

- [ ] **Step 2: Run shared tests to verify the new tests fail**

Run: `npm --prefix /workspace/My-NoteBook/packages/shared test`
Expected: FAIL because `blockValidator.ts` does not yet reject non-boolean `hasHeaderRow` / `hasHeaderColumn` / `fitToWidth`.

- [ ] **Step 3: Update `TableBlockContent` and `validateBlockContent`**

1. In `packages/shared/src/types/block.ts`, add `hasHeaderRow?: boolean;`, `hasHeaderColumn?: boolean;`, and `fitToWidth?: boolean;` to `TableBlockContent`.
2. In `packages/shared/src/validation/blockValidator.ts` inside the `if (type === 'table')` branch, validate that `c.hasHeaderRow`, `c.hasHeaderColumn`, and `c.fitToWidth` are `boolean` if `!== undefined`.

- [ ] **Step 4: Build `@notebook/shared` and run tests**

Run: `npm --prefix /workspace/My-NoteBook/packages/shared run build && npm --prefix /workspace/My-NoteBook/packages/shared test`
Expected: PASS, and `packages/shared/dist/types/block.d.ts` updated.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types/block.ts packages/shared/src/validation/blockValidator.ts packages/shared/tests/blockValidator.test.ts packages/shared/dist
git commit -m "feat(shared): add Notion header and fitToWidth options to TableBlockContent"
```

---

### Task 2: Pure Table Operations, Selection Geometry, & TSV Utilities (`tableUtils.ts`)

**Files:**
- Create: `apps/web/src/components/editor/blocks/tableUtils.ts`
- Test: `apps/web/tests/tableUtils.test.ts`

**Interfaces:**
- Produces:
  - Types: `CellCoord` (`{ row: number; col: number }`, where `row === -1` is top row `columns`), `CellRange` (`{ start: CellCoord; end: CellCoord }`), `NormalizedRange` (`{ minR: number; maxR: number; minC: number; maxC: number }`)
  - `normalizeRange(range: CellRange): NormalizedRange`
  - `isCellInRange(r: number, c: number, range: CellRange | null): boolean`
  - `computeSelectionBoxShadow(r: number, c: number, range: CellRange | null): string | undefined` (returns inset `2px` `#2383E2` shadows for outer perimeter edges only)
  - `escapeTsvCell(val: string): string` & `serializeRangeToTsv(columns: string[], rows: string[][], range: CellRange): string`
  - Row operations returning updated `TableBlockContent`: `insertRowAt(content: TableBlockContent, visualRowIndex: number, position: 'above' | 'below'): TableBlockContent`, `duplicateRowAt(content: TableBlockContent, rowIndex: number): TableBlockContent`, `clearRowAt(content: TableBlockContent, rowIndex: number): TableBlockContent`, `deleteRowAt(content: TableBlockContent, rowIndex: number): TableBlockContent | null` (promotes `rows[0]` to `columns` if `rowIndex === -1` and `rows.length > 0`; returns `null` if total rows would drop below 1), `reorderRow(content: TableBlockContent, fromIndex: number, toIndex: number): TableBlockContent` (supports `-1..rows.length - 1` unified row space, keeping `rowHeights` aligned)
  - Column operations returning updated `TableBlockContent`: `insertColAt(content: TableBlockContent, colIndex: number, side: 'left' | 'right'): TableBlockContent`, `duplicateColAt(content: TableBlockContent, colIndex: number): TableBlockContent`, `clearColAt(content: TableBlockContent, colIndex: number): TableBlockContent`, `deleteColAt(content: TableBlockContent, colIndex: number): TableBlockContent | null` (returns `null` if `columns.length <= 1`), `sortCol(content: TableBlockContent, colIndex: number, direction: 'asc' | 'desc'): TableBlockContent` (respects `hasHeaderRow !== false`: keeps row `-1` fixed when true, includes row `-1` in sort when false, and keeps `rowHeights` aligned if present), `reorderCol(content: TableBlockContent, fromIndex: number, toIndex: number): TableBlockContent` (updates `columns`, every row, and `columnWidths`)
  - `clearRangeCells(content: TableBlockContent, range: CellRange): TableBlockContent`

- [ ] **Step 1: Write failing unit tests in `apps/web/tests/tableUtils.test.ts`**

Write tests covering:
- `normalizeRange`, `isCellInRange`, and `computeSelectionBoxShadow` (verifying top/bottom/left/right inset `2px #2383E2` only on outer edges of a 2×2 selection).
- `insertRowAt` (`above`/`below` on both `-1` and body rows), `duplicateRowAt`, `clearRowAt`, `deleteRowAt` (including deleting row `-1` promoting `rows[0]`, and returning `null` on a 1-row table where `rows.length === 0`), and `reorderRow` (syncing `rowHeights`).
- `insertColAt`, `duplicateColAt`, `clearColAt`, `deleteColAt` (returning `null` when 1 col), `reorderCol` (syncing `columnWidths`).
- `sortCol` ascending/descending with `hasHeaderRow: true` (header fixed) vs `hasHeaderRow: false` (row `-1` sorted together with `rows`).
- `serializeRangeToTsv` and `clearRangeCells` spanning row `-1` and body rows.

- [ ] **Step 2: Run `tableUtils.test.ts` to verify failure**

Run: `npm --prefix /workspace/My-NoteBook/apps/web test -- tests/tableUtils.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `apps/web/src/components/editor/blocks/tableUtils.ts`**

Implement all exported pure helpers cleanly using unified row-array transformations (`allRows = [columns, ...rows]` for row reorder / header-off sort) so edge cases like row `-1` promotion, `rowHeights`, and `columnWidths` alignment are handled uniformly without duplicated logic.

- [ ] **Step 4: Run `tableUtils.test.ts` to verify pass**

Run: `npm --prefix /workspace/My-NoteBook/apps/web test -- tests/tableUtils.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/editor/blocks/tableUtils.ts apps/web/tests/tableUtils.test.ts
git commit -m "feat(web): add pure Notion table grid, selection, and reorder utilities"
```

---

### Task 3: Caret-Safe `TableCell` with Notion Keyboard Navigation (`TableCell.tsx`)

**Files:**
- Create: `apps/web/src/components/editor/blocks/TableCell.tsx`
- Test: `apps/web/tests/TableCell.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type CellNavDirection = 'next' | 'prev' | 'left' | 'right' | 'up' | 'down';
  export interface TableCellProps {
    value: string;
    rowIndex: number; // -1 for top row, 0..n-1 for body
    colIndex: number;
    isHeaderCell?: boolean;
    onChange: (val: string) => void;
    onNavigate: (direction: CellNavDirection, rowIndex: number, colIndex: number) => void;
    onEscapeToSelect: (rowIndex: number, colIndex: number) => void;
    onFocusCell?: (rowIndex: number, colIndex: number) => void;
    className?: string;
  }
  export const TableCell: React.FC<TableCellProps>;
  ```

- [ ] **Step 1: Write failing tests in `apps/web/tests/TableCell.test.tsx`**

Write tests covering:
- Renders clean `contentEditable` with **no** `"Empty"` placeholder and **no** `dangerouslySetInnerHTML` clobbering while focused.
- Live `onInput` calls `onChange` with normalized text (`\r\n` -> `\n`) without overwriting DOM while focused, and `onBlur` flushes changes if different.
- Pressing `Enter` (with or without `Shift`) does NOT call `preventDefault()` (allows native newline insertion inside the cell).
- Pressing `Tab` calls `preventDefault()` and invokes `onNavigate('next', rowIndex, colIndex)`; `Shift+Tab` invokes `onNavigate('prev', rowIndex, colIndex)`.
- Pressing `Escape` blurs the cell and calls `onEscapeToSelect(rowIndex, colIndex)`.
- Pressing `ArrowLeft` when caret is at offset 0 invokes `onNavigate('left', ...)`, whereas inside text (offset > 0) does NOT invoke `onNavigate`. Pressing `ArrowRight` at text end invokes `onNavigate('right', ...)`. Pressing `ArrowUp` / `ArrowDown` on single-line / boundary line invokes `onNavigate('up' / 'down', ...)`.

- [ ] **Step 2: Run `TableCell.test.tsx` to verify failure**

Run: `npm --prefix /workspace/My-NoteBook/apps/web test -- tests/TableCell.test.tsx`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `apps/web/src/components/editor/blocks/TableCell.tsx`**

Implement `TableCell` with:
- Imperative text sync via `useLayoutEffect` / `useEffect` only when `document.activeElement !== ref.current` (using `innerText` / `textContent` normalization), plus `lastEmittedRef` so live `onInput` emissions don't trigger redundant `onBlur` or DOM resets.
- Caret boundary helpers (`isCaretAtStart(el)`, `isCaretAtEnd(el)`, `isCaretOnFirstLine(el)`, `isCaretOnLastLine(el)`) using `window.getSelection()` + `Range.getClientRects()` with safe fallbacks for `jsdom` tests.

- [ ] **Step 4: Run `TableCell.test.tsx` to verify pass**

Run: `npm --prefix /workspace/My-NoteBook/apps/web test -- tests/TableCell.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/editor/blocks/TableCell.tsx apps/web/tests/TableCell.test.tsx
git commit -m "feat(web): add caret-safe TableCell with Notion keyboard navigation"
```

---

### Task 4: Row, Column, and Table Options Popover Menus (`TableContextMenus.tsx`)

**Files:**
- Create: `apps/web/src/components/editor/blocks/TableContextMenus.tsx`
- Test: `apps/web/tests/TableContextMenus.test.tsx`

**Interfaces:**
- Produces:
  - `RowActionMenu`: props `{ rowIndex: number; canDelete: boolean; onInsertAbove: () => void; onInsertBelow: () => void; onDuplicate: () => void; onClear: () => void; onDelete: () => void; onClose: () => void }`
  - `ColumnActionMenu`: props `{ colIndex: number; canDelete: boolean; onInsertLeft: () => void; onInsertRight: () => void; onDuplicate: () => void; onSortAsc: () => void; onSortDesc: () => void; onClear: () => void; onDelete: () => void; onClose: () => void }`
  - `TableOptionsMenu`: props `{ hasHeaderRow: boolean; hasHeaderColumn: boolean; fitToWidth: boolean; onToggleHeaderRow: () => void; onToggleHeaderColumn: () => void; onToggleFitToWidth: () => void; onCopyTable: () => void; onClearTable: () => void; onClose: () => void }`

- [ ] **Step 1: Write failing tests in `apps/web/tests/TableContextMenus.test.tsx`**

Write tests verifying all menu items render with accessible labels/roles, toggle switches reflect `aria-checked` state for `Header row`, `Header column`, and `Fit to page width`, and `Delete` is disabled when `canDelete === false`.

- [ ] **Step 2: Run `TableContextMenus.test.tsx` to verify failure**

Run: `npm --prefix /workspace/My-NoteBook/apps/web test -- tests/TableContextMenus.test.tsx`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `apps/web/src/components/editor/blocks/TableContextMenus.tsx`**

Implement Notion-styled popovers (`bg-white dark:bg-stone-900`, `border-stone-200 dark:border-stone-800`, `rounded-lg shadow-lg`, Lucide icons, toggle switches with `role="switch"` and `aria-checked`, click-outside backdrop or `onMouseDown` propagation stop).

- [ ] **Step 4: Run `TableContextMenus.test.tsx` to verify pass**

Run: `npm --prefix /workspace/My-NoteBook/apps/web test -- tests/TableContextMenus.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/editor/blocks/TableContextMenus.tsx apps/web/tests/TableContextMenus.test.tsx
git commit -m "feat(web): add Notion row, column, and table options menus"
```

---

### Task 5: Rebuild `TableBlock.tsx` with Full Notion Chrome, Handles, Resizing, & Interactions

**Files:**
- Modify: `apps/web/src/components/editor/blocks/TableBlock.tsx`
- Modify: `apps/web/tests/TableBlock.test.tsx`
- Verify: `apps/web/tests/TablePasteIntegration.test.tsx`

**Interfaces:**
- Consumes: `tableUtils.ts`, `TableCell.tsx`, `TableContextMenus.tsx`, `clipboardTableParser.ts`, `TableBlockContent`
- Produces: `export const TableBlock: React.FC<{ content: TableBlockContent; onChange: (updated: TableBlockContent) => void }>`

- [ ] **Step 1: Update `apps/web/tests/TableBlock.test.tsx` for Notion Simple Table spec & add new tests**

Update outdated tests in `TableBlock.test.tsx` that tested old non-Notion chrome (`+ New` text inside `td`, `Enter` moving to next row, old `bg-blue-500/15` class names, permanent resize handles), and add/keep comprehensive tests for:
1. Flat 1px grid (no `40px` action column, no `+ New` `<tr>`, no `"Empty"` placeholders).
2. `hasHeaderRow` and `hasHeaderColumn` toggle via **Options** menu (`aria-checked`), plus `fitToWidth` toggle switching table width between strict column sum and `100%`.
3. Outside-edge hover `+` buttons: Add column (right bar), Add row (bottom bar), Add row & column (corner `+`).
4. Row (`⋮⋮`) and Column (`⋯`) hover pill handles: click (`<= 4px` move) selects row/col and opens `RowActionMenu`/`ColumnActionMenu` (insert, duplicate, sort A-Z/Z-A, clear, delete); pointer drag (`> 4px` move) reorders rows/columns along with `rowHeights`/`columnWidths` without triggering HTML5 block drag.
5. Full-height blue `#2383E2` hover column resize dividers (drag to resize clamped `60..800`, double-click resets to `150`).
6. Keyboard navigation: `Enter` inserts newline natively, `Tab` moves to next cell and appends row on final cell, `Shift+Tab` moves back, Arrow keys navigate at boundaries, `Escape` exits cell to single-cell selection and second `Escape` clears selection.
7. Mouse drag-selection blurs active `contentEditable` cell so `Delete`/`Backspace`, `Ctrl/Cmd+C`, and `Ctrl/Cmd+X` clear/copy `selectedRange` properly, plus `Ctrl/Cmd+A` whole-table selection, printable key press starting edit on a single selected cell, and unified outer border `boxShadow`.
8. Existing TSV/CSV/HTML smart-paste and single-cell multiline paste preservation (`TablePasteIntegration.test.tsx` + `TableBlock.test.tsx`).

- [ ] **Step 2: Run `TableBlock.test.tsx` to verify failure against current `TableBlock.tsx`**

Run: `npm --prefix /workspace/My-NoteBook/apps/web test -- tests/TableBlock.test.tsx`
Expected: FAIL on the new Notion design/interaction assertions.

- [ ] **Step 3: Rebuild `apps/web/src/components/editor/blocks/TableBlock.tsx`**

Implement the complete Notion Simple Table architecture per Spec Sections 5.3–5.9:
- Top-right **Options** trigger + `TableOptionsMenu` pinned above the visible wrapper (`right-0 -top-7`).
- Horizontal scroll container (`overflow-x-auto custom-scrollbar`) containing padded gutter frame (`pt-4 pl-4 pr-6 pb-6`, plus `w-full` when `fitToWidth`).
- Flex grid layout: `[table + right + bar]` over `[bottom + bar + corner +]`.
- `<table>` (`border-collapse table-fixed`) with `<colgroup>`, full-height column resize overlay dividers (`#2383E2` on hover/drag), row pill handles (`⋮⋮`) on left gutter, column pill handles (`⋯`) on top gutter, pointer drag-reordering with `#2383E2` drop indicator lines, `TableCell` cells with unified perimeter selection `boxShadow`, printable-key handoff on a single selected cell, and smart-paste / TSV copy handlers.

- [ ] **Step 4: Run `TableBlock.test.tsx` and `TablePasteIntegration.test.tsx`**

Run: `npm --prefix /workspace/My-NoteBook/apps/web test -- tests/TableBlock.test.tsx tests/TablePasteIntegration.test.tsx`
Expected: PASS (100% green).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/editor/blocks/TableBlock.tsx apps/web/tests/TableBlock.test.tsx
git commit -m "feat(web): rebuild TableBlock with Notion Simple Table UI and interactions"
```

---

### Task 6: Fix `BlockEditorModal.tsx` Metadata Preservation & Default Blank Table Creation

**Files:**
- Modify: `apps/web/src/components/editor/BlockEditorModal.tsx:369-373,530-533,918-922`
- Modify: `apps/web/tests/BlockEditorModal.test.tsx:188-192` (plus new persistence test)

**Interfaces:**
- Consumes: `TableBlock`, `TableBlockContent`

- [ ] **Step 1: Add failing test in `apps/web/tests/BlockEditorModal.test.tsx` for preserving `columnWidths`, `hasHeaderRow`, `hasHeaderColumn`, `fitToWidth` and update new-table insertion test**

1. Add a test rendering `BlockEditorModal` with a table block that has `columnWidths: [240, 180], hasHeaderRow: false, hasHeaderColumn: true, fitToWidth: true`, verifying the rendered `<table>` / `<col>` keeps `240px` width and header column styling (and persists after editing a cell).
2. Update line 191 (`successfully inserts To-Do, Table, and Image blocks without crashing`) to assert `await screen.findByRole('table')` (since newly inserted blank tables start with empty `''` cells like Notion instead of `'Column 1'`).

- [ ] **Step 2: Run `BlockEditorModal.test.tsx` to verify failure**

Run: `npm --prefix /workspace/My-NoteBook/apps/web test -- tests/BlockEditorModal.test.tsx`
Expected: FAIL because `BlockEditorModal.tsx` strips `columnWidths` and creates `'Column 1'`.

- [ ] **Step 3: Fix `BlockEditorModal.tsx`**

1. Lines 918–922: Spread `...parsedContent` when normalizing `block.type === 'table'` so `columnWidths`, `rowHeights`, `hasHeaderRow`, `hasHeaderColumn`, and `fitToWidth` are preserved, and allow `Array.isArray(parsedContent.rows)` (including 1-row `[]` tables).
2. Lines 369–373: When `handleAddBlock('table', extraContent)` runs without `extraContent`, initialize `{ columns: ['', ''], rows: [['', '']], hasHeaderRow: true, hasHeaderColumn: false, fitToWidth: false }`.
3. Line 532: Keep `columns: ['', '']` (or preserve clean blank header) when converting to table.

- [ ] **Step 4: Run full web test suite & TypeScript build**

Run: `npm --prefix /workspace/My-NoteBook/apps/web test && npm --prefix /workspace/My-NoteBook/apps/web run build`
Expected: All web tests PASS and `tsc && vite build` succeeds with zero errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/editor/BlockEditorModal.tsx apps/web/tests/BlockEditorModal.test.tsx
git commit -m "fix(web): preserve TableBlock metadata in BlockEditorModal and use Notion blank defaults"
```
