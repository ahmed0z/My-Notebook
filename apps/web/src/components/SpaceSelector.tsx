import React, { useState, useRef, useEffect } from 'react';
import { SpaceDto } from '@notebook/shared';
import {
  Folder,
  FolderOpen,
  Plus,
  ChevronRight,
  ChevronDown,
  Pencil,
  Trash2,
  Layers,
  Check,
  X
} from 'lucide-react';

export interface SpaceSelectorProps {
  spaces: SpaceDto[];
  activeSpaceId: string | null;
  onSelectSpace: (spaceId: string | null) => void;
  onCreateSpace: (name: string, parentSpaceId?: string | null) => Promise<void>;
  onUpdateSpace: (id: string, updates: { name?: string; parentSpaceId?: string | null }) => Promise<void>;
  onDeleteSpace: (id: string) => Promise<void>;
}

interface SpaceNode {
  space: SpaceDto;
  children: SpaceNode[];
}

function buildSpaceTree(spaces: SpaceDto[]): SpaceNode[] {
  const map = new Map<string, SpaceNode>();
  for (const s of spaces) {
    map.set(s.id, { space: s, children: [] });
  }
  const roots: SpaceNode[] = [];
  for (const s of spaces) {
    const node = map.get(s.id)!;
    if (s.parentSpaceId && map.has(s.parentSpaceId)) {
      map.get(s.parentSpaceId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export const SpaceSelector: React.FC<SpaceSelectorProps> = ({
  spaces,
  activeSpaceId,
  onSelectSpace,
  onCreateSpace,
  onUpdateSpace,
  onDeleteSpace
}) => {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [creatingUnderParentId, setCreatingUnderParentId] = useState<string | null | undefined>(undefined);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editSpaceName, setEditSpaceName] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creatingUnderParentId !== undefined) {
      inputRef.current?.focus();
    }
  }, [creatingUnderParentId]);

  useEffect(() => {
    if (editingSpaceId !== null) {
      editInputRef.current?.focus();
    }
  }, [editingSpaceId]);

  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleStartCreate = (parentId: string | null = null, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCreatingUnderParentId(parentId);
    setNewSpaceName('');
    if (parentId && collapsedIds.has(parentId)) {
      setCollapsedIds(prev => {
        const next = new Set(prev);
        next.delete(parentId);
        return next;
      });
    }
  };

  const handleConfirmCreate = async () => {
    const trimmed = newSpaceName.trim();
    if (!trimmed) {
      setCreatingUnderParentId(undefined);
      return;
    }
    const parent = creatingUnderParentId === null ? undefined : creatingUnderParentId;
    try {
      await onCreateSpace(trimmed, parent);
    } catch (err) {
      console.error('Failed to create space', err);
    } finally {
      setCreatingUnderParentId(undefined);
      setNewSpaceName('');
    }
  };

  const handleStartEdit = (space: SpaceDto, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSpaceId(space.id);
    setEditSpaceName(space.name);
  };

  const handleConfirmEdit = async () => {
    if (!editingSpaceId) return;
    const trimmed = editSpaceName.trim();
    if (trimmed) {
      try {
        await onUpdateSpace(editingSpaceId, { name: trimmed });
      } catch (err) {
        console.error('Failed to rename space', err);
      }
    }
    setEditingSpaceId(null);
    setEditSpaceName('');
  };

  const handleDelete = async (space: SpaceDto, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete space "${space.name}" and all its sub-spaces? Notes in this space will remain preserved.`)) {
      try {
        await onDeleteSpace(space.id);
        if (activeSpaceId === space.id) {
          onSelectSpace(null);
        }
      } catch (err) {
        console.error('Failed to delete space', err);
      }
    }
  };

  const tree = buildSpaceTree(spaces);

  const renderNode = (node: SpaceNode, depth: number = 0) => {
    const { space, children } = node;
    const isCollapsed = collapsedIds.has(space.id);
    const hasChildren = children.length > 0;
    const isActive = activeSpaceId === space.id;
    const isEditing = editingSpaceId === space.id;

    return (
      <div key={space.id} className="space-y-0.5">
        <div
          data-testid={`space-item-${space.id}`}
          onClick={() => onSelectSpace(space.id)}
          style={{ paddingLeft: `${Math.max(depth * 14 + 10, 10)}px` }}
          className={`group relative flex items-center justify-between py-1.5 pr-2 rounded-xl text-sm font-medium transition cursor-pointer select-none ${
            isActive
              ? 'bg-stone-200/80 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-semibold shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200/50 dark:hover:bg-stone-800/60 hover:text-stone-900 dark:hover:text-stone-100'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleCollapse(space.id, e)}
                className="p-0.5 rounded hover:bg-stone-300/50 dark:hover:bg-stone-700 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                title={isCollapsed ? 'Expand' : 'Collapse'}
                aria-label={isCollapsed ? 'Expand sub-spaces' : 'Collapse sub-spaces'}
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <span className="w-3.5 h-3.5 inline-block shrink-0" />
            )}

            {isActive ? (
              <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-stone-400 group-hover:text-stone-600 dark:text-stone-500 shrink-0" />
            )}

            {isEditing ? (
              <div
                className="flex items-center gap-1 flex-1 min-w-0 pr-1"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  ref={editInputRef}
                  type="text"
                  value={editSpaceName}
                  onChange={(e) => setEditSpaceName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmEdit();
                    if (e.key === 'Escape') setEditingSpaceId(null);
                  }}
                  className="w-full text-xs px-2 py-0.5 rounded border border-amber-500 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleConfirmEdit}
                  className="p-1 text-emerald-600 hover:text-emerald-700"
                  title="Save"
                  aria-label="Save space name"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingSpaceId(null)}
                  className="p-1 text-stone-400 hover:text-stone-600"
                  title="Cancel"
                  aria-label="Cancel editing"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <span className="truncate flex-1 text-xs sm:text-sm">{space.name}</span>
            )}
          </div>

          {!isEditing && (
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
              <button
                type="button"
                onClick={(e) => handleStartCreate(space.id, e)}
                title="Add sub-space"
                aria-label="Add sub-space"
                className="p-1 rounded text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-300/40 dark:hover:bg-stone-700/50"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => handleStartEdit(space, e)}
                title="Rename space"
                aria-label="Rename space"
                className="p-1 rounded text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-300/40 dark:hover:bg-stone-700/50"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => handleDelete(space, e)}
                title="Delete space"
                aria-label="Delete space"
                className="p-1 rounded text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100/50 dark:hover:bg-red-950/40"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Inline create input if creating child under this space */}
        {creatingUnderParentId === space.id && (
          <div
            style={{ paddingLeft: `${(depth + 1) * 14 + 10}px` }}
            className="flex items-center gap-1.5 py-1 pr-2"
          >
            <Folder className="w-4 h-4 text-stone-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Sub-space name..."
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmCreate();
                if (e.key === 'Escape') setCreatingUnderParentId(undefined);
              }}
              className="flex-1 text-xs px-2 py-1 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <button
              type="button"
              onClick={handleConfirmCreate}
              className="p-1 text-emerald-600 hover:text-emerald-700"
              title="Add"
              aria-label="Add sub-space"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCreatingUnderParentId(undefined)}
              className="p-1 text-stone-400 hover:text-stone-600"
              title="Cancel"
              aria-label="Cancel adding sub-space"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Sub-spaces */}
        {hasChildren && !isCollapsed && (
          <div className="space-y-0.5">
            {children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1 select-none">
      <div className="flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
        <span>Spaces</span>
        <button
          type="button"
          onClick={(e) => handleStartCreate(null, e)}
          title="New Space"
          aria-label="New Space"
          className="p-1 rounded text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* All Notes option */}
      <button
        type="button"
        onClick={() => onSelectSpace(null)}
        data-testid="space-all-notes"
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition ${
          activeSpaceId === null
            ? 'bg-stone-200/70 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-semibold shadow-sm'
            : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200/40 dark:hover:bg-stone-800/60 hover:text-stone-900 dark:hover:text-stone-100'
        }`}
      >
        <Layers className={`w-4 h-4 ${activeSpaceId === null ? 'text-amber-500' : 'text-stone-400'}`} />
        <span className="truncate">All Notes</span>
      </button>

      {/* Tree of spaces */}
      <div className="space-y-0.5 pt-0.5">
        {tree.map(node => renderNode(node, 0))}
      </div>

      {/* Inline create input for root space */}
      {creatingUnderParentId === null && (
        <div className="flex items-center gap-1.5 px-3 py-1">
          <Folder className="w-4 h-4 text-stone-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Space name..."
            value={newSpaceName}
            onChange={(e) => setNewSpaceName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmCreate();
              if (e.key === 'Escape') setCreatingUnderParentId(undefined);
            }}
            className="flex-1 text-xs px-2 py-1 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <button
            type="button"
            onClick={handleConfirmCreate}
            className="p-1 text-emerald-600 hover:text-emerald-700"
            title="Add"
            aria-label="Add space"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setCreatingUnderParentId(undefined)}
            className="p-1 text-stone-400 hover:text-stone-600"
            title="Cancel"
            aria-label="Cancel creating space"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
