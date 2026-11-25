import { describe, it, expect } from 'vitest';
import { validateBlockContent } from '../src/validation/blockValidator';

describe('validateBlockContent', () => {
  it('validates a valid text block', () => {
    const res = validateBlockContent('text', { text: 'Hello', level: 'paragraph' });
    expect(res.valid).toBe(true);
  });
  it('rejects text block with invalid level', () => {
    const res = validateBlockContent('text', { text: 'Hello', level: 'h5' });
    expect(res.valid).toBe(false);
  });
  it('validates checklist block with items', () => {
    const res = validateBlockContent('checklist', { items: [{ id: '1', text: 'Task', checked: false }] });
    expect(res.valid).toBe(true);
  });
  it('rejects malformed table block with non-matching row columns', () => {
    const res = validateBlockContent('table', { columns: ['A', 'B'], rows: [['1']] });
    expect(res.valid).toBe(false);
  });
  it('validates a valid table block with optional columnWidths and rowHeights', () => {
    const res = validateBlockContent('table', {
      columns: ['A', 'B'],
      rows: [['1', '2']],
      columnWidths: [150, 200],
      rowHeights: [40],
    });
    expect(res.valid).toBe(true);
  });
  it('rejects table block with invalid columnWidths or rowHeights', () => {
    const resWidth = validateBlockContent('table', {
      columns: ['A'],
      rows: [['1']],
      columnWidths: [-50],
    });
    expect(resWidth.valid).toBe(false);

    const resHeight = validateBlockContent('table', {
      columns: ['A'],
      rows: [['1']],
      rowHeights: [0],
    });
    expect(resHeight.valid).toBe(false);
  });

  it('validates table block with optional boolean header and fitToWidth flags', () => {
    const res = validateBlockContent('table', {
      columns: ['A', 'B'],
      rows: [['1', '2']],
      hasHeaderRow: true,
      hasHeaderColumn: false,
      fitToWidth: true,
    });
    expect(res.valid).toBe(true);
  });

  it('rejects table block when hasHeaderRow, hasHeaderColumn, or fitToWidth is not a boolean', () => {
    const resHeaderRow = validateBlockContent('table', {
      columns: ['A'],
      rows: [['1']],
      hasHeaderRow: 'true',
    });
    expect(resHeaderRow.valid).toBe(false);

    const resHeaderCol = validateBlockContent('table', {
      columns: ['A'],
      rows: [['1']],
      hasHeaderColumn: 1,
    });
    expect(resHeaderCol.valid).toBe(false);

    const resFitToWidth = validateBlockContent('table', {
      columns: ['A'],
      rows: [['1']],
      fitToWidth: null,
    });
    expect(resFitToWidth.valid).toBe(false);
  });

  describe('image block validation', () => {
    it('validates a valid image block with url only', () => {
      const res = validateBlockContent('image' as any, { url: '/uploads/sample.png' });
      expect(res.valid).toBe(true);
    });

    it('validates a valid image block with all fields', () => {
      const res = validateBlockContent('image' as any, {
        url: 'https://example.com/photo.jpg',
        caption: 'Vacation photo',
        width: 1200,
        height: 800
      });
      expect(res.valid).toBe(true);
    });

    it('rejects image block missing url', () => {
      const res = validateBlockContent('image' as any, { caption: 'No url here' });
      expect(res.valid).toBe(false);
    });

    it('accepts image block with empty url for initial upload dropzone state', () => {
      const res = validateBlockContent('image' as any, { url: '' });
      expect(res.valid).toBe(true);
    });

    it('rejects image block with non-string url', () => {
      const res = validateBlockContent('image' as any, { url: 12345 });
      expect(res.valid).toBe(false);
    });

    it('rejects image block with non-string caption', () => {
      const res = validateBlockContent('image' as any, { url: '/uploads/img.png', caption: 12345 });
      expect(res.valid).toBe(false);
    });

    it('rejects image block with non-positive dimensions', () => {
      const resWidth = validateBlockContent('image' as any, { url: '/uploads/img.png', width: -10 });
      expect(resWidth.valid).toBe(false);

      const resHeight = validateBlockContent('image' as any, { url: '/uploads/img.png', height: 0 });
      expect(resHeight.valid).toBe(false);
    });
  });
});

