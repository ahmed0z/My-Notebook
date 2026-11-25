import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RowActionMenu,
  ColumnActionMenu,
  TableOptionsMenu,
} from '../src/components/editor/blocks/TableContextMenus';

describe('TableContextMenus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RowActionMenu', () => {
    const createProps = (overrides: Partial<React.ComponentProps<typeof RowActionMenu>> = {}) => ({
      rowIndex: 1,
      canDelete: true,
      onInsertAbove: vi.fn(),
      onInsertBelow: vi.fn(),
      onDuplicate: vi.fn(),
      onClear: vi.fn(),
      onDelete: vi.fn(),
      onClose: vi.fn(),
      ...overrides,
    });

    it('renders all row menu items with accessible roles and triggers callbacks + onClose', () => {
      const props = createProps();
      render(<RowActionMenu {...props} />);

      expect(screen.getByRole('menu')).toBeInTheDocument();

      const insertAbove = screen.getByRole('menuitem', { name: /insert above/i });
      const insertBelow = screen.getByRole('menuitem', { name: /insert below/i });
      const duplicate = screen.getByRole('menuitem', { name: /duplicate/i });
      const clear = screen.getByRole('menuitem', { name: /clear contents/i });
      const del = screen.getByRole('menuitem', { name: /delete/i });

      expect(del).toBeEnabled();

      fireEvent.click(insertAbove);
      expect(props.onInsertAbove).toHaveBeenCalledTimes(1);
      expect(props.onClose).toHaveBeenCalledTimes(1);

      fireEvent.click(insertBelow);
      expect(props.onInsertBelow).toHaveBeenCalledTimes(1);
      expect(props.onClose).toHaveBeenCalledTimes(2);

      fireEvent.click(duplicate);
      expect(props.onDuplicate).toHaveBeenCalledTimes(1);
      expect(props.onClose).toHaveBeenCalledTimes(3);

      fireEvent.click(clear);
      expect(props.onClear).toHaveBeenCalledTimes(1);
      expect(props.onClose).toHaveBeenCalledTimes(4);

      fireEvent.click(del);
      expect(props.onDelete).toHaveBeenCalledTimes(1);
      expect(props.onClose).toHaveBeenCalledTimes(5);
    });

    it('disables Delete when canDelete is false', () => {
      const props = createProps({ canDelete: false });
      render(<RowActionMenu {...props} />);

      const del = screen.getByRole('menuitem', { name: /delete/i });
      expect(del).toBeDisabled();

      fireEvent.click(del);
      expect(props.onDelete).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
    });

    it('stops mousedown propagation and closes on Escape or outside mousedown', () => {
      const parentMouseDown = vi.fn();
      const props = createProps();

      render(
        <div onMouseDown={parentMouseDown}>
          <button type="button">Outside</button>
          <RowActionMenu {...props} />
        </div>
      );

      fireEvent.mouseDown(screen.getByRole('menuitem', { name: /insert above/i }));
      expect(parentMouseDown).not.toHaveBeenCalled();

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(props.onClose).toHaveBeenCalledTimes(1);

      fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }));
      expect(props.onClose).toHaveBeenCalledTimes(2);
    });
  });

  describe('ColumnActionMenu', () => {
    const createProps = (overrides: Partial<React.ComponentProps<typeof ColumnActionMenu>> = {}) => ({
      colIndex: 0,
      canDelete: true,
      onInsertLeft: vi.fn(),
      onInsertRight: vi.fn(),
      onDuplicate: vi.fn(),
      onSortAsc: vi.fn(),
      onSortDesc: vi.fn(),
      onClear: vi.fn(),
      onDelete: vi.fn(),
      onClose: vi.fn(),
      ...overrides,
    });

    it('renders all column menu items and triggers callbacks + onClose', () => {
      const props = createProps();
      render(<ColumnActionMenu {...props} />);

      expect(screen.getByRole('menu')).toBeInTheDocument();

      const insertLeft = screen.getByRole('menuitem', { name: /insert left/i });
      const insertRight = screen.getByRole('menuitem', { name: /insert right/i });
      const duplicate = screen.getByRole('menuitem', { name: /duplicate/i });
      const sortAsc = screen.getByRole('menuitem', { name: /sort a.*z/i });
      const sortDesc = screen.getByRole('menuitem', { name: /sort z.*a/i });
      const clear = screen.getByRole('menuitem', { name: /clear contents/i });
      const del = screen.getByRole('menuitem', { name: /delete/i });

      expect(del).toBeEnabled();

      fireEvent.click(insertLeft);
      expect(props.onInsertLeft).toHaveBeenCalledTimes(1);

      fireEvent.click(insertRight);
      expect(props.onInsertRight).toHaveBeenCalledTimes(1);

      fireEvent.click(duplicate);
      expect(props.onDuplicate).toHaveBeenCalledTimes(1);

      fireEvent.click(sortAsc);
      expect(props.onSortAsc).toHaveBeenCalledTimes(1);

      fireEvent.click(sortDesc);
      expect(props.onSortDesc).toHaveBeenCalledTimes(1);

      fireEvent.click(clear);
      expect(props.onClear).toHaveBeenCalledTimes(1);

      fireEvent.click(del);
      expect(props.onDelete).toHaveBeenCalledTimes(1);
      expect(props.onClose).toHaveBeenCalledTimes(7);
    });

    it('disables Delete when canDelete is false', () => {
      const props = createProps({ canDelete: false });
      render(<ColumnActionMenu {...props} />);

      const del = screen.getByRole('menuitem', { name: /delete/i });
      expect(del).toBeDisabled();

      fireEvent.click(del);
      expect(props.onDelete).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
    });

    it('stops mousedown propagation on menu container', () => {
      const parentMouseDown = vi.fn();
      const props = createProps();

      render(
        <div onMouseDown={parentMouseDown}>
          <ColumnActionMenu {...props} />
        </div>
      );

      fireEvent.mouseDown(screen.getByRole('menu'));
      expect(parentMouseDown).not.toHaveBeenCalled();
    });
  });

  describe('TableOptionsMenu', () => {
    const createProps = (overrides: Partial<React.ComponentProps<typeof TableOptionsMenu>> = {}) => ({
      hasHeaderRow: true,
      hasHeaderColumn: false,
      fitToWidth: false,
      onToggleHeaderRow: vi.fn(),
      onToggleHeaderColumn: vi.fn(),
      onToggleFitToWidth: vi.fn(),
      onCopyTable: vi.fn(),
      onClearTable: vi.fn(),
      onClose: vi.fn(),
      ...overrides,
    });

    it('renders switch toggles with accurate aria-checked state and invokes toggle callbacks', () => {
      const props = createProps({
        hasHeaderRow: true,
        hasHeaderColumn: false,
        fitToWidth: true,
      });
      render(<TableOptionsMenu {...props} />);

      expect(screen.getByRole('menu')).toBeInTheDocument();

      const headerRowSwitch = screen.getByRole('switch', { name: /header row/i });
      const headerColSwitch = screen.getByRole('switch', { name: /header column/i });
      const fitWidthSwitch = screen.getByRole('switch', { name: /fit to page width/i });

      expect(headerRowSwitch).toHaveAttribute('aria-checked', 'true');
      expect(headerColSwitch).toHaveAttribute('aria-checked', 'false');
      expect(fitWidthSwitch).toHaveAttribute('aria-checked', 'true');

      fireEvent.click(headerRowSwitch);
      expect(props.onToggleHeaderRow).toHaveBeenCalledTimes(1);

      fireEvent.click(headerColSwitch);
      expect(props.onToggleHeaderColumn).toHaveBeenCalledTimes(1);

      fireEvent.click(fitWidthSwitch);
      expect(props.onToggleFitToWidth).toHaveBeenCalledTimes(1);

      expect(props.onClose).not.toHaveBeenCalled();
    });

    it('renders Copy table and Clear contents actions and closes on click', () => {
      const props = createProps();
      render(<TableOptionsMenu {...props} />);

      const copyBtn = screen.getByRole('menuitem', { name: /copy table/i });
      const clearBtn = screen.getByRole('menuitem', { name: /clear contents/i });

      fireEvent.click(copyBtn);
      expect(props.onCopyTable).toHaveBeenCalledTimes(1);
      expect(props.onClose).toHaveBeenCalledTimes(1);

      fireEvent.click(clearBtn);
      expect(props.onClearTable).toHaveBeenCalledTimes(1);
      expect(props.onClose).toHaveBeenCalledTimes(2);
    });

    it('stops mousedown propagation and closes on Escape', () => {
      const parentMouseDown = vi.fn();
      const props = createProps();

      render(
        <div onMouseDown={parentMouseDown}>
          <TableOptionsMenu {...props} />
        </div>
      );

      fireEvent.mouseDown(screen.getByRole('switch', { name: /header row/i }));
      expect(parentMouseDown).not.toHaveBeenCalled();

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });
  });
});
