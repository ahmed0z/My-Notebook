import React, { useState } from 'react';
import {
  StickyNote,
  Archive,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  Plus
} from 'lucide-react';
import { SpaceDto, NoteDto } from '@notebook/shared';
import { SpaceSelector } from './SpaceSelector';
import { useAuth } from '../context/AuthContext';

export interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: 'home' | 'archive' | 'settings') => void;
  currentPage: 'home' | 'archive' | 'settings';
  spaces?: SpaceDto[];
  notes?: NoteDto[];
  activeSpaceId?: string | null;
  selectedNoteId?: string | null;
  onSelectSpace?: (spaceId: string | null) => void;
  onSelectNote?: (note: NoteDto) => void;
  onCreateSpace?: (name: string, parentSpaceId?: string | null) => Promise<void>;
  onUpdateSpace?: (id: string, updates: { name?: string; parentSpaceId?: string | null }) => Promise<void>;
  onDeleteSpace?: (id: string) => Promise<void>;
  onCreateNote?: (spaceId?: string | null) => void;
}

interface NavItem {
  id: 'home' | 'archive' | 'settings';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Notes', icon: StickyNote },
  { id: 'archive', label: 'Archive', icon: Archive },
  { id: 'settings', label: 'Settings', icon: Settings }
];

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

export const SideMenu: React.FC<SideMenuProps> = ({
  isOpen,
  onClose,
  onNavigate,
  currentPage,
  spaces = [],
  notes = [],
  activeSpaceId = null,
  selectedNoteId = null,
  onSelectSpace,
  onSelectNote,
  onCreateSpace,
  onUpdateSpace,
  onDeleteSpace,
  onCreateNote
}) => {
  const { username, avatarUrl } = useAuth();
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(new Set());

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
  const tree = buildSpaceTree(spaces);
  const unassignedNotes = activeNotes.filter(n => !n.spaceId);

  const handleNoteClick = (note: NoteDto) => {
    if (onSelectNote) {
      onSelectNote(note);
    }
    // Only close drawer on mobile viewports (< 768px)
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      onClose();
    }
  };

  const handleSpaceClick = (spaceId: string | null) => {
    if (onSelectSpace) {
      onSelectSpace(spaceId);
      onNavigate('home');
    }
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      onClose();
    }
  };

  const renderNoteItem = (n: NoteDto, depth: number) => {
    const isActive = n.id === selectedNoteId;
    return (
      <button
        key={n.id}
        type="button"
        onClick={() => handleNoteClick(n)}
        style={{ paddingLeft: `${(depth + 1) * 14 + 10}px` }}
        className={`w-full flex items-center gap-2 py-1.5 pr-2.5 rounded-xl text-xs transition text-left group ${
          isActive
            ? 'bg-amber-100/90 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 font-semibold shadow-xs'
            : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200/50 dark:hover:bg-stone-800/60 hover:text-stone-900 dark:hover:text-stone-100'
        }`}
      >
        <FileText className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-600 dark:text-amber-400' : 'text-stone-400 group-hover:text-stone-600 dark:group-hover:text-stone-300'}`} />
        <span className="truncate flex-1">{n.title || 'Untitled Note'}</span>
      </button>
    );
  };

  const renderSpaceNode = (node: SpaceNode, depth = 0) => {
    const isCollapsed = collapsedFolderIds.has(node.space.id);
    const folderNotes = activeNotes.filter(n => n.spaceId === node.space.id);
    const isSpaceActive = activeSpaceId === node.space.id;

    return (
      <div key={node.space.id} className="space-y-0.5">
        <div
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          className={`group flex items-center justify-between py-1.5 pr-2 rounded-xl text-xs font-medium transition cursor-pointer ${
            isSpaceActive && !selectedNoteId
              ? 'bg-stone-200/80 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-semibold'
              : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200/40 dark:hover:bg-stone-800/40'
          }`}
        >
          <div
            className="flex items-center gap-1.5 min-w-0 flex-1"
            onClick={() => handleSpaceClick(node.space.id)}
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
            <span className="truncate">
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

        {/* Space notes when expanded */}
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
      {/* Backdrop overlay for mobile drawer */}
      {isOpen && (
        <div
          data-testid="side-menu-backdrop"
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden transition-opacity animate-in fade-in duration-200"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Persistent Master Sidebar */}
      <aside
        data-testid="side-menu"
        aria-label="Main Navigation"
        className={`fixed top-0 bottom-0 left-0 w-64 bg-stone-50 dark:bg-stone-900 border-r border-stone-200/80 dark:border-stone-800 z-50 flex flex-col shadow-xl md:shadow-none transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200/60 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100">
              NoteBook
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Collapse menu"
            aria-label="Collapse menu"
            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items & Notion-style Tree */}
        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto custom-scrollbar">
          {/* Top Level Nav Items */}
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id && !selectedNoteId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onNavigate(item.id);
                    if (item.id === 'home' && onSelectSpace) {
                      onSelectSpace(null);
                    }
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                    isActive
                      ? 'bg-stone-200/70 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-semibold shadow-sm'
                      : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200/40 dark:hover:bg-stone-800/60 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-stone-900 dark:text-stone-100' : 'text-stone-500 dark:text-stone-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Hierarchical Notion-style Spaces Tree with Nested Notes */}
          <div className="pt-3 border-t border-stone-200/60 dark:border-stone-800 space-y-2">
            <div className="flex items-center justify-between px-2 text-[11px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
              <span>Spaces</span>
              {onCreateNote && (
                <button
                  type="button"
                  title="Create new note"
                  aria-label="Create new note"
                  onClick={() => onCreateNote(null)}
                  className="p-1 rounded hover:bg-stone-200/60 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-900 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="space-y-0.5">
              {tree.map(node => renderSpaceNode(node, 0))}
            </div>

            {/* Unassigned / General Notes */}
            {unassignedNotes.length > 0 && (
              <div className="pt-2">
                <div className="px-2 py-1 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                  General Notes
                </div>
                <div className="space-y-0.5">
                  {unassignedNotes.map(n => renderNoteItem(n, 0))}
                </div>
              </div>
            )}
          </div>

          {/* Manage Spaces Selector if provided */}
          {onSelectSpace && onCreateSpace && (
            <div className="pt-3 border-t border-stone-200/60 dark:border-stone-800">
              <SpaceSelector
                spaces={spaces}
                activeSpaceId={activeSpaceId}
                onSelectSpace={(spaceId) => {
                  onSelectSpace(spaceId);
                  onNavigate('home');
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    onClose();
                  }
                }}
                onCreateSpace={onCreateSpace || (async () => {})}
                onUpdateSpace={onUpdateSpace || (async () => {})}
                onDeleteSpace={onDeleteSpace || (async () => {})}
              />
            </div>
          )}
        </nav>

        {/* Footer info & Profile */}
        <div className="px-4 py-3 border-t border-stone-200/60 dark:border-stone-800 flex items-center gap-2.5">
          {avatarUrl ? (
            avatarUrl.startsWith('http') || avatarUrl.startsWith('/api') || avatarUrl.startsWith('data:') ? (
              <img
                src={avatarUrl}
                alt={username || 'Profile'}
                className="w-8 h-8 rounded-full object-cover border border-stone-200 dark:border-stone-700 shadow-sm"
              />
            ) : (
              <span className="w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-800 flex items-center justify-center text-base border border-stone-300 dark:border-stone-700">
                {avatarUrl}
              </span>
            )
          ) : (
            <span className="w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center text-xs font-bold uppercase border border-stone-300 dark:border-stone-700">
              {username ? username.charAt(0) : 'U'}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-stone-800 dark:text-stone-200 truncate">
              {username || 'NoteBook User'}
            </p>
            <div className="flex items-center justify-between gap-1 text-[11px] text-stone-400 dark:text-stone-500">
              <span className="truncate">Personal Workspace</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 font-medium shrink-0">v0.0.1-beta</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
