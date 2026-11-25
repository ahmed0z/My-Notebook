import React, { useLayoutEffect, useRef } from 'react';

export type CellNavDirection = 'next' | 'prev' | 'left' | 'right' | 'up' | 'down';

export interface TableCellProps {
  value: string;
  rowIndex: number; // -1 for top row, 0..n-1 for body
  colIndex: number;
  isHeaderCell?: boolean;
  onChange: (val: string) => void;
  onNavigate: (direction: CellNavDirection, rowIndex: number, colIndex: number) => void;
  onEscapeToSelect: (rowIndex: number, colIndex: number) => void;
  onFocusCell?: (rowIndex: number, colIndex: number) => void;
  className?: string;
}

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI']);
const LINE_TOLERANCE_PX = 2;

function readCellText(el: HTMLElement): string {
  const raw = el.innerText !== undefined ? el.innerText : (el.textContent || '');
  return raw.replace(/\r\n/g, '\n');
}

function isElementEffectivelyEmpty(el: HTMLElement): boolean {
  return (el.textContent || '') === '' && el.querySelectorAll('br, div, p').length <= 1;
}

function getCollapsedRangeInElement(el: HTMLElement): Range | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!el.contains(range.startContainer)) {
    return null;
  }
  return range;
}

function hasBlockSibling(
  root: HTMLElement,
  node: Node,
  direction: 'previous' | 'next'
): boolean {
  let current: Node | null = node;
  while (current && current !== root) {
    if (current instanceof HTMLElement && BLOCK_TAGS.has(current.tagName)) {
      const sibling = direction === 'previous' ? current.previousSibling : current.nextSibling;
      if (sibling) {
        return true;
      }
    }
    current = current.parentNode;
  }
  return false;
}

function createSideRange(el: HTMLElement, range: Range, side: 'before' | 'after'): Range {
  const sideRange = document.createRange();
  sideRange.selectNodeContents(el);
  if (side === 'before') {
    sideRange.setEnd(range.startContainer, range.startOffset);
  } else {
    sideRange.setStart(range.endContainer, range.endOffset);
  }
  return sideRange;
}

function hasBreakInSide(el: HTMLElement, range: Range, side: 'before' | 'after'): boolean {
  const sideRange = createSideRange(el, range, side);
  if (sideRange.toString().includes('\n')) {
    return true;
  }
  if (sideRange.cloneContents().querySelectorAll('br').length > 0) {
    return true;
  }
  return hasBlockSibling(el, side === 'before' ? range.startContainer : range.endContainer, side === 'before' ? 'previous' : 'next');
}

function isCaretAtEdge(el: HTMLElement, edge: 'start' | 'end'): boolean {
  const range = getCollapsedRangeInElement(el);
  if (!range) {
    return document.activeElement === el && isElementEffectivelyEmpty(el) && (window.getSelection()?.rangeCount ?? 0) === 0;
  }
  if (isElementEffectivelyEmpty(el)) {
    return true;
  }
  const side = edge === 'start' ? 'before' : 'after';
  const sideRange = createSideRange(el, range, side);
  if (sideRange.toString().length > 0) {
    return false;
  }
  if (sideRange.cloneContents().querySelectorAll('br').length > 0) {
    return false;
  }
  return !hasBlockSibling(
    el,
    edge === 'start' ? range.startContainer : range.endContainer,
    edge === 'start' ? 'previous' : 'next'
  );
}

function findEdgeLeaf(el: HTMLElement, edge: 'start' | 'end'): Node | null {
  let node: Node | null = edge === 'start' ? el.firstChild : el.lastChild;
  while (node && node.hasChildNodes()) {
    node = edge === 'start' ? node.firstChild : node.lastChild;
  }
  return node;
}

function getRangeRect(range: Range): DOMRect | null {
  const rects = range.getClientRects?.();
  if (rects && rects.length > 0 && rects[0].height > 0) {
    return rects[0];
  }
  const bounding = range.getBoundingClientRect?.();
  if (bounding && bounding.height > 0) {
    return bounding;
  }
  return null;
}

function getBoundaryRect(el: HTMLElement, edge: 'start' | 'end'): DOMRect | null {
  const range = document.createRange();
  const leaf = findEdgeLeaf(el, edge);
  if (leaf && leaf.nodeType === Node.TEXT_NODE) {
    const offset = edge === 'start' ? 0 : (leaf.textContent || '').length;
    range.setStart(leaf, offset);
  } else if (leaf && leaf instanceof HTMLBRElement) {
    range.setStartBefore(leaf);
  } else {
    range.setStart(el, edge === 'start' ? 0 : el.childNodes.length);
  }
  range.collapse(true);
  return getRangeRect(range);
}

function isCaretAtLineBoundary(el: HTMLElement, edge: 'start' | 'end'): boolean {
  const range = getCollapsedRangeInElement(el);
  if (!range) {
    return document.activeElement === el && isElementEffectivelyEmpty(el) && (window.getSelection()?.rangeCount ?? 0) === 0;
  }
  if (isElementEffectivelyEmpty(el)) {
    return true;
  }

  const caretRect = getRangeRect(range);
  const boundaryRect = getBoundaryRect(el, edge);
  if (caretRect && boundaryRect) {
    return edge === 'start'
      ? caretRect.top <= boundaryRect.top + LINE_TOLERANCE_PX
      : caretRect.bottom >= boundaryRect.bottom - LINE_TOLERANCE_PX;
  }

  // Fallback for jsdom / unlaid-out environments where Range rects have zero height.
  return !hasBreakInSide(el, range, edge === 'start' ? 'before' : 'after');
}

export function isCaretAtStart(el: HTMLElement): boolean {
  return isCaretAtEdge(el, 'start');
}

export function isCaretAtEnd(el: HTMLElement): boolean {
  return isCaretAtEdge(el, 'end');
}

export function isCaretOnFirstLine(el: HTMLElement): boolean {
  return isCaretAtLineBoundary(el, 'start');
}

export function isCaretOnLastLine(el: HTMLElement): boolean {
  return isCaretAtLineBoundary(el, 'end');
}

/** Caret-safe contentEditable table cell with Notion-style keyboard navigation. */
export const TableCell: React.FC<TableCellProps> = ({
  value,
  rowIndex,
  colIndex,
  isHeaderCell = false,
  onChange,
  onNavigate,
  onEscapeToSelect,
  onFocusCell,
  className,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef<string>(value);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement !== el) {
      if (readCellText(el) !== value) {
        el.textContent = value;
      }
      lastEmittedRef.current = value;
    }
  }, [value]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const text = readCellText(e.currentTarget);
    if (text !== lastEmittedRef.current) {
      lastEmittedRef.current = text;
      onChange(text);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const text = readCellText(e.currentTarget);
    if (text !== value && text !== lastEmittedRef.current) {
      lastEmittedRef.current = text;
      onChange(text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.nativeEvent.isComposing) {
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      onNavigate(e.shiftKey ? 'prev' : 'next', rowIndex, colIndex);
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      ref.current?.blur();
      onEscapeToSelect(rowIndex, colIndex);
      return;
    }

    if (e.key === 'Enter') {
      // Allow native newline insertion inside the cell (both Enter and Shift+Enter).
      return;
    }

    if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }

    const el = e.currentTarget;
    const arrowDirectionMap: Record<string, { dir: CellNavDirection; check: (el: HTMLElement) => boolean }> = {
      ArrowLeft: { dir: 'left', check: isCaretAtStart },
      ArrowRight: { dir: 'right', check: isCaretAtEnd },
      ArrowUp: { dir: 'up', check: isCaretOnFirstLine },
      ArrowDown: { dir: 'down', check: isCaretOnLastLine },
    };

    const nav = arrowDirectionMap[e.key];
    if (nav && nav.check(el)) {
      e.preventDefault();
      onNavigate(nav.dir, rowIndex, colIndex);
    }
  };

  const baseClassName =
    'w-full outline-none focus:outline-none select-text cursor-text whitespace-pre-wrap break-words';
  const variantClassName = isHeaderCell
    ? 'font-semibold text-xs text-stone-700 dark:text-stone-200'
    : 'text-sm text-stone-800 dark:text-stone-100';
  const combinedClassName = className
    ? `${baseClassName} ${variantClassName} ${className}`
    : `${baseClassName} ${variantClassName} px-2.5 py-1.5 min-h-[1.75rem]`;

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onFocus={() => onFocusCell?.(rowIndex, colIndex)}
      onInput={handleInput}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={combinedClassName}
    />
  );
};
