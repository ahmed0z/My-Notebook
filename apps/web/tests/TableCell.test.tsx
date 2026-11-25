import React, { useState } from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TableCell, CellNavDirection } from '../src/components/editor/blocks/TableCell';

function setCaret(el: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) throw new Error('Selection not available');
  const range = document.createRange();
  const textNode = el.firstChild;
  if (textNode && textNode.nodeType === Node.TEXT_NODE) {
    const clamped = Math.max(0, Math.min(offset, (textNode.textContent || '').length));
    range.setStart(textNode, clamped);
    range.setEnd(textNode, clamped);
  } else {
    range.setStart(el, 0);
    range.setEnd(el, 0);
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

function setRangeSelection(el: HTMLElement, startOffset: number, endOffset: number) {
  const selection = window.getSelection();
  if (!selection) throw new Error('Selection not available');
  const range = document.createRange();
  const textNode = el.firstChild;
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
    throw new Error('Expected text node');
  }
  range.setStart(textNode, startOffset);
  range.setEnd(textNode, endOffset);
  selection.removeAllRanges();
  selection.addRange(range);
}

function getEditableCell(container: HTMLElement): HTMLElement {
  const cell = container.querySelector('[contenteditable="true"]') as HTMLElement | null;
  if (!cell) throw new Error('Editable cell not found');
  return cell;
}

describe('TableCell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.getSelection()?.removeAllRanges();
  });

  it('renders a clean contentEditable element with no "Empty" placeholder and no focus rings', () => {
    const { container } = render(
      <TableCell
        value=""
        rowIndex={0}
        colIndex={0}
        onChange={vi.fn()}
        onNavigate={vi.fn()}
        onEscapeToSelect={vi.fn()}
      />
    );

    const cell = getEditableCell(container);
    expect(cell).toHaveAttribute('contenteditable', 'true');
    expect(cell).not.toHaveAttribute('data-placeholder');
    expect(cell.textContent).toBe('');
    expect(container.textContent).not.toContain('Empty');
    expect(cell.className).not.toMatch(/focus:ring-/);
    expect(cell.className).toContain('outline-none');
  });

  it('syncs external value changes when unfocused without clobbering focused DOM or caret', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <TableCell
        value="Initial"
        rowIndex={0}
        colIndex={1}
        onChange={onChange}
        onNavigate={vi.fn()}
        onEscapeToSelect={vi.fn()}
      />
    );

    const cell = getEditableCell(container);
    expect(cell.textContent).toBe('Initial');

    // External update while unfocused
    rerender(
      <TableCell
        value="External"
        rowIndex={0}
        colIndex={1}
        onChange={onChange}
        onNavigate={vi.fn()}
        onEscapeToSelect={vi.fn()}
      />
    );
    expect(cell.textContent).toBe('External');

    // Focus cell and place caret at offset 3
    cell.focus();
    expect(document.activeElement).toBe(cell);
    const originalTextNode = cell.firstChild!;
    setCaret(cell, 3);

    // Simulate live edit + parent prop update while focused
    originalTextNode.textContent = 'ExtEdited';
    setCaret(cell, 5);
    fireEvent.input(cell);
    expect(onChange).toHaveBeenCalledWith('ExtEdited');

    rerender(
      <TableCell
        value="ExtEdited"
        rowIndex={0}
        colIndex={1}
        onChange={onChange}
        onNavigate={vi.fn()}
        onEscapeToSelect={vi.fn()}
      />
    );

    // DOM text node and caret position must remain intact
    expect(cell.firstChild).toBe(originalTextNode);
    const sel = window.getSelection();
    expect(sel?.anchorNode).toBe(originalTextNode);
    expect(sel?.anchorOffset).toBe(5);
  });

  it('normalizes CRLF on input, avoids redundant blur emission, and flushes un-emitted blur edits', () => {
    const onChange = vi.fn();
    const { container } = render(
      <TableCell
        value="Start"
        rowIndex={1}
        colIndex={0}
        onChange={onChange}
        onNavigate={vi.fn()}
        onEscapeToSelect={vi.fn()}
      />
    );

    const cell = getEditableCell(container);
    cell.focus();

    // Simulate environment where innerText is present and contains \r\n
    Object.defineProperty(cell, 'innerText', {
      configurable: true,
      get: () => 'Line 1\r\nLine 2',
    });
    fireEvent.input(cell);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('Line 1\nLine 2');

    // Blur with identical text must not emit a duplicate onChange
    fireEvent.blur(cell);
    expect(onChange).toHaveBeenCalledTimes(1);

    // Direct DOM mutation without input event should flush on blur
    Object.defineProperty(cell, 'innerText', {
      configurable: true,
      get: () => 'Flushed on blur',
    });
    fireEvent.blur(cell);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith('Flushed on blur');
  });

  it('preserves controlled typing flow without resetting text when value prop updates on input', () => {
    const ControlledWrapper = () => {
      const [val, setVal] = useState('abc');
      return (
        <TableCell
          value={val}
          rowIndex={0}
          colIndex={0}
          onChange={setVal}
          onNavigate={vi.fn()}
          onEscapeToSelect={vi.fn()}
        />
      );
    };

    const { container } = render(<ControlledWrapper />);
    const cell = getEditableCell(container);
    cell.focus();
    const textNode = cell.firstChild!;
    textNode.textContent = 'abXc';
    setCaret(cell, 3);
    fireEvent.input(cell);

    expect(cell.textContent).toBe('abXc');
    expect(window.getSelection()?.anchorOffset).toBe(3);
  });

  it('calls onFocusCell when focused', () => {
    const onFocusCell = vi.fn();
    const { container } = render(
      <TableCell
        value="Cell"
        rowIndex={-1}
        colIndex={2}
        isHeaderCell
        onChange={vi.fn()}
        onNavigate={vi.fn()}
        onEscapeToSelect={vi.fn()}
        onFocusCell={onFocusCell}
      />
    );

    const cell = getEditableCell(container);
    fireEvent.focus(cell);
    expect(onFocusCell).toHaveBeenCalledWith(-1, 2);
  });

  it('allows native Enter and Shift+Enter without calling preventDefault or onNavigate', () => {
    const onNavigate = vi.fn();
    const { container } = render(
      <TableCell
        value="Hello"
        rowIndex={0}
        colIndex={0}
        onChange={vi.fn()}
        onNavigate={onNavigate}
        onEscapeToSelect={vi.fn()}
      />
    );

    const cell = getEditableCell(container);
    cell.focus();

    const enterNotPrevented = fireEvent.keyDown(cell, { key: 'Enter', shiftKey: false });
    const shiftEnterNotPrevented = fireEvent.keyDown(cell, { key: 'Enter', shiftKey: true });

    expect(enterNotPrevented).toBe(true);
    expect(shiftEnterNotPrevented).toBe(true);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('navigates next/prev on Tab and Shift+Tab with preventDefault', () => {
    const onNavigate = vi.fn<[CellNavDirection, number, number], void>();
    const { container } = render(
      <TableCell
        value="Cell"
        rowIndex={2}
        colIndex={1}
        onChange={vi.fn()}
        onNavigate={onNavigate}
        onEscapeToSelect={vi.fn()}
      />
    );

    const cell = getEditableCell(container);
    cell.focus();

    const tabAllowed = fireEvent.keyDown(cell, { key: 'Tab', shiftKey: false });
    expect(tabAllowed).toBe(false);
    expect(onNavigate).toHaveBeenNthCalledWith(1, 'next', 2, 1);

    const shiftTabAllowed = fireEvent.keyDown(cell, { key: 'Tab', shiftKey: true });
    expect(shiftTabAllowed).toBe(false);
    expect(onNavigate).toHaveBeenNthCalledWith(2, 'prev', 2, 1);
  });

  it('blurs cell and calls onEscapeToSelect on Escape', () => {
    const onEscapeToSelect = vi.fn();
    const { container } = render(
      <TableCell
        value="Editing"
        rowIndex={1}
        colIndex={2}
        onChange={vi.fn()}
        onNavigate={vi.fn()}
        onEscapeToSelect={onEscapeToSelect}
      />
    );

    const cell = getEditableCell(container);
    cell.focus();
    expect(document.activeElement).toBe(cell);

    const escapeAllowed = fireEvent.keyDown(cell, { key: 'Escape' });
    expect(escapeAllowed).toBe(false);
    expect(document.activeElement).not.toBe(cell);
    expect(onEscapeToSelect).toHaveBeenCalledWith(1, 2);
  });

  it('navigates left/right only when caret is at start/end boundary', () => {
    const onNavigate = vi.fn();
    const { container } = render(
      <TableCell
        value="Hello"
        rowIndex={0}
        colIndex={1}
        onChange={vi.fn()}
        onNavigate={onNavigate}
        onEscapeToSelect={vi.fn()}
      />
    );

    const cell = getEditableCell(container);
    cell.focus();

    // Middle of text (offset 2): neither ArrowLeft nor ArrowRight navigates
    setCaret(cell, 2);
    expect(fireEvent.keyDown(cell, { key: 'ArrowLeft' })).toBe(true);
    expect(fireEvent.keyDown(cell, { key: 'ArrowRight' })).toBe(true);
    expect(onNavigate).not.toHaveBeenCalled();

    // Start of text (offset 0): ArrowLeft navigates left, ArrowRight does not
    setCaret(cell, 0);
    expect(fireEvent.keyDown(cell, { key: 'ArrowRight' })).toBe(true);
    expect(fireEvent.keyDown(cell, { key: 'ArrowLeft' })).toBe(false);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenLastCalledWith('left', 0, 1);

    // End of text (offset 5): ArrowRight navigates right, ArrowLeft does not
    setCaret(cell, 5);
    expect(fireEvent.keyDown(cell, { key: 'ArrowLeft' })).toBe(true);
    expect(fireEvent.keyDown(cell, { key: 'ArrowRight' })).toBe(false);
    expect(onNavigate).toHaveBeenCalledTimes(2);
    expect(onNavigate).toHaveBeenLastCalledWith('right', 0, 1);
  });

  it('does not navigate on Arrow keys when text is selected or modifiers are held', () => {
    const onNavigate = vi.fn();
    const { container } = render(
      <TableCell
        value="Hello"
        rowIndex={0}
        colIndex={0}
        onChange={vi.fn()}
        onNavigate={onNavigate}
        onEscapeToSelect={vi.fn()}
      />
    );

    const cell = getEditableCell(container);
    cell.focus();

    // Non-collapsed selection
    setRangeSelection(cell, 0, 3);
    expect(fireEvent.keyDown(cell, { key: 'ArrowLeft' })).toBe(true);
    expect(fireEvent.keyDown(cell, { key: 'ArrowUp' })).toBe(true);
    expect(onNavigate).not.toHaveBeenCalled();

    // Collapsed at start/end with Shift/Ctrl modifiers
    setCaret(cell, 0);
    expect(fireEvent.keyDown(cell, { key: 'ArrowLeft', shiftKey: true })).toBe(true);
    expect(fireEvent.keyDown(cell, { key: 'ArrowUp', ctrlKey: true })).toBe(true);
    setCaret(cell, 5);
    expect(fireEvent.keyDown(cell, { key: 'ArrowRight', shiftKey: true })).toBe(true);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('navigates up/down on single-line and respects multiline line boundaries', () => {
    const onNavigate = vi.fn();
    const { container, rerender } = render(
      <TableCell
        value="Single line"
        rowIndex={1}
        colIndex={1}
        onChange={vi.fn()}
        onNavigate={onNavigate}
        onEscapeToSelect={vi.fn()}
      />
    );

    const cell = getEditableCell(container);
    cell.focus();
    setCaret(cell, 4);

    // Single-line: both ArrowUp and ArrowDown navigate
    expect(fireEvent.keyDown(cell, { key: 'ArrowUp' })).toBe(false);
    expect(onNavigate).toHaveBeenNthCalledWith(1, 'up', 1, 1);
    expect(fireEvent.keyDown(cell, { key: 'ArrowDown' })).toBe(false);
    expect(onNavigate).toHaveBeenNthCalledWith(2, 'down', 1, 1);

    // Multiline cell: "line1\nline2\nline3"
    cell.blur();
    rerender(
      <TableCell
        value={'line1\nline2\nline3'}
        rowIndex={1}
        colIndex={1}
        onChange={vi.fn()}
        onNavigate={onNavigate}
        onEscapeToSelect={vi.fn()}
      />
    );
    onNavigate.mockClear();
    cell.focus();

    // First line (offset 2): ArrowUp navigates up, ArrowDown stays in cell
    setCaret(cell, 2);
    expect(fireEvent.keyDown(cell, { key: 'ArrowDown' })).toBe(true);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(cell, { key: 'ArrowUp' })).toBe(false);
    expect(onNavigate).toHaveBeenCalledWith('up', 1, 1);

    onNavigate.mockClear();

    // Middle line (offset 8): neither ArrowUp nor ArrowDown navigates
    setCaret(cell, 8);
    expect(fireEvent.keyDown(cell, { key: 'ArrowUp' })).toBe(true);
    expect(fireEvent.keyDown(cell, { key: 'ArrowDown' })).toBe(true);
    expect(onNavigate).not.toHaveBeenCalled();

    // Last line (offset 14): ArrowDown navigates down, ArrowUp stays in cell
    setCaret(cell, 14);
    expect(fireEvent.keyDown(cell, { key: 'ArrowUp' })).toBe(true);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(cell, { key: 'ArrowDown' })).toBe(false);
    expect(onNavigate).toHaveBeenCalledWith('down', 1, 1);
  });

  it('respects browser <div>/<br> multiline DOM structure and mocked Range.getClientRects geometry', () => {
    const onNavigate = vi.fn();
    const { container } = render(
      <TableCell
        value=""
        rowIndex={0}
        colIndex={0}
        onChange={vi.fn()}
        onNavigate={onNavigate}
        onEscapeToSelect={vi.fn()}
      />
    );

    const cell = getEditableCell(container);
    cell.focus();

    // Simulate browser-inserted <div>line1</div><div>line2</div>
    cell.innerHTML = '<div>line1</div><div>line2</div>';
    const firstDivText = cell.firstElementChild!.firstChild!;
    const secondDivText = cell.lastElementChild!.firstChild!;

    const selection = window.getSelection()!;
    const r1 = document.createRange();
    r1.setStart(firstDivText, 0);
    r1.collapse(true);
    selection.removeAllRanges();
    selection.addRange(r1);

    expect(fireEvent.keyDown(cell, { key: 'ArrowLeft' })).toBe(false);
    expect(onNavigate).toHaveBeenLastCalledWith('left', 0, 0);
    expect(fireEvent.keyDown(cell, { key: 'ArrowDown' })).toBe(true);

    onNavigate.mockClear();
    const r2 = document.createRange();
    r2.setStart(secondDivText, 5);
    r2.collapse(true);
    selection.removeAllRanges();
    selection.addRange(r2);

    expect(fireEvent.keyDown(cell, { key: 'ArrowUp' })).toBe(true);
    expect(fireEvent.keyDown(cell, { key: 'ArrowRight' })).toBe(false);
    expect(onNavigate).toHaveBeenLastCalledWith('right', 0, 0);

    // Verify Range.getClientRects geometry path when browser rects are non-zero
    onNavigate.mockClear();
    const originalGetClientRects = Range.prototype.getClientRects;
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      writable: true,
      value: function (this: Range) {
        const top = this.startContainer === firstDivText ? 10 : 30;
        const rect = { top, bottom: top + 16, height: 16, left: 0, right: 40, width: 40, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
        return [rect] as unknown as DOMRectList;
      },
    });

    try {
      selection.removeAllRanges();
      selection.addRange(r1);
      expect(fireEvent.keyDown(cell, { key: 'ArrowUp' })).toBe(false);
      expect(onNavigate).toHaveBeenLastCalledWith('up', 0, 0);
      expect(fireEvent.keyDown(cell, { key: 'ArrowDown' })).toBe(true);

      onNavigate.mockClear();
      selection.removeAllRanges();
      selection.addRange(r2);
      expect(fireEvent.keyDown(cell, { key: 'ArrowDown' })).toBe(false);
      expect(onNavigate).toHaveBeenLastCalledWith('down', 0, 0);
    } finally {
      if (originalGetClientRects) {
        Object.defineProperty(Range.prototype, 'getClientRects', {
          configurable: true,
          writable: true,
          value: originalGetClientRects,
        });
      } else {
        delete (Range.prototype as unknown as Record<string, unknown>).getClientRects;
      }
    }
  });
});
