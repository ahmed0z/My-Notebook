import React, { useState, useEffect, useRef } from 'react';
import { NoteDto, SpaceDto } from '@notebook/shared';
import {
  MoreVertical,
  Archive,
  ArchiveRestore,
  Trash2,
  FolderInput,
  Folder,
  ChevronRight,
  ChevronLeft,
  Check
} from 'lucide-react';

export interface NoteActionsMenuProps {
  note: NoteDto;
  spaces: SpaceDto[];
  onArchiveToggle: () => void;
  onDelete: () => void;
  onMoveToSpace: (spaceId: string | null) => void;
}

export const NoteActionsMenu: React.FC<NoteActionsMenuProps> = ({
  note,
  spaces = [],
  onArchiveToggle,
  onDelete,
  onMoveToSpace
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showFolderSubmenu, setShowFolderSubmenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowFolderSubmenu(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showFolderSubmenu) {
          setShowFolderSubmenu(false);
        } else {
          setIsOpen(false);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, showFolderSubmenu]);

  const handleDelete = () => {
    if (window.confirm(`Delete "${note.title || 'Untitled Note'}"?`)) {
      onDelete();
      setIsOpen(false);
    }
  };

  const handleArchive = () => {
    onArchiveToggle();
    setIsOpen(false);
  };

  const handleSelectSpace = (spaceId: string | null) => {
    onMoveToSpace(spaceId);
    setShowFolderSubmenu(false);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        title="Note options"
        aria-label="Note options"
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen(!isOpen);
          setShowFolderSubmenu(false);
        }}
        className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition flex items-center justify-center min-w-[36px] min-h-[36px]"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          data-testid="note-actions-menu-dropdown"
          className="absolute right-0 top-11 z-50 w-52 bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-2xl shadow-xl p-1.5 text-xs text-stone-800 dark:text-stone-200 space-y-0.5 animate-in fade-in zoom-in-95 duration-100"
        >
          {!showFolderSubmenu ? (
            <>
              {/* Change Folder */}
              <button
                type="button"
                onClick={() => setShowFolderSubmenu(true)}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800/80 transition text-left"
              >
                <div className="flex items-center gap-2">
                  <FolderInput className="w-4 h-4 text-stone-500 shrink-0" />
                  <span>Change folder</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
              </button>

              {/* Archive / Unarchive */}
              <button
                type="button"
                onClick={handleArchive}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800/80 transition text-left"
              >
                {note.isArchived ? (
                  <>
                    <ArchiveRestore className="w-4 h-4 text-stone-500 shrink-0" />
                    <span>Unarchive note</span>
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4 text-stone-500 shrink-0" />
                    <span>Archive note</span>
                  </>
                )}
              </button>

              <div className="h-px bg-stone-100 dark:bg-stone-800 my-1" />

              {/* Delete */}
              <button
                type="button"
                onClick={handleDelete}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition text-left font-medium"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <span>Delete note</span>
              </button>
            </>
          ) : (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setShowFolderSubmenu(false)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 font-semibold text-[11px] uppercase tracking-wider"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back to options</span>
              </button>

              <div className="h-px bg-stone-100 dark:bg-stone-800 my-1" />

              <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-0.5">
                <button
                  type="button"
                  onClick={() => handleSelectSpace(null)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800/80 transition text-left ${
                    !note.spaceId ? 'font-semibold text-amber-600 dark:text-amber-400' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Folder className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span className="truncate">No folder (General)</span>
                  </div>
                  {!note.spaceId && <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />}
                </button>

                {spaces.map(s => {
                  const isCurrent = note.spaceId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectSpace(s.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800/80 transition text-left ${
                        isCurrent ? 'font-semibold text-amber-600 dark:text-amber-400' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="truncate">{s.name}</span>
                      </div>
                      {isCurrent && <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
