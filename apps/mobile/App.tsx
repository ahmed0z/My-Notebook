import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { getToken } from './src/storage/authStorage';
import { LoginScreen } from './src/screens/LoginScreen';
import { NotesGridScreen } from './src/screens/NotesGridScreen';
import { ArchiveScreen } from './src/screens/ArchiveScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { MobileSideMenu } from './src/components/MobileSideMenu';
import { NoteDetailScreen } from './src/screens/NoteDetailScreen';
import { MobileApiClient } from './src/api/mobileClient';
import { NoteDto, SpaceDto } from '@notebook/shared';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { SettingsProvider } from './src/context/SettingsContext';

export function AppContent() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [spaces, setSpaces] = useState<SpaceDto[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<NoteDto | null>(null);
  const [activeScreen, setActiveScreen] = useState<'notes' | 'archive' | 'settings'>('notes');
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const { isDark, colors } = useTheme();

  const loadSpaces = async () => {
    try {
      const data = await MobileApiClient.getSpaces();
      setSpaces(data);
    } catch (err) {
      console.error('Failed to load spaces on mobile', err);
    }
  };

  const checkAuth = async () => {
    try {
      const storedToken = await getToken();
      setToken(storedToken);
      if (storedToken) {
        await loadSpaces();
      }
    } catch {
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleCreateSpace = async (name: string, parentSpaceId?: string | null) => {
    const created = await MobileApiClient.createSpace(name, parentSpaceId);
    setSpaces((prev) => [...prev, created]);
  };

  const handleUpdateSpace = async (id: string, updates: { name?: string; parentSpaceId?: string | null }) => {
    const updated = await MobileApiClient.updateSpace(id, updates);
    setSpaces((prev) => prev.map((s) => (s.id === id ? updated : s)));
  };

  const handleDeleteSpace = async (id: string) => {
    await MobileApiClient.deleteSpace(id);
    await loadSpaces();
    if (activeSpaceId === id) {
      setActiveSpaceId(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  const toggleSideMenu = () => setSideMenuOpen(prev => !prev);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <MobileSideMenu
        isOpen={sideMenuOpen}
        onClose={() => setSideMenuOpen(false)}
        onNavigate={(screen) => {
          setActiveScreen(screen);
          setSideMenuOpen(false);
        }}
        currentScreen={activeScreen}
        spaces={spaces}
        activeSpaceId={activeSpaceId}
        onSelectSpace={(spaceId) => {
          setActiveSpaceId(spaceId);
          setActiveScreen('notes');
        }}
        onCreateSpace={handleCreateSpace}
        onUpdateSpace={handleUpdateSpace}
        onDeleteSpace={handleDeleteSpace}
      />
      {!token ? (
        <LoginScreen onLoginSuccess={checkAuth} />
      ) : selectedNote ? (
        <NoteDetailScreen
          noteId={selectedNote.id}
          onBack={() => setSelectedNote(null)}
          onOpenNote={async (targetId) => {
            try {
              const fullNote = await MobileApiClient.getNote(targetId);
              setSelectedNote(fullNote);
            } catch (err) {
              console.error('Failed to open linked note on mobile', err);
            }
          }}
        />
      ) : activeScreen === 'archive' ? (
        <ArchiveScreen
          onBack={() => setActiveScreen('notes')}
          onSelectNote={(note) => setSelectedNote(note)}
          onToggleSideMenu={toggleSideMenu}
        />
      ) : activeScreen === 'settings' ? (
        <SettingsScreen
          onBack={() => setActiveScreen('notes')}
          onToggleSideMenu={toggleSideMenu}
        />
      ) : (
        <NotesGridScreen
          onSelectNote={(note) => setSelectedNote(note)}
          onLogout={() => {
            setToken(null);
            setSelectedNote(null);
          }}
          onToggleSideMenu={toggleSideMenu}
          onNavigate={(screen) => setActiveScreen(screen)}
          spaces={spaces}
          activeSpaceId={activeSpaceId}
          onSelectSpace={setActiveSpaceId}
        />
      )}
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <AppContent />
      </SettingsProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
