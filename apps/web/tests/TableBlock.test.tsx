import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TableBlock } from '../src/components/editor/blocks/TableBlock';
import { TableBlockContent } from '@notebook/shared';

describe('TableBlock (Web)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders table headers and cells using contentEditable elements', () => {
    const content: TableBlockContent = {
      columns: ['Col A', 'Col B'],
      rows: [
        ['A1', 'B1'],
        ['A2', 'B2'],
      ],
    };
    const onChange = vi.fn();

    const { container } = render(<TableBlock content={content} onChange={onChange} />);

    // Header cells should be contentEditable, not <input>
    const colA = screen.getByText('Col A');
    expect(colA).toHaveAttribute('contenteditable', 'true');
    expect(container.querySelectorAll('th input').length).toBe(0);

    // Body cells should be contentEditable, not <input>
    const cellA1 = screen.getByText('A1');
    expect(cellA1).toHaveAttribute('contenteditable', 'true');
    expect(container.querySelectorAll('td input').length).toBe(0);
  });

  it('updates column name on blur', () => {
    const content: TableBlockContent = {
      columns: ['Col A', 'Col B'],
      rows: [['Val 1', 'Val 2']],
    };
    const onChange = vi.fn();

    render(<TableBlock content={content} onChange={onChange} />);

    const colA = screen.getByText('Col A');
    colA.textContent = 'Updated Col A';
    fireEvent.blur(colA);

    expect(onChange).toHaveBeenCalledWith({
      columns: ['Updated Col A', 'Col B'],
      rows: [['Val 1', 'Val 2']],
    });
  });

  it('updates cell value on blur', () => {
    const content: TableBlockContent = {
      columns: ['Col A', 'Col B'],
      rows: [['Val 1', 'Val 2']],
    };
    const onChange = vi.fn();

    render(<TableBlock content={content} onChange={onChange} />);

    const cellVal1 = screen.getByText('Val 1');
    cellVal1.textContent = 'New Val 1';
    fireEvent.blur(cellVal1);

    expect(onChange).toHaveBeenCalledWith({
      columns: ['Col A', 'Col B'],
      rows: [['New Val 1', 'Val 2']],
    });
  });

  it('adds and deletes rows and columns', () => {
    const content: TableBlockContent = {
      columns: ['Col 1', 'Col 2'],
      rows: [
        ['R1C1', 'R1C2'],
        ['R2C1', 'R2C2'],
      ],
    };
    const onChange = vi.fn();

    render(<TableBlock content={content} onChange={onChange} />);

    // Add row
    const addRowBtn = screen.getByRole('button', { name: /add row/i });
    fireEvent.click(addRowBtn);
    expect(onChange).toHaveBeenCalledWith({
      columns: ['Col 1', 'Col 2'],
      rows: [
        ['R1C1', 'R1C2'],
        ['R2C1', 'R2C2'],
        ['', ''],
      ],
    });

    // Add column (can click button in header or bottom toolbar)
    const addColBtns = screen.getAllByRole('button', { name: /add column/i });
    fireEvent.click(addColBtns[0]);
    expect(onChange).toHaveBeenCalledWith({
      columns: ['Col 1', 'Col 2', 'Column 3'],
      rows: [
        ['R1C1', 'R1C2', ''],
        ['R2C1', 'R2C2', ''],
      ],
    });

    // Delete column
    const deleteColBtn = screen.getByLabelText('Delete column Col 1');
    fireEvent.click(deleteColBtn);
    expect(onChange).toHaveBeenCalledWith({
      columns: ['Col 2'],
      rows: [['R1C2'], ['R2C2']],
    });

    // Delete row
    const deleteRowBtn = screen.getByLabelText('Delete row 1');
    fireEvent.click(deleteRowBtn);
    expect(onChange).toHaveBeenCalledWith({
      columns: ['Col 1', 'Col 2'],
      rows: [['R2C1', 'R2C2']],
    });
  });

  it('adds row when clicking inline Notion + New row button', () => {
    const content: TableBlockContent = {
      columns: ['Col 1', 'Col 2'],
      rows: [['Val 1', 'Val 2']],
    };
    const onChange = vi.fn();
    render(<TableBlock content={content} onChange={onChange} />);

    const inlineNewRow = screen.getByText('New').closest('td')!;
    fireEvent.click(inlineNewRow);
    expect(onChange).toHaveBeenCalledWith({
      columns: ['Col 1', 'Col 2'],
      rows: [['Val 1', 'Val 2'], ['', '']],
    });
  });

  it('copies table to clipboard formatted as TSV', async () => {
    const content: TableBlockContent = {
      columns: ['Header 1', 'Header 2'],
      rows: [
        ['R1C1', 'R1C2'],
        ['R2C1', 'R2C2'],
      ],
    };
    const onChange = vi.fn();

    render(<TableBlock content={content} onChange={onChange} />);

    const copyBtn = screen.getByRole('button', { name: /copy table/i });
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'Header 1\tHeader 2\nR1C1\tR1C2\nR2C1\tR2C2'
    );
    expect(await screen.findByText('Copied!')).toBeInTheDocument();
  });

  describe('Paste handling', () => {
    it('does NOT wipe table when pasting single-line text with commas (e.g. "Seattle, WA")', () => {
      const content: TableBlockContent = {
        columns: ['City, State', 'Notes'],
        rows: [['Original 1', 'Original 2']],
      };
      const onChange = vi.fn();

      const { container } = render(<TableBlock content={content} onChange={onChange} />);
      const tableWrapper = container.firstChild as HTMLElement;

      const clipboardData = {
        getData: vi.fn((format: string) => (format === 'text/plain' ? 'Seattle, WA' : '')),
      };

      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
      Object.assign(pasteEvent, { clipboardData });

      tableWrapper.dispatchEvent(pasteEvent);

      // Should not prevent default and should not call onChange to replace the table
      expect(onChange).not.toHaveBeenCalled();
      expect(pasteEvent.defaultPrevented).toBe(false);
    });

    it('replaces table when pasting multi-line TSV data (from Excel)', () => {
      const content: TableBlockContent = {
        columns: ['Col 1', 'Col 2'],
        rows: [['', '']],
      };
      const onChange = vi.fn();

      const { container } = render(<TableBlock content={content} onChange={onChange} />);
      const tableWrapper = container.firstChild as HTMLElement;

      const tsvData = 'First\tLast\tScore\nAlice\tSmith\t95\nBob\tJones\t88';
      const clipboardData = {
        getData: vi.fn((format: string) => (format === 'text/plain' ? tsvData : '')),
      };

      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
      Object.assign(pasteEvent, { clipboardData });

      tableWrapper.dispatchEvent(pasteEvent);

      expect(pasteEvent.defaultPrevented).toBe(true);
      expect(onChange).toHaveBeenCalledWith({
        columns: ['First', 'Last', 'Score'],
        rows: [
          ['Alice', 'Smith', '95'],
          ['Bob', 'Jones', '88'],
        ],
      });
    });

    it('replaces table when pasting multi-line CSV data with consistent columns', () => {
      const content: TableBlockContent = {
        columns: ['Col 1', 'Col 2'],
        rows: [['', '']],
      };
      const onChange = vi.fn();

      const { container } = render(<TableBlock content={content} onChange={onChange} />);
      const tableWrapper = container.firstChild as HTMLElement;

      const csvData = 'Item,Quantity,Price\nApple,10,$1.50\nOrange,5,$2.00';
      const clipboardData = {
        getData: vi.fn((format: string) => (format === 'text/plain' ? csvData : '')),
      };

      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
      Object.assign(pasteEvent, { clipboardData });

      tableWrapper.dispatchEvent(pasteEvent);

      expect(pasteEvent.defaultPrevented).toBe(true);
      expect(onChange).toHaveBeenCalledWith({
        columns: ['Item', 'Quantity', 'Price'],
        rows: [
          ['Apple', '10', '$1.50'],
          ['Orange', '5', '$2.00'],
        ],
      });
    });
  });

  describe('Copy event handling', () => {
    it('does NOT hijack copy with full table if cursor is focused inside an editable cell', () => {
      const content: TableBlockContent = {
        columns: ['Col 1', 'Col 2'],
        rows: [['A', 'B']],
      };
      const onChange = vi.fn();

      render(<TableBlock content={content} onChange={onChange} />);

      const cellA = screen.getByText('A');
      cellA.focus();

      const setDataMock = vi.fn();
      const clipboardData = { setData: setDataMock };

      const copyEvent = new Event('copy', { bubbles: true, cancelable: true });
      Object.assign(copyEvent, { clipboardData });

      cellA.dispatchEvent(copyEvent);

      // Should not call preventDefault and should not set full TSV table
      expect(copyEvent.defaultPrevented).toBe(false);
      expect(setDataMock).not.toHaveBeenCalled();
    });

    it('copies full table as TSV when container is copied and no cell is focused', () => {
      const content: TableBlockContent = {
        columns: ['Col 1', 'Col 2'],
        rows: [['A', 'B']],
      };
      const onChange = vi.fn();

      const { container } = render(<TableBlock content={content} onChange={onChange} />);
      const tableWrapper = container.firstChild as HTMLElement;

      const setDataMock = vi.fn();
      const clipboardData = { setData: setDataMock };

      const copyEvent = new Event('copy', { bubbles: true, cancelable: true });
      Object.assign(copyEvent, { clipboardData });

      tableWrapper.dispatchEvent(copyEvent);

      expect(copyEvent.defaultPrevented).toBe(true);
      expect(setDataMock).toHaveBeenCalledWith('text/plain', 'Col 1\tCol 2\nA\tB');
    });

    it('escapes cells containing quotes, tabs, or newlines when copied as TSV', () => {
      const content: TableBlockContent = {
        columns: ['Header "1"', 'Header\t2'],
        rows: [['Value\nwith newline', 'Simple "quoted" text']],
      };
      const onChange = vi.fn();

      const { container } = render(<TableBlock content={content} onChange={onChange} />);
      const tableWrapper = container.firstChild as HTMLElement;

      const setDataMock = vi.fn();
      const clipboardData = { setData: setDataMock };

      const copyEvent = new Event('copy', { bubbles: true, cancelable: true });
      Object.assign(copyEvent, { clipboardData });

      tableWrapper.dispatchEvent(copyEvent);

      expect(copyEvent.defaultPrevented).toBe(true);
      expect(setDataMock).toHaveBeenCalledWith(
        'text/plain',
        '"Header ""1"""\t"Header\t2"\n"Value\nwith newline"\t"Simple ""quoted"" text"'
      );
    });
  });

  describe('Notion-style mouse cell selection', () => {
    it('selects cells by dragging mouse across cells and highlights them', () => {
      const content: TableBlockContent = {
        columns: ['Col 1', 'Col 2'],
        rows: [
          ['R1C1', 'R1C2'],
          ['R2C1', 'R2C2'],
        ],
      };
      const onChange = vi.fn();

      const { container } = render(<TableBlock content={content} onChange={onChange} />);

      const cells = container.querySelectorAll('td.table-data-cell');
      expect(cells.length).toBe(4);

      // Start drag on R1C1
      fireEvent.mouseDown(cells[0]);
      // Move into R2C2
      fireEvent.mouseEnter(cells[3]);
      // Release
      fireEvent.mouseUp(window);

      // All 4 cells should have the active selection ring/background
      cells.forEach((cell) => {
        expect(cell.className).toContain('bg-blue-500/15');
        expect(cell.className).toContain('ring-blue-500/40');
      });
    });

    it('selects whole table when corner table button is clicked', () => {
      const content: TableBlockContent = {
        columns: ['Col 1', 'Col 2'],
        rows: [
          ['R1C1', 'R1C2'],
          ['R2C1', 'R2C2'],
        ],
      };
      const onChange = vi.fn();

      const { container } = render(<TableBlock content={content} onChange={onChange} />);

      const selectAllBtn = screen.getByRole('button', { name: /select whole table/i });
      fireEvent.click(selectAllBtn);

      const headers = container.querySelectorAll('th.table-header-cell');
      headers.forEach((th) => {
        expect(th.className).toContain('bg-blue-500/15');
      });

      const cells = container.querySelectorAll('td.table-data-cell');
      cells.forEach((cell) => {
        expect(cell.className).toContain('bg-blue-500/15');
      });
    });

    it('clears selection when Escape is pressed', () => {
      const content: TableBlockContent = {
        columns: ['Col 1', 'Col 2'],
        rows: [['R1C1', 'R1C2']],
      };
      const onChange = vi.fn();

      const { container } = render(<TableBlock content={content} onChange={onChange} />);

      const selectAllBtn = screen.getByRole('button', { name: /select whole table/i });
      fireEvent.click(selectAllBtn);

      const cell = container.querySelector('td.table-data-cell')!;
      expect(cell.className).toContain('bg-blue-500/15');

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(cell.className).not.toContain('bg-blue-500/15');
    });

    it('clears selected cells content when Backspace or Delete is pressed', () => {
      const content: TableBlockContent = {
        columns: ['Col 1', 'Col 2'],
        rows: [
          ['R1C1', 'R1C2'],
          ['R2C1', 'R2C2'],
        ],
      };
      const onChange = vi.fn();

      const { container } = render(<TableBlock content={content} onChange={onChange} />);

      const cells = container.querySelectorAll('td.table-data-cell');
      // Drag select row 1 (R1C1 and R1C2)
      fireEvent.mouseDown(cells[0]);
      fireEvent.mouseEnter(cells[1]);
      fireEvent.mouseUp(window);

      fireEvent.keyDown(window, { key: 'Delete' });

      expect(onChange).toHaveBeenCalledWith({
        columns: ['Col 1', 'Col 2'],
        rows: [
          ['', ''],
          ['R2C1', 'R2C2'],
        ],
      });
    });
  });

  describe('Column and row resizing', () => {
    it('resizes column width when dragging column resize handle', () => {
      const content: TableBlockContent = {
        columns: ['Col 1', 'Col 2'],
        rows: [['A', 'B']],
        columnWidths: [150, 150],
      };
      const onChange = vi.fn();

      render(<TableBlock content={content} onChange={onChange} />);

      const colResizeHandle = screen.getByLabelText('Resize column Col 1');
      expect(colResizeHandle).toBeInTheDocument();

      // Mouse down at clientX = 100
      fireEvent.mouseDown(colResizeHandle, { clientX: 100 });

      // Mouse move to clientX = 160 (delta +60 -> width 210)
      fireEvent.mouseMove(window, { clientX: 160 });

      // Mouse up at clientX = 160
      fireEvent.mouseUp(window, { clientX: 160 });

      expect(onChange).toHaveBeenCalledWith({
        ...content,
        columnWidths: [210, 150],
      });
    });

    it('resets column width to default (150px) on double click', () => {
      const content: TableBlockContent = {
        columns: ['Col 1', 'Col 2'],
        rows: [['A', 'B']],
        columnWidths: [260, 180],
      };
      const onChange = vi.fn();

      render(<TableBlock content={content} onChange={onChange} />);

      const colResizeHandle = screen.getByLabelText('Resize column Col 1');
      fireEvent.doubleClick(colResizeHandle);

      expect(onChange).toHaveBeenCalledWith({
        ...content,
        columnWidths: [150, 180],
      });
    });

    it('resizes row height when dragging row resize handle', () => {
      const content: TableBlockContent = {
        columns: ['Col 1', 'Col 2'],
        rows: [['A', 'B']],
        rowHeights: [36],
      };
      const onChange = vi.fn();

      render(<TableBlock content={content} onChange={onChange} />);

      const rowResizeHandles = screen.getAllByLabelText('Resize row 1');
      expect(rowResizeHandles.length).toBeGreaterThan(0);

      // Mouse down at clientY = 50
      fireEvent.mouseDown(rowResizeHandles[0], { clientY: 50 });

      // Mouse move to clientY = 80 (delta +30 -> height 66)
      fireEvent.mouseMove(window, { clientY: 80 });

      // Mouse up at clientY = 80
      fireEvent.mouseUp(window, { clientY: 80 });

      expect(onChange).toHaveBeenCalledWith({
        ...content,
        rowHeights: [66],
      });
    });

    it('resets row height to default (36px) on double click', () => {
      const content: TableBlockContent = {
        columns: ['Col 1', 'Col 2'],
        rows: [['A', 'B']],
        rowHeights: [72],
      };
      const onChange = vi.fn();

      render(<TableBlock content={content} onChange={onChange} />);

      const rowResizeHandles = screen.getAllByLabelText('Resize row 1');
      fireEvent.doubleClick(rowResizeHandles[0]);

      expect(onChange).toHaveBeenCalledWith({
        ...content,
        rowHeights: [36],
      });
    });
  });
});
