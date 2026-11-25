import { TableBlockContent } from '@notebook/shared';

export interface CellCoord {
  /** -1 represents the top row (`columns`), 0..rows.length - 1 represent body rows. */
  row: number;
  /** 0..columns.length - 1 */
  col: number;
}

export interface CellRange {
  start: CellCoord;
  end: CellCoord;
}

export interface NormalizedRange {
  minR: number;
  maxR: number;
  minC: number;
  maxC: number;
}

const DEFAULT_COLUMN_WIDTH = 150;
const DEFAULT_ROW_HEIGHT = 32;
const SELECTION_BORDER_COLOR = '#2383E2';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function insertItem<T>(items: T[], index: number, value: T): T[] {
  const next = [...items];
  next.splice(index, 0, value);
  return next;
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function toUnifiedRows(content: TableBlockContent): string[][] {
  return [content.columns, ...content.rows];
}

function toUnifiedHeights(content: TableBlockContent): number[] | undefined {
  if (!content.rowHeights) return undefined;
  return [
    DEFAULT_ROW_HEIGHT,
    ...content.rows.map((_, i) => content.rowHeights![i] ?? DEFAULT_ROW_HEIGHT),
  ];
}

function fromUnifiedRows(
  content: TableBlockContent,
  allRows: string[][],
  allHeights?: number[]
): TableBlockContent {
  const updated: TableBlockContent = {
    ...content,
    columns: allRows[0] ?? [],
    rows: allRows.slice(1),
  };
  if (allHeights !== undefined) {
    updated.rowHeights = allHeights.slice(1);
  }
  return updated;
}

function normalizedColumnWidths(content: TableBlockContent): number[] | undefined {
  if (!content.columnWidths) return undefined;
  return content.columns.map((_, i) => content.columnWidths![i] ?? DEFAULT_COLUMN_WIDTH);
}

function withColumnWidths(content: TableBlockContent, widths?: number[]): TableBlockContent {
  if (widths === undefined) return content;
  return { ...content, columnWidths: widths };
}

/** Normalizes any CellRange into ascending row/column bounds. */
export function normalizeRange(range: CellRange): NormalizedRange {
  return {
    minR: Math.min(range.start.row, range.end.row),
    maxR: Math.max(range.start.row, range.end.row),
    minC: Math.min(range.start.col, range.end.col),
    maxC: Math.max(range.start.col, range.end.col),
  };
}

/** Returns true when `(r, c)` lies inside `range`. */
export function isCellInRange(r: number, c: number, range: CellRange | null): boolean {
  if (!range) return false;
  const { minR, maxR, minC, maxC } = normalizeRange(range);
  return r >= minR && r <= maxR && c >= minC && c <= maxC;
}

/**
 * Computes inset box-shadow CSS for outer perimeter edges of a selected range.
 * Returns undefined for unselected cells or interior cells of a >=3x3 selection.
 */
export function computeSelectionBoxShadow(
  r: number,
  c: number,
  range: CellRange | null
): string | undefined {
  if (!range) return undefined;
  const { minR, maxR, minC, maxC } = normalizeRange(range);
  if (r < minR || r > maxR || c < minC || c > maxC) return undefined;

  const shadows: string[] = [];
  if (r === minR) shadows.push(`inset 0 2px 0 0 ${SELECTION_BORDER_COLOR}`);
  if (r === maxR) shadows.push(`inset 0 -2px 0 0 ${SELECTION_BORDER_COLOR}`);
  if (c === minC) shadows.push(`inset 2px 0 0 0 ${SELECTION_BORDER_COLOR}`);
  if (c === maxC) shadows.push(`inset -2px 0 0 0 ${SELECTION_BORDER_COLOR}`);
  return shadows.length > 0 ? shadows.join(', ') : undefined;
}

/** Escapes a single cell value for RFC 4180 TSV export. */
export function escapeTsvCell(val: string): string {
  if (val.includes('\t') || val.includes('\n') || val.includes('\r') || val.includes('"')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/** Serializes a rectangular CellRange (supporting row -1 and body rows) into TSV. */
export function serializeRangeToTsv(
  columns: string[],
  rows: string[][],
  range: CellRange
): string {
  const { minR, maxR, minC, maxC } = normalizeRange(range);
  const tsvLines: string[] = [];
  for (let r = minR; r <= maxR; r++) {
    const rowVals: string[] = [];
    for (let c = minC; c <= maxC; c++) {
      const val = r === -1 ? (columns[c] ?? '') : (rows[r]?.[c] ?? '');
      rowVals.push(escapeTsvCell(val));
    }
    tsvLines.push(rowVals.join('\t'));
  }
  return tsvLines.join('\n');
}

/** Inserts an empty row above or below `visualRowIndex` (-1 for top row). */
export function insertRowAt(
  content: TableBlockContent,
  visualRowIndex: number,
  position: 'above' | 'below'
): TableBlockContent {
  const allRows = toUnifiedRows(content);
  const uIdx = visualRowIndex + 1;
  const insertIdx = clamp(position === 'above' ? uIdx : uIdx + 1, 0, allRows.length);
  const emptyRow = Array<string>(content.columns.length).fill('');
  const nextAllRows = insertItem(allRows, insertIdx, emptyRow);

  const allHeights = toUnifiedHeights(content);
  const nextAllHeights = allHeights
    ? insertItem(allHeights, insertIdx, DEFAULT_ROW_HEIGHT)
    : undefined;

  return fromUnifiedRows(content, nextAllRows, nextAllHeights);
}

/** Duplicates the row at `rowIndex` (-1 for top row) immediately below it. */
export function duplicateRowAt(
  content: TableBlockContent,
  rowIndex: number
): TableBlockContent {
  const allRows = toUnifiedRows(content);
  const uIdx = rowIndex + 1;
  if (uIdx < 0 || uIdx >= allRows.length) return content;

  const nextAllRows = insertItem(allRows, uIdx + 1, [...allRows[uIdx]]);
  const allHeights = toUnifiedHeights(content);
  const nextAllHeights = allHeights
    ? insertItem(allHeights, uIdx + 1, allHeights[uIdx])
    : undefined;

  return fromUnifiedRows(content, nextAllRows, nextAllHeights);
}

/** Clears all cell values in `rowIndex` (-1 for top row) to empty strings. */
export function clearRowAt(
  content: TableBlockContent,
  rowIndex: number
): TableBlockContent {
  const allRows = toUnifiedRows(content);
  const uIdx = rowIndex + 1;
  if (uIdx < 0 || uIdx >= allRows.length) return content;

  const nextAllRows = allRows.map((row, idx) =>
    idx === uIdx ? row.map(() => '') : row
  );
  return fromUnifiedRows(content, nextAllRows);
}

/**
 * Deletes `rowIndex` (-1 promotes `rows[0]` to `columns`).
 * Returns null if total rows would drop below 1.
 */
export function deleteRowAt(
  content: TableBlockContent,
  rowIndex: number
): TableBlockContent | null {
  const allRows = toUnifiedRows(content);
  if (allRows.length <= 1) return null;

  const uIdx = rowIndex + 1;
  if (uIdx < 0 || uIdx >= allRows.length) return content;

  const nextAllRows = allRows.filter((_, idx) => idx !== uIdx);
  const allHeights = toUnifiedHeights(content);
  const nextAllHeights = allHeights
    ? allHeights.filter((_, idx) => idx !== uIdx)
    : undefined;

  return fromUnifiedRows(content, nextAllRows, nextAllHeights);
}

/** Reorders a row across the unified `-1..rows.length - 1` space, keeping `rowHeights` aligned. */
export function reorderRow(
  content: TableBlockContent,
  fromIndex: number,
  toIndex: number
): TableBlockContent {
  const allRows = toUnifiedRows(content);
  const fromU = fromIndex + 1;
  const toU = toIndex + 1;
  if (
    fromU === toU ||
    fromU < 0 ||
    fromU >= allRows.length ||
    toU < 0 ||
    toU >= allRows.length
  ) {
    return content;
  }

  const nextAllRows = moveItem(allRows, fromU, toU);
  const allHeights = toUnifiedHeights(content);
  const nextAllHeights = allHeights ? moveItem(allHeights, fromU, toU) : undefined;

  return fromUnifiedRows(content, nextAllRows, nextAllHeights);
}

/** Inserts an empty column to the left or right of `colIndex`. */
export function insertColAt(
  content: TableBlockContent,
  colIndex: number,
  side: 'left' | 'right'
): TableBlockContent {
  const insertIdx = clamp(side === 'left' ? colIndex : colIndex + 1, 0, content.columns.length);
  const nextAllRows = toUnifiedRows(content).map((row) => insertItem(row, insertIdx, ''));
  const widths = normalizedColumnWidths(content);
  const nextWidths = widths ? insertItem(widths, insertIdx, DEFAULT_COLUMN_WIDTH) : undefined;

  return withColumnWidths(fromUnifiedRows(content, nextAllRows), nextWidths);
}

/** Duplicates column `colIndex` immediately to its right. */
export function duplicateColAt(
  content: TableBlockContent,
  colIndex: number
): TableBlockContent {
  if (colIndex < 0 || colIndex >= content.columns.length) return content;

  const nextAllRows = toUnifiedRows(content).map((row) =>
    insertItem(row, colIndex + 1, row[colIndex] ?? '')
  );
  const widths = normalizedColumnWidths(content);
  const nextWidths = widths
    ? insertItem(widths, colIndex + 1, widths[colIndex] ?? DEFAULT_COLUMN_WIDTH)
    : undefined;

  return withColumnWidths(fromUnifiedRows(content, nextAllRows), nextWidths);
}

/** Clears all cells (including top row) in column `colIndex`. */
export function clearColAt(
  content: TableBlockContent,
  colIndex: number
): TableBlockContent {
  if (colIndex < 0 || colIndex >= content.columns.length) return content;

  const nextAllRows = toUnifiedRows(content).map((row) =>
    row.map((cell, ci) => (ci === colIndex ? '' : cell))
  );
  return fromUnifiedRows(content, nextAllRows);
}

/** Deletes column `colIndex` and its width, or returns null if `columns.length <= 1`. */
export function deleteColAt(
  content: TableBlockContent,
  colIndex: number
): TableBlockContent | null {
  if (content.columns.length <= 1) return null;
  if (colIndex < 0 || colIndex >= content.columns.length) return content;

  const nextAllRows = toUnifiedRows(content).map((row) =>
    row.filter((_, ci) => ci !== colIndex)
  );
  const widths = normalizedColumnWidths(content);
  const nextWidths = widths ? widths.filter((_, ci) => ci !== colIndex) : undefined;

  return withColumnWidths(fromUnifiedRows(content, nextAllRows), nextWidths);
}

/**
 * Sorts rows by `colIndex`. Keeps row `-1` fixed when `hasHeaderRow !== false`,
 * and includes row `-1` in the sort when `hasHeaderRow === false`.
 */
export function sortCol(
  content: TableBlockContent,
  colIndex: number,
  direction: 'asc' | 'desc'
): TableBlockContent {
  if (colIndex < 0 || colIndex >= content.columns.length) return content;

  const compare = (rowA: string[], rowB: string[]): number => {
    const cmp = (rowA[colIndex] ?? '').localeCompare(rowB[colIndex] ?? '', undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    return direction === 'asc' ? cmp : -cmp;
  };

  const allHeights = toUnifiedHeights(content);

  if (content.hasHeaderRow === false) {
    const paired = toUnifiedRows(content).map((row, idx) => ({
      row,
      height: allHeights ? allHeights[idx] : DEFAULT_ROW_HEIGHT,
    }));
    paired.sort((a, b) => compare(a.row, b.row));

    return fromUnifiedRows(
      content,
      paired.map((p) => p.row),
      allHeights ? paired.map((p) => p.height) : undefined
    );
  }

  const bodyHeights = allHeights ? allHeights.slice(1) : undefined;
  const pairedBody = content.rows.map((row, idx) => ({
    row,
    height: bodyHeights ? bodyHeights[idx] : DEFAULT_ROW_HEIGHT,
  }));
  pairedBody.sort((a, b) => compare(a.row, b.row));

  return {
    ...content,
    rows: pairedBody.map((p) => p.row),
    ...(bodyHeights ? { rowHeights: pairedBody.map((p) => p.height) } : {}),
  };
}

/** Moves column `fromIndex` to `toIndex`, updating `columns`, every row, and `columnWidths`. */
export function reorderCol(
  content: TableBlockContent,
  fromIndex: number,
  toIndex: number
): TableBlockContent {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    fromIndex >= content.columns.length ||
    toIndex < 0 ||
    toIndex >= content.columns.length
  ) {
    return content;
  }

  const nextAllRows = toUnifiedRows(content).map((row) =>
    moveItem(row, fromIndex, toIndex)
  );
  const widths = normalizedColumnWidths(content);
  const nextWidths = widths ? moveItem(widths, fromIndex, toIndex) : undefined;

  return withColumnWidths(fromUnifiedRows(content, nextAllRows), nextWidths);
}

/** Clears all cells within `range` (spanning row `-1` and body rows) to empty strings. */
export function clearRangeCells(
  content: TableBlockContent,
  range: CellRange
): TableBlockContent {
  const { minR, maxR, minC, maxC } = normalizeRange(range);
  const nextAllRows = toUnifiedRows(content).map((row, uIdx) => {
    const r = uIdx - 1;
    if (r < minR || r > maxR) return row;
    return row.map((cell, c) => (c >= minC && c <= maxC ? '' : cell));
  });
  return fromUnifiedRows(content, nextAllRows);
}
