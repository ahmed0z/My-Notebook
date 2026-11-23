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

  it('returns null for single tab or single cell without row breaks', () => {
    expect(parseClipboardTableData('SingleCell')).toBeNull();
    expect(parseClipboardTableData('Word1\tWord2')).toBeNull();
  });

  it('detects HTML table tags when textPlain is ambiguous', () => {
    const html = '<table><tr><th>Name</th><th>Age</th></tr><tr><td>Alice</td><td>30</td></tr></table>';
    const result = parseClipboardTableData('', html);
    expect(result).not.toBeNull();
    expect(result?.columns).toEqual(['Name', 'Age']);
    expect(result?.rows).toEqual([['Alice', '30']]);
  });
});
