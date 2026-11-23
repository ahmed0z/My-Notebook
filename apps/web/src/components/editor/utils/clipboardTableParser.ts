export interface ParsedTableData {
  isTable: boolean;
  columns: string[];
  rows: string[][];
  rawGrid: string[][];
}

/**
 * Parses TSV string following RFC 4180 principles:
 * - Cells enclosed in double quotes can contain newlines (\n, \r\n) and delimiters (\t).
 * - Inside double quotes, a pair of double quotes ("") represents a single escaped quote.
 */
export function parseRfcTsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  let cellWasQuoted = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          // Escaped quote
          currentCell += '"';
          i += 2;
        } else {
          // Closing quote
          inQuotes = false;
          i++;
        }
      } else {
        currentCell += ch;
        i++;
      }
    } else {
      if (ch === '"' && currentCell.trim() === '') {
        // Double-quoted cell starts
        inQuotes = true;
        cellWasQuoted = true;
        currentCell = '';
        i++;
      } else if (ch === '\t') {
        currentRow.push(cellWasQuoted ? currentCell : currentCell.trim());
        currentCell = '';
        cellWasQuoted = false;
        i++;
      } else if (ch === '\r') {
        if (i + 1 < text.length && text[i + 1] === '\n') {
          i++;
        }
        currentRow.push(cellWasQuoted ? currentCell : currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        cellWasQuoted = false;
        i++;
      } else if (ch === '\n') {
        currentRow.push(cellWasQuoted ? currentCell : currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        cellWasQuoted = false;
        i++;
      } else {
        if (!(cellWasQuoted && (ch === ' ' || ch === '\t'))) {
          currentCell += ch;
        }
        i++;
      }
    }
  }

  // Push final cell and row if anything accumulated
  if (currentCell.length > 0 || cellWasQuoted || currentRow.length > 0) {
    currentRow.push(cellWasQuoted ? currentCell : currentCell.trim());
    rows.push(currentRow);
  }

  // Remove trailing blank rows if any
  while (rows.length > 0) {
    const lastRow = rows[rows.length - 1];
    if (lastRow.every(c => c.trim() === '')) {
      rows.pop();
    } else {
      break;
    }
  }

  return rows;
}

export function parseClipboardTableData(textPlain: string, textHtml?: string): ParsedTableData | null {
  // 1. Try parsing textPlain as TSV
  if (textPlain && textPlain.trim().length > 0) {
    const parsedRows = parseRfcTsv(textPlain);

    // Must have at least 2 rows and at least one tab to be considered a table from clipboard
    if (parsedRows.length >= 2 && textPlain.includes('\t')) {
      let maxCols = 0;
      for (const row of parsedRows) {
        if (row.length > maxCols) maxCols = row.length;
      }

      if (maxCols >= 2) {
        const paddedRows = parsedRows.map(row => {
          const padded = [...row];
          while (padded.length < maxCols) {
            padded.push('');
          }
          return padded;
        });

        return {
          isTable: true,
          columns: paddedRows[0].map((col, idx) => col || `Column ${idx + 1}`),
          rows: paddedRows.slice(1),
          rawGrid: paddedRows
        };
      }
    }
  }

  // 2. Try parsing textHtml as HTML Table
  if (textHtml && (textHtml.includes('<table') || textHtml.includes('<tr'))) {
    try {
      if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(textHtml, 'text/html');
        const trList = doc.querySelectorAll('tr');
        if (trList.length >= 1) {
          const parsedRows: string[][] = [];
          trList.forEach(tr => {
            const cells = tr.querySelectorAll('th, td');
            if (cells.length > 0) {
              const row: string[] = [];
              cells.forEach(cell => {
                row.push(cell.textContent?.trim() || '');
              });
              parsedRows.push(row);
            }
          });

          if (parsedRows.length >= 1) {
            let maxCols = 0;
            for (const r of parsedRows) {
              if (r.length > maxCols) maxCols = r.length;
            }

            if (maxCols >= 2 || parsedRows.length >= 2) {
              const paddedRows = parsedRows.map(row => {
                const padded = [...row];
                while (padded.length < maxCols) {
                  padded.push('');
                }
                return padded;
              });

              return {
                isTable: true,
                columns: paddedRows[0].map((col, idx) => col || `Column ${idx + 1}`),
                rows: paddedRows.length > 1 ? paddedRows.slice(1) : [new Array(maxCols).fill('')],
                rawGrid: paddedRows
              };
            }
          }
        }
      }
    } catch {
      // Ignore HTML parse errors and fall through
    }
  }

  return null;
}
