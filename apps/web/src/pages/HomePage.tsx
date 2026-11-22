import React, { useState, useEffect, useCallback } from 'react';
import { NoteDto, SpaceDto } from '@notebook/shared';
import { ApiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { NoteGrid } from '../components/NoteGrid';
import { QuickCaptureBar } from '../components/QuickCaptureBar';
import { Header } from '../components/Header';
import { Loader2 } from 'lucide-react';

export interface HomePageProps {
  onSelectNote: (note: NoteDto) => void;
  notes?: NoteDto[];
  loading?: boolean;
  onRefresh?: () => void;
  onNoteCreated?: (note: NoteDto) => void;
  onNoteUpdated?: (note: NoteDto) => void;
  onNoteDeleted?: (noteId: string) => void;
  onToggleSideMenu?: () => void;
  activeSpaceId?: string | null;
  spaces?: SpaceDto[];
  onSelectSpace?: (spaceId: string | null) => void;
  onMoveNote?: (note: NoteDto, spaceId: string | null) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onSelectNote,
  notes: externalNotes,
  loading: externalLoading,
  onRefresh,
  onNoteCreated,
  onNoteUpdated,
  onNoteDeleted,
  onToggleSideMenu,
  activeSpaceId = null,
  spaces = [],
  onSelectSpace,
  onMoveNote
}) => {
  const { logout, username } = useAuth();
  const [internalNotes, setInternalNotes] = useState<NoteDto[]>([]);
  const [internalLoading, setInternalLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<NoteDto[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const isControlled = externalNotes !== undefined;
  const notes = isControlled ? externalNotes : internalNotes;
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
      console.error('Failed to load notes', err);
    } finally {
      setInternalLoading(false);
    }
  }, [isControlled, onRefresh]);

  useEffect(() => {
    if (!isControlled) {
      loadNotes();
    }
  }, [isControlled, loadNotes]);

  const handleSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setSearchResults(null);
      return;
    }

    try {
      setSearchLoading(true);
      const results = await ApiClient.searchNotes(trimmed);
      setSearchResults(results);
    } catch (err) {
      console.error('Failed to search notes', err);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleCreate = async (title: string) => {
    try {
      const newNote = await ApiClient.createNote(title, undefined, activeSpaceId);
      if (!isControlled) {
        setInternalNotes(prev => [newNote, ...prev]);
      }
      if (onNoteCreated) {
        onNoteCreated(newNote);
      }
      if (searchResults !== null) {
        setSearchResults(prev => prev ? [newNote, ...prev] : [newNote]);
      }
      onSelectNote(newNote);
    } catch (err) {
      console.error('Failed to create note', err);
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
    if (searchResults !== null) {
      setSearchResults(prev => prev ? prev.map(n => n.id === note.id ? updated : n) : null);
    }
    try {
      await ApiClient.updateNote(note.id, { isPinned: updatedPinned });
    } catch (err) {
      console.error('Failed to toggle pin', err);
    }
  };

  const handleArchiveToggle = async (note: NoteDto) => {
    const updatedArchived = !note.isArchived;
    const updated = { ...note, isArchived: updatedArchived };
    if (!isControlled) {
      setInternalNotes(prev => prev.map(n => n.id === note.id ? updated : n));
    }
    if (onNoteUpdated) {
      onNoteUpdated(updated);
    }
    if (searchResults !== null) {
      setSearchResults(prev => prev ? prev.filter(n => n.id !== note.id) : null);
    }
    try {
      await ApiClient.updateNote(note.id, { isArchived: updatedArchived });
    } catch (err) {
      console.error('Failed to toggle archive', err);
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
    if (searchResults !== null) {
      setSearchResults(prev => prev ? prev.map(n => n.id === note.id ? updated : n) : null);
    }
    try {
      await ApiClient.updateNote(note.id, { color });
    } catch (err) {
      console.error('Failed to change note color', err);
    }
  };

  const handleDelete = async (note: NoteDto) => {
    // Optimistic UI removal: remove from state immediately
    if (searchResults !== null) {
      setSearchResults(prev => prev ? prev.filter(n => n.id !== note.id) : null);
    }
    if (onNoteDeleted) {
      onNoteDeleted(note.id);
    } else {
      setInternalNotes(prev => prev.filter(n => n.id !== note.id));
      try {
        await ApiClient.deleteNote(note.id);
      } catch (err) {
        console.error('Failed to delete note on server', err);
      }
    }
  };

  const activeSpace = activeSpaceId ? spaces.find(s => s.id === activeSpaceId) : null;
  const filteredNotes = activeSpaceId ? notes.filter(n => n.spaceId === activeSpaceId) : notes;

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 pb-20 transition-colors">
      <Header
        onSearch={handleSearch}
        username={username}
        onLogout={logout}
        onToggleSideMenu={onToggleSideMenu}
        activeSpace={activeSpace}
        onBackToAllNotes={() => onSelectSpace?.(null)}
      />

      {/* Main Content */}
      <main className="w-full px-4 sm:px-6 lg:px-8 pt-8">
        <QuickCaptureBar onCreate={handleCreate} />

        {loading || searchLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-stone-400 dark:text-stone-500">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-xs">{searchLoading ? 'Searching notes...' : 'Loading notes...'}</span>
          </div>
        ) : searchResults !== null ? (
          searchResults.length === 0 ? (
            <div className="py-24 text-center">
              <p className="text-stone-400 dark:text-stone-500 text-sm">No matching notes found</p>
            </div>
          ) : (
            <NoteGrid
              notes={searchResults}
              onSelectNote={onSelectNote}
              onPinToggle={handlePinToggle}
              onArchiveToggle={handleArchiveToggle}
              onColorChange={handleColorChange}
              onDeleteNote={handleDelete}
              spaces={spaces}
              onMoveNote={onMoveNote}
            />
          )
        ) : (
          <NoteGrid
            notes={filteredNotes}
            onSelectNote={onSelectNote}
            onPinToggle={handlePinToggle}
            onArchiveToggle={handleArchiveToggle}
            onColorChange={handleColorChange}
            onDeleteNote={handleDelete}
            spaces={spaces}
            onMoveNote={onMoveNote}
            emptyMessage={activeSpace ? `No notes in "${activeSpace.name}" yet` : undefined}
          />
        )}
      </main>
    </div>
  );
};
