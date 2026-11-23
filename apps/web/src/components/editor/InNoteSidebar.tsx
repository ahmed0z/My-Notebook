import React, { useState } from 'react';
import { SpaceDto, NoteDto } from '@notebook/shared';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  FileText,
  Plus,
  Layers,
  Archive
} from 'lucide-react';

export interface InNoteSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  currentNoteId: string;
  spaces: SpaceDto[];
  notes: NoteDto[];
  onSelectNote: (noteId: string) => void;
  onCreateNote?: (spaceId: string | null) => void;
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

export const InNoteSidebar: React.FC<InNoteSidebarProps> = ({
  isOpen,
  onToggle,
  currentNoteId,
  spaces = [],
  notes = [],
  onSelectNote,
  onCreateNote
}) => {
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const toggleFolder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedFolderIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const activeNotes = notes.filter(n => !n.isArchived);
  const currentNote = notes.find(n => n.id === currentNoteId);
  const isCurrentArchived = currentNote?.isArchived;

  const tree = buildSpaceTree(spaces);
  const unassignedNotes = activeNotes.filter(n => !n.spaceId);

  const renderNoteItem = (n: NoteDto, depth: number) => {
    const isActive = n.id === currentNoteId;
    return (
      <button
        key={n.id}
        type="button"
        onClick={() => onSelectNote(n.id)}
        style={{ paddingLeft: `${(depth + 1) * 16}px` }}
        className={`w-full flex items-center gap-2 py-1.5 pr-2.5 rounded-lg text-xs transition text-left ${
          isActive
            ? 'bg-amber-100/90 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 font-semibold shadow-xs'
            : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200/50 dark:hover:bg-stone-800/60 hover:text-stone-900 dark:hover:text-stone-100'
        }`}
      >
        <FileText className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-600 dark:text-amber-400' : 'text-stone-400'}`} />
        <span className="truncate flex-1">{n.title || 'Untitled Note'}</span>
      </button>
    );
  };

  const renderSpaceNode = (node: SpaceNode, depth = 0) => {
    const isCollapsed = collapsedFolderIds.has(node.space.id);
    const folderNotes = activeNotes.filter(n => n.spaceId === node.space.id);

    return (
      <div key={node.space.id} className="space-y-0.5">
        <div
          style={{ paddingLeft: `${depth * 12 + 6}px` }}
          className="group flex items-center justify-between py-1.5 pr-1.5 rounded-lg text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-200/40 dark:hover:bg-stone-800/40 transition cursor-pointer"
        >
          <div
            className="flex items-center gap-1.5 min-w-0 flex-1"
            onClick={(e) => toggleFolder(node.space.id, e)}
          >
            <button
              type="button"
              aria-label={`Toggle ${node.space.name} folder`}
              onClick={(e) => toggleFolder(node.space.id, e)}
              className="p-0.5 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
            >
              {isCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              )}
            </button>
            {isCollapsed ? (
              <Folder className="w-3.5 h-3.5 text-amber-500/80 shrink-0" />
            ) : (
              <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            )}
            <span className="truncate text-stone-800 dark:text-stone-200 font-medium">
              {node.space.name}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[10px] text-stone-400 dark:text-stone-500 font-mono px-1">
              {folderNotes.length}
            </span>
            {onCreateNote && (
              <button
                type="button"
                title={`New note in ${node.space.name}`}
                aria-label={`New note in ${node.space.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateNote(node.space.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-stone-300/50 dark:hover:bg-stone-700 text-stone-500 hover:text-stone-900 transition"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Folder contents when expanded */}
        {!isCollapsed && (
          <div className="space-y-0.5">
            {folderNotes.map(n => renderNoteItem(n, depth))}
            {node.children.map(child => renderSpaceNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        data-testid="in-note-sidebar-backdrop"
        className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 sm:hidden animate-in fade-in duration-200"
        onClick={onToggle}
        aria-hidden="true"
      />
      <aside
        data-testid="in-note-sidebar"
        aria-label="Note folders and pages"
        role="navigation"
        className="fixed sm:static top-0 bottom-0 left-0 z-40 sm:z-auto w-60 md:w-64 h-full bg-stone-50 dark:bg-stone-900 border-r border-stone-200/70 dark:border-stone-800/80 flex flex-col shrink-0 select-none overflow-hidden shadow-2xl sm:shadow-none transition-transform animate-in slide-in-from-left duration-200"
      >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-stone-200/50 dark:border-stone-800/50">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-stone-500" />
          <span className="text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
            Workspace
          </span>
        </div>
        {onCreateNote && (
          <button
            type="button"
            title="Create note"
            aria-label="Create note"
            onClick={() => onCreateNote(null)}
            className="p-1 rounded-lg text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Tree list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-3">
        {/* Hierarchical spaces */}
        {tree.length > 0 && (
          <div className="space-y-0.5">
            {tree.map(rootNode => renderSpaceNode(rootNode))}
          </div>
        )}

        {/* General / Unfiled notes */}
        {unassignedNotes.length > 0 && (
          <div className="pt-2 border-t border-stone-200/40 dark:border-stone-800/40">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              General Notes
            </div>
            <div className="space-y-0.5">
              {unassignedNotes.map(n => renderNoteItem(n, 0))}
            </div>
          </div>
        )}

        {/* If viewing an archived note, display an archived section */}
        {isCurrentArchived && currentNote && (
          <div className="pt-2 border-t border-stone-200/40 dark:border-stone-800/40">
            <div className="px-2 py-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              <Archive className="w-3 h-3" />
              <span>Archived Note</span>
            </div>
            <div className="space-y-0.5">
              {renderNoteItem(currentNote, 0)}
            </div>
          </div>
        )}
      </div>
    </aside>
    </>
  );
};
