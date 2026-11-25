import { describe, it, expect } from 'vitest';
import { TableBlockContent } from '@notebook/shared';
import {
  CellCoord,
  CellRange,
  NormalizedRange,
  normalizeRange,
  isCellInRange,
  computeSelectionBoxShadow,
  escapeTsvCell,
  serializeRangeToTsv,
  insertRowAt,
  duplicateRowAt,
  clearRowAt,
  deleteRowAt,
  reorderRow,
  insertColAt,
  duplicateColAt,
  clearColAt,
  deleteColAt,
  sortCol,
  reorderCol,
  clearRangeCells,
} from '../src/components/editor/blocks/tableUtils';

const makeSampleTable = (overrides: Partial<TableBlockContent> = {}): TableBlockContent => ({
  columns: ['Name', 'Age', 'Role'],
  rows: [
    ['Alice', '30', 'Eng'],
    ['Bob', '25', 'PM'],
    ['Cara', '35', 'Design'],
  ],
  ...overrides,
});

describe('tableUtils', () => {
  describe('selection geometry', () => {
    it('normalizeRange orders reversed start/end coordinates', () => {
      const start: CellCoord = { row: 2, col: 2 };
      const end: CellCoord = { row: -1, col: 0 };
      const range: CellRange = { start, end };
      const expected: NormalizedRange = {
        minR: -1,
        maxR: 2,
        minC: 0,
        maxC: 2,
      };
      expect(normalizeRange(range)).toEqual(expected);
    });

    it('isCellInRange handles null and inclusive boundaries', () => {
      expect(isCellInRange(0, 0, null)).toBe(false);

      const range: CellRange = {
        start: { row: 1, col: 2 },
        end: { row: -1, col: 1 },
      };
      expect(isCellInRange(-1, 1, range)).toBe(true);
      expect(isCellInRange(0, 2, range)).toBe(true);
      expect(isCellInRange(1, 2, range)).toBe(true);
      expect(isCellInRange(0, 0, range)).toBe(false);
      expect(isCellInRange(2, 1, range)).toBe(false);
    });

    it('computeSelectionBoxShadow draws inset 2px #2383E2 only on outer edges of a 2x2 selection', () => {
      const range: CellRange = {
        start: { row: 0, col: 1 },
        end: { row: 1, col: 2 },
      };

      expect(computeSelectionBoxShadow(0, 0, range)).toBeUndefined();
      expect(computeSelectionBoxShadow(0, 1, null)).toBeUndefined();

      // Top-left of 2x2: top + left
      expect(computeSelectionBoxShadow(0, 1, range)).toBe(
        'inset 0 2px 0 0 #2383E2, inset 2px 0 0 0 #2383E2'
      );
      // Top-right of 2x2: top + right
      expect(computeSelectionBoxShadow(0, 2, range)).toBe(
        'inset 0 2px 0 0 #2383E2, inset -2px 0 0 0 #2383E2'
      );
      // Bottom-left of 2x2: bottom + left
      expect(computeSelectionBoxShadow(1, 1, range)).toBe(
        'inset 0 -2px 0 0 #2383E2, inset 2px 0 0 0 #2383E2'
      );
      // Bottom-right of 2x2: bottom + right
      expect(computeSelectionBoxShadow(1, 2, range)).toBe(
        'inset 0 -2px 0 0 #2383E2, inset -2px 0 0 0 #2383E2'
      );
    });

    it('computeSelectionBoxShadow returns all 4 edges for 1x1 cell and undefined for interior cell of 3x3', () => {
      const single: CellRange = { start: { row: -1, col: 0 }, end: { row: -1, col: 0 } };
      expect(computeSelectionBoxShadow(-1, 0, single)).toBe(
        'inset 0 2px 0 0 #2383E2, inset 0 -2px 0 0 #2383E2, inset 2px 0 0 0 #2383E2, inset -2px 0 0 0 #2383E2'
      );

      const threeByThree: CellRange = { start: { row: -1, col: 0 }, end: { row: 1, col: 2 } };
      expect(computeSelectionBoxShadow(0, 1, threeByThree)).toBeUndefined();
    });
  });

  describe('TSV serialization', () => {
    it('escapeTsvCell quotes tabs, newlines, and double quotes per RFC 4180', () => {
      expect(escapeTsvCell('plain')).toBe('plain');
      expect(escapeTsvCell('a\tb')).toBe('"a\tb"');
      expect(escapeTsvCell('line1\nline2')).toBe('"line1\nline2"');
      expect(escapeTsvCell('say "hi"')).toBe('"say ""hi"""');
    });

    it('serializeRangeToTsv serializes ranges spanning row -1 and body rows', () => {
      const columns = ['Col\t1', 'Col 2', 'Col 3'];
      const rows = [
        ['A', 'B\n2', 'C'],
        ['D', 'E"F', 'G'],
      ];
      const range: CellRange = {
        start: { row: 0, col: 1 },
        end: { row: -1, col: 0 },
      };

      expect(serializeRangeToTsv(columns, rows, range)).toBe(
        '"Col\t1"\tCol 2\nA\t"B\n2"'
      );
    });
  });

  describe('row operations', () => {
    it('insertRowAt inserts above/below row -1 and body rows with empty strings and aligned rowHeights', () => {
      const table = makeSampleTable({ rowHeights: [40, 50, 60] });

      // Above row -1: new empty row becomes columns, old columns moves to rows[0] with height 32
      const aboveHeader = insertRowAt(table, -1, 'above');
      expect(aboveHeader.columns).toEqual(['', '', '']);
      expect(aboveHeader.rows).toEqual([
        ['Name', 'Age', 'Role'],
        ['Alice', '30', 'Eng'],
        ['Bob', '25', 'PM'],
        ['Cara', '35', 'Design'],
      ]);
      expect(aboveHeader.rowHeights).toEqual([32, 40, 50, 60]);

      // Below row -1: inserts empty row at rows[0] with height 32
      const belowHeader = insertRowAt(table, -1, 'below');
      expect(belowHeader.columns).toEqual(['Name', 'Age', 'Role']);
      expect(belowHeader.rows).toEqual([
        ['', '', ''],
        ['Alice', '30', 'Eng'],
        ['Bob', '25', 'PM'],
        ['Cara', '35', 'Design'],
      ]);
      expect(belowHeader.rowHeights).toEqual([32, 40, 50, 60]);

      // Above body row 1
      const aboveBody = insertRowAt(table, 1, 'above');
      expect(aboveBody.rows).toEqual([
        ['Alice', '30', 'Eng'],
        ['', '', ''],
        ['Bob', '25', 'PM'],
        ['Cara', '35', 'Design'],
      ]);
      expect(aboveBody.rowHeights).toEqual([40, 32, 50, 60]);

      // Below body row 1 without rowHeights
      const noHeights = makeSampleTable();
      const belowBody = insertRowAt(noHeights, 1, 'below');
      expect(belowBody.rows).toEqual([
        ['Alice', '30', 'Eng'],
        ['Bob', '25', 'PM'],
        ['', '', ''],
        ['Cara', '35', 'Design'],
      ]);
      expect(belowBody.rowHeights).toBeUndefined();
    });

    it('duplicateRowAt duplicates row -1 or body rows and keeps rowHeights aligned', () => {
      const table = makeSampleTable({ rowHeights: [40, 50, 60] });

      const dupHeader = duplicateRowAt(table, -1);
      expect(dupHeader.columns).toEqual(['Name', 'Age', 'Role']);
      expect(dupHeader.rows[0]).toEqual(['Name', 'Age', 'Role']);
      expect(dupHeader.rows).toHaveLength(4);
      expect(dupHeader.rowHeights).toEqual([32, 40, 50, 60]);

      const dupBody = duplicateRowAt(table, 1);
      expect(dupBody.rows).toEqual([
        ['Alice', '30', 'Eng'],
        ['Bob', '25', 'PM'],
        ['Bob', '25', 'PM'],
        ['Cara', '35', 'Design'],
      ]);
      expect(dupBody.rowHeights).toEqual([40, 50, 50, 60]);
    });

    it('clearRowAt clears row -1 or a body row without changing structure', () => {
      const table = makeSampleTable({ rowHeights: [40, 50, 60] });

      const clearedHeader = clearRowAt(table, -1);
      expect(clearedHeader.columns).toEqual(['', '', '']);
      expect(clearedHeader.rows).toEqual(table.rows);

      const clearedBody = clearRowAt(table, 1);
      expect(clearedBody.columns).toEqual(table.columns);
      expect(clearedBody.rows[1]).toEqual(['', '', '']);
      expect(clearedBody.rowHeights).toEqual([40, 50, 60]);
    });

    it('deleteRowAt promotes rows[0] when deleting row -1 and returns null on a 1-row table', () => {
      const table = makeSampleTable({ rowHeights: [40, 50, 60] });

      const deletedHeader = deleteRowAt(table, -1);
      expect(deletedHeader).not.toBeNull();
      expect(deletedHeader?.columns).toEqual(['Alice', '30', 'Eng']);
      expect(deletedHeader?.rows).toEqual([
        ['Bob', '25', 'PM'],
        ['Cara', '35', 'Design'],
      ]);
      expect(deletedHeader?.rowHeights).toEqual([50, 60]);

      const deletedBody = deleteRowAt(table, 1);
      expect(deletedBody?.columns).toEqual(['Name', 'Age', 'Role']);
      expect(deletedBody?.rows).toEqual([
        ['Alice', '30', 'Eng'],
        ['Cara', '35', 'Design'],
      ]);
      expect(deletedBody?.rowHeights).toEqual([40, 60]);

      const singleRowTable: TableBlockContent = {
        columns: ['Only', 'Row'],
        rows: [],
      };
      expect(deleteRowAt(singleRowTable, -1)).toBeNull();

      const twoRowTable: TableBlockContent = {
        columns: ['Top', 'Row'],
        rows: [['Body', 'Row']],
        rowHeights: [42],
      };
      const reduced = deleteRowAt(twoRowTable, -1);
      expect(reduced?.columns).toEqual(['Body', 'Row']);
      expect(reduced?.rows).toEqual([]);
      expect(reduced?.rowHeights).toEqual([]);
    });

    it('reorderRow moves across unified -1..rows.length-1 space and syncs rowHeights', () => {
      const table = makeSampleTable({ rowHeights: [40, 50, 60] });

      // Move row -1 ('Name') down to index 1
      const movedHeaderDown = reorderRow(table, -1, 1);
      expect(movedHeaderDown.columns).toEqual(['Alice', '30', 'Eng']);
      expect(movedHeaderDown.rows).toEqual([
        ['Bob', '25', 'PM'],
        ['Name', 'Age', 'Role'],
        ['Cara', '35', 'Design'],
      ]);
      expect(movedHeaderDown.rowHeights).toEqual([50, 32, 60]);

      // Move body row 2 ('Cara') up to row -1
      const movedBodyToTop = reorderRow(table, 2, -1);
      expect(movedBodyToTop.columns).toEqual(['Cara', '35', 'Design']);
      expect(movedBodyToTop.rows).toEqual([
        ['Name', 'Age', 'Role'],
        ['Alice', '30', 'Eng'],
        ['Bob', '25', 'PM'],
      ]);
      expect(movedBodyToTop.rowHeights).toEqual([32, 40, 50]);
    });
  });

  describe('column operations', () => {
    it('insertColAt inserts empty cells left/right and 150 width when columnWidths is defined', () => {
      const table = makeSampleTable({ columnWidths: [120, 180, 200] });

      const left = insertColAt(table, 1, 'left');
      expect(left.columns).toEqual(['Name', '', 'Age', 'Role']);
      expect(left.rows[0]).toEqual(['Alice', '', '30', 'Eng']);
      expect(left.columnWidths).toEqual([120, 150, 180, 200]);

      const right = insertColAt(table, 2, 'right');
      expect(right.columns).toEqual(['Name', 'Age', 'Role', '']);
      expect(right.rows[1]).toEqual(['Bob', '25', 'PM', '']);
      expect(right.columnWidths).toEqual([120, 180, 200, 150]);

      const noWidths = makeSampleTable();
      expect(insertColAt(noWidths, 0, 'left').columnWidths).toBeUndefined();
    });

    it('duplicateColAt duplicates header, cells, and columnWidth', () => {
      const table = makeSampleTable({ columnWidths: [120, 180, 200] });
      const dup = duplicateColAt(table, 1);
      expect(dup.columns).toEqual(['Name', 'Age', 'Age', 'Role']);
      expect(dup.rows).toEqual([
        ['Alice', '30', '30', 'Eng'],
        ['Bob', '25', '25', 'PM'],
        ['Cara', '35', '35', 'Design'],
      ]);
      expect(dup.columnWidths).toEqual([120, 180, 180, 200]);
    });

    it('clearColAt empties column header and body cells while keeping widths', () => {
      const table = makeSampleTable({ columnWidths: [120, 180, 200] });
      const cleared = clearColAt(table, 1);
      expect(cleared.columns).toEqual(['Name', '', 'Role']);
      expect(cleared.rows).toEqual([
        ['Alice', '', 'Eng'],
        ['Bob', '', 'PM'],
        ['Cara', '', 'Design'],
      ]);
      expect(cleared.columnWidths).toEqual([120, 180, 200]);
    });

    it('deleteColAt removes column and width, and returns null for 1-column tables', () => {
      const table = makeSampleTable({ columnWidths: [120, 180, 200] });
      const deleted = deleteColAt(table, 1);
      expect(deleted).not.toBeNull();
      expect(deleted?.columns).toEqual(['Name', 'Role']);
      expect(deleted?.rows).toEqual([
        ['Alice', 'Eng'],
        ['Bob', 'PM'],
        ['Cara', 'Design'],
      ]);
      expect(deleted?.columnWidths).toEqual([120, 200]);

      const singleCol: TableBlockContent = {
        columns: ['Only'],
        rows: [['A']],
      };
      expect(deleteColAt(singleCol, 0)).toBeNull();
    });

    it('reorderCol updates columns, every row, and columnWidths', () => {
      const table = makeSampleTable({ columnWidths: [120, 180, 200] });
      const moved = reorderCol(table, 2, 0);
      expect(moved.columns).toEqual(['Role', 'Name', 'Age']);
      expect(moved.rows).toEqual([
        ['Eng', 'Alice', '30'],
        ['PM', 'Bob', '25'],
        ['Design', 'Cara', '35'],
      ]);
      expect(moved.columnWidths).toEqual([200, 120, 180]);
    });
  });

  describe('sortCol', () => {
    it('sorts ascending/descending with header fixed when hasHeaderRow is true or undefined and aligns rowHeights', () => {
      const table: TableBlockContent = {
        columns: ['Item', 'Count'],
        rows: [
          ['Banana', '10'],
          ['Apple', '2'],
          ['Cherry', '30'],
        ],
        rowHeights: [40, 50, 60],
        hasHeaderRow: true,
      };

      const asc = sortCol(table, 1, 'asc');
      expect(asc.columns).toEqual(['Item', 'Count']);
      expect(asc.rows).toEqual([
        ['Apple', '2'],
        ['Banana', '10'],
        ['Cherry', '30'],
      ]);
      expect(asc.rowHeights).toEqual([50, 40, 60]);

      const desc = sortCol({ ...table, hasHeaderRow: undefined }, 1, 'desc');
      expect(desc.columns).toEqual(['Item', 'Count']);
      expect(desc.rows).toEqual([
        ['Cherry', '30'],
        ['Banana', '10'],
        ['Apple', '2'],
      ]);
      expect(desc.rowHeights).toEqual([60, 40, 50]);
    });

    it('includes row -1 in sort when hasHeaderRow is false and keeps rowHeights aligned', () => {
      const table: TableBlockContent = {
        columns: ['Zebra', '100'],
        rows: [
          ['Apple', '2'],
          ['Mango', '50'],
        ],
        rowHeights: [44, 55],
        hasHeaderRow: false,
      };

      const asc = sortCol(table, 0, 'asc');
      expect(asc.columns).toEqual(['Apple', '2']);
      expect(asc.rows).toEqual([
        ['Mango', '50'],
        ['Zebra', '100'],
      ]);
      expect(asc.rowHeights).toEqual([55, 32]);

      const desc = sortCol(table, 1, 'desc');
      expect(desc.columns).toEqual(['Zebra', '100']);
      expect(desc.rows).toEqual([
        ['Mango', '50'],
        ['Apple', '2'],
      ]);
      expect(desc.rowHeights).toEqual([55, 44]);
    });
  });

  describe('clearRangeCells', () => {
    it('clears cells spanning row -1 and body rows without mutating original content', () => {
      const table = makeSampleTable();
      const range: CellRange = {
        start: { row: -1, col: 1 },
        end: { row: 1, col: 2 },
      };

      const cleared = clearRangeCells(table, range);
      expect(cleared.columns).toEqual(['Name', '', '']);
      expect(cleared.rows).toEqual([
        ['Alice', '', ''],
        ['Bob', '', ''],
        ['Cara', '35', 'Design'],
      ]);
      // Original unchanged
      expect(table.columns).toEqual(['Name', 'Age', 'Role']);
      expect(table.rows[0]).toEqual(['Alice', '30', 'Eng']);
    });
  });
});
