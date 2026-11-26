import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TableBlock } from '../src/components/editor/blocks/TableBlock';
import { TableBlockContent } from '@notebook/shared';

function setCaret(el: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) throw new Error('Selection not available');
  const range = document.createRange();
  const textNode = el.firstChild;
  if (textNode && textNode.nodeType === Node.TEXT_NODE) {
    const clamped = Math.max(0, Math.min(offset, (textNode.textContent || '').length));
    range.setStart(textNode, clamped);
    range.setEnd(textNode, clamped);
  } else {
    range.setStart(el, 0);
    range.setEnd(el, 0);
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

describe('TableBlock (Notion Simple Table)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.getSelection()?.removeAllRanges();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  describe('Flat grid chrome & 1-row support', () => {
    it('renders flat 1px grid with no rounded-xl card, no 40px action column, no + New row, and no Empty placeholders', () => {
      const content: TableBlockContent = {
        columns: ['Col A', 'Col B'],
        rows: [
          ['', 'B1'],
          ['A2', ''],
        ],
      };

      const { container } = render(<TableBlock content={content} onChange={vi.fn()} />);

      // No rounded-xl outer card
      expect(container.querySelector('.rounded-xl')).toBeNull();

      // Exact 2 columns in colgroup (no 40px action column)
      const cols = container.querySelectorAll('colgroup col');
      expect(cols).toHaveLength(2);

      // Exact 2 header cells and 4 body cells (no + New row)
      expect(container.querySelectorAll('thead th')).toHaveLength(2);
      expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
      expect(container.querySelectorAll('tbody td')).toHaveLength(4);
      expect(screen.queryByText('New')).toBeNull();

      // No "Empty" placeholder text or data-placeholder attributes
      expect(container.textContent).not.toContain('Empty');
      expect(container.querySelectorAll('[data-placeholder]').length).toBe(0);

      // ContentEditable cells without <input> or focus:ring-
      const editables = container.querySelectorAll('[contenteditable="true"]');
      expect(editables).toHaveLength(6);
      expect(container.querySelectorAll('input')).toHaveLength(0);
      editables.forEach((el) => {
        expect(el.className).not.toMatch(/focus:ring-/);
      });
    });

    it('supports 1-row tables when rows is an empty array', () => {
      const content: TableBlockContent = {
        columns: ['Only A', 'Only B'],
        rows: [],
      };

      const { container } = render(<TableBlock content={content} onChange={vi.fn()} />);

      expect(container.querySelectorAll('thead th')).toHaveLength(2);
      expect(container.querySelectorAll('tbody tr')).toHaveLength(0);
      expect(screen.getByText('Only A')).toBeInTheDocument();
      expect(screen.getByText('Only B')).toBeInTheDocument();
    });

    it('updates cell values on input and blur', () => {
      const content: TableBlockContent = {
        columns: ['Col A', 'Col B'],
        rows: [['Val 1', 'Val 2']],
      };
      const onChange = vi.fn();

      render(<TableBlock content={content} onChange={onChange} />);

      const colA = screen.getByText('Col A');
      colA.focus();
      colA.textContent = 'Updated Col A';
      fireEvent.input(colA);

      expect(onChange).toHaveBeenCalledWith({
        columns: ['Updated Col A', 'Col B'],
        rows: [['Val 1', 'Val 2']],
      });

      const cellVal1 = screen.getByText('Val 1');
      cellVal1.textContent = 'New Val 1';
      fireEvent.blur(cellVal1);

      expect(onChange).toHaveBeenCalledWith({
        columns: ['Col A', 'Col B'],
        rows: [['New Val 1', 'Val 2']],
      });
    });
  });

  describe('Options menu & table toggles', () => {
    it('toggles Options menu cleanly on trigger click without reopening on second click', () => {
      const content: TableBlockContent = {
        columns: ['Col 1', 'Col 2'],
        rows: [['A', 'B']],
      };
      render(<TableBlock content={content} onChange={vi.fn()} />);

      const optionsBtn = screen.getByRole('button', { name: /^options$/i });
      expect(screen.queryByRole('menu', { name: /table options/i })).toBeNull();

      // Simulate real mouse sequence (mousedown + click)
      fireEvent.mouseDown(optionsBtn);
      fireEvent.click(optionsBtn);
      expect(screen.getByRole('menu', { name: /table options/i })).toBeInTheDocument();

      // Clicking already-open trigger closes it instead of re-opening
      fireEvent.mouseDown(optionsBtn);
      fireEvent.click(optionsBtn);
      expect(screen.queryByRole('menu', { name: /table options/i })).toBeNull();
    });

    it('toggles hasHeaderRow, hasHeaderColumn, and fitToWidth via Options menu', () => {
      const onChange = vi.fn();
      const baseContent: TableBlockContent = {
        columns: ['H1', 'H2'],
        rows: [['A1', 'B1']],
        columnWidths: [150, 150],
      };

      const { container, rerender } = render(
        <TableBlock content={baseContent} onChange={onChange} />
      );

      // Default: hasHeaderRow=true, hasHeaderColumn=false, fitToWidth=false
      const table = screen.getByRole('table');
      expect(table.style.width).toBe('300px');
      expect(table.style.minWidth).toBe('');
      expect(container.querySelector('thead th')?.className).toContain('bg-stone-100/70');
      expect(container.querySelectorAll('tbody td')[0]?.className).not.toContain('bg-stone-100/70');

      fireEvent.click(screen.getByRole('button', { name: /^options$/i }));

      const headerRowSwitch = screen.getByRole('switch', { name: /header row/i });
      const headerColSwitch = screen.getByRole('switch', { name: /header column/i });
      const fitWidthSwitch = screen.getByRole('switch', { name: /fit to page width/i });

      expect(headerRowSwitch).toHaveAttribute('aria-checked', 'true');
      expect(headerColSwitch).toHaveAttribute('aria-checked', 'false');
      expect(fitWidthSwitch).toHaveAttribute('aria-checked', 'false');

      fireEvent.click(headerRowSwitch);
      expect(onChange).toHaveBeenLastCalledWith({
        ...baseContent,
        hasHeaderRow: false,
      });

      fireEvent.click(headerColSwitch);
      expect(onChange).toHaveBeenLastCalledWith({
        ...baseContent,
        hasHeaderColumn: true,
      });

      fireEvent.click(fitWidthSwitch);
      expect(onChange).toHaveBeenLastCalledWith({
        ...baseContent,
        fitToWidth: true,
      });

      // Verify updated visual rendering with toggled flags
      rerender(
        <TableBlock
          content={{
            ...baseContent,
            hasHeaderRow: false,
            hasHeaderColumn: true,
            fitToWidth: true,
          }}
          onChange={onChange}
        />
      );

      expect(table.style.width).toBe('100%');
      expect(table.style.minWidth).toBe('300px');
      // Header row off -> col 1 in thead no longer has header fill; col 0 still has it because hasHeaderColumn=true
      const ths = container.querySelectorAll('thead th');
      expect(ths[0].className).toContain('bg-stone-100/70');
      expect(ths[1].className).not.toContain('bg-stone-100/70');
      // Body col 0 has header fill, body col 1 does not; TableCell header typography matches thead col 0 cleanly
      const tds = container.querySelectorAll('tbody td');
      expect(tds[0].className).toContain('bg-stone-100/70');
      expect(tds[1].className).not.toContain('bg-stone-100/70');

      const th0Editable = ths[0].querySelector('[contenteditable="true"]')!;
      const td0Editable = tds[0].querySelector('[contenteditable="true"]')!;
      const td1Editable = tds[1].querySelector('[contenteditable="true"]')!;
      expect(th0Editable.className).toBe(td0Editable.className);
      expect(td0Editable.className).toContain('font-semibold');
      expect(td0Editable.className).not.toContain('text-sm');
      expect(td1Editable.className).toContain('text-sm');
      expect(td1Editable.className).not.toContain('font-semibold');
    });

    it('copies table as TSV and clears contents from Options menu', async () => {
      const onChange = vi.fn();
      const content: TableBlockContent = {
        columns: ['Header 1', 'Header 2'],
        rows: [
          ['R1C1', 'R1C2'],
          ['R2C1', 'R2C2'],
        ],
      };

      render(<TableBlock content={content} onChange={onChange} />);

      fireEvent.click(screen.getByRole('button', { name: /^options$/i }));
      fireEvent.click(screen.getByRole('menuitem', { name: /copy table/i }));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'Header 1\tHeader 2\nR1C1\tR1C2\nR2C1\tR2C2'
      );
      expect(await screen.findByText('Copied!')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /^options$/i }));
      fireEvent.click(screen.getByRole('menuitem', { name: /clear contents/i }));

      expect(onChange).toHaveBeenCalledWith({
        columns: ['', ''],
        rows: [
          ['', ''],
          ['', ''],
        ],
      });
    });
  });

  describe('Outside-edge + bars & corner add', () => {
    it('adds a column, adds a row, and adds both row and column via outside-edge + buttons', () => {
      const content: TableBlockContent = {
        columns: ['Col 1', 'Col 2'],
        rows: [['R1C1', 'R1C2']],
        columnWidths: [140, 160],
      };
      const onChange = vi.fn();

      render(<TableBlock content={content} onChange={onChange} />);

      // Right + bar adds column with empty header and 150px width
      fireEvent.click(screen.getByRole('button', { name: /^add column$/i }));
      expect(onChange).toHaveBeenNthCalledWith(1, {
        columns: ['Col 1', 'Col 2', ''],
        rows: [['R1C1', 'R1C2', '']],
        columnWidths: [140, 160, 150],
      });

      // Bottom + bar adds row
      fireEvent.click(screen.getByRole('button', { name: /^add row$/i }));
      expect(onChange).toHaveBeenNthCalledWith(2, {
        columns: ['Col 1', 'Col 2'],
        rows: [
          ['R1C1', 'R1C2'],
          ['', ''],
        ],
        columnWidths: [140, 160],
      });

      // Corner + adds both row and column
      fireEvent.click(screen.getByRole('button', { name: /add row and column/i }));
      expect(onChange).toHaveBeenNthCalledWith(3, {
        columns: ['Col 1', 'Col 2', ''],
        rows: [
          ['R1C1', 'R1C2', ''],
          ['', '', ''],
        ],
        columnWidths: [140, 160, 150],
      });
    });
  });

  describe('Row and Column hover pill handles, menus, & pointer drag reordering', () => {
    it('opens RowActionMenu on <=4px click, selects the row, and executes row menu actions', () => {
      const onChange = vi.fn();
      const content: TableBlockContent = {
        columns: ['Name', 'Age'],
        rows: [
          ['Alice', '30'],
          ['Bob', '25'],
        ],
        rowHeights: [40, 50],
      };

      const { container } = render(<TableBlock content={content} onChange={onChange} />);

      const row1Handle = screen.getByRole('button', { name: /row 2 options/i });
      // Must NOT use HTML5 draggable
      expect(row1Handle).not.toHaveAttribute('draggable', 'true');

      // Click (<= 4px move) selects row 0 and opens RowActionMenu
      fireEvent.mouseDown(row1Handle, { button: 0, clientX: 10, clientY: 50 });
      fireEvent.mouseUp(window, { clientX: 11, clientY: 51 });

      expect(screen.getByRole('menu', { name: /row 1 actions/i })).toBeInTheDocument();
      const row0Cells = container.querySelectorAll('tbody tr')[0].querySelectorAll('td');
      row0Cells.forEach((td) => {
        expect(td.className).toContain('bg-[#2383E2]/10');
      });

      // Insert above
      fireEvent.click(screen.getByRole('menuitem', { name: /insert above/i }));
      expect(onChange).toHaveBeenLastCalledWith({
        ...content,
        rows: [
          ['', ''],
          ['Alice', '30'],
          ['Bob', '25'],
        ],
        rowHeights: [32, 40, 50],
      });

      // Re-open and Delete row 0
      fireEvent.mouseDown(row1Handle, { button: 0, clientX: 10, clientY: 50 });
      fireEvent.mouseUp(window, { clientX: 10, clientY: 50 });
      fireEvent.click(screen.getByRole('menuitem', { name: /delete/i }));
      expect(onChange).toHaveBeenLastCalledWith({
        ...content,
        rows: [['Bob', '25']],
        rowHeights: [50],
      });
    });

    it('disables Delete in RowActionMenu on a 1-row table and closes menu on second handle click', () => {
      const content: TableBlockContent = {
        columns: ['Only', 'Row'],
        rows: [],
      };
      render(<TableBlock content={content} onChange={vi.fn()} />);

      const topRowHandle = screen.getByRole('button', { name: /row 1 options/i });
      fireEvent.mouseDown(topRowHandle, { button: 0, clientX: 10, clientY: 20 });
      fireEvent.mouseUp(window, { clientX: 10, clientY: 20 });

      expect(screen.getByRole('menuitem', { name: /delete/i })).toBeDisabled();

      // Clicking handle again closes the open menu
      fireEvent.mouseDown(topRowHandle, { button: 0, clientX: 10, clientY: 20 });
      fireEvent.mouseUp(window, { clientX: 10, clientY: 20 });
      expect(screen.queryByRole('menu', { name: /row 0 actions/i })).toBeNull();
    });

    it('opens ColumnActionMenu on <=4px click, selects the column, and sorts/deletes columns', () => {
      const onChange = vi.fn();
      const content: TableBlockContent = {
        columns: ['Item', 'Count'],
        rows: [
          ['Banana', '10'],
          ['Apple', '2'],
        ],
        columnWidths: [140, 120],
      };

      const { container } = render(<TableBlock content={content} onChange={onChange} />);

      const col2Handle = screen.getByRole('button', { name: /column 2 options/i });
      expect(col2Handle).not.toHaveAttribute('draggable', 'true');

      fireEvent.mouseDown(col2Handle, { button: 0, clientX: 200, clientY: 5 });
      fireEvent.mouseUp(window, { clientX: 201, clientY: 6 });

      expect(screen.getByRole('menu', { name: /column 2 actions/i })).toBeInTheDocument();
      // Column 1 (index 1) cells selected across thead and tbody
      const ths = container.querySelectorAll('thead th');
      expect(ths[1].className).toContain('bg-[#2383E2]/10');
      expect(ths[0].className).not.toContain('bg-[#2383E2]/10');

      // Sort A -> Z numerically
      fireEvent.click(screen.getByRole('menuitem', { name: /sort a.*z/i }));
      expect(onChange).toHaveBeenLastCalledWith({
        ...content,
        rows: [
          ['Apple', '2'],
          ['Banana', '10'],
        ],
      });

      // Re-open and Duplicate column 2
      fireEvent.mouseDown(col2Handle, { button: 0, clientX: 200, clientY: 5 });
      fireEvent.mouseUp(window, { clientX: 200, clientY: 5 });
      fireEvent.click(screen.getByRole('menuitem', { name: /duplicate/i }));
      expect(onChange).toHaveBeenLastCalledWith({
        ...content,
        columns: ['Item', 'Count', 'Count'],
        rows: [
          ['Banana', '10', '10'],
          ['Apple', '2', '2'],
        ],
        columnWidths: [140, 120, 120],
      });
    });

    it('reorders rows via pointer drag (>4px) and syncs rowHeights without opening menu', () => {
      const onChange = vi.fn();
      const parentMouseDown = vi.fn();
      const content: TableBlockContent = {
        columns: ['Name'],
        rows: [['Alice'], ['Bob'], ['Cara']],
        rowHeights: [40, 50, 60],
      };

      const { container } = render(
        <div onMouseDown={parentMouseDown}>
          <TableBlock content={content} onChange={onChange} />
        </div>
      );

      const trs = Array.from(container.querySelectorAll('thead tr, tbody tr'));
      const mockRects = [
        { top: 0, bottom: 32, height: 32, left: 0, right: 150, width: 150 },
        { top: 32, bottom: 72, height: 40, left: 0, right: 150, width: 150 },
        { top: 72, bottom: 122, height: 50, left: 0, right: 150, width: 150 },
        { top: 122, bottom: 182, height: 60, left: 0, right: 150, width: 150 },
      ];
      trs.forEach((tr, i) => {
        vi.spyOn(tr, 'getBoundingClientRect').mockReturnValue(mockRects[i] as DOMRect);
      });

      // Drag body row 0 (Alice) down below Cara (bottom=182)
      const rowAliceHandle = screen.getByRole('button', { name: /row 2 options/i });
      fireEvent.mouseDown(rowAliceHandle, { button: 0, clientX: 5, clientY: 50 });
      expect(parentMouseDown).not.toHaveBeenCalled();

      fireEvent.mouseMove(window, { clientX: 5, clientY: 180 });
      // Menu must NOT open during drag
      expect(screen.queryByRole('menu')).toBeNull();

      fireEvent.mouseUp(window, { clientX: 5, clientY: 180 });

      expect(onChange).toHaveBeenCalledWith({
        ...content,
        rows: [['Bob'], ['Cara'], ['Alice']],
        rowHeights: [50, 60, 40],
      });
      expect(screen.queryByRole('menu')).toBeNull();
    });

    it('reorders columns via pointer drag (>4px) and syncs columnWidths', () => {
      const onChange = vi.fn();
      const content: TableBlockContent = {
        columns: ['A', 'B', 'C'],
        rows: [['1', '2', '3']],
        columnWidths: [100, 150, 200],
      };

      const { container } = render(<TableBlock content={content} onChange={onChange} />);

      const ths = Array.from(container.querySelectorAll('thead th'));
      const mockRects = [
        { left: 0, right: 100, width: 100, top: 0, bottom: 32, height: 32 },
        { left: 100, right: 250, width: 150, top: 0, bottom: 32, height: 32 },
        { left: 250, right: 450, width: 200, top: 0, bottom: 32, height: 32 },
      ];
      ths.forEach((th, i) => {
        vi.spyOn(th, 'getBoundingClientRect').mockReturnValue(mockRects[i] as DOMRect);
      });

      // Drag column 2 (C) left before column 0 (A)
      const colCHandle = screen.getByRole('button', { name: /column 3 options/i });
      fireEvent.mouseDown(colCHandle, { button: 0, clientX: 350, clientY: 5 });
      fireEvent.mouseMove(window, { clientX: 5, clientY: 5 });
      fireEvent.mouseUp(window, { clientX: 5, clientY: 5 });

      expect(onChange).toHaveBeenCalledWith({
        ...content,
        columns: ['C', 'A', 'B'],
        rows: [['3', '1', '2']],
        columnWidths: [200, 100, 150],
      });
      expect(screen.queryByRole('menu')).toBeNull();
    });
  });

  describe('Full-height blue column resize dividers', () => {
    it('resizes column width clamped to [60, 800] and resets to 150px on double-click', () => {
      const onChange = vi.fn();
      const content: TableBlockContent = {
        columns: ['Col 1', 'Col 2'],
        rows: [['A', 'B']],
        columnWidths: [150, 260],
      };

      render(<TableBlock content={content} onChange={onChange} />);

      const col1Resize = screen.getByLabelText('Resize column Col 1');
      expect(col1Resize.innerHTML).toContain('#2383E2');

      // Drag +60 -> 210
      fireEvent.mouseDown(col1Resize, { clientX: 100 });
      fireEvent.mouseMove(window, { clientX: 160 });
      fireEvent.mouseUp(window, { clientX: 160 });
      expect(onChange).toHaveBeenLastCalledWith({
        ...content,
        columnWidths: [210, 260],
      });

      // Drag -200 -> clamped to 60
      fireEvent.mouseDown(col1Resize, { clientX: 200 });
      fireEvent.mouseUp(window, { clientX: 0 });
      expect(onChange).toHaveBeenLastCalledWith({
        ...content,
        columnWidths: [60, 260],
      });

      // Drag +900 -> clamped to 800
      fireEvent.mouseDown(col1Resize, { clientX: 0 });
      fireEvent.mouseUp(window, { clientX: 900 });
      expect(onChange).toHaveBeenLastCalledWith({
        ...content,
        columnWidths: [800, 260],
      });

      // Double-click Col 2 resets to 150
      const col2Resize = screen.getByLabelText('Resize column Col 2');
      fireEvent.doubleClick(col2Resize);
      expect(onChange).toHaveBeenLastCalledWith({
        ...content,
        columnWidths: [150, 150],
      });
    });

    it('recomputes measuredColEdges when fitToWidth is true on equal-sum columnWidths change and ResizeObserver', () => {
      let observerCallback: (() => void) | null = null;
      const observeMock = vi.fn();
      const disconnectMock = vi.fn();
      const OriginalResizeObserver = globalThis.ResizeObserver;

      class MockResizeObserver {
        constructor(cb: () => void) {
          observerCallback = cb;
        }
        observe = observeMock;
        disconnect = disconnectMock;
        unobserve = vi.fn();
      }
      globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

      try {
        const { container, rerender, unmount } = render(
          <TableBlock
            content={{
              columns: ['Col 1', 'Col 2'],
              rows: [['A', 'B']],
              columnWidths: [100, 200],
              fitToWidth: true,
            }}
            onChange={vi.fn()}
          />
        );

        expect(observeMock).toHaveBeenCalledTimes(1);

        const ths = Array.from(container.querySelectorAll('thead th')) as HTMLElement[];
        let widths = [120, 240];
        Object.defineProperty(ths[0], 'offsetLeft', { configurable: true, get: () => 0 });
        Object.defineProperty(ths[0], 'offsetWidth', { configurable: true, get: () => widths[0] });
        Object.defineProperty(ths[1], 'offsetLeft', { configurable: true, get: () => widths[0] });
        Object.defineProperty(ths[1], 'offsetWidth', { configurable: true, get: () => widths[1] });

        // Trigger ResizeObserver update
        act(() => {
          observerCallback?.();
        });
        expect(screen.getByLabelText('Resize column Col 1')).toHaveStyle({ left: '117px' });
        expect(screen.getByLabelText('Resize column Col 2')).toHaveStyle({ left: '357px' });

        // Reorder / equal-sum width change (100+200 === 200+100 === 300)
        widths = [240, 120];
        rerender(
          <TableBlock
            content={{
              columns: ['Col 2', 'Col 1'],
              rows: [['B', 'A']],
              columnWidths: [200, 100],
              fitToWidth: true,
            }}
            onChange={vi.fn()}
          />
        );

        expect(screen.getByLabelText('Resize column Col 2')).toHaveStyle({ left: '237px' });
        expect(screen.getByLabelText('Resize column Col 1')).toHaveStyle({ left: '357px' });

        unmount();
        expect(disconnectMock).toHaveBeenCalled();
      } finally {
        globalThis.ResizeObserver = OriginalResizeObserver;
      }
    });
  });

  describe('Keyboard navigation & Notion Enter/Tab/Arrow/Escape behavior', () => {
    it('allows native Enter and Shift+Enter to insert newlines in both header and body cells', () => {
      const onChange = vi.fn();
      render(
        <TableBlock
          content={{
            columns: ['Header 1'],
            rows: [['Row 1']],
          }}
          onChange={onChange}
        />
      );

      const header = screen.getByText('Header 1');
      const bodyCell = screen.getByText('Row 1');

      expect(fireEvent.keyDown(header, { key: 'Enter', shiftKey: false })).toBe(true);
      expect(fireEvent.keyDown(header, { key: 'Enter', shiftKey: true })).toBe(true);
      expect(fireEvent.keyDown(bodyCell, { key: 'Enter', shiftKey: false })).toBe(true);
      expect(fireEvent.keyDown(bodyCell, { key: 'Enter', shiftKey: true })).toBe(true);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('moves across cells on Tab/Shift+Tab and appends a row on Tab at the final cell', () => {
      const onChange = vi.fn();
      render(
        <TableBlock
          content={{
            columns: ['H1', 'H2'],
            rows: [['A1', 'B1']],
          }}
          onChange={onChange}
        />
      );

      const h1 = screen.getByText('H1');
      const h2 = screen.getByText('H2');
      const a1 = screen.getByText('A1');
      const b1 = screen.getByText('B1');

      h1.focus();
      fireEvent.keyDown(h1, { key: 'Tab', shiftKey: false });
      expect(document.activeElement).toBe(h2);

      fireEvent.keyDown(h2, { key: 'Tab', shiftKey: false });
      expect(document.activeElement).toBe(a1);

      fireEvent.keyDown(a1, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(h2);

      fireEvent.keyDown(h2, { key: 'Tab', shiftKey: false });
      fireEvent.keyDown(a1, { key: 'Tab', shiftKey: false });
      expect(document.activeElement).toBe(b1);

      // Tab on final cell appends a new blank row
      fireEvent.keyDown(b1, { key: 'Tab', shiftKey: false });
      expect(onChange).toHaveBeenCalledWith({
        columns: ['H1', 'H2'],
        rows: [
          ['A1', 'B1'],
          ['', ''],
        ],
      });
    });

    it('navigates between cells with Arrow keys when caret is at cell boundaries', () => {
      render(
        <TableBlock
          content={{
            columns: ['H1', 'H2'],
            rows: [['A1', 'B1']],
          }}
          onChange={vi.fn()}
        />
      );

      const h1 = screen.getByText('H1');
      const h2 = screen.getByText('H2');
      const a1 = screen.getByText('A1');
      const b1 = screen.getByText('B1');

      h1.focus();
      setCaret(h1, 2); // end of "H1"
      fireEvent.keyDown(h1, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(h2);

      setCaret(h2, 0); // start of "H2"
      fireEvent.keyDown(h2, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(b1);

      setCaret(b1, 0); // start of "B1"
      fireEvent.keyDown(b1, { key: 'ArrowLeft' });
      expect(document.activeElement).toBe(a1);

      setCaret(a1, 0); // first line of "A1"
      fireEvent.keyDown(a1, { key: 'ArrowUp' });
      expect(document.activeElement).toBe(h1);
    });

    it('exits focused cell to single-cell selection on Escape and clears selection on second Escape', () => {
      const { container } = render(
        <TableBlock
          content={{
            columns: ['Col 1', 'Col 2'],
            rows: [['R1C1', 'R1C2']],
          }}
          onChange={vi.fn()}
        />
      );

      const r1c2 = screen.getByText('R1C2');
      const td = r1c2.closest('td')!;
      r1c2.focus();
      expect(document.activeElement).toBe(r1c2);

      // First Escape: blurs cell and selects just (0, 1)
      fireEvent.keyDown(r1c2, { key: 'Escape' });
      expect(document.activeElement).not.toBe(r1c2);
      expect(td.className).toContain('bg-[#2383E2]/10');
      expect(td.style.boxShadow).toContain('#2383E2');

      // Second Escape: clears selection
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(td.className).not.toContain('bg-[#2383E2]/10');
      expect(td.style.boxShadow).toBe('');
      expect(container.querySelectorAll('.bg-blue-500\\/15')).toHaveLength(0);
    });
  });

  describe('Range selection, unified boxShadow, printable-key edit, & clipboard', () => {
    it('drag-selects cells, blurs active contentEditable, draws unified perimeter boxShadow, and clears on Delete', () => {
      const onChange = vi.fn();
      const content: TableBlockContent = {
        columns: ['Col 1', 'Col 2'],
        rows: [
          ['R1C1', 'R1C2'],
          ['R2C1', 'R2C2'],
        ],
      };

      const { container } = render(<TableBlock content={content} onChange={onChange} />);

      const cellR1C1Editable = screen.getByText('R1C1');
      cellR1C1Editable.focus();
      expect(document.activeElement).toBe(cellR1C1Editable);

      const cells = container.querySelectorAll('td.table-data-cell');
      fireEvent.mouseDown(cells[0], { button: 0 });
      fireEvent.mouseEnter(cells[3]);
      fireEvent.mouseUp(window);

      // Active contentEditable cell must be blurred on drag-selection across cells
      expect(document.activeElement).not.toBe(cellR1C1Editable);

      // Unified outer perimeter boxShadow across the 2x2 body selection
      expect((cells[0] as HTMLElement).style.boxShadow).toBe(
        'inset 0 2px 0 0 #2383E2, inset 2px 0 0 0 #2383E2'
      );
      expect((cells[1] as HTMLElement).style.boxShadow).toBe(
        'inset 0 2px 0 0 #2383E2, inset -2px 0 0 0 #2383E2'
      );
      expect((cells[2] as HTMLElement).style.boxShadow).toBe(
        'inset 0 -2px 0 0 #2383E2, inset 2px 0 0 0 #2383E2'
      );
      expect((cells[3] as HTMLElement).style.boxShadow).toBe(
        'inset 0 -2px 0 0 #2383E2, inset -2px 0 0 0 #2383E2'
      );

      fireEvent.keyDown(window, { key: 'Delete' });
      expect(onChange).toHaveBeenCalledWith({
        columns: ['Col 1', 'Col 2'],
        rows: [
          ['', ''],
          ['', ''],
        ],
      });
    });

    it('supports Ctrl/Cmd+A whole-table selection, Ctrl/Cmd+C copy, and Ctrl/Cmd+X cut', () => {
      const onChange = vi.fn();
      const content: TableBlockContent = {
        columns: ['Col 1', 'Col 2'],
        rows: [['R1C1', 'R1C2']],
      };

      const { container } = render(<TableBlock content={content} onChange={onChange} />);

      const r1c1 = screen.getByText('R1C1');
      r1c1.focus();

      // Select all text inside cell first -> second Ctrl+A selects whole table
      const selection = window.getSelection()!;
      const range = document.createRange();
      range.selectNodeContents(r1c1);
      selection.removeAllRanges();
      selection.addRange(range);

      fireEvent.keyDown(window, { key: 'a', ctrlKey: true });

      const allHeaders = container.querySelectorAll('thead th');
      const allCells = container.querySelectorAll('tbody td');
      allHeaders.forEach((th) => expect(th.className).toContain('bg-[#2383E2]/10'));
      allCells.forEach((td) => expect(td.className).toContain('bg-[#2383E2]/10'));

      // Ctrl+C copies selected range as TSV
      fireEvent.keyDown(window, { key: 'c', ctrlKey: true });
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Col 1\tCol 2\nR1C1\tR1C2');

      // Ctrl+X copies and clears selected range
      fireEvent.keyDown(window, { key: 'x', ctrlKey: true });
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenCalledWith({
        columns: ['', ''],
        rows: [['', '']],
      });
    });

    it('starts editing when pressing a printable key on a single selected cell', () => {
      const onChange = vi.fn();
      render(
        <TableBlock
          content={{
            columns: ['Col 1'],
            rows: [['Old']],
          }}
          onChange={onChange}
        />
      );

      const editable = screen.getByText('Old');
      editable.focus();
      fireEvent.keyDown(editable, { key: 'Escape' });
      expect(document.activeElement).not.toBe(editable);

      // Type 'N' while single cell is selected
      fireEvent.keyDown(window, { key: 'N' });

      expect(document.activeElement).toBe(editable);
      expect(onChange).toHaveBeenCalledWith({
        columns: ['Col 1'],
        rows: [['N']],
      });
    });

    it('shrinks drag-selection back to origin cell when dragging out and returning to origin', () => {
      const { container } = render(
        <TableBlock
          content={{
            columns: ['Col 1', 'Col 2'],
            rows: [
              ['R1C1', 'R1C2'],
              ['R2C1', 'R2C2'],
            ],
          }}
          onChange={vi.fn()}
        />
      );

      const cells = container.querySelectorAll('td.table-data-cell');
      fireEvent.mouseDown(cells[0], { button: 0 });
      fireEvent.mouseEnter(cells[3]);
      expect((cells[3] as HTMLElement).className).toContain('bg-[#2383E2]/10');

      // Drag back onto origin cell (0, 0)
      fireEvent.mouseEnter(cells[0]);
      fireEvent.mouseUp(window);

      expect((cells[0] as HTMLElement).className).toContain('bg-[#2383E2]/10');
      expect((cells[0] as HTMLElement).style.boxShadow).toBe(
        'inset 0 2px 0 0 #2383E2, inset 0 -2px 0 0 #2383E2, inset 2px 0 0 0 #2383E2, inset -2px 0 0 0 #2383E2'
      );
      expect((cells[1] as HTMLElement).className).not.toContain('bg-[#2383E2]/10');
      expect((cells[2] as HTMLElement).className).not.toContain('bg-[#2383E2]/10');
      expect((cells[3] as HTMLElement).className).not.toContain('bg-[#2383E2]/10');
    });

    it('updates Shift+Click anchor on Tab/Arrow navigation and resets anchor on outside click', () => {
      const { container } = render(
        <div>
          <button type="button">Outside Button</button>
          <TableBlock
            content={{
              columns: ['H1', 'H2'],
              rows: [
                ['A1', 'B1'],
                ['A2', 'B2'],
              ],
            }}
            onChange={vi.fn()}
          />
        </div>
      );

      const a1 = screen.getByText('A1');
      const b1 = screen.getByText('B1');
      const cells = container.querySelectorAll('td.table-data-cell');

      // Focus A1 via mousedown + focus, then Tab to B1
      fireEvent.mouseDown(cells[0], { button: 0 });
      fireEvent.mouseUp(window);
      a1.focus();
      fireEvent.keyDown(a1, { key: 'Tab', shiftKey: false });
      expect(document.activeElement).toBe(b1);

      // Shift+Click B2 -> anchor should be B1 (0, 1), NOT stale A1 (0, 0)
      fireEvent.mouseDown(cells[3], { button: 0, shiftKey: true });
      expect((cells[0] as HTMLElement).className).not.toContain('bg-[#2383E2]/10');
      expect((cells[1] as HTMLElement).className).toContain('bg-[#2383E2]/10');
      expect((cells[2] as HTMLElement).className).not.toContain('bg-[#2383E2]/10');
      expect((cells[3] as HTMLElement).className).toContain('bg-[#2383E2]/10');

      // Click outside resets anchor and clears selection
      fireEvent.mouseDown(screen.getByRole('button', { name: /outside button/i }));
      expect((cells[1] as HTMLElement).className).not.toContain('bg-[#2383E2]/10');
      expect((cells[3] as HTMLElement).className).not.toContain('bg-[#2383E2]/10');

      // Subsequent Shift+Click on A2 selects only A2 instead of using stale B1 anchor
      fireEvent.mouseDown(cells[2], { button: 0, shiftKey: true });
      expect((cells[2] as HTMLElement).className).toContain('bg-[#2383E2]/10');
      expect((cells[1] as HTMLElement).className).not.toContain('bg-[#2383E2]/10');
      expect((cells[3] as HTMLElement).className).not.toContain('bg-[#2383E2]/10');
    });

    it('does not hijack typing, Backspace, or Ctrl+A in an outside input while selectedRange is active', () => {
      const onChange = vi.fn();
      const { container } = render(
        <div>
          <input aria-label="Outside Input" defaultValue="hello" />
          <TableBlock
            content={{
              columns: ['Col 1', 'Col 2'],
              rows: [['R1C1', 'R1C2']],
            }}
            onChange={onChange}
          />
        </div>
      );

      // Select cell (0, 0) in the table
      const r1c1 = screen.getByText('R1C1');
      const td0 = r1c1.closest('td')!;
      r1c1.focus();
      fireEvent.keyDown(r1c1, { key: 'Escape' });
      expect(td0.className).toContain('bg-[#2383E2]/10');

      // Move focus to the outside input without clicking outside (e.g. Tab / programmatic focus)
      const outsideInput = screen.getByLabelText('Outside Input') as HTMLInputElement;
      outsideInput.focus();
      expect(document.activeElement).toBe(outsideInput);

      // Ctrl+A in outside input must NOT select whole table or preventDefault
      const ctrlA = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      outsideInput.dispatchEvent(ctrlA);
      expect(ctrlA.defaultPrevented).toBe(false);
      expect(container.querySelectorAll('thead th')[1].className).not.toContain('bg-[#2383E2]/10');

      // Backspace in outside input must NOT clear the selected table cell
      const backspace = new KeyboardEvent('keydown', {
        key: 'Backspace',
        bubbles: true,
        cancelable: true,
      });
      outsideInput.dispatchEvent(backspace);
      expect(backspace.defaultPrevented).toBe(false);

      // Printable key in outside input must NOT overwrite or focus the table cell
      const typing = new KeyboardEvent('keydown', {
        key: 'Z',
        bubbles: true,
        cancelable: true,
      });
      outsideInput.dispatchEvent(typing);
      expect(typing.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(outsideInput);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('Paste & Copy event handling', () => {
    it('does NOT hijack copy with full table if cursor is focused inside an editable cell', () => {
      const content: TableBlockContent = {
        columns: ['Col 1', 'Col 2'],
        rows: [['A', 'B']],
      };
      render(<TableBlock content={content} onChange={vi.fn()} />);

      const cellA = screen.getByText('A');
      cellA.focus();

      const setDataMock = vi.fn();
      const copyEvent = new Event('copy', { bubbles: true, cancelable: true });
      Object.assign(copyEvent, { clipboardData: { setData: setDataMock } });

      cellA.dispatchEvent(copyEvent);

      expect(copyEvent.defaultPrevented).toBe(false);
      expect(setDataMock).not.toHaveBeenCalled();
    });

    it('copies full table as TSV with RFC 4180 escaping when container is copied without cell focus', () => {
      const content: TableBlockContent = {
        columns: ['Header "1"', 'Header\t2'],
        rows: [['Value\nwith newline', 'Simple "quoted" text']],
      };
      const { container } = render(<TableBlock content={content} onChange={vi.fn()} />);
      const tableWrapper = container.firstChild as HTMLElement;

      const setDataMock = vi.fn();
      const copyEvent = new Event('copy', { bubbles: true, cancelable: true });
      Object.assign(copyEvent, { clipboardData: { setData: setDataMock } });

      tableWrapper.dispatchEvent(copyEvent);

      expect(copyEvent.defaultPrevented).toBe(true);
      expect(setDataMock).toHaveBeenCalledWith(
        'text/plain',
        '"Header ""1"""\t"Header\t2"\n"Value\nwith newline"\t"Simple ""quoted"" text"'
      );
    });

    it('does NOT wipe table when pasting single-line text with commas (e.g. "Seattle, WA")', () => {
      const content: TableBlockContent = {
        columns: ['City, State', 'Notes'],
        rows: [['Original 1', 'Original 2']],
      };
      const onChange = vi.fn();

      const { container } = render(<TableBlock content={content} onChange={onChange} />);
      const tableWrapper = container.firstChild as HTMLElement;

      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
      Object.assign(pasteEvent, {
        clipboardData: {
          getData: vi.fn((format: string) => (format === 'text/plain' ? 'Seattle, WA' : '')),
        },
      });

      tableWrapper.dispatchEvent(pasteEvent);

      expect(onChange).not.toHaveBeenCalled();
      expect(pasteEvent.defaultPrevented).toBe(false);
    });

    it('replaces table when pasting multi-line TSV or CSV data on container', () => {
      const content: TableBlockContent = {
        columns: ['Col 1', 'Col 2'],
        rows: [['', '']],
      };
      const onChange = vi.fn();

      const { container } = render(<TableBlock content={content} onChange={onChange} />);
      const tableWrapper = container.firstChild as HTMLElement;

      const tsvEvent = new Event('paste', { bubbles: true, cancelable: true });
      Object.assign(tsvEvent, {
        clipboardData: {
          getData: vi.fn((format: string) =>
            format === 'text/plain' ? 'First\tLast\tScore\nAlice\tSmith\t95\nBob\tJones\t88' : ''
          ),
        },
      });
      tableWrapper.dispatchEvent(tsvEvent);
      expect(tsvEvent.defaultPrevented).toBe(true);
      expect(onChange).toHaveBeenLastCalledWith({
        columns: ['First', 'Last', 'Score'],
        rows: [
          ['Alice', 'Smith', '95'],
          ['Bob', 'Jones', '88'],
        ],
      });

      const csvEvent = new Event('paste', { bubbles: true, cancelable: true });
      Object.assign(csvEvent, {
        clipboardData: {
          getData: vi.fn((format: string) =>
            format === 'text/plain' ? 'Item,Quantity,Price\nApple,10,$1.50\nOrange,5,$2.00' : ''
          ),
        },
      });
      tableWrapper.dispatchEvent(csvEvent);
      expect(csvEvent.defaultPrevented).toBe(true);
      expect(onChange).toHaveBeenLastCalledWith({
        columns: ['Item', 'Quantity', 'Price'],
        rows: [
          ['Apple', '10', '$1.50'],
          ['Orange', '5', '$2.00'],
        ],
      });
    });

    it('allows native multiline paste inside a focused cell without whole-table replacement', () => {
      const content: TableBlockContent = {
        columns: ['Col 1'],
        rows: [['Cell 1']],
      };
      const onChange = vi.fn();
      render(<TableBlock content={content} onChange={onChange} />);

      const cell = screen.getByText('Cell 1');
      cell.focus();

      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
      Object.assign(pasteEvent, {
        clipboardData: {
          getData: vi.fn((format: string) => (format === 'text/plain' ? 'Line 1\nLine 2' : '')),
        },
      });

      cell.dispatchEvent(pasteEvent);

      expect(pasteEvent.defaultPrevented).toBe(false);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('applies minHeight and height auto with whitespace-pre-wrap on body cells', () => {
      const { container } = render(
        <TableBlock
          content={{
            columns: ['Col 1'],
            rows: [['Multi\nline\ntext']],
            rowHeights: [48],
          }}
          onChange={vi.fn()}
        />
      );
      const row = container.querySelector('tbody tr') as HTMLElement;
      expect(row.style.minHeight).toBe('48px');
      expect(row.style.height).toBe('auto');

      const cellTd = container.querySelector('tbody td.table-data-cell') as HTMLElement;
      expect(cellTd.style.minHeight).toBe('48px');
      expect(cellTd.style.height).toBe('auto');

      const editableDiv = cellTd.querySelector('[contenteditable="true"]') as HTMLElement;
      expect(editableDiv.className).toContain('whitespace-pre-wrap');
      expect(editableDiv.className).toContain('break-words');
      expect(editableDiv.className).toContain('min-h-[1.75rem]');
    });

    it('shows + edge buttons only on direct hover (not table hover) and uses compact Notion pill handles', () => {
      render(
        <TableBlock
          content={{
            columns: ['Col 1'],
            rows: [['A']],
          }}
          onChange={vi.fn()}
        />
      );

      for (const label of ['Add column', 'Add row', 'Add row and column']) {
        const btn = screen.getByRole('button', { name: label });
        expect(btn.className).toContain('opacity-0');
        expect(btn.className).toContain('hover:opacity-100');
        expect(btn.className).not.toContain('group-hover/table');
      }

      const rowHandle = screen.getByRole('button', { name: 'Row 1 options' });
      expect(rowHandle.className).toContain('w-2.5');
      expect(rowHandle.className).toContain('h-4');

      const colHandle = screen.getByRole('button', { name: 'Column 1 options' });
      expect(colHandle.className).toContain('h-2.5');
      expect(colHandle.className).toContain('w-4');
    });
  });
});
