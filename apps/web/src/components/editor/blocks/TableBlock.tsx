import React, { useRef, useState, useEffect } from 'react';
import { TableBlockContent } from '@notebook/shared';
import { Plus, Trash2, Table } from 'lucide-react';
import { parseClipboardTableData } from '../utils/clipboardTableParser';

interface TableBlockProps {
  content: TableBlockContent;
  onChange: (updated: TableBlockContent) => void;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const escapeTsvCell = (val: string) => {
  if (val.includes('\t') || val.includes('\n') || val.includes('\r') || val.includes('"')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
};

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

interface EditableCellProps {
  value: string;
  placeholder?: string;
  onChange: (val: string) => void;
  onEnterDown?: () => void;
  isHeader?: boolean;
  className?: string;
}

const EditableCell: React.FC<EditableCellProps> = ({
  value,
  placeholder,
  onChange,
  onEnterDown,
  isHeader,
  className,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  // Keep DOM text in sync with external value updates when not focused
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      if (ref.current.textContent !== value) {
        ref.current.textContent = value;
      }
    }
  }, [value]);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={(e) => {
        // If content is cleared, reset innerHTML so :empty pseudo-class matches
        if (!e.currentTarget.textContent) {
          e.currentTarget.innerHTML = '';
        }
      }}
      onBlur={(e) => {
        const text = e.currentTarget.innerText !== undefined ? e.currentTarget.innerText : (e.currentTarget.textContent || '');
        if (text !== value) {
          onChange(text);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.shiftKey) {
          if (isHeader) {
            e.preventDefault();
          }
          return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const text = e.currentTarget.innerText !== undefined ? e.currentTarget.innerText : (e.currentTarget.textContent || '');
          if (text !== value) {
            onChange(text);
          }
          onEnterDown?.();
        }
      }}
      className={className}
      dangerouslySetInnerHTML={{ __html: escapeHtml(value) }}
    />
  );
};

export const TableBlock: React.FC<TableBlockProps> = ({ content, onChange }) => {
  const tableRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState(false);

  interface CellCoord {
    row: number; // -1 for header, 0..rows.length - 1 for body
    col: number; // 0..columns.length - 1
  }

  const [selectedRange, setSelectedRange] = useState<{
    start: CellCoord;
    end: CellCoord;
  } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const dragStartRef = useRef<CellCoord | null>(null);
  const pendingFocusRef = useRef<{ row: number; col: number } | null>(null);

  const focusCell = (r: number, c: number) => {
    const selector = r === -1
      ? `th[data-col-index="${c}"] [contenteditable]`
      : `td[data-row-index="${r}"][data-col-index="${c}"] [contenteditable]`;
    const cellEl = tableRef.current?.querySelector(selector) as HTMLElement | null;
    if (cellEl) {
      cellEl.focus();
      try {
        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(cellEl);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } catch {
        // Selection API may not be fully supported in headless test environments
      }
    }
  };

  const columns = content?.columns?.length ? content.columns : ['Column 1', 'Column 2'];
  const rows = content?.rows?.length ? content.rows : [['', '']];

  // Column width & row height resizing state
  const [resizingCol, setResizingCol] = useState<{
    index: number;
    startX: number;
    startWidth: number;
    currentWidth: number;
  } | null>(null);

  const [resizingRow, setResizingRow] = useState<{
    index: number;
    startY: number;
    startHeight: number;
    currentHeight: number;
  } | null>(null);

  const activeColWidths = columns.map((_, i) => {
    if (resizingCol && resizingCol.index === i) {
      return resizingCol.currentWidth;
    }
    return content.columnWidths?.[i] ?? 150;
  });

  const activeRowHeights = rows.map((_, i) => {
    if (resizingRow && resizingRow.index === i) {
      return resizingRow.currentHeight;
    }
    return content.rowHeights?.[i] ?? 36;
  });

  const handleColResizeStart = (e: React.MouseEvent, ci: number) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = content.columnWidths?.[ci] ?? 150;

    setResizingCol({
      index: ci,
      startX,
      startWidth,
      currentWidth: startWidth,
    });

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(70, Math.min(800, startWidth + deltaX));
      setResizingCol({
        index: ci,
        startX,
        startWidth,
        currentWidth: newWidth,
      });
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      const deltaX = upEvent.clientX - startX;
      const finalWidth = Math.max(70, Math.min(800, startWidth + deltaX));

      const updatedWidths = columns.map((_, i) =>
        i === ci ? finalWidth : (content.columnWidths?.[i] ?? 150)
      );

      setResizingCol(null);
      onChange({
        ...content,
        columnWidths: updatedWidths,
      });
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const resetColWidth = (ci: number) => {
    const updatedWidths = columns.map((_, i) =>
      i === ci ? 150 : (content.columnWidths?.[i] ?? 150)
    );
    onChange({
      ...content,
      columnWidths: updatedWidths,
    });
  };

  const handleRowResizeStart = (e: React.MouseEvent, ri: number) => {
    e.preventDefault();
    e.stopPropagation();

    const startY = e.clientY;
    const startHeight = content.rowHeights?.[ri] ?? 36;

    setResizingRow({
      index: ri,
      startY,
      startHeight,
      currentHeight: startHeight,
    });

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const deltaY = moveEvent.clientY - startY;
      const newHeight = Math.max(32, Math.min(400, startHeight + deltaY));
      setResizingRow({
        index: ri,
        startY,
        startHeight,
        currentHeight: newHeight,
      });
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      const deltaY = upEvent.clientY - startY;
      const finalHeight = Math.max(32, Math.min(400, startHeight + deltaY));

      const updatedHeights = rows.map((_, i) =>
        i === ri ? finalHeight : (content.rowHeights?.[i] ?? 36)
      );

      setResizingRow(null);
      onChange({
        ...content,
        rowHeights: updatedHeights,
      });
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const resetRowHeight = (ri: number) => {
    const updatedHeights = rows.map((_, i) =>
      i === ri ? 36 : (content.rowHeights?.[i] ?? 36)
    );
    onChange({
      ...content,
      rowHeights: updatedHeights,
    });
  };

  const isCellSelected = (r: number, c: number): boolean => {
    if (!selectedRange) return false;
    const minR = Math.min(selectedRange.start.row, selectedRange.end.row);
    const maxR = Math.max(selectedRange.start.row, selectedRange.end.row);
    const minC = Math.min(selectedRange.start.col, selectedRange.end.col);
    const maxC = Math.max(selectedRange.start.col, selectedRange.end.col);
    return r >= minR && r <= maxR && c >= minC && c <= maxC;
  };

  const handleCellMouseDown = (e: React.MouseEvent, r: number, c: number) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;
    if ((e.target as HTMLElement).closest('.cursor-col-resize')) return;
    if ((e.target as HTMLElement).closest('.cursor-row-resize')) return;

    dragStartRef.current = { row: r, col: c };
    setIsSelecting(true);

    if (e.shiftKey && selectedRange) {
      setSelectedRange({
        start: selectedRange.start,
        end: { row: r, col: c }
      });
      return;
    }

    if (!e.shiftKey) {
      setSelectedRange(null);
    }
  };

  const handleCellMouseEnter = (r: number, c: number) => {
    if (!isSelecting || !dragStartRef.current) return;
    const start = dragStartRef.current;
    if (start.row !== r || start.col !== c) {
      window.getSelection()?.removeAllRanges();
      setSelectedRange({
        start,
        end: { row: r, col: c }
      });
    }
  };

  const selectWholeTable = () => {
    setSelectedRange({
      start: { row: -1, col: 0 },
      end: { row: rows.length - 1, col: columns.length - 1 }
    });
  };

  useEffect(() => {
    const handleWindowMouseUp = () => {
      setIsSelecting(false);
      dragStartRef.current = null;
    };

    const handleWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedRange(null);
        return;
      }

      // Select whole table with Ctrl+A / Cmd+A when inside table
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        const activeEl = document.activeElement;
        const isEditingCell = activeEl && activeEl.getAttribute('contenteditable') === 'true';
        const isInsideTable = tableRef.current && tableRef.current.contains(activeEl);

        if (selectedRange || isInsideTable) {
          const selection = window.getSelection();
          // If editing a cell and text is not yet fully selected, let native Ctrl+A select the text first.
          // If already selected or if user presses it again, select the entire table!
          if (!isEditingCell || (selection && selection.toString() === activeEl.textContent)) {
            e.preventDefault();
            selectWholeTable();
            return;
          }
        }
      }

      // Copy selected range with Ctrl+C / Cmd+C
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        if (selectedRange) {
          const minR = Math.min(selectedRange.start.row, selectedRange.end.row);
          const maxR = Math.max(selectedRange.start.row, selectedRange.end.row);
          const minC = Math.min(selectedRange.start.col, selectedRange.end.col);
          const maxC = Math.max(selectedRange.start.col, selectedRange.end.col);

          const tsvLines: string[] = [];
          for (let r = minR; r <= maxR; r++) {
            const rowVals: string[] = [];
            for (let c = minC; c <= maxC; c++) {
              const val = r === -1 ? (columns[c] || '') : (rows[r]?.[c] || '');
              rowVals.push(escapeTsvCell(val));
            }
            tsvLines.push(rowVals.join('\t'));
          }
          const text = tsvLines.join('\n');
          if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text);
          }
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }

      // Clear selected cells with Backspace or Delete
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedRange) {
          const activeEl = document.activeElement;
          const isEditingCell = activeEl && activeEl.getAttribute('contenteditable') === 'true';
          if (!isEditingCell) {
            e.preventDefault();
            const minR = Math.min(selectedRange.start.row, selectedRange.end.row);
            const maxR = Math.max(selectedRange.start.row, selectedRange.end.row);
            const minC = Math.min(selectedRange.start.col, selectedRange.end.col);
            const maxC = Math.max(selectedRange.start.col, selectedRange.end.col);

            const newRows = rows.map((row, ri) => {
              if (ri >= minR && ri <= maxR) {
                return row.map((cell, ci) => (ci >= minC && ci <= maxC ? '' : cell));
              }
              return row;
            });
            onChange({ ...content, columns, rows: newRows });
          }
        }
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
        setSelectedRange(null);
      }
    };

    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('keydown', handleWindowKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('keydown', handleWindowKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedRange, columns, rows, onChange, content]);

  useEffect(() => {
    if (pendingFocusRef.current) {
      const { row, col } = pendingFocusRef.current;
      pendingFocusRef.current = null;
      focusCell(row, col);
    }
  }, [rows]);

  const handleEnterOnHeader = (ci: number) => {
    if (rows.length > 0) {
      focusCell(0, ci);
    } else {
      const newRow = new Array(columns.length).fill('');
      pendingFocusRef.current = { row: 0, col: ci };
      onChange({ ...content, columns, rows: [newRow] });
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => focusCell(0, ci));
      } else {
        setTimeout(() => focusCell(0, ci), 0);
      }
    }
  };

  const handleEnterOnCell = (ri: number, ci: number) => {
    if (ri < rows.length - 1) {
      focusCell(ri + 1, ci);
    } else {
      const newRow = new Array(columns.length).fill('');
      const newRowHeights = content.rowHeights ? [...content.rowHeights, 36] : undefined;

      const currentCellEl = tableRef.current?.querySelector(
        `td[data-row-index="${ri}"][data-col-index="${ci}"] [contenteditable]`
      ) as HTMLElement | null;
      const currentText = currentCellEl
        ? (currentCellEl.innerText !== undefined ? currentCellEl.innerText : (currentCellEl.textContent || ''))
        : rows[ri][ci];

      const updatedRows = rows.map((r, rIdx) =>
        rIdx === ri ? r.map((c, cIdx) => (cIdx === ci ? currentText : c)) : r
      );
      const newRows = [...updatedRows, newRow];

      pendingFocusRef.current = { row: ri + 1, col: ci };
      onChange({
        ...content,
        columns,
        rows: newRows,
        rowHeights: newRowHeights,
      });
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => focusCell(ri + 1, ci));
      } else {
        setTimeout(() => focusCell(ri + 1, ci), 0);
      }
    }
  };

  const updateColumnName = (colIndex: number, name: string) => {
    const newCols = [...columns];
    newCols[colIndex] = name;
    onChange({ ...content, columns: newCols, rows });
  };

  const updateCell = (rowIndex: number, colIndex: number, val: string) => {
    const newRows = rows.map((r, ri) =>
      ri === rowIndex ? r.map((c, ci) => (ci === colIndex ? val : c)) : r
    );
    onChange({ ...content, columns, rows: newRows });
  };

  const addColumn = () => {
    const newCols = [...columns, `Column ${columns.length + 1}`];
    const newRows = rows.map(r => [...r, '']);
    const newColWidths = content.columnWidths ? [...content.columnWidths, 150] : undefined;
    onChange({ ...content, columns: newCols, rows: newRows, columnWidths: newColWidths });
  };

  const addRow = () => {
    const newRow = new Array(columns.length).fill('');
    const newRowHeights = content.rowHeights ? [...content.rowHeights, 36] : undefined;
    onChange({ ...content, columns, rows: [...rows, newRow], rowHeights: newRowHeights });
  };

  const deleteRow = (rowIndex: number) => {
    if (rows.length <= 1) return;
    const newRows = rows.filter((_, ri) => ri !== rowIndex);
    const newRowHeights = content.rowHeights ? content.rowHeights.filter((_, ri) => ri !== rowIndex) : undefined;
    onChange({ ...content, columns, rows: newRows, rowHeights: newRowHeights });
  };

  const deleteColumn = (colIndex: number) => {
    if (columns.length <= 1) return;
    const newCols = columns.filter((_, ci) => ci !== colIndex);
    const newRows = rows.map(r => r.filter((_, ci) => ci !== colIndex));
    const newColWidths = content.columnWidths ? content.columnWidths.filter((_, ci) => ci !== colIndex) : undefined;
    onChange({ ...content, columns: newCols, rows: newRows, columnWidths: newColWidths });
  };

  const copyTableToClipboard = async () => {
    const tsv = [
      columns.map(escapeTsvCell).join('\t'),
      ...rows.map(r => r.map(escapeTsvCell).join('\t'))
    ].join('\n');
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(tsv);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = tsv;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy table: ', err);
    }
  };

  const handleContainerCopy = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (selectedRange) {
      e.preventDefault();
      const minR = Math.min(selectedRange.start.row, selectedRange.end.row);
      const maxR = Math.max(selectedRange.start.row, selectedRange.end.row);
      const minC = Math.min(selectedRange.start.col, selectedRange.end.col);
      const maxC = Math.max(selectedRange.start.col, selectedRange.end.col);

      const tsvLines: string[] = [];
      for (let r = minR; r <= maxR; r++) {
        const rowVals: string[] = [];
        for (let c = minC; c <= maxC; c++) {
          const val = r === -1 ? (columns[c] || '') : (rows[r]?.[c] || '');
          rowVals.push(escapeTsvCell(val));
        }
        tsvLines.push(rowVals.join('\t'));
      }
      e.clipboardData.setData('text/plain', tsvLines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }

    const activeEl = document.activeElement;
    const isFocusedInCell = !!(
      activeEl &&
      (activeEl.getAttribute('contenteditable') === 'true' ||
        activeEl.closest('[contenteditable="true"]') !== null ||
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA')
    );

    const selection = window.getSelection();

    // If focus is inside an active cell or input, do NOT hijack copy unless multiple cells are selected
    if (isFocusedInCell) {
      if (!selection || selection.isCollapsed || !tableRef.current || selection.rangeCount === 0) {
        // Native copy handles collapsed cursor or single-cell selection
        return;
      }
      const range = selection.getRangeAt(0);
      const allCells = Array.from(tableRef.current.querySelectorAll('th, td'));
      const selectedCells = allCells.filter(cell => range.intersectsNode(cell));
      if (selectedCells.length <= 1) {
        // Native copy handles selection inside a single cell
        return;
      }
      // Spans multiple cells: fall through to format as TSV
    } else {
      // Focus is outside editable cells (e.g. table container selected or no active cell focus)
      if (!selection || selection.isCollapsed) {
        // Nothing selected, copy whole table as TSV
        e.preventDefault();
        const tsv = [
          columns.map(escapeTsvCell).join('\t'),
          ...rows.map(r => r.map(escapeTsvCell).join('\t'))
        ].join('\n');
        e.clipboardData.setData('text/plain', tsv);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }
    }

    // If selection spans multiple table cells, format them as TSV
    if (tableRef.current && selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const allCells = Array.from(tableRef.current.querySelectorAll('th, td'));
      const selectedCells = allCells.filter(cell => range.intersectsNode(cell));
      if (selectedCells.length > 1) {
        e.preventDefault();
        const trElements = Array.from(tableRef.current.querySelectorAll('tbody tr'));
        const tsvRows: string[] = [];

        // Check if headers are included
        const thElements = Array.from(tableRef.current.querySelectorAll('thead th.table-header-cell'));
        const selectedHeaders = thElements.filter(th => range.intersectsNode(th));
        if (selectedHeaders.length > 0) {
          const headerVals = selectedHeaders.map(th => {
            const editable = th.querySelector('[contenteditable]');
            const raw = editable ? (editable.textContent || '') : (th.textContent || '');
            return escapeTsvCell(raw);
          });
          tsvRows.push(headerVals.join('\t'));
        }

        for (const tr of trElements) {
          const rowTd = Array.from(tr.querySelectorAll('td.table-data-cell'));
          const selectedRowTd = rowTd.filter(td => range.intersectsNode(td));
          if (selectedRowTd.length > 0) {
            const vals = selectedRowTd.map(td => {
              const editable = td.querySelector('[contenteditable]');
              const raw = editable ? (editable.textContent || '') : (td.textContent || '');
              return escapeTsvCell(raw);
            });
            tsvRows.push(vals.join('\t'));
          }
        }

        const resultTsv = tsvRows.length > 0
          ? tsvRows.join('\n')
          : [
              columns.map(escapeTsvCell).join('\t'),
              ...rows.map(r => r.map(escapeTsvCell).join('\t'))
            ].join('\n');
        e.clipboardData.setData('text/plain', resultTsv);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData.getData('text/plain');
    const html = e.clipboardData.getData('text/html');
    if (!text && !html) return;

    const activeEl = document.activeElement;
    const targetEl = e.target as HTMLElement | null;
    const isCellFocused = !!(
      (activeEl && (activeEl.getAttribute('contenteditable') === 'true' || activeEl.closest('[contenteditable="true"]'))) ||
      (targetEl && (targetEl.getAttribute('contenteditable') === 'true' || targetEl.closest('[contenteditable="true"]')))
    );
    const isHtmlTable = !!(html && (html.includes('<table') || html.includes('<tr')));

    if (isCellFocused && !text.includes('\t') && !isHtmlTable) {
      // Allow native multiline paste directly into the focused cell without whole-table replacement
      return;
    }

    const targetTd = targetEl?.closest ? targetEl.closest('td') : null;
    const targetTh = targetEl?.closest ? targetEl.closest('th') : null;

    const startRow = targetTd ? Number(targetTd.getAttribute('data-row-index') ?? 0) : -1;
    const startCol = targetTd
      ? Number(targetTd.getAttribute('data-col-index') ?? 0)
      : (targetTh ? Number(targetTh.getAttribute('data-col-index') ?? 0) : 0);

    const tableData = parseClipboardTableData(text, html);
    if (tableData && tableData.rawGrid.length > 0) {
      e.preventDefault();
      const pasteGrid = tableData.rawGrid;
      const pasteRowCount = pasteGrid.length;
      const pasteColCount = pasteGrid[0].length;

      if (startRow === -1) {
        // Pasted into header
        const reqCols = Math.max(columns.length, startCol + pasteColCount);
        const reqRows = Math.max(rows.length, pasteRowCount - 1);

        const newCols = [...columns];
        while (newCols.length < reqCols) {
          newCols.push(`Column ${newCols.length + 1}`);
        }
        for (let c = 0; c < pasteColCount; c++) {
          newCols[startCol + c] = pasteGrid[0][c] || newCols[startCol + c];
        }

        const newRows = rows.map(r => {
          const rowCopy = [...r];
          while (rowCopy.length < reqCols) rowCopy.push('');
          return rowCopy;
        });
        while (newRows.length < reqRows) {
          newRows.push(new Array(reqCols).fill(''));
        }

        for (let r = 1; r < pasteRowCount; r++) {
          for (let c = 0; c < pasteColCount; c++) {
            newRows[r - 1][startCol + c] = pasteGrid[r][c];
          }
        }

        onChange({ ...content, columns: newCols, rows: newRows });
      } else {
        // Pasted into regular body cell
        const actualStartRow = Math.max(0, startRow);
        const actualStartCol = Math.max(0, startCol);

        const reqCols = Math.max(columns.length, actualStartCol + pasteColCount);
        const reqRows = Math.max(rows.length, actualStartRow + pasteRowCount);

        const newCols = [...columns];
        while (newCols.length < reqCols) {
          newCols.push(`Column ${newCols.length + 1}`);
        }

        const newRows = rows.map(r => {
          const rowCopy = [...r];
          while (rowCopy.length < reqCols) rowCopy.push('');
          return rowCopy;
        });
        while (newRows.length < reqRows) {
          newRows.push(new Array(reqCols).fill(''));
        }

        for (let r = 0; r < pasteRowCount; r++) {
          for (let c = 0; c < pasteColCount; c++) {
            newRows[actualStartRow + r][actualStartCol + c] = pasteGrid[r][c];
          }
        }

        onChange({ ...content, columns: newCols, rows: newRows });
      }

      setPasted(true);
      setTimeout(() => setPasted(false), 2000);
      return;
    }

    // Split lines, ignoring trailing empty newline
    const rawLines = text.split(/\r?\n/).filter((line, idx, arr) => {
      if (idx === arr.length - 1 && line.trim() === '') return false;
      return true;
    });

    // 1. Single-line text should NEVER trigger whole-table replacement; pass through to native cell paste
    if (rawLines.length <= 1) {
      return;
    }

    const hasTabs = rawLines.some(l => l.includes('\t'));
    const hasCommas = rawLines.some(l => l.includes(','));

    let parsedRows: string[][] = [];
    if (hasTabs) {
      parsedRows = rawLines.map(l => l.split('\t'));
    } else if (hasCommas) {
      // 2. Comma-separated CSV parsing only if multiple lines (rawLines.length >= 2) with consistent columns (>= 2 columns)
      const csvRows = rawLines.map(l => parseCsvLine(l));
      const firstColCount = csvRows[0].length;
      if (firstColCount >= 2 && csvRows.every(r => r.length === firstColCount)) {
        parsedRows = csvRows;
      } else {
        // Inconsistent columns with commas, treat each line as a single row
        parsedRows = rawLines.map(l => [l]);
      }
    } else {
      // Multiple lines without tabs or commas: treat each line as a row
      parsedRows = rawLines.map(l => [l]);
    }

    const maxCols = parsedRows.length > 0 ? Math.max(...parsedRows.map(r => r.length)) : 0;
    const numRows = parsedRows.length;

    // If there are >= 2 rows, parse as table replacement
    if (numRows >= 2) {
      e.preventDefault();

      // Pad rows so all rows have maxCols
      const normalizedRows = parsedRows.map(r => {
        const row = [...r];
        while (row.length < maxCols) row.push('');
        return row;
      });

      const newColumns = normalizedRows[0].map((c, i) => c.trim() || `Column ${i + 1}`);
      const newRows = normalizedRows.slice(1);

      onChange({ ...content, columns: newColumns, rows: newRows });
      setPasted(true);
      setTimeout(() => setPasted(false), 2000);
    }
  };

  return (
    <div
      ref={tableRef}
      onPaste={handlePaste}
      onCopy={handleContainerCopy}
      className="w-full my-2.5 group/table select-text"
    >
      <div className="w-full overflow-x-auto custom-scrollbar rounded-xl border border-stone-200/80 dark:border-stone-800/80 bg-white/40 dark:bg-stone-900/30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <table
          className="border-collapse text-sm select-text table-fixed"
          style={{
            width: `${activeColWidths.reduce((a, b) => a + b, 0) + 40}px`,
          }}
        >
          <colgroup>
            {columns.map((_, ci) => (
              <col key={ci} style={{ width: `${activeColWidths[ci]}px` }} />
            ))}
            <col style={{ width: '40px' }} />
          </colgroup>
          <thead>
            <tr className="border-b border-stone-200/80 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-900/40">
              {columns.map((col, ci) => {
                const isSelected = isCellSelected(-1, ci);
                const isResizingThis = resizingCol?.index === ci;
                return (
                  <th
                    key={ci}
                    data-col-index={ci}
                    style={{ width: `${activeColWidths[ci]}px` }}
                    onMouseDown={(e) => handleCellMouseDown(e, -1, ci)}
                    onMouseEnter={() => handleCellMouseEnter(-1, ci)}
                    className={`table-header-cell p-1.5 text-left font-semibold text-xs text-stone-600 dark:text-stone-300 border-r border-stone-200/60 dark:border-stone-800/60 last:border-r-0 relative group/th select-none transition-colors ${
                      isSelected
                        ? 'bg-blue-500/15 dark:bg-blue-400/20 ring-1 ring-blue-500/40 dark:ring-blue-400/40 ring-inset'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 pr-1.5">
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        {ci === 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectWholeTable();
                            }}
                            title="Select whole table"
                            aria-label="Select whole table"
                            className="opacity-0 group-hover/table:opacity-100 group-hover/th:opacity-100 p-0.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded hover:bg-stone-500/10 dark:hover:bg-white/10 transition leading-none shrink-0"
                          >
                            <Table className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <EditableCell
                          value={col}
                          placeholder="Column name"
                          isHeader
                          onChange={(val) => updateColumnName(ci, val)}
                          onEnterDown={() => handleEnterOnHeader(ci)}
                          className="w-full font-semibold outline-none text-stone-700 dark:text-stone-200 text-xs px-1.5 py-0.5 rounded hover:bg-stone-500/10 dark:hover:bg-white/10 focus:bg-white/80 dark:focus:bg-stone-800/80 focus:ring-1 focus:ring-stone-400 dark:focus:ring-stone-600 transition-colors select-text cursor-text empty:before:content-[attr(data-placeholder)] empty:before:text-stone-400 dark:empty:before:text-stone-500 empty:before:pointer-events-none empty:before:select-none truncate"
                        />
                      </div>
                      {columns.length > 1 && (
                        <button
                          type="button"
                          onClick={() => deleteColumn(ci)}
                          title="Delete column"
                          aria-label={`Delete column ${col || ci + 1}`}
                          className="opacity-0 group-hover/th:opacity-100 text-stone-400 hover:text-red-500 dark:hover:text-red-400 p-0.5 rounded hover:bg-stone-500/10 dark:hover:bg-white/10 text-xs transition leading-none shrink-0"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    {/* Column resize handle */}
                    <div
                      onMouseDown={(e) => handleColResizeStart(e, ci)}
                      onDoubleClick={() => resetColWidth(ci)}
                      title="Drag to resize column (Double-click to reset)"
                      aria-label={`Resize column ${col || ci + 1}`}
                      className={`absolute top-0 right-0 bottom-0 w-2 cursor-col-resize flex items-center justify-center group/resize z-20 transition-colors ${
                        isResizingThis ? 'bg-amber-500/25 dark:bg-amber-400/25' : 'hover:bg-amber-500/20 dark:hover:bg-amber-400/20'
                      }`}
                    >
                      <div
                        className={`w-[2px] transition-all rounded-full ${
                          isResizingThis
                            ? 'h-full bg-amber-500 dark:bg-amber-400'
                            : 'h-3.5 bg-stone-300/80 dark:bg-stone-700/80 group-hover/resize:bg-amber-500 dark:group-hover/resize:bg-amber-400'
                        }`}
                      />
                    </div>
                  </th>
                );
              })}
              <th className="w-10 p-1 border-stone-200/80 dark:border-stone-800 text-center">
                <button
                  type="button"
                  onClick={addColumn}
                  title="Add column"
                  aria-label="Add column"
                  className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-500/10 dark:hover:bg-white/10 transition"
                >
                  <Plus className="w-3.5 h-3.5 mx-auto" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const rowH = activeRowHeights[ri];
              const isResizingThisRow = resizingRow?.index === ri;
              return (
                <tr
                  key={ri}
                  style={{ minHeight: `${rowH}px`, height: 'auto' }}
                  className="border-b border-stone-200/50 dark:border-stone-800/50 last:border-b-0 hover:bg-stone-500/5 dark:hover:bg-white/5 transition-colors group/tr relative"
                >
                  {row.map((cell, ci) => {
                    const isSelected = isCellSelected(ri, ci);
                    return (
                      <td
                        key={ci}
                        data-row-index={ri}
                        data-col-index={ci}
                        style={{ width: `${activeColWidths[ci]}px`, minHeight: `${rowH}px`, height: 'auto' }}
                        onMouseDown={(e) => handleCellMouseDown(e, ri, ci)}
                        onMouseEnter={() => handleCellMouseEnter(ri, ci)}
                        className={`table-data-cell p-0 border-r border-stone-200/50 dark:border-stone-800/50 last:border-r-0 align-top transition-colors relative group/td ${
                          isSelected
                            ? 'bg-blue-500/15 dark:bg-blue-400/20 ring-1 ring-blue-500/40 dark:ring-blue-400/40 ring-inset'
                            : ''
                        }`}
                      >
                        <EditableCell
                          value={cell}
                          placeholder="Empty"
                          onChange={(val) => updateCell(ri, ci, val)}
                          onEnterDown={() => handleEnterOnCell(ri, ci)}
                          className="w-full px-2.5 py-1.5 text-sm text-stone-800 dark:text-stone-100 outline-none focus:bg-white/80 dark:focus:bg-stone-800/80 focus:ring-1 focus:ring-stone-400 dark:focus:ring-stone-600 transition-colors select-text cursor-text empty:before:content-[attr(data-placeholder)] empty:before:text-stone-400 dark:empty:before:text-stone-600 empty:before:pointer-events-none empty:before:select-none whitespace-pre-wrap break-words min-h-[1.75rem]"
                        />

                        {/* Row resize handle at bottom of cell */}
                        <div
                          onMouseDown={(e) => handleRowResizeStart(e, ri)}
                          onDoubleClick={() => resetRowHeight(ri)}
                          title="Drag to resize row (Double-click to reset)"
                          aria-label={`Resize row ${ri + 1}`}
                          className={`absolute bottom-0 left-0 right-0 h-1.5 cursor-row-resize z-10 group/row-resize transition-colors ${
                            isResizingThisRow ? 'bg-amber-500/25 dark:bg-amber-400/25' : 'hover:bg-amber-500/20 dark:hover:bg-amber-400/20'
                          }`}
                        >
                          <div
                            className={`h-[1.5px] w-full transition-colors ${
                              isResizingThisRow
                                ? 'bg-amber-500 dark:bg-amber-400'
                                : 'bg-transparent group-hover/row-resize:bg-amber-500/70 dark:group-hover/row-resize:bg-amber-400/70'
                            }`}
                          />
                        </div>
                      </td>
                    );
                  })}
                  <td
                    style={{ minHeight: `${rowH}px`, height: 'auto' }}
                    className="w-10 p-1 text-center align-middle relative"
                  >
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => deleteRow(ri)}
                        title="Delete row"
                        aria-label={`Delete row ${ri + 1}`}
                        className="opacity-0 group-hover/tr:opacity-100 p-1 rounded text-stone-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-stone-500/10 dark:hover:bg-white/10 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5 mx-auto" />
                      </button>
                    )}
                    <div
                      onMouseDown={(e) => handleRowResizeStart(e, ri)}
                      onDoubleClick={() => resetRowHeight(ri)}
                      title="Drag to resize row (Double-click to reset)"
                      aria-label={`Resize row ${ri + 1}`}
                      className={`absolute bottom-0 left-0 right-0 h-1.5 cursor-row-resize z-10 transition-colors ${
                        isResizingThisRow ? 'bg-amber-500/25 dark:bg-amber-400/25' : 'hover:bg-amber-500/20 dark:hover:bg-amber-400/20'
                      }`}
                    />
                  </td>
                </tr>
              );
            })}
            {/* Notion style inline + New row */}
            <tr
              onClick={addRow}
              className="border-t border-stone-200/50 dark:border-stone-800/50 hover:bg-stone-500/5 dark:hover:bg-white/5 transition-colors cursor-pointer group/new-row"
            >
              <td
                colSpan={columns.length + 1}
                className="p-0 select-none cursor-pointer"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    addRow();
                  }}
                  aria-label="Add row"
                  className="w-full text-left px-3 py-2 text-xs text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200 flex items-center gap-1.5 font-medium transition-colors cursor-pointer bg-transparent border-none"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Screen-reader / test accessible button */}
      <button
        type="button"
        onClick={copyTableToClipboard}
        aria-label="Copy table"
        className="sr-only"
      >
        Copy table
      </button>

      {/* Subtle feedback indicator */}
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
