export interface ParsedTableData {
  isTable: boolean;
  columns: string[];
  rows: string[][];
  rawGrid: string[][];
}

function cleanCell(cell: string): string {
  let trimmed = cell.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    trimmed = trimmed.substring(1, trimmed.length - 1).replace(/""/g, '"');
  }
  return trimmed;
}

export function parseClipboardTableData(textPlain: string, textHtml?: string): ParsedTableData | null {
  // 1. Try parsing textPlain as TSV
  if (textPlain && textPlain.trim().length > 0) {
    const rawLines = textPlain.split(/\r?\n/);
    // Remove trailing blank line if any
    while (rawLines.length > 0 && rawLines[rawLines.length - 1].trim() === '') {
      rawLines.pop();
    }

    // Must have at least 2 rows and at least one tab to be considered a table from clipboard
    if (rawLines.length >= 2) {
      const hasTab = rawLines.some(line => line.includes('\t'));
      if (hasTab) {
        const splitRows = rawLines.map(line => line.split('\t').map(cleanCell));
        let maxCols = 0;
        for (const row of splitRows) {
          if (row.length > maxCols) maxCols = row.length;
        }

        if (maxCols >= 2) {
          const paddedRows = splitRows.map(row => {
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
