import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { TableBlockContent } from '@notebook/shared';
import { Plus, GripVertical, MoreHorizontal, SlidersHorizontal } from 'lucide-react';
import { parseClipboardTableData } from '../utils/clipboardTableParser';
import { TableCell, CellNavDirection } from './TableCell';
import {
  RowActionMenu,
  ColumnActionMenu,
  TableOptionsMenu,
} from './TableContextMenus';
import {
  CellCoord,
  CellRange,
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
} from './tableUtils';

interface TableBlockProps {
  content: TableBlockContent;
  onChange: (updated: TableBlockContent) => void;
}

type ActiveMenu =
  | { type: 'options' }
  | { type: 'row'; index: number; top: number; left: number }
  | { type: 'col'; index: number; top: number; left: number }
  | null;

const DEFAULT_COL_WIDTH = 150;
const DEFAULT_ROW_HEIGHT = 32;
const MIN_COL_WIDTH = 60;
const MAX_COL_WIDTH = 800;
const DRAG_THRESHOLD_PX = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function readEditableText(el: HTMLElement): string {
  const raw = el.innerText !== undefined ? el.innerText : (el.textContent || '');
  return raw.replace(/\r\n/g, '\n');
}

function placeCaret(el: HTMLElement, position: 'start' | 'end') {
  try {
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(position === 'start');
    selection.removeAllRanges();
    selection.addRange(range);
  } catch {
    // Selection API may not be fully supported in headless environments
  }
}

function writeClipboardText(text: string): void {
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text).catch(() => {});
    return;
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  } catch {
    // Ignore fallback copy failures
  }
}

function findGapIndex(clientPos: number, rects: DOMRect[], axis: 'x' | 'y'): number {
  for (let i = 0; i < rects.length; i++) {
    const mid =
      axis === 'y'
        ? rects[i].top + rects[i].height / 2
        : rects[i].left + rects[i].width / 2;
    if (clientPos < mid) {
      return i;
    }
  }
  return rects.length;
}

export const TableBlock: React.FC<TableBlockProps> = ({ content, onChange }) => {
  const tableRef = useRef<HTMLDivElement>(null);
  const tableBoxRef = useRef<HTMLDivElement>(null);
  const tableElRef = useRef<HTMLTableElement>(null);
  const thRefs = useRef<(HTMLTableCellElement | null)[]>([]);

  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pastedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedRange, setSelectedRange] = useState<CellRange | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const dragStartRef = useRef<CellCoord | null>(null);
  const anchorRef = useRef<CellCoord | null>(null);
  const focusedCellRef = useRef<CellCoord | null>(null);
  const pendingFocusRef = useRef<{ row: number; col: number; caret: 'start' | 'end' } | null>(null);

  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>(null);

  const [resizingCol, setResizingCol] = useState<{
    index: number;
    currentWidth: number;
  } | null>(null);
  const [measuredColEdges, setMeasuredColEdges] = useState<number[]>([]);

  const [dragRow, setDragRow] = useState<{
    fromIndex: number;
    targetIndex: number;
    lineTop: number;
  } | null>(null);
  const [dragCol, setDragCol] = useState<{
    fromIndex: number;
    targetIndex: number;
    lineLeft: number;
  } | null>(null);

  const columns = content?.columns?.length ? content.columns : ['', ''];
  const rows = Array.isArray(content?.rows) ? content.rows : [['', '']];
  const hasHeaderRow = content?.hasHeaderRow !== false;
  const hasHeaderColumn = content?.hasHeaderColumn === true;
  const fitToWidth = content?.fitToWidth === true;

  const contentRef = useRef(content);
  contentRef.current = content;
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const activeMenuRef = useRef(activeMenu);
  activeMenuRef.current = activeMenu;
  const selectedRangeRef = useRef(selectedRange);
  selectedRangeRef.current = selectedRange;

  const getNormalizedContent = useCallback((): TableBlockContent => {
    return {
      ...contentRef.current,
      columns: columnsRef.current,
      rows: rowsRef.current,
    };
  }, []);

  const flashCopied = useCallback(() => {
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
  }, []);

  const flashPasted = useCallback(() => {
    setPasted(true);
    if (pastedTimerRef.current) clearTimeout(pastedTimerRef.current);
    pastedTimerRef.current = setTimeout(() => setPasted(false), 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      if (pastedTimerRef.current) clearTimeout(pastedTimerRef.current);
    };
  }, []);

  const activeColWidths = columns.map((_, i) =>
    resizingCol && resizingCol.index === i
      ? resizingCol.currentWidth
      : (content.columnWidths?.[i] ?? DEFAULT_COL_WIDTH)
  );
  const totalColWidth = activeColWidths.reduce((sum, w) => sum + w, 0);

  const cumulativeColEdges = activeColWidths.reduce<number[]>((acc, width, idx) => {
    const prev = idx > 0 ? acc[idx - 1] : 0;
    acc.push(prev + width);
    return acc;
  }, []);

  const colWidthsKey = activeColWidths.join(',');

  useLayoutEffect(() => {
    if (!fitToWidth) {
      setMeasuredColEdges([]);
      return;
    }

    const updateMeasuredEdges = () => {
      const edges = columnsRef.current.map((_, ci) => {
        const th = thRefs.current[ci];
        if (th && th.offsetWidth > 0) {
          return th.offsetLeft + th.offsetWidth;
        }
        return 0;
      });
      const next = edges.some((e) => e > 0) ? edges : [];
      setMeasuredColEdges((prev) =>
        prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next
      );
    };

    updateMeasuredEdges();

    const tableEl = tableElRef.current;
    if (!tableEl || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateMeasuredEdges();
    });
    observer.observe(tableEl);
    return () => {
      observer.disconnect();
    };
  }, [fitToWidth, columns.length, colWidthsKey]);

  const blurActiveEditable = useCallback(() => {
    const activeEl = document.activeElement as HTMLElement | null;
    if (
      activeEl &&
      tableRef.current?.contains(activeEl) &&
      activeEl.getAttribute('contenteditable') === 'true'
    ) {
      activeEl.blur();
    }
  }, []);

  const getCellEditable = useCallback((r: number, c: number): HTMLElement | null => {
    const selector =
      r === -1
        ? `th[data-col-index="${c}"] [contenteditable="true"]`
        : `td[data-row-index="${r}"][data-col-index="${c}"] [contenteditable="true"]`;
    return (tableRef.current?.querySelector(selector) as HTMLElement | null) ?? null;
  }, []);

  const focusCell = useCallback(
    (r: number, c: number, caret: 'start' | 'end' = 'end') => {
      const cellEl = getCellEditable(r, c);
      if (!cellEl) return;
      cellEl.focus();
      focusedCellRef.current = { row: r, col: c };
      anchorRef.current = { row: r, col: c };
      placeCaret(cellEl, caret);
    },
    [getCellEditable]
  );

  useEffect(() => {
    if (pendingFocusRef.current) {
      const { row, col, caret } = pendingFocusRef.current;
      pendingFocusRef.current = null;
      focusCell(row, col, caret);
    }
  }, [rows.length, columns.length, focusCell]);

  const selectWholeTable = useCallback(() => {
    setSelectedRange({
      start: { row: -1, col: 0 },
      end: { row: rowsRef.current.length - 1, col: columnsRef.current.length - 1 },
    });
  }, []);

  const updateCellValue = useCallback(
    (rowIndex: number, colIndex: number, val: string) => {
      const base = getNormalizedContent();
      if (rowIndex === -1) {
        const nextCols = base.columns.map((c, ci) => (ci === colIndex ? val : c));
        onChange({ ...base, columns: nextCols });
        return;
      }
      const nextRows = base.rows.map((r, ri) =>
        ri === rowIndex ? r.map((c, ci) => (ci === colIndex ? val : c)) : r
      );
      onChange({ ...base, rows: nextRows });
    },
    [getNormalizedContent, onChange]
  );

  const handleCellNavigate = useCallback(
    (direction: CellNavDirection, rowIndex: number, colIndex: number) => {
      const colCount = columnsRef.current.length;
      const rowCount = rowsRef.current.length;

      if (direction === 'next') {
        if (colIndex < colCount - 1) {
          focusCell(rowIndex, colIndex + 1, 'end');
        } else if (rowIndex < rowCount - 1) {
          focusCell(rowIndex + 1, 0, 'end');
        } else {
          const base = getNormalizedContent();
          const newRow = new Array<string>(colCount).fill('');
          const newRowHeights = base.rowHeights
            ? [...base.rowHeights, DEFAULT_ROW_HEIGHT]
            : undefined;
          pendingFocusRef.current = { row: rowCount, col: 0, caret: 'start' };
          onChange({
            ...base,
            rows: [...base.rows, newRow],
            ...(newRowHeights !== undefined ? { rowHeights: newRowHeights } : {}),
          });
        }
        return;
      }

      if (direction === 'prev' || direction === 'left') {
        const caret = direction === 'left' ? 'end' : 'end';
        if (colIndex > 0) {
          focusCell(rowIndex, colIndex - 1, caret);
        } else if (rowIndex > 0) {
          focusCell(rowIndex - 1, colCount - 1, caret);
        } else if (rowIndex === 0) {
          focusCell(-1, colCount - 1, caret);
        }
        return;
      }

      if (direction === 'right') {
        if (colIndex < colCount - 1) {
          focusCell(rowIndex, colIndex + 1, 'start');
        } else if (rowIndex < rowCount - 1) {
          focusCell(rowIndex + 1, 0, 'start');
        }
        return;
      }

      if (direction === 'up') {
        if (rowIndex > 0) {
          focusCell(rowIndex - 1, colIndex, 'end');
        } else if (rowIndex === 0) {
          focusCell(-1, colIndex, 'end');
        }
        return;
      }

      if (direction === 'down') {
        if (rowIndex < rowCount - 1) {
          focusCell(rowIndex + 1, colIndex, 'start');
        }
      }
    },
    [focusCell, getNormalizedContent, onChange]
  );

  const handleEscapeToSelect = useCallback((rowIndex: number, colIndex: number) => {
    const coord = { row: rowIndex, col: colIndex };
    anchorRef.current = coord;
    setSelectedRange({ start: coord, end: coord });
  }, []);

  const handleCellMouseDown = (e: React.MouseEvent, r: number, c: number) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('.cursor-col-resize')) {
      return;
    }

    if (e.shiftKey) {
      e.preventDefault();
      blurActiveEditable();
      window.getSelection()?.removeAllRanges();
      const anchor =
        anchorRef.current ??
        focusedCellRef.current ??
        selectedRange?.start ??
        { row: r, col: c };
      anchorRef.current = anchor;
      setSelectedRange({ start: anchor, end: { row: r, col: c } });
      return;
    }

    dragStartRef.current = { row: r, col: c };
    anchorRef.current = { row: r, col: c };
    setIsSelecting(true);
    setSelectedRange(null);
  };

  const handleCellMouseEnter = (r: number, c: number) => {
    setHoveredRow(r);
    setHoveredCol(c);
    if (!isSelecting || !dragStartRef.current) return;
    const start = dragStartRef.current;
    if (start.row !== r || start.col !== c || selectedRange !== null) {
      blurActiveEditable();
      window.getSelection()?.removeAllRanges();
      setSelectedRange({ start, end: { row: r, col: c } });
    }
  };

  // Column resize handlers
  const handleColResizeStart = (e: React.MouseEvent, ci: number) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const measuredWidth =
      fitToWidth && thRefs.current[ci]?.offsetWidth
        ? thRefs.current[ci]!.offsetWidth
        : (contentRef.current.columnWidths?.[ci] ?? DEFAULT_COL_WIDTH);

    setResizingCol({ index: ci, currentWidth: measuredWidth });

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const nextWidth = clamp(
        measuredWidth + (moveEvent.clientX - startX),
        MIN_COL_WIDTH,
        MAX_COL_WIDTH
      );
      setResizingCol({ index: ci, currentWidth: nextWidth });
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      const finalWidth = clamp(
        measuredWidth + (upEvent.clientX - startX),
        MIN_COL_WIDTH,
        MAX_COL_WIDTH
      );
      const base = getNormalizedContent();
      const updatedWidths = base.columns.map((_, idx) =>
        idx === ci ? finalWidth : (base.columnWidths?.[idx] ?? DEFAULT_COL_WIDTH)
      );
      setResizingCol(null);
      onChange({ ...base, columnWidths: updatedWidths });
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const resetColWidth = (ci: number) => {
    const base = getNormalizedContent();
    const updatedWidths = base.columns.map((_, idx) =>
      idx === ci ? DEFAULT_COL_WIDTH : (base.columnWidths?.[idx] ?? DEFAULT_COL_WIDTH)
    );
    onChange({ ...base, columnWidths: updatedWidths });
  };

  const getRelativeAnchor = (triggerEl: HTMLElement): { top: number; left: number } => {
    const containerRect = tableRef.current?.getBoundingClientRect();
    const triggerRect = triggerEl.getBoundingClientRect();
    if (!containerRect || (triggerRect.width === 0 && triggerRect.height === 0)) {
      return { top: 0, left: 0 };
    }
    return {
      top: Math.max(0, triggerRect.bottom - containerRect.top + 4),
      left: Math.max(0, triggerRect.left - containerRect.left),
    };
  };

  // Row pill handle: <=4px click opens menu + selects row; >4px drag reorders rows
  const handleRowHandleMouseDown = (e: React.MouseEvent<HTMLButtonElement>, ri: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const triggerEl = e.currentTarget;
    const startX = e.clientX;
    const startY = e.clientY;
    let hasDragged = false;
    let latestTarget = ri;

    const tableBoxRect = tableBoxRef.current?.getBoundingClientRect();
    const rowEls = Array.from(
      tableElRef.current?.querySelectorAll('thead tr, tbody tr') ?? []
    );
    const rowRects = rowEls.map((el) => el.getBoundingClientRect());

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
      if (!hasDragged && dist > DRAG_THRESHOLD_PX) {
        hasDragged = true;
        setActiveMenu(null);
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
      }
      if (!hasDragged || rowRects.length === 0) return;

      const gapIdx = findGapIndex(moveEvent.clientY, rowRects, 'y');
      const fromU = ri + 1;
      const toU = gapIdx <= fromU ? gapIdx : gapIdx - 1;
      latestTarget = toU - 1;

      const boundaryY =
        gapIdx < rowRects.length
          ? rowRects[gapIdx].top
          : rowRects[rowRects.length - 1].bottom;
      const lineTop = boundaryY - (tableBoxRect?.top ?? 0);

      setDragRow({ fromIndex: ri, targetIndex: latestTarget, lineTop });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setDragRow(null);

      if (hasDragged) {
        if (latestTarget !== ri) {
          onChange(reorderRow(getNormalizedContent(), ri, latestTarget));
        }
        return;
      }

      blurActiveEditable();
      window.getSelection()?.removeAllRanges();
      setSelectedRange({
        start: { row: ri, col: 0 },
        end: { row: ri, col: columnsRef.current.length - 1 },
      });

      const currentMenu = activeMenuRef.current;
      if (currentMenu?.type === 'row' && currentMenu.index === ri) {
        setActiveMenu(null);
      } else {
        const pos = getRelativeAnchor(triggerEl);
        setActiveMenu({ type: 'row', index: ri, top: pos.top, left: pos.left });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Column pill handle: <=4px click opens menu + selects col; >4px drag reorders columns
  const handleColHandleMouseDown = (e: React.MouseEvent<HTMLButtonElement>, ci: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const triggerEl = e.currentTarget;
    const startX = e.clientX;
    const startY = e.clientY;
    let hasDragged = false;
    let latestTarget = ci;

    const tableBoxRect = tableBoxRef.current?.getBoundingClientRect();
    const colEls = Array.from(tableElRef.current?.querySelectorAll('thead th') ?? []);
    const colRects = colEls.map((el) => el.getBoundingClientRect());

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
      if (!hasDragged && dist > DRAG_THRESHOLD_PX) {
        hasDragged = true;
        setActiveMenu(null);
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
      }
      if (!hasDragged || colRects.length === 0) return;

      const gapIdx = findGapIndex(moveEvent.clientX, colRects, 'x');
      latestTarget = gapIdx <= ci ? gapIdx : gapIdx - 1;

      const boundaryX =
        gapIdx < colRects.length
          ? colRects[gapIdx].left
          : colRects[colRects.length - 1].right;
      const lineLeft = boundaryX - (tableBoxRect?.left ?? 0);

      setDragCol({ fromIndex: ci, targetIndex: latestTarget, lineLeft });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setDragCol(null);

      if (hasDragged) {
        if (latestTarget !== ci) {
          onChange(reorderCol(getNormalizedContent(), ci, latestTarget));
        }
        return;
      }

      blurActiveEditable();
      window.getSelection()?.removeAllRanges();
      setSelectedRange({
        start: { row: -1, col: ci },
        end: { row: rowsRef.current.length - 1, col: ci },
      });

      const currentMenu = activeMenuRef.current;
      if (currentMenu?.type === 'col' && currentMenu.index === ci) {
        setActiveMenu(null);
      } else {
        const pos = getRelativeAnchor(triggerEl);
        setActiveMenu({ type: 'col', index: ci, top: pos.top, left: pos.left });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Global keyboard, mouseup, and outside-click handling for range selection
  useEffect(() => {
    const handleWindowMouseUp = () => {
      setIsSelecting(false);
      dragStartRef.current = null;
    };

    const handleWindowKeyDownCapture = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const activeEl = document.activeElement as HTMLElement | null;
      const isInsideTable = !!(tableRef.current && activeEl && tableRef.current.contains(activeEl));
      const isEditingCell = !!(
        isInsideTable && activeEl?.getAttribute('contenteditable') === 'true'
      );
      if (selectedRangeRef.current && !isEditingCell && !activeMenuRef.current) {
        e.preventDefault();
        e.stopPropagation();
        setSelectedRange(null);
      }
    };

    const handleWindowKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const isInsideTable = !!(tableRef.current && activeEl && tableRef.current.contains(activeEl));
      const isEditingCell = !!(
        isInsideTable && activeEl?.getAttribute('contenteditable') === 'true'
      );
      const activeTag = activeEl?.tagName;
      const ceAttr = activeEl?.getAttribute('contenteditable');
      const isFocusedElsewhere = !!(
        activeEl &&
        activeEl !== document.body &&
        !isInsideTable &&
        (activeTag === 'INPUT' ||
          activeTag === 'TEXTAREA' ||
          ceAttr === 'true' ||
          ceAttr === '')
      );

      if (isFocusedElsewhere) return;

      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        if (selectedRange || isInsideTable) {
          const selection = window.getSelection();
          const cellText = activeEl?.textContent || '';
          const allCellSelected =
            !isEditingCell ||
            cellText === '' ||
            (selection !== null && selection.toString() === cellText);
          if (allCellSelected) {
            e.preventDefault();
            blurActiveEditable();
            window.getSelection()?.removeAllRanges();
            selectWholeTable();
          }
        }
        return;
      }

      if (!selectedRange || isEditingCell) return;

      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        const tsv = serializeRangeToTsv(columnsRef.current, rowsRef.current, selectedRange);
        writeClipboardText(tsv);
        flashCopied();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        const base = getNormalizedContent();
        const tsv = serializeRangeToTsv(base.columns, base.rows, selectedRange);
        writeClipboardText(tsv);
        flashCopied();
        onChange(clearRangeCells(base, selectedRange));
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        onChange(clearRangeCells(getNormalizedContent(), selectedRange));
        return;
      }

      // Printable key on a single selected cell focuses it and starts editing
      const { minR, maxR, minC, maxC } = normalizeRange(selectedRange);
      const isSingleCell = minR === maxR && minC === maxC;

      if (
        isSingleCell &&
        !activeMenuRef.current &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        const cellEl = getCellEditable(minR, minC);
        if (cellEl) {
          cellEl.textContent = e.key;
          cellEl.focus();
          focusedCellRef.current = { row: minR, col: minC };
          anchorRef.current = { row: minR, col: minC };
          placeCaret(cellEl, 'end');
        }
        setSelectedRange(null);
        updateCellValue(minR, minC, e.key);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
        setSelectedRange(null);
        anchorRef.current = null;
        focusedCellRef.current = null;
      }
    };

    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('keydown', handleWindowKeyDownCapture, { capture: true });
    window.addEventListener('keydown', handleWindowKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('keydown', handleWindowKeyDownCapture, { capture: true });
      window.removeEventListener('keydown', handleWindowKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [
    selectedRange,
    blurActiveEditable,
    selectWholeTable,
    flashCopied,
    getNormalizedContent,
    onChange,
    getCellEditable,
    updateCellValue,
  ]);

  // Outside-edge + actions
  const addColumn = () => {
    const base = getNormalizedContent();
    const newCols = [...base.columns, ''];
    const newRows = base.rows.map((r) => [...r, '']);
    const newColWidths = base.columnWidths
      ? [...base.columnWidths, DEFAULT_COL_WIDTH]
      : undefined;
    pendingFocusRef.current = { row: -1, col: base.columns.length, caret: 'start' };
    onChange({
      ...base,
      columns: newCols,
      rows: newRows,
      ...(newColWidths !== undefined ? { columnWidths: newColWidths } : {}),
    });
  };

  const addRow = () => {
    const base = getNormalizedContent();
    const newRow = new Array<string>(base.columns.length).fill('');
    const newRowHeights = base.rowHeights
      ? [...base.rowHeights, DEFAULT_ROW_HEIGHT]
      : undefined;
    pendingFocusRef.current = { row: base.rows.length, col: 0, caret: 'start' };
    onChange({
      ...base,
      rows: [...base.rows, newRow],
      ...(newRowHeights !== undefined ? { rowHeights: newRowHeights } : {}),
    });
  };

  const addRowAndColumn = () => {
    const base = getNormalizedContent();
    const newCols = [...base.columns, ''];
    const newRows = [
      ...base.rows.map((r) => [...r, '']),
      new Array<string>(newCols.length).fill(''),
    ];
    const newColWidths = base.columnWidths
      ? [...base.columnWidths, DEFAULT_COL_WIDTH]
      : undefined;
    const newRowHeights = base.rowHeights
      ? [...base.rowHeights, DEFAULT_ROW_HEIGHT]
      : undefined;
    pendingFocusRef.current = { row: base.rows.length, col: base.columns.length, caret: 'start' };
    onChange({
      ...base,
      columns: newCols,
      rows: newRows,
      ...(newColWidths !== undefined ? { columnWidths: newColWidths } : {}),
      ...(newRowHeights !== undefined ? { rowHeights: newRowHeights } : {}),
    });
  };

  // Clipboard Copy / Cut / Paste
  const serializeFullTableToTsv = () =>
    serializeRangeToTsv(columns, rows, {
      start: { row: -1, col: 0 },
      end: { row: rows.length - 1, col: columns.length - 1 },
    });

  const copyFullTable = () => {
    writeClipboardText(serializeFullTableToTsv());
    flashCopied();
  };

  const handleContainerCopy = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (selectedRange) {
      e.preventDefault();
      e.clipboardData.setData('text/plain', serializeRangeToTsv(columns, rows, selectedRange));
      flashCopied();
      return;
    }

    const activeEl = document.activeElement;
    const isFocusedInCell = !!(
      activeEl &&
      (activeEl.getAttribute('contenteditable') === 'true' ||
        activeEl.closest('[contenteditable="true"]') !== null)
    );
    const selection = window.getSelection();

    if (isFocusedInCell) {
      if (!selection || selection.isCollapsed || !tableRef.current || selection.rangeCount === 0) {
        return;
      }
      const range = selection.getRangeAt(0);
      const selectedCells = Array.from(tableRef.current.querySelectorAll('th, td')).filter((cell) =>
        range.intersectsNode(cell)
      );
      if (selectedCells.length <= 1) {
        return;
      }
    } else if (!selection || selection.isCollapsed) {
      e.preventDefault();
      e.clipboardData.setData('text/plain', serializeFullTableToTsv());
      flashCopied();
      return;
    }

    if (tableRef.current && selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const allCells = Array.from(tableRef.current.querySelectorAll('th, td'));
      const selectedCells = allCells.filter((cell) => range.intersectsNode(cell));
      if (selectedCells.length > 1) {
        e.preventDefault();
        const tsvRows: string[] = [];
        const selectedHeaders = Array.from(
          tableRef.current.querySelectorAll('thead th.table-header-cell')
        ).filter((th) => range.intersectsNode(th));
        if (selectedHeaders.length > 0) {
          tsvRows.push(
            selectedHeaders
              .map((th) => {
                const editable = th.querySelector<HTMLElement>('[contenteditable]');
                return escapeTsvCell(readEditableText(editable ?? (th as HTMLElement)));
              })
              .join('\t')
          );
        }

        for (const tr of Array.from(tableRef.current.querySelectorAll('tbody tr'))) {
          const selectedRowTd = Array.from(tr.querySelectorAll('td.table-data-cell')).filter(
            (td) => range.intersectsNode(td)
          );
          if (selectedRowTd.length > 0) {
            tsvRows.push(
              selectedRowTd
                .map((td) => {
                  const editable = td.querySelector<HTMLElement>('[contenteditable]');
                  return escapeTsvCell(readEditableText(editable ?? (td as HTMLElement)));
                })
                .join('\t')
            );
          }
        }

        const resultTsv =
          tsvRows.length > 0 ? tsvRows.join('\n') : serializeFullTableToTsv();
        e.clipboardData.setData('text/plain', resultTsv);
        flashCopied();
      }
    }
  };

  const handleContainerCut = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!selectedRange) return;
    const activeEl = document.activeElement;
    const isEditingCell = !!(
      activeEl &&
      tableRef.current?.contains(activeEl) &&
      activeEl.getAttribute('contenteditable') === 'true'
    );
    if (isEditingCell) return;

    e.preventDefault();
    const base = getNormalizedContent();
    e.clipboardData.setData('text/plain', serializeRangeToTsv(base.columns, base.rows, selectedRange));
    flashCopied();
    onChange(clearRangeCells(base, selectedRange));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData.getData('text/plain');
    const html = e.clipboardData.getData('text/html');
    if (!text && !html) return;

    const activeEl = document.activeElement;
    const targetEl = e.target as HTMLElement | null;
    const isCellFocused = !!(
      (activeEl &&
        (activeEl.getAttribute('contenteditable') === 'true' ||
          activeEl.closest('[contenteditable="true"]'))) ||
      (targetEl &&
        (targetEl.getAttribute('contenteditable') === 'true' ||
          targetEl.closest('[contenteditable="true"]')))
    );
    const isHtmlTable = !!(html && (html.includes('<table') || html.includes('<tr')));

    if (isCellFocused && !text.includes('\t') && !isHtmlTable) {
      return;
    }

    const targetTd = targetEl?.closest ? targetEl.closest('td') : null;
    const targetTh = targetEl?.closest ? targetEl.closest('th') : null;
    const rangeStart = selectedRange ? normalizeRange(selectedRange) : null;

    const startRow = targetTd
      ? Number(targetTd.getAttribute('data-row-index') ?? 0)
      : targetTh
        ? -1
        : (rangeStart?.minR ?? -1);
    const startCol = targetTd
      ? Number(targetTd.getAttribute('data-col-index') ?? 0)
      : targetTh
        ? Number(targetTh.getAttribute('data-col-index') ?? 0)
        : (rangeStart?.minC ?? 0);

    const base = getNormalizedContent();
    const tableData = parseClipboardTableData(text, html);
    if (tableData && tableData.rawGrid.length > 0) {
      e.preventDefault();
      const pasteGrid = tableData.rawGrid;
      const pasteRowCount = pasteGrid.length;
      const pasteColCount = pasteGrid[0].length;

      if (startRow === -1) {
        const reqCols = Math.max(base.columns.length, startCol + pasteColCount);
        const reqRows = Math.max(base.rows.length, pasteRowCount - 1);

        const newCols = [...base.columns];
        while (newCols.length < reqCols) {
          newCols.push(`Column ${newCols.length + 1}`);
        }
        for (let c = 0; c < pasteColCount; c++) {
          newCols[startCol + c] = pasteGrid[0][c] || newCols[startCol + c];
        }

        const newRows = base.rows.map((r) => {
          const rowCopy = [...r];
          while (rowCopy.length < reqCols) rowCopy.push('');
          return rowCopy;
        });
        while (newRows.length < reqRows) {
          newRows.push(new Array<string>(reqCols).fill(''));
        }

        for (let r = 1; r < pasteRowCount; r++) {
          for (let c = 0; c < pasteColCount; c++) {
            newRows[r - 1][startCol + c] = pasteGrid[r][c];
          }
        }

        onChange({ ...base, columns: newCols, rows: newRows });
      } else {
        const actualStartRow = Math.max(0, startRow);
        const actualStartCol = Math.max(0, startCol);

        const reqCols = Math.max(base.columns.length, actualStartCol + pasteColCount);
        const reqRows = Math.max(base.rows.length, actualStartRow + pasteRowCount);

        const newCols = [...base.columns];
        while (newCols.length < reqCols) {
          newCols.push(`Column ${newCols.length + 1}`);
        }

        const newRows = base.rows.map((r) => {
          const rowCopy = [...r];
          while (rowCopy.length < reqCols) rowCopy.push('');
          return rowCopy;
        });
        while (newRows.length < reqRows) {
          newRows.push(new Array<string>(reqCols).fill(''));
        }

        for (let r = 0; r < pasteRowCount; r++) {
          for (let c = 0; c < pasteColCount; c++) {
            newRows[actualStartRow + r][actualStartCol + c] = pasteGrid[r][c];
          }
        }

        onChange({ ...base, columns: newCols, rows: newRows });
      }

      flashPasted();
      return;
    }

    const rawLines = text.split(/\r?\n/).filter((line, idx, arr) => {
      if (idx === arr.length - 1 && line.trim() === '') return false;
      return true;
    });

    if (rawLines.length <= 1) return;

    const hasTabs = rawLines.some((l) => l.includes('\t'));
    const hasCommas = rawLines.some((l) => l.includes(','));

    let parsedRows: string[][];
    if (hasTabs) {
      parsedRows = rawLines.map((l) => l.split('\t'));
    } else if (hasCommas) {
      const csvRows = rawLines.map((l) => parseCsvLine(l));
      const firstColCount = csvRows[0].length;
      if (firstColCount >= 2 && csvRows.every((r) => r.length === firstColCount)) {
        parsedRows = csvRows;
      } else {
        parsedRows = rawLines.map((l) => [l]);
      }
    } else {
      parsedRows = rawLines.map((l) => [l]);
    }

    const maxCols = parsedRows.length > 0 ? Math.max(...parsedRows.map((r) => r.length)) : 0;
    if (parsedRows.length >= 2) {
      e.preventDefault();
      const normalizedRows = parsedRows.map((r) => {
        const row = [...r];
        while (row.length < maxCols) row.push('');
        return row;
      });
      const newColumns = normalizedRows[0].map((c, i) => c.trim() || `Column ${i + 1}`);
      const newRows = normalizedRows.slice(1);
      onChange({ ...base, columns: newColumns, rows: newRows });
      flashPasted();
    }
  };

  const renderRowPillHandle = (rowIndex: number) => {
    const isMenuOrDrag =
      (activeMenu?.type === 'row' && activeMenu.index === rowIndex) ||
      dragRow?.fromIndex === rowIndex;
    const isVisible = hoveredRow === rowIndex || isMenuOrDrag;
    return (
      <button
        type="button"
        aria-label={`Row ${rowIndex + 2} options`}
        title="Click for row options or drag to reorder"
        onMouseDown={(e) => handleRowHandleMouseDown(e, rowIndex)}
        onMouseEnter={() => setHoveredRow(rowIndex)}
        className={`group/row-handle absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex items-center justify-center rounded-full border border-black/20 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 shadow-xs cursor-grab active:cursor-grabbing transition-all duration-150 ${
          isMenuOrDrag
            ? 'w-3 h-4 rounded-[3px] opacity-100'
            : isVisible
              ? 'w-1.5 h-3 hover:w-3 hover:h-4 hover:rounded-[3px] opacity-100'
              : 'w-1.5 h-3 hover:w-3 hover:h-4 hover:rounded-[3px] opacity-0 hover:opacity-100 focus-visible:opacity-100'
        }`}
      >
        <GripVertical
          className={`w-2.5 h-2.5 transition-opacity duration-150 ${
            isMenuOrDrag ? 'opacity-100' : 'opacity-0 group-hover/row-handle:opacity-100'
          }`}
        />
      </button>
    );
  };

  const renderColPillHandle = (colIndex: number) => {
    const isMenuOrDrag =
      (activeMenu?.type === 'col' && activeMenu.index === colIndex) ||
      dragCol?.fromIndex === colIndex;
    const isVisible = hoveredCol === colIndex || isMenuOrDrag;
    return (
      <button
        type="button"
        aria-label={`Column ${colIndex + 1} options`}
        title="Click for column options or drag to reorder"
        onMouseDown={(e) => handleColHandleMouseDown(e, colIndex)}
        onMouseEnter={() => setHoveredCol(colIndex)}
        className={`group/col-handle absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex items-center justify-center rounded-full border border-black/20 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 shadow-xs cursor-grab active:cursor-grabbing transition-all duration-150 ${
          isMenuOrDrag
            ? 'h-3 w-4 rounded-[3px] opacity-100'
            : isVisible
              ? 'h-1.5 w-3 hover:h-3 hover:w-4 hover:rounded-[3px] opacity-100'
              : 'h-1.5 w-3 hover:h-3 hover:w-4 hover:rounded-[3px] opacity-0 hover:opacity-100 focus-visible:opacity-100'
        }`}
      >
        <MoreHorizontal
          className={`w-2.5 h-2.5 transition-opacity duration-150 ${
            isMenuOrDrag ? 'opacity-100' : 'opacity-0 group-hover/col-handle:opacity-100'
          }`}
        />
      </button>
    );
  };

  const totalRows = 1 + rows.length;
  const headerCellFill = 'bg-black/[0.045] dark:bg-white/[0.04]';
  const selectedCellFill = 'bg-[#2383E2]/10 dark:bg-[#2383E2]/20';
  const gridBorderClass = 'border border-black/[0.16] dark:border-stone-700/70';

  return (
    <div
      ref={tableRef}
      onPaste={handlePaste}
      onCopy={handleContainerCopy}
      onCut={handleContainerCut}
      className="relative w-full my-2 group/table select-none"
    >
      {/* Floating top-right Options bar pinned outside horizontal scroll */}
      <div
        className={`absolute right-0 -top-7 z-30 flex items-center gap-1.5 transition-opacity duration-150 ${
          activeMenu?.type === 'options'
            ? 'opacity-100'
            : 'opacity-0 group-hover/table:opacity-100 focus-within:opacity-100'
        }`}
      >
        <button
          type="button"
          aria-label="Options"
          aria-haspopup="menu"
          aria-expanded={activeMenu?.type === 'options'}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() =>
            setActiveMenu((prev) =>
              prev?.type === 'options' ? null : { type: 'options' }
            )
          }
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-black/65 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-black/[0.06] dark:hover:bg-stone-800 transition-colors"
        >
          <SlidersHorizontal className="w-3 h-3" />
          <span>Options</span>
        </button>

        {activeMenu?.type === 'options' && (
          <div className="absolute right-0 top-full mt-1 z-50">
            <TableOptionsMenu
              hasHeaderRow={hasHeaderRow}
              hasHeaderColumn={hasHeaderColumn}
              fitToWidth={fitToWidth}
              onToggleHeaderRow={() =>
                onChange({ ...getNormalizedContent(), hasHeaderRow: !hasHeaderRow })
              }
              onToggleHeaderColumn={() =>
                onChange({ ...getNormalizedContent(), hasHeaderColumn: !hasHeaderColumn })
              }
              onToggleFitToWidth={() =>
                onChange({ ...getNormalizedContent(), fitToWidth: !fitToWidth })
              }
              onCopyTable={copyFullTable}
              onClearTable={() => {
                const base = getNormalizedContent();
                onChange({
                  ...base,
                  columns: base.columns.map(() => ''),
                  rows: base.rows.map((r) => r.map(() => '')),
                });
              }}
              onClose={() => setActiveMenu(null)}
            />
          </div>
        )}
      </div>

      {/* Horizontal scroll container */}
      <div className="w-full overflow-x-auto custom-scrollbar">
        <div
          onMouseLeave={() => {
            setHoveredRow(null);
            setHoveredCol(null);
          }}
          className={`relative inline-block pt-4 pl-4 pr-6 pb-6 ${
            fitToWidth ? 'min-w-full' : ''
          }`}
        >
          {/* Row 1: Table box + Right outside-edge + bar */}
          <div className="flex items-stretch">
            <div ref={tableBoxRef} className={`relative ${fitToWidth ? 'flex-1' : ''}`}>
              <table
                ref={tableElRef}
                className="border-collapse table-fixed text-sm"
                style={
                  fitToWidth
                    ? { width: '100%', minWidth: `${totalColWidth}px` }
                    : { width: `${totalColWidth}px` }
                }
              >
                <colgroup>
                  {columns.map((_, ci) => (
                    <col key={ci} style={{ width: `${activeColWidths[ci]}px` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr style={{ minHeight: `${DEFAULT_ROW_HEIGHT}px`, height: 'auto' }}>
                    {columns.map((col, ci) => {
                      const isHeaderStyled = hasHeaderRow || (hasHeaderColumn && ci === 0);
                      const isSelected = isCellInRange(-1, ci, selectedRange);
                      const boxShadow = computeSelectionBoxShadow(-1, ci, selectedRange);

                      return (
                        <th
                          key={ci}
                          ref={(el) => {
                            thRefs.current[ci] = el;
                          }}
                          data-row-index={-1}
                          data-col-index={ci}
                          style={{
                            width: `${activeColWidths[ci]}px`,
                            minHeight: `${DEFAULT_ROW_HEIGHT}px`,
                            height: 'auto',
                            ...(boxShadow ? { boxShadow } : {}),
                          }}
                          onMouseDown={(e) => handleCellMouseDown(e, -1, ci)}
                          onMouseEnter={() => handleCellMouseEnter(-1, ci)}
                          className={`table-header-cell p-0 align-top text-left relative ${gridBorderClass} transition-colors ${
                            isSelected
                              ? selectedCellFill
                              : isHeaderStyled
                                ? headerCellFill
                                : ''
                          }`}
                        >
                          {ci === 0 && renderRowPillHandle(-1)}
                          {renderColPillHandle(ci)}

                          <TableCell
                            value={col}
                            rowIndex={-1}
                            colIndex={ci}
                            isHeaderCell={isHeaderStyled}
                            onChange={(val) => updateCellValue(-1, ci, val)}
                            onNavigate={handleCellNavigate}
                            onEscapeToSelect={handleEscapeToSelect}
                            onFocusCell={(r, c) => {
                              focusedCellRef.current = { row: r, col: c };
                              anchorRef.current = { row: r, col: c };
                            }}
                            className="px-2.5 py-1.5 min-h-[1.75rem] leading-[1.45]"
                          />
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => {
                    const rowH = content.rowHeights?.[ri] ?? DEFAULT_ROW_HEIGHT;
                    return (
                      <tr
                        key={ri}
                        style={{ minHeight: `${rowH}px`, height: 'auto' }}
                      >
                        {row.map((cell, ci) => {
                          const isHeaderStyled = hasHeaderColumn && ci === 0;
                          const isSelected = isCellInRange(ri, ci, selectedRange);
                          const boxShadow = computeSelectionBoxShadow(ri, ci, selectedRange);

                          return (
                            <td
                              key={ci}
                              data-row-index={ri}
                              data-col-index={ci}
                              style={{
                                width: `${activeColWidths[ci]}px`,
                                minHeight: `${rowH}px`,
                                height: 'auto',
                                ...(boxShadow ? { boxShadow } : {}),
                              }}
                              onMouseDown={(e) => handleCellMouseDown(e, ri, ci)}
                              onMouseEnter={() => handleCellMouseEnter(ri, ci)}
                              className={`table-data-cell p-0 align-top relative ${gridBorderClass} transition-colors ${
                                isSelected
                                  ? selectedCellFill
                                  : isHeaderStyled
                                    ? headerCellFill
                                    : ''
                              }`}
                            >
                              {ci === 0 && renderRowPillHandle(ri)}

                              <TableCell
                                value={cell}
                                rowIndex={ri}
                                colIndex={ci}
                                isHeaderCell={isHeaderStyled}
                                onChange={(val) => updateCellValue(ri, ci, val)}
                                onNavigate={handleCellNavigate}
                                onEscapeToSelect={handleEscapeToSelect}
                                onFocusCell={(r, c) => {
                                  focusedCellRef.current = { row: r, col: c };
                                  anchorRef.current = { row: r, col: c };
                                }}
                                className="px-2.5 py-1.5 min-h-[1.75rem] leading-[1.45]"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Full-height blue hover column resize dividers */}
              {columns.map((col, ci) => {
                const edgePx =
                  fitToWidth && measuredColEdges[ci]
                    ? measuredColEdges[ci]
                    : cumulativeColEdges[ci];
                const isResizingThis = resizingCol?.index === ci;
                return (
                  <div
                    key={`col-resize-${ci}`}
                    aria-label={`Resize column ${col || ci + 1}`}
                    title="Drag to resize column (Double-click to reset)"
                    onMouseDown={(e) => handleColResizeStart(e, ci)}
                    onDoubleClick={() => resetColWidth(ci)}
                    style={{ left: `${edgePx - 3}px` }}
                    className="absolute top-0 bottom-0 w-1.5 cursor-col-resize z-20 group/col-resize flex justify-center"
                  >
                    <div
                      className={`w-[2px] h-full transition-colors ${
                        isResizingThis
                          ? 'bg-[#2383E2]'
                          : 'bg-transparent group-hover/col-resize:bg-[#2383E2]'
                      }`}
                    />
                  </div>
                );
              })}

              {/* Drag reorder drop indicator lines */}
              {dragRow && (
                <div
                  aria-hidden="true"
                  style={{ top: `${dragRow.lineTop}px` }}
                  className="pointer-events-none absolute left-0 right-0 h-[2px] bg-[#2383E2] z-30"
                />
              )}
              {dragCol && (
                <div
                  aria-hidden="true"
                  style={{ left: `${dragCol.lineLeft}px` }}
                  className="pointer-events-none absolute top-0 bottom-0 w-[2px] bg-[#2383E2] z-30"
                />
              )}
            </div>

            {/* Right outside-edge + bar (Add column) */}
            <button
              type="button"
              onClick={addColumn}
              aria-label="Add column"
              title="Add column"
              className={`w-4 ml-1 shrink-0 ${gridBorderClass} bg-black/[0.03] dark:bg-white/[0.03] hover:bg-black/[0.07] dark:hover:bg-white/[0.07] text-black/50 hover:text-black/80 dark:text-stone-500 dark:hover:text-stone-300 flex items-center justify-center opacity-0 hover:opacity-100 focus-visible:opacity-100 transition-all`}
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Row 2: Bottom outside-edge + bar (Add row) + Corner + (Add row & column) */}
          <div className="flex items-center mt-1">
            <button
              type="button"
              onClick={addRow}
              aria-label="Add row"
              title="Add row"
              className={`h-4 flex-1 min-w-0 ${gridBorderClass} bg-black/[0.03] dark:bg-white/[0.03] hover:bg-black/[0.07] dark:hover:bg-white/[0.07] text-black/50 hover:text-black/80 dark:text-stone-500 dark:hover:text-stone-300 flex items-center justify-center opacity-0 hover:opacity-100 focus-visible:opacity-100 transition-all`}
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={addRowAndColumn}
              aria-label="Add row and column"
              title="Add row and column"
              className={`w-4 h-4 ml-1 shrink-0 ${gridBorderClass} bg-black/[0.03] dark:bg-white/[0.03] hover:bg-black/[0.07] dark:hover:bg-white/[0.07] text-black/50 hover:text-black/80 dark:text-stone-500 dark:hover:text-stone-300 flex items-center justify-center opacity-0 hover:opacity-100 focus-visible:opacity-100 transition-all`}
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Row & Column contextual menus rendered outside overflow-x-auto to avoid clipping */}
      {activeMenu?.type === 'row' && (
        <div
          className="absolute z-50"
          style={{ top: `${activeMenu.top}px`, left: `${activeMenu.left}px` }}
        >
          <RowActionMenu
            rowIndex={activeMenu.index}
            canDelete={totalRows > 1}
            onInsertAbove={() =>
              onChange(insertRowAt(getNormalizedContent(), activeMenu.index, 'above'))
            }
            onInsertBelow={() =>
              onChange(insertRowAt(getNormalizedContent(), activeMenu.index, 'below'))
            }
            onDuplicate={() =>
              onChange(duplicateRowAt(getNormalizedContent(), activeMenu.index))
            }
            onClear={() =>
              onChange(clearRowAt(getNormalizedContent(), activeMenu.index))
            }
            onDelete={() => {
              const next = deleteRowAt(getNormalizedContent(), activeMenu.index);
              if (next) {
                setSelectedRange(null);
                onChange(next);
              }
            }}
            onClose={() => setActiveMenu(null)}
          />
        </div>
      )}

      {activeMenu?.type === 'col' && (
        <div
          className="absolute z-50"
          style={{ top: `${activeMenu.top}px`, left: `${activeMenu.left}px` }}
        >
          <ColumnActionMenu
            colIndex={activeMenu.index}
            canDelete={columns.length > 1}
            onInsertLeft={() =>
              onChange(insertColAt(getNormalizedContent(), activeMenu.index, 'left'))
            }
            onInsertRight={() =>
              onChange(insertColAt(getNormalizedContent(), activeMenu.index, 'right'))
            }
            onDuplicate={() =>
              onChange(duplicateColAt(getNormalizedContent(), activeMenu.index))
            }
            onSortAsc={() =>
              onChange(sortCol(getNormalizedContent(), activeMenu.index, 'asc'))
            }
            onSortDesc={() =>
              onChange(sortCol(getNormalizedContent(), activeMenu.index, 'desc'))
            }
            onClear={() =>
              onChange(clearColAt(getNormalizedContent(), activeMenu.index))
            }
            onDelete={() => {
              const next = deleteColAt(getNormalizedContent(), activeMenu.index);
              if (next) {
                setSelectedRange(null);
                onChange(next);
              }
            }}
            onClose={() => setActiveMenu(null)}
          />
        </div>
      )}

      {(copied || pasted) && (
        <div className="flex justify-end mt-1 px-1">
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            {copied ? 'Copied!' : 'Table pasted from clipboard'}
          </span>
        </div>
      )}
    </div>
  );
};
