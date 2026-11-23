# In-Note Collapsible Sidebar, Adaptive Footprint, Three-Dot Menu, and Smart Excel Paste Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Notion-like in-note collapsible folder tree sidebar, adaptive full-screen and compact footprints, a Material Design 3 three-dot action menu, and intelligent Excel/Sheets table paste detection.

**Architecture:** A modular React component architecture in `apps/web/src/components/editor/` where `InNoteSidebar` manages the space hierarchy and note navigation, `NoteActionsMenu` provides a clean M3 three-dot dropdown for archive/delete/folder operations, `BlockEditorModal` orchestrates dynamic container widths (wide in full mode, side-by-side without overlap in compact mode), and `clipboardTableParser` detects and converts clipboard TSV/HTML tables.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, Vitest, Testing Library, Material Design 3 (M3).

**Spec:** `docs/superpowers/specs/2026-11-23-in-note-sidebar-and-table-paste-design.md`

## Global Constraints

- Never overlap the sidebar on top of note content in compact mode on desktop/tablet (side-by-side docking with a visible gutter is strictly required).
- Full mode must expand up to 95% viewport width (or `max-w-7xl`), removing the legacy `max-w-4xl` cap.
- Minimum 48x48px interactive touch/click targets for all header icons and menu items following Material Design 3 standards.
- Sidebar open/collapsed state must persist in local storage (`notebook_in_note_sidebar_open`).
- Only active notes (`!note.isArchived`) appear in folder trees; archiving a note immediately closes the modal and updates parent state optimistically.

## Review Focus

1. **Clipboard contains single tab or single cell without row breaks**: Should paste as normal text rather than generating an empty or broken single-cell table. (Tested in Task 1)
2. **Clipboard contains mismatched row lengths (ragged TSV from Excel)**: Rows with fewer columns should be padded with empty strings to preserve rectangular table dimensions. (Tested in Task 1)
3. **Pasting multi-cell tabular data inside an existing table cell near the right/bottom edge**: Must dynamically expand table columns and rows without truncating data. (Tested in Task 5)
4. **Navigating to another note via the In-Note Sidebar when current note has pending block autosaves**: All pending autosaves must flush before switching notes. (Tested in Task 4)
5. **Screen resize between mobile (< 640px) and desktop (>= 640px) while sidebar is open**: Layout must smoothly transition between drawer mode on mobile and side-by-side docked mode on desktop without clipping. (Tested in Task 4)

---

### Task 1: Smart Excel / Sheets Table Clipboard Parser

**Files:**
- Create: `apps/web/src/components/editor/utils/clipboardTableParser.ts`
- Test: `apps/web/tests/clipboardTableParser.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface ParsedTableData {
    isTable: boolean;
    columns: string[];
    rows: string[][];
    rawGrid: string[][];
  }

  export function parseClipboardTableData(textPlain: string, textHtml?: string): ParsedTableData | null;
  ```

- [ ] **Step 1: Write the failing tests for clipboard table parsing**

Create `apps/web/tests/clipboardTableParser.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { parseClipboardTableData } from '../src/components/editor/utils/clipboardTableParser';

describe('parseClipboardTableData', () => {
  it('detects and parses standard TSV from Excel with headers and rows', () => {
    const tsv = 'Header1\tHeader2\tHeader3\r\nVal1\tVal2\tVal3\r\nVal4\tVal5\tVal6';
    const result = parseClipboardTableData(tsv);
    expect(result).not.toBeNull();
    expect(result?.isTable).toBe(true);
    expect(result?.columns).toEqual(['Header1', 'Header2', 'Header3']);
    expect(result?.rows).toEqual([
      ['Val1', 'Val2', 'Val3'],
      ['Val4', 'Val5', 'Val6']
    ]);
    expect(result?.rawGrid).toEqual([
      ['Header1', 'Header2', 'Header3'],
      ['Val1', 'Val2', 'Val3'],
      ['Val4', 'Val5', 'Val6']
    ]);
  });

  it('pads ragged rows to maintain rectangular table structure', () => {
    const raggedTsv = 'ColA\tColB\tColC\nRow1A\tRow1B\nRow2A\tRow2B\tRow2C\tExtra';
    const result = parseClipboardTableData(raggedTsv);
    expect(result).not.toBeNull();
    expect(result?.columns.length).toBe(4);
    expect(result?.rows[0]).toEqual(['Row1A', 'Row1B', '', '']);
  });

  it('returns null for plain text without tabs or table structure', () => {
    expect(parseClipboardTableData('Just a regular paragraph of text')).toBeNull();
    expect(parseClipboardTableData('Line 1\nLine 2\nLine 3')).toBeNull();
  });

  it('detects HTML table tags when textPlain is ambiguous', () => {
    const html = '<table><tr><th>Name</th><th>Age</th></tr><tr><td>Alice</td><td>30</td></tr></table>';
    const result = parseClipboardTableData('', html);
    expect(result).not.toBeNull();
    expect(result?.columns).toEqual(['Name', 'Age']);
    expect(result?.rows).toEqual([['Alice', '30']]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /workspace/My-NoteBook/apps/web && npx vitest run tests/clipboardTableParser.test.ts`
Expected: FAIL with "Cannot find module '../src/components/editor/utils/clipboardTableParser'"

- [ ] **Step 3: Implement `parseClipboardTableData` in `apps/web/src/components/editor/utils/clipboardTableParser.ts`**

Implement TSV splitting (`\r\n` / `\n` and `\t`), HTML `<table>` parsing with DOMParser fallback, row padding, and quotes unescaping.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /workspace/My-NoteBook/apps/web && npx vitest run tests/clipboardTableParser.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/editor/utils/clipboardTableParser.ts apps/web/tests/clipboardTableParser.test.ts
git commit -m "feat(web): add clipboard table parser utility for Excel and Sheets"
```

---

### Task 2: In-Note Hierarchical Folder Tree Sidebar

**Files:**
- Create: `apps/web/src/components/editor/InNoteSidebar.tsx`
- Test: `apps/web/tests/InNoteSidebar.test.tsx`

**Interfaces:**
- Consumes: `SpaceDto`, `NoteDto` from `@notebook/shared`
- Produces:
  ```typescript
  export interface InNoteSidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    currentNoteId: string;
    spaces: SpaceDto[];
    notes: NoteDto[];
    onSelectNote: (noteId: string) => void;
    onCreateNote?: (spaceId: string | null) => void;
  }
  export const InNoteSidebar: React.FC<InNoteSidebarProps>;
  ```

- [ ] **Step 1: Write failing tests for InNoteSidebar**

Create `apps/web/tests/InNoteSidebar.test.tsx`:
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { InNoteSidebar } from '../src/components/editor/InNoteSidebar';
import { SpaceDto, NoteDto } from '@notebook/shared';

describe('InNoteSidebar', () => {
  const spaces: SpaceDto[] = [
    { id: 's1', name: 'Work', parentSpaceId: null, position: 0, createdAt: '' },
    { id: 's2', name: 'Projects', parentSpaceId: 's1', position: 0, createdAt: '' }
  ];

  const notes: NoteDto[] = [
    { id: 'n1', title: 'Work Note', color: '#fff', position: 0, isPinned: false, isArchived: false, spaceId: 's1', createdAt: '', updatedAt: '' },
    { id: 'n2', title: 'Archived Note', color: '#fff', position: 1, isPinned: false, isArchived: true, spaceId: 's1', createdAt: '', updatedAt: '' },
    { id: 'n3', title: 'General Note', color: '#fff', position: 0, isPinned: false, isArchived: false, spaceId: null, createdAt: '', updatedAt: '' }
  ];

  it('renders folders and active notes while excluding archived notes from folder trees', () => {
    render(
      <InNoteSidebar
        isOpen={true}
        onToggle={() => {}}
        currentNoteId="n1"
        spaces={spaces}
        notes={notes}
        onSelectNote={() => {}}
      />
    );

    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Work Note')).toBeInTheDocument();
    expect(screen.getByText('General Note')).toBeInTheDocument();
    expect(screen.queryByText('Archived Note')).not.toBeInTheDocument();
  });

  it('highlights current active note and calls onSelectNote on click', () => {
    const onSelectNote = vi.fn();
    render(
      <InNoteSidebar
        isOpen={true}
        onToggle={() => {}}
        currentNoteId="n1"
        spaces={spaces}
        notes={notes}
        onSelectNote={onSelectNote}
      />
    );

    const activeItem = screen.getByText('Work Note').closest('button');
    expect(activeItem).toHaveClass('font-semibold');

    const generalItem = screen.getByText('General Note');
    fireEvent.click(generalItem);
    expect(onSelectNote).toHaveBeenCalledWith('n3');
  });

  it('collapses folders when chevron is clicked', () => {
    render(
      <InNoteSidebar
        isOpen={true}
        onToggle={() => {}}
        currentNoteId="n1"
        spaces={spaces}
        notes={notes}
        onSelectNote={() => {}}
      />
    );

    const collapseBtn = screen.getByLabelText('Toggle Work folder');
    fireEvent.click(collapseBtn);
    expect(screen.queryByText('Work Note')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /workspace/My-NoteBook/apps/web && npx vitest run tests/InNoteSidebar.test.tsx`
Expected: FAIL with "Cannot find module '../src/components/editor/InNoteSidebar'"

- [ ] **Step 3: Implement `InNoteSidebar.tsx`**

Build `InNoteSidebar` with tree building (`buildSpaceTree`), folder toggle states, note count badge, active note indicator with Material Design 3 tokens, and accessible keyboard navigation.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /workspace/My-NoteBook/apps/web && npx vitest run tests/InNoteSidebar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/editor/InNoteSidebar.tsx apps/web/tests/InNoteSidebar.test.tsx
git commit -m "feat(web): add InNoteSidebar component for in-note folder tree navigation"
```

---

### Task 3: Material Design 3 Three-Dot Overflow Action Menu

**Files:**
- Create: `apps/web/src/components/editor/NoteActionsMenu.tsx`
- Test: `apps/web/tests/NoteActionsMenu.test.tsx`

**Interfaces:**
- Consumes: `SpaceDto`, `NoteDto` from `@notebook/shared`
- Produces:
  ```typescript
  export interface NoteActionsMenuProps {
    note: NoteDto;
    spaces: SpaceDto[];
    onArchiveToggle: () => void;
    onDelete: () => void;
    onMoveToSpace: (spaceId: string | null) => void;
  }
  export const NoteActionsMenu: React.FC<NoteActionsMenuProps>;
  ```

- [ ] **Step 1: Write failing tests for NoteActionsMenu**

Create `apps/web/tests/NoteActionsMenu.test.tsx`:
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { NoteActionsMenu } from '../src/components/editor/NoteActionsMenu';
import { NoteDto, SpaceDto } from '@notebook/shared';

describe('NoteActionsMenu', () => {
  const note: NoteDto = {
    id: 'n1',
    title: 'Test Note',
    color: '#fff',
    position: 0,
    isPinned: false,
    isArchived: false,
    spaceId: null,
    createdAt: '',
    updatedAt: ''
  };

  const spaces: SpaceDto[] = [
    { id: 's1', name: 'Work', parentSpaceId: null, position: 0, createdAt: '' }
  ];

  it('renders trigger button and opens menu on click', () => {
    render(
      <NoteActionsMenu
        note={note}
        spaces={spaces}
        onArchiveToggle={() => {}}
        onDelete={() => {}}
        onMoveToSpace={() => {}}
      />
    );

    const trigger = screen.getByTitle('Note options');
    fireEvent.click(trigger);

    expect(screen.getByText('Archive note')).toBeInTheDocument();
    expect(screen.getByText('Change folder')).toBeInTheDocument();
    expect(screen.getByText('Delete note')).toBeInTheDocument();
  });

  it('shows Unarchive note when note is already archived', () => {
    const archivedNote = { ...note, isArchived: true };
    render(
      <NoteActionsMenu
        note={archivedNote}
        spaces={spaces}
        onArchiveToggle={() => {}}
        onDelete={() => {}}
        onMoveToSpace={() => {}}
      />
    );

    fireEvent.click(screen.getByTitle('Note options'));
    expect(screen.getByText('Unarchive note')).toBeInTheDocument();
  });

  it('triggers delete callback with confirmation', () => {
    const onDelete = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <NoteActionsMenu
        note={note}
        spaces={spaces}
        onArchiveToggle={() => {}}
        onDelete={onDelete}
        onMoveToSpace={() => {}}
      />
    );

    fireEvent.click(screen.getByTitle('Note options'));
    fireEvent.click(screen.getByText('Delete note'));
    expect(onDelete).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /workspace/My-NoteBook/apps/web && npx vitest run tests/NoteActionsMenu.test.tsx`
Expected: FAIL with "Cannot find module '../src/components/editor/NoteActionsMenu'"

- [ ] **Step 3: Implement `NoteActionsMenu.tsx`**

Implement `NoteActionsMenu` with M3 elevation-2 styling, keyboard `Escape` dismissal, folder submenu for moving spaces, archive toggle, and destructive delete action.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /workspace/My-NoteBook/apps/web && npx vitest run tests/NoteActionsMenu.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/editor/NoteActionsMenu.tsx apps/web/tests/NoteActionsMenu.test.tsx
git commit -m "feat(web): add Material Design 3 NoteActionsMenu component"
```

---

### Task 4: Adaptive Footprint & Sidebar Integration in `BlockEditorModal.tsx`

**Files:**
- Modify: `apps/web/src/components/editor/BlockEditorModal.tsx`
- Modify: `apps/web/src/App.tsx` (pass `notes` to `BlockEditorModal`)
- Modify: `apps/web/tests/BlockEditorModal.test.tsx`

**Interfaces:**
- Consumes: `InNoteSidebar`, `NoteActionsMenu`, `SpaceDto`, `NoteDto`
- Produces: Updated `BlockEditorModal` supporting wide full mode (`max-w-7xl`), side-by-side docked compact mode (`max-w-5xl`), and sidebar toggle.

- [ ] **Step 1: Write test for adaptive footprint and in-note sidebar integration**

Update `apps/web/tests/BlockEditorModal.test.tsx` with:
```typescript
it('renders wide full mode footprint without max-w-4xl constraint', async () => {
  const note: NoteDto = {
    id: 'n1',
    title: 'Wide Mode Note',
    color: '#ffffff',
    position: 0,
    isPinned: false,
    isArchived: false,
    createdAt: '',
    updatedAt: '',
    blocks: []
  };

  render(<BlockEditorModal note={note} onClose={() => {}} onNoteUpdated={() => {}} />);
  const fullscreenBtn = screen.getByTitle('Full screen');
  fireEvent.click(fullscreenBtn);

  const contentContainer = screen.getByTestId('modal-editor-content-area');
  expect(contentContainer).toHaveClass('max-w-7xl');
  expect(contentContainer).not.toHaveClass('max-w-4xl');
});

it('renders in-note sidebar side-by-side with editor in compact mode without overlap', async () => {
  const note: NoteDto = {
    id: 'n1',
    title: 'Compact Side-by-Side Note',
    color: '#ffffff',
    position: 0,
    isPinned: false,
    isArchived: false,
    createdAt: '',
    updatedAt: '',
    blocks: []
  };

  render(<BlockEditorModal note={note} onClose={() => {}} onNoteUpdated={() => {}} />);
  const sidebarToggle = screen.getByTitle('Toggle folder sidebar');
  fireEvent.click(sidebarToggle);

  const modalDialog = screen.getByTestId('block-editor-modal-dialog');
  expect(modalDialog).toHaveClass('max-w-5xl');
  expect(screen.getByTestId('in-note-sidebar')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /workspace/My-NoteBook/apps/web && npx vitest run tests/BlockEditorModal.test.tsx`
Expected: FAIL due to missing data-testids or class mismatches

- [ ] **Step 3: Update `BlockEditorModal.tsx` and `App.tsx`**

1. In `BlockEditorModal.tsx`:
   - Add state `isSidebarOpen` initialized from `localStorage.getItem('notebook_in_note_sidebar_open') === 'true'`.
   - In header: add `PanelLeft` toggle button and replace separate folder/delete icons with `NoteActionsMenu`.
   - In body: render `InNoteSidebar` docked side-by-side with the editor canvas inside a flex container with clean gutter padding.
   - Update container classes: Full mode uses `max-w-7xl w-full mx-auto px-6 lg:px-12`; Compact mode dynamically switches between `max-w-3xl` (collapsed) and `max-w-5xl` (expanded).
2. In `App.tsx`: pass `notes={notes}` to `BlockEditorModal`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /workspace/My-NoteBook/apps/web && npx vitest run tests/BlockEditorModal.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/editor/BlockEditorModal.tsx apps/web/src/App.tsx apps/web/tests/BlockEditorModal.test.tsx
git commit -m "feat(web): integrate InNoteSidebar, NoteActionsMenu, and adaptive footprints into BlockEditorModal"
```

---

### Task 5: Smart Table Paste Integration (Canvas / Empty Block & Inside Table)

**Files:**
- Modify: `apps/web/src/components/editor/BlockEditorModal.tsx`
- Modify: `apps/web/src/components/editor/blocks/TableBlock.tsx`
- Test: `apps/web/tests/TablePasteIntegration.test.tsx`

**Interfaces:**
- Consumes: `parseClipboardTableData` from `clipboardTableParser.ts`
- Produces: Seamless detection of pasted Excel/Sheets data in note canvas and within table cells.

- [ ] **Step 1: Write integration tests for table paste handling**

Create `apps/web/tests/TablePasteIntegration.test.tsx`:
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { TableBlock } from '../src/components/editor/blocks/TableBlock';

describe('TableBlock Smart Paste', () => {
  it('pastes multi-cell TSV into existing table starting from active cell', () => {
    const onChange = vi.fn();
    const content = {
      columns: ['Col 1', 'Col 2'],
      rows: [['A', 'B'], ['C', 'D']]
    };

    render(<TableBlock content={content} onChange={onChange} />);

    const firstCell = screen.getByText('A');
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.assign(pasteEvent, {
      clipboardData: {
        getData: (format: string) => format === 'text/plain' ? 'X\tY\nZ\tW' : ''
      }
    });

    firstCell.dispatchEvent(pasteEvent);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      rows: [
        ['X', 'Y'],
        ['Z', 'W']
      ]
    }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /workspace/My-NoteBook/apps/web && npx vitest run tests/TablePasteIntegration.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement smart paste handlers**

1. In `BlockEditorModal.tsx`:
   - Attach `onPaste` handler on the canvas area and empty text block.
   - When clipboard contains table data via `parseClipboardTableData`: prevent default, automatically create a `TableBlock` with `columns` and `rows`, and show a temporary toast indicator.
2. In `TableBlock.tsx`:
   - Wire cell paste event to `parseClipboardTableData`.
   - If tabular data detected, map cells starting from active row and column, auto-expanding dimensions if pasted data exceeds bounds.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /workspace/My-NoteBook/apps/web && npx vitest run tests/TablePasteIntegration.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/editor/BlockEditorModal.tsx apps/web/src/components/editor/blocks/TableBlock.tsx apps/web/tests/TablePasteIntegration.test.tsx
git commit -m "feat(web): wire smart Excel table paste detection on note canvas and TableBlock"
```

---

### Task 6: End-to-End Verification and Regression Suite

**Files:**
- Modify: `apps/web/tests/BlockEditorModal.test.tsx`
- Run: Full vitest suite across `apps/web`

- [ ] **Step 1: Run all unit and integration tests**

Run: `cd /workspace/My-NoteBook/apps/web && npm test -- --run`
Expected: All 18+ test files pass with 0 errors.

- [ ] **Step 2: Run production web build to verify TypeScript and bundling**

Run: `cd /workspace/My-NoteBook/apps/web && npm run build`
Expected: Build succeeds with `dist/` artifacts created.

- [ ] **Step 3: Commit final integration updates**

```bash
git add -A
git commit -m "chore(web): complete in-note sidebar, adaptive footprints, and table paste integration"
```
