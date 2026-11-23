import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SettingsProvider } from './context/SettingsContext';
import { SetupPage } from './pages/SetupPage';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { ArchivePage } from './pages/ArchivePage';
import { SettingsPage } from './pages/SettingsPage';
import { SideMenu } from './components/SideMenu';
import { BlockEditorModal } from './components/editor/BlockEditorModal';
import { ApiClient } from './api/client';
import { NoteDto, SpaceDto } from '@notebook/shared';
import { Loader2 } from 'lucide-react';

export const AppContent: React.FC = () => {
  const { token, isConfigured, isLoading, serverWaking } = useAuth();
  const [notes, setNotes] = useState<NoteDto[]>([]);
  const [spaces, setSpaces] = useState<SpaceDto[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [notesLoading, setNotesLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState<NoteDto | null>(null);
  const [activePage, setActivePage] = useState<'home' | 'archive' | 'settings'>('home');
  const [sideMenuOpen, setSideMenuOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('notebook_master_sidebar_open');
      if (saved !== null) return saved === 'true';
      return typeof window !== 'undefined' && window.innerWidth >= 768;
    } catch {
      return true;
    }
  });

  const toggleSideMenu = useCallback(() => {
    setSideMenuOpen(prev => {
      const next = !prev;
      try {
        localStorage.setItem('notebook_master_sidebar_open', String(next));
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl+\ or Cmd+\ toggles master sidebar (Notion convention)
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        toggleSideMenu();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [toggleSideMenu]);

  const loadNotes = useCallback(async () => {
    try {
      setNotesLoading(true);
      const data = await ApiClient.getNotes();
      setNotes(data);
    } catch (err) {
      console.error('Failed to load notes in App', err);
    } finally {
      setNotesLoading(false);
    }
  }, []);

  const loadSpaces = useCallback(async () => {
    try {
      const data = await ApiClient.getSpaces();
      setSpaces(data);
    } catch (err) {
      console.error('Failed to load spaces in App', err);
    }
  }, []);

  useEffect(() => {
    if (token) {
      loadNotes();
      loadSpaces();
    }
  }, [token, loadNotes, loadSpaces]);

  const handleNoteCreated = (newNote: NoteDto) => {
    setNotes(prev => [newNote, ...prev]);
    setSelectedNote(newNote);
  };

  const handleNoteUpdated = (updated: NoteDto) => {
    setNotes(prev => prev.map(n => n.id === updated.id ? { ...n, ...updated } : n));
    setSelectedNote(prev => prev && prev.id === updated.id ? { ...prev, ...updated } : prev);
  };

  const handleDeleteNote = async (noteId: string) => {
    // Optimistic deletion: update UI instantly without waiting for network
    setNotes(prev => prev.filter(n => n.id !== noteId));
    if (selectedNote?.id === noteId) {
      setSelectedNote(null);
    }
    try {
      await ApiClient.deleteNote(noteId);
    } catch (err) {
      console.error('Failed to delete note on server', err);
    }
  };

  const handleCreateSpace = async (name: string, parentSpaceId?: string | null) => {
    const created = await ApiClient.createSpace(name, parentSpaceId);
    setSpaces(prev => [...prev, created]);
  };

  const handleUpdateSpace = async (id: string, updates: { name?: string; parentSpaceId?: string | null }) => {
    const updated = await ApiClient.updateSpace(id, updates);
    setSpaces(prev => prev.map(s => s.id === id ? updated : s));
  };

  const handleDeleteSpace = async (id: string) => {
    await ApiClient.deleteSpace(id);
    await loadSpaces();
    await loadNotes();
    if (activeSpaceId === id) {
      setActiveSpaceId(null);
    }
  };

  const handleMoveNote = async (note: NoteDto, spaceId: string | null) => {
    try {
      const updated = await ApiClient.moveNote(note.id, spaceId);
      handleNoteUpdated(updated);
    } catch (err) {
      console.error('Failed to move note', err);
    }
  };

  if (serverWaking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 dark:bg-stone-950 text-stone-600 dark:text-stone-300 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-stone-900 dark:text-stone-100" />
        <p className="text-sm font-medium">Connecting to server...</p>
        <p className="text-xs text-stone-400 dark:text-stone-500">MonsterASP is starting up from idle state. Retrying automatically.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 text-stone-400 dark:text-stone-500">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (isConfigured === false) {
    return <SetupPage />;
  }

  if (!token) {
    return <LoginPage />;
  }

  const handleCreateNoteInSpace = async (spaceId?: string | null) => {
    try {
      const newNote = await ApiClient.createNote('Untitled', undefined, spaceId || activeSpaceId || undefined);
      handleNoteCreated(newNote);
    } catch (err) {
      console.error('Failed to create note in space', err);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-stone-50 dark:bg-stone-950 transition-colors flex">
      {/* Notion-style Persistent Master Sidebar */}
      <SideMenu
        isOpen={sideMenuOpen}
        onClose={() => setSideMenuOpen(false)}
        onNavigate={(page) => {
          setActivePage(page);
          setSelectedNote(null);
        }}
        currentPage={activePage}
        spaces={spaces}
        notes={notes}
        activeSpaceId={activeSpaceId}
        selectedNoteId={selectedNote?.id || null}
        onSelectSpace={(spaceId) => {
          setActiveSpaceId(spaceId);
          setActivePage('home');
          setSelectedNote(null);
        }}
        onSelectNote={(note) => {
          setSelectedNote(note);
          setActivePage('home');
        }}
        onCreateNote={handleCreateNoteInSpace}
        onCreateSpace={handleCreateSpace}
        onUpdateSpace={handleUpdateSpace}
        onDeleteSpace={handleDeleteSpace}
      />

      {/* Main Workspace Canvas */}
      <div className={`flex-1 h-full min-w-0 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${sideMenuOpen ? 'md:pl-64' : 'pl-0'}`}>
        {selectedNote ? (
          <BlockEditorModal
            note={selectedNote}
            notes={notes}
            spaces={spaces}
            isEmbedded={true}
            isMasterSidebarOpen={sideMenuOpen}
            onToggleMasterSidebar={toggleSideMenu}
            onClose={() => setSelectedNote(null)}
            onNoteUpdated={handleNoteUpdated}
            onDeleteNote={handleDeleteNote}
            onOpenNote={async (targetId) => {
              try {
                const fullNote = await ApiClient.getNote(targetId);
                setSelectedNote(fullNote);
              } catch (err) {
                console.error('Failed to open linked note', err);
              }
            }}
          />
        ) : (
          <div className="flex-1 w-full h-full overflow-y-auto custom-scrollbar">
            {activePage === 'home' && (
              <HomePage
                notes={notes}
                loading={notesLoading}
                onRefresh={loadNotes}
                onSelectNote={(note) => setSelectedNote(note)}
                onNoteCreated={handleNoteCreated}
                onNoteUpdated={handleNoteUpdated}
                onNoteDeleted={handleDeleteNote}
                onToggleSideMenu={toggleSideMenu}
                activeSpaceId={activeSpaceId}
                spaces={spaces}
                onSelectSpace={setActiveSpaceId}
                onMoveNote={handleMoveNote}
              />
            )}

            {activePage === 'archive' && (
              <ArchivePage
                notes={notes}
                loading={notesLoading}
                onRefresh={loadNotes}
                onSelectNote={(note) => setSelectedNote(note)}
                onNoteUpdated={handleNoteUpdated}
                onNoteDeleted={handleDeleteNote}
                onBack={() => setActivePage('home')}
                onToggleSideMenu={toggleSideMenu}
              />
            )}

            {activePage === 'settings' && (
              <SettingsPage
                onBack={() => setActivePage('home')}
                onToggleSideMenu={toggleSideMenu}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <AppContent />
      </SettingsProvider>
    </ThemeProvider>
  );
};

export default App;
