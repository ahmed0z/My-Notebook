import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { TableBlock } from '../src/components/editor/blocks/TableBlock';

describe('TableBlock Smart Paste', () => {
  it('pastes multi-cell TSV into existing table starting from active cell', () => {
    const onChange = vi.fn();
    const content = {
      columns: ['Col 1', 'Col 2'],
      rows: [['A', 'B'], ['C', 'D']]
    };

    render(<TableBlock content={content} onChange={onChange} />);

    const firstCell = screen.getByText('A');
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.assign(pasteEvent, {
      clipboardData: {
        getData: (format: string) => format === 'text/plain' ? 'X\tY\nZ\tW' : ''
      }
    });

    firstCell.dispatchEvent(pasteEvent);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      columns: ['Col 1', 'Col 2'],
      rows: [
        ['X', 'Y'],
        ['Z', 'W']
      ]
    }));
  });

  it('dynamically expands table columns and rows when pasted TSV exceeds existing bounds', () => {
    const onChange = vi.fn();
    const content = {
      columns: ['Col 1'],
      rows: [['A']]
    };

    render(<TableBlock content={content} onChange={onChange} />);

    const firstCell = screen.getByText('A');
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.assign(pasteEvent, {
      clipboardData: {
        getData: (format: string) => format === 'text/plain' ? '1\t2\t3\n4\t5\t6' : ''
      }
    });

    firstCell.dispatchEvent(pasteEvent);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      columns: ['Col 1', 'Column 2', 'Column 3'],
      rows: [
        ['1', '2', '3'],
        ['4', '5', '6']
      ]
    }));
  });
});
