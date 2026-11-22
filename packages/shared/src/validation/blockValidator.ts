import { BlockType } from '../types/block.js';

export function validateBlockContent(type: BlockType, content: unknown): { valid: boolean; error?: string } {
  if (!content || typeof content !== 'object') {
    return { valid: false, error: 'Content must be a non-null object' };
  }

  const c = content as Record<string, unknown>;

  if (type === 'text') {
    if (typeof c.text !== 'string') {
      return { valid: false, error: 'Text block requires text property as string' };
    }
    const validLevels = ['paragraph', 'h1', 'h2', 'h3'];
    if (!validLevels.includes(c.level as string)) {
      return { valid: false, error: `Text block level must be one of: ${validLevels.join(', ')}` };
    }
    return { valid: true };
  }

  if (type === 'checklist') {
    if (!Array.isArray(c.items)) {
      return { valid: false, error: 'Checklist block requires items array' };
    }
    for (const item of c.items) {
      if (!item || typeof item !== 'object') {
        return { valid: false, error: 'Checklist item must be an object' };
      }
      if (typeof item.id !== 'string' || typeof item.text !== 'string' || typeof item.checked !== 'boolean') {
        return { valid: false, error: 'Checklist item must contain id (string), text (string), and checked (boolean)' };
      }
    }
    return { valid: true };
  }

  if (type === 'table') {
    if (!Array.isArray(c.columns)) {
      return { valid: false, error: 'Table block requires columns array' };
    }
    for (const col of c.columns) {
      if (typeof col !== 'string') {
        return { valid: false, error: 'Table columns must be strings' };
      }
    }
    if (!Array.isArray(c.rows)) {
      return { valid: false, error: 'Table block requires rows array' };
    }
    const expectedColCount = c.columns.length;
    for (const row of c.rows) {
      if (!Array.isArray(row)) {
        return { valid: false, error: 'Each table row must be an array' };
      }
      if (row.length !== expectedColCount) {
        return { valid: false, error: `Table row column count (${row.length}) does not match columns length (${expectedColCount})` };
      }
      for (const cell of row) {
        if (typeof cell !== 'string') {
          return { valid: false, error: 'Table cell values must be strings' };
        }
      }
    }
    if (c.columnWidths !== undefined) {
      if (!Array.isArray(c.columnWidths)) {
        return { valid: false, error: 'Table columnWidths must be an array' };
      }
      for (const w of c.columnWidths) {
        if (typeof w !== 'number' || isNaN(w) || w <= 0) {
          return { valid: false, error: 'Table column widths must be positive numbers' };
        }
      }
    }
    if (c.rowHeights !== undefined) {
      if (!Array.isArray(c.rowHeights)) {
        return { valid: false, error: 'Table rowHeights must be an array' };
      }
      for (const h of c.rowHeights) {
        if (typeof h !== 'number' || isNaN(h) || h <= 0) {
          return { valid: false, error: 'Table row heights must be positive numbers' };
        }
      }
    }
    return { valid: true };
  }

  if (type === 'image') {
    if (typeof c.url !== 'string') {
      return { valid: false, error: 'Image block requires a url string' };
    }
    if (c.caption !== undefined && typeof c.caption !== 'string') {
      return { valid: false, error: 'Image caption must be a string if provided' };
    }
    if (c.width !== undefined && (typeof c.width !== 'number' || isNaN(c.width) || c.width <= 0)) {
      return { valid: false, error: 'Image width must be a positive number if provided' };
    }
    if (c.height !== undefined && (typeof c.height !== 'number' || isNaN(c.height) || c.height <= 0)) {
      return { valid: false, error: 'Image height must be a positive number if provided' };
    }
    return { valid: true };
  }

  return { valid: false, error: `Unknown block type: ${type}` };
}
