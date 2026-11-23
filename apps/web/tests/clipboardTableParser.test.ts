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

  it('parses RFC 4180 double-quoted multiline cells preserving cell content across rows', () => {
    const tsv = 'Header 1\tHeader 2\r\n"Line 1\nLine 2"\tValue B\r\n"Line 3\r\nLine 4"\t"Value with ""escaped"" quotes"';
    const result = parseClipboardTableData(tsv);
    expect(result).not.toBeNull();
    expect(result?.isTable).toBe(true);
    expect(result?.columns).toEqual(['Header 1', 'Header 2']);
    expect(result?.rows).toEqual([
      ['Line 1\nLine 2', 'Value B'],
      ['Line 3\r\nLine 4', 'Value with "escaped" quotes']
    ]);
    expect(result?.rawGrid).toEqual([
      ['Header 1', 'Header 2'],
      ['Line 1\nLine 2', 'Value B'],
      ['Line 3\r\nLine 4', 'Value with "escaped" quotes']
    ]);
  });

  it('handles quoted cells with inner tabs without breaking column count', () => {
    const tsv = 'ColA\tColB\n"Text with\ttab"\tNormal Cell\nVal1\tVal2';
    const result = parseClipboardTableData(tsv);
    expect(result).not.toBeNull();
    expect(result?.columns).toEqual(['ColA', 'ColB']);
    expect(result?.rows[0]).toEqual(['Text with\ttab', 'Normal Cell']);
  });
});
