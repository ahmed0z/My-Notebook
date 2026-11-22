import React, { useState, useEffect, useCallback } from 'react';
import { NoteDto } from '@notebook/shared';
import { ApiClient } from '../api/client';
import { NoteGrid } from '../components/NoteGrid';
import { Archive, ArrowLeft, Menu, Loader2, Sun, Moon, LogOut } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export interface ArchivePageProps {
  onSelectNote: (note: NoteDto) => void;
  notes?: NoteDto[];
  loading?: boolean;
  onRefresh?: () => void;
  onNoteUpdated?: (note: NoteDto) => void;
  onNoteDeleted?: (noteId: string) => void;
  onBack?: () => void;
  onToggleSideMenu?: () => void;
}

export const ArchivePage: React.FC<ArchivePageProps> = ({
  onSelectNote,
  notes: externalNotes,
  loading: externalLoading,
  onRefresh,
  onNoteUpdated,
  onNoteDeleted,
  onBack,
  onToggleSideMenu
}) => {
  const [internalNotes, setInternalNotes] = useState<NoteDto[]>([]);
  const [internalLoading, setInternalLoading] = useState(true);
  const { isDark, toggleTheme } = useTheme();
  const { logout, username, avatarUrl } = useAuth();

  const isControlled = externalNotes !== undefined;
  const allNotes = isControlled ? externalNotes : internalNotes;
  const loading = isControlled ? (externalLoading ?? false) : internalLoading;

  const loadNotes = useCallback(async () => {
    if (isControlled && onRefresh) {
      onRefresh();
      return;
    }
    try {
      setInternalLoading(true);
      const data = await ApiClient.getNotes();
      setInternalNotes(data);
    } catch (err) {
      console.error('Failed to load notes in ArchivePage', err);
    } finally {
      setInternalLoading(false);
    }
  }, [isControlled, onRefresh]);

  useEffect(() => {
    if (!isControlled) {
      loadNotes();
    }
  }, [isControlled, loadNotes]);

  const archivedNotes = allNotes.filter(n => n.isArchived);

  const handleUnarchive = async (note: NoteDto) => {
    const updated = { ...note, isArchived: false };
    if (!isControlled) {
      setInternalNotes(prev => prev.map(n => n.id === note.id ? updated : n));
    }
    if (onNoteUpdated) {
      onNoteUpdated(updated);
    }
    try {
      await ApiClient.updateNote(note.id, { isArchived: false });
    } catch (err) {
      console.error('Failed to unarchive note', err);
    }
  };

  const handlePinToggle = async (note: NoteDto) => {
    const updatedPinned = !note.isPinned;
    const updated = { ...note, isPinned: updatedPinned };
    if (!isControlled) {
      setInternalNotes(prev => prev.map(n => n.id === note.id ? updated : n));
    }
    if (onNoteUpdated) {
      onNoteUpdated(updated);
    }
    try {
      await ApiClient.updateNote(note.id, { isPinned: updatedPinned });
    } catch (err) {
      console.error('Failed to toggle pin in ArchivePage', err);
    }
  };

  const handleColorChange = async (note: NoteDto, color: string) => {
    const updated = { ...note, color };
    if (!isControlled) {
      setInternalNotes(prev => prev.map(n => n.id === note.id ? updated : n));
    }
    if (onNoteUpdated) {
      onNoteUpdated(updated);
    }
    try {
      await ApiClient.updateNote(note.id, { color });
    } catch (err) {
      console.error('Failed to change color in ArchivePage', err);
    }
  };

  const handleDelete = async (note: NoteDto) => {
    if (onNoteDeleted) {
      onNoteDeleted(note.id);
    } else {
      setInternalNotes(prev => prev.filter(n => n.id !== note.id));
      try {
        await ApiClient.deleteNote(note.id);
      } catch (err) {
        console.error('Failed to delete note in ArchivePage', err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 pb-20 transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-stone-50/80 dark:bg-stone-900/90 backdrop-blur-md border-b border-stone-200/60 dark:border-stone-800 px-4 py-3 sm:px-6 lg:px-8 transition-colors">
        <div className="w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {onToggleSideMenu && (
              <button
                type="button"
                onClick={onToggleSideMenu}
                title="Open menu"
                aria-label="Open menu"
                className="p-1.5 rounded-lg text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                title="Back to notes"
                aria-label="Back to notes"
                className="p-1.5 rounded-lg text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition mr-1"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-stone-700 dark:text-stone-300" />
              <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                Archive
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-1.5 rounded-lg text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-stone-600 dark:text-stone-300" />
              )}
            </button>

            {username && (
              <div className="flex items-center gap-1.5 py-1 px-2 rounded-xl bg-stone-100/70 dark:bg-stone-800/60 border border-stone-200/50 dark:border-stone-700/50">
                {avatarUrl ? (
                  avatarUrl.startsWith('http') || avatarUrl.startsWith('/api') || avatarUrl.startsWith('data:') ? (
                    <img
                      src={avatarUrl}
                      alt={username}
                      className="w-5 h-5 rounded-full object-cover border border-stone-300 dark:border-stone-600 shadow-sm"
                    />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-xs">
                      {avatarUrl}
                    </span>
                  )
                ) : (
                  <span className="w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 flex items-center justify-center text-xs font-bold uppercase">
                    {username.charAt(0)}
                  </span>
                )}
                <span className="text-xs font-medium text-stone-700 dark:text-stone-300 hidden sm:inline">
                  {username}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={logout}
              title="Sign out"
              aria-label="Sign out"
              className="p-1.5 rounded-lg text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-4 sm:px-6 lg:px-8 pt-8">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-stone-400 dark:text-stone-500">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-xs">Loading archived notes...</span>
          </div>
        ) : (
          <NoteGrid
            notes={archivedNotes}
            showArchived={true}
            emptyMessage="No archived notes"
            onSelectNote={onSelectNote}
            onPinToggle={handlePinToggle}
            onArchiveToggle={handleUnarchive}
            onColorChange={handleColorChange}
            onDeleteNote={handleDelete}
          />
        )}
      </main>
    </div>
  );
};
