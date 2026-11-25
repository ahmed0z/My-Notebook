import React, { useEffect, useRef } from 'react';
import {
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  Copy,
  Eraser,
  Trash2,
  ArrowUpAZ,
  ArrowDownZA,
  PanelTop,
  PanelLeft,
  Maximize2,
  ClipboardCopy,
} from 'lucide-react';

export interface RowActionMenuProps {
  rowIndex: number;
  canDelete: boolean;
  onInsertAbove: () => void;
  onInsertBelow: () => void;
  onDuplicate: () => void;
  onClear: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export interface ColumnActionMenuProps {
  colIndex: number;
  canDelete: boolean;
  onInsertLeft: () => void;
  onInsertRight: () => void;
  onDuplicate: () => void;
  onSortAsc: () => void;
  onSortDesc: () => void;
  onClear: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export interface TableOptionsMenuProps {
  hasHeaderRow: boolean;
  hasHeaderColumn: boolean;
  fitToWidth: boolean;
  onToggleHeaderRow: () => void;
  onToggleHeaderColumn: () => void;
  onToggleFitToWidth: () => void;
  onCopyTable: () => void;
  onClearTable: () => void;
  onClose: () => void;
}

interface PopoverContainerProps {
  ariaLabel: string;
  onClose: () => void;
  children: React.ReactNode;
  dataAttrs?: Record<string, string | number>;
}

/** Shared Notion-styled popover shell handling outside clicks, Escape, and mousedown isolation. */
const PopoverContainer: React.FC<PopoverContainerProps> = ({
  ariaLabel,
  onClose,
  children,
  dataAttrs,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const handleOutsideMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
    };

    document.addEventListener('mousedown', handleOutsideMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={ariaLabel}
      onMouseDown={(e) => e.stopPropagation()}
      className="z-50 min-w-[200px] rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-1 text-xs text-stone-700 dark:text-stone-200 shadow-lg select-none"
      {...dataAttrs}
    >
      {children}
    </div>
  );
};

const MenuDivider: React.FC = () => (
  <div role="separator" className="my-1 h-px bg-stone-200/80 dark:bg-stone-800" />
);

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'danger';
}

const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  label,
  onClick,
  disabled = false,
  variant = 'default',
}) => {
  const variantClasses =
    variant === 'danger'
      ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:text-stone-400 dark:disabled:text-stone-600'
      : 'text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800/80';

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent ${variantClasses}`}
    >
      <span className="shrink-0 opacity-75">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
};

interface MenuSwitchItemProps {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onToggle: () => void;
}

const MenuSwitchItem: React.FC<MenuSwitchItemProps> = ({
  icon,
  label,
  checked,
  onToggle,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onToggle}
    className="w-full flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-md text-left text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800/80 transition-colors"
  >
    <span className="flex items-center gap-2 min-w-0">
      <span className="shrink-0 opacity-75">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
    <span
      aria-hidden="true"
      className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-150 ${
        checked ? 'bg-[#2383E2]' : 'bg-stone-300 dark:bg-stone-700'
      }`}
    >
      <span
        className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform duration-150 ${
          checked ? 'translate-x-3.5' : 'translate-x-0.5'
        }`}
      />
    </span>
  </button>
);

/** Contextual menu for row-level actions triggered from the row hover pill handle. */
export const RowActionMenu: React.FC<RowActionMenuProps> = ({
  rowIndex,
  canDelete,
  onInsertAbove,
  onInsertBelow,
  onDuplicate,
  onClear,
  onDelete,
  onClose,
}) => {
  const runAndClose = (action: () => void) => () => {
    action();
    onClose();
  };

  return (
    <PopoverContainer
      ariaLabel={`Row ${rowIndex + 1} actions`}
      onClose={onClose}
      dataAttrs={{ 'data-row-index': rowIndex }}
    >
      <MenuItem
        icon={<ArrowUpToLine className="w-3.5 h-3.5" />}
        label="Insert above"
        onClick={runAndClose(onInsertAbove)}
      />
      <MenuItem
        icon={<ArrowDownToLine className="w-3.5 h-3.5" />}
        label="Insert below"
        onClick={runAndClose(onInsertBelow)}
      />
      <MenuItem
        icon={<Copy className="w-3.5 h-3.5" />}
        label="Duplicate"
        onClick={runAndClose(onDuplicate)}
      />
      <MenuDivider />
      <MenuItem
        icon={<Eraser className="w-3.5 h-3.5" />}
        label="Clear contents"
        onClick={runAndClose(onClear)}
      />
      <MenuItem
        icon={<Trash2 className="w-3.5 h-3.5" />}
        label="Delete"
        variant="danger"
        disabled={!canDelete}
        onClick={() => {
          if (!canDelete) return;
          onDelete();
          onClose();
        }}
      />
    </PopoverContainer>
  );
};

/** Contextual menu for column-level actions triggered from the column hover pill handle. */
export const ColumnActionMenu: React.FC<ColumnActionMenuProps> = ({
  colIndex,
  canDelete,
  onInsertLeft,
  onInsertRight,
  onDuplicate,
  onSortAsc,
  onSortDesc,
  onClear,
  onDelete,
  onClose,
}) => {
  const runAndClose = (action: () => void) => () => {
    action();
    onClose();
  };

  return (
    <PopoverContainer
      ariaLabel={`Column ${colIndex + 1} actions`}
      onClose={onClose}
      dataAttrs={{ 'data-col-index': colIndex }}
    >
      <MenuItem
        icon={<ArrowLeftToLine className="w-3.5 h-3.5" />}
        label="Insert left"
        onClick={runAndClose(onInsertLeft)}
      />
      <MenuItem
        icon={<ArrowRightToLine className="w-3.5 h-3.5" />}
        label="Insert right"
        onClick={runAndClose(onInsertRight)}
      />
      <MenuItem
        icon={<Copy className="w-3.5 h-3.5" />}
        label="Duplicate"
        onClick={runAndClose(onDuplicate)}
      />
      <MenuDivider />
      <MenuItem
        icon={<ArrowUpAZ className="w-3.5 h-3.5" />}
        label="Sort A → Z"
        onClick={runAndClose(onSortAsc)}
      />
      <MenuItem
        icon={<ArrowDownZA className="w-3.5 h-3.5" />}
        label="Sort Z → A"
        onClick={runAndClose(onSortDesc)}
      />
      <MenuDivider />
      <MenuItem
        icon={<Eraser className="w-3.5 h-3.5" />}
        label="Clear contents"
        onClick={runAndClose(onClear)}
      />
      <MenuItem
        icon={<Trash2 className="w-3.5 h-3.5" />}
        label="Delete"
        variant="danger"
        disabled={!canDelete}
        onClick={() => {
          if (!canDelete) return;
          onDelete();
          onClose();
        }}
      />
    </PopoverContainer>
  );
};

/** Contextual menu for table-level options triggered from the floating top-right Options button. */
export const TableOptionsMenu: React.FC<TableOptionsMenuProps> = ({
  hasHeaderRow,
  hasHeaderColumn,
  fitToWidth,
  onToggleHeaderRow,
  onToggleHeaderColumn,
  onToggleFitToWidth,
  onCopyTable,
  onClearTable,
  onClose,
}) => {
  const runAndClose = (action: () => void) => () => {
    action();
    onClose();
  };

  return (
    <PopoverContainer ariaLabel="Table options" onClose={onClose}>
      <MenuSwitchItem
        icon={<PanelTop className="w-3.5 h-3.5" />}
        label="Header row"
        checked={hasHeaderRow}
        onToggle={onToggleHeaderRow}
      />
      <MenuSwitchItem
        icon={<PanelLeft className="w-3.5 h-3.5" />}
        label="Header column"
        checked={hasHeaderColumn}
        onToggle={onToggleHeaderColumn}
      />
      <MenuSwitchItem
        icon={<Maximize2 className="w-3.5 h-3.5" />}
        label="Fit to page width"
        checked={fitToWidth}
        onToggle={onToggleFitToWidth}
      />
      <MenuDivider />
      <MenuItem
        icon={<ClipboardCopy className="w-3.5 h-3.5" />}
        label="Copy table"
        onClick={runAndClose(onCopyTable)}
      />
      <MenuItem
        icon={<Eraser className="w-3.5 h-3.5" />}
        label="Clear contents"
        onClick={runAndClose(onClearTable)}
      />
    </PopoverContainer>
  );
};
