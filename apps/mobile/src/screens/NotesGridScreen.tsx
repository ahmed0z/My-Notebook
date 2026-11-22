import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Modal, ScrollView } from 'react-native';
import { NoteDto, SpaceDto } from '@notebook/shared';
import { MobileApiClient } from '../api/mobileClient';
import { MobileNoteCard } from '../components/MobileNoteCard';
import { MobileSearchBar } from '../components/MobileSearchBar';
import { clearToken, clearUsername } from '../storage/authStorage';
import { useTheme } from '../context/ThemeContext';

interface NotesGridScreenProps {
  onSelectNote: (note: NoteDto) => void;
  onLogout: () => void;
  onToggleSideMenu?: () => void;
  onNavigate?: (screen: 'notes' | 'archive' | 'settings') => void;
  spaces?: SpaceDto[];
  activeSpaceId?: string | null;
  onSelectSpace?: (spaceId: string | null) => void;
  onMoveNote?: (note: NoteDto, spaceId: string | null) => Promise<void>;
}

export const NotesGridScreen: React.FC<NotesGridScreenProps> = ({
  onSelectNote,
  onLogout,
  onToggleSideMenu,
  onNavigate,
  spaces = [],
  activeSpaceId = null,
  onSelectSpace,
  onMoveNote,
}) => {
  const [notes, setNotes] = useState<NoteDto[]>([]);
  const [searchResults, setSearchResults] = useState<NoteDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [movingNote, setMovingNote] = useState<NoteDto | null>(null);

  const loadNotes = async () => {
    try {
      const data = await MobileApiClient.getNotes();
      setNotes(data);
    } catch (err) {
      console.error('Failed to load notes on mobile', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadNotes();
  };

  const handleSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults(null);
      return;
    }

    try {
      setSearching(true);
      const results = await MobileApiClient.searchNotes(trimmed);
      setSearchResults(results);
    } catch (err) {
      console.error('Failed to search notes on mobile', err);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleCreateNote = async () => {
    try {
      const newNote = await MobileApiClient.createNote('New Note', undefined, activeSpaceId);
      setNotes([newNote, ...notes]);
      if (searchResults !== null) {
        setSearchResults([newNote, ...searchResults]);
      }
      onSelectNote(newNote);
    } catch (err) {
      console.error('Failed to create note on mobile', err);
    }
  };

  const handleSelectTargetSpace = async (targetSpaceId: string | null) => {
    if (!movingNote) return;
    try {
      const updated = await MobileApiClient.moveNote(movingNote.id, targetSpaceId);
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      if (onMoveNote) {
        await onMoveNote(movingNote, targetSpaceId);
      }
    } catch (err) {
      console.error('Failed to move note on mobile', err);
    } finally {
      setMovingNote(null);
    }
  };

  const handleLogoutPress = async () => {
    await clearToken();
    await clearUsername();
    onLogout();
  };

  const { isDark, toggleTheme, colors } = useTheme();
  const activeSpace = activeSpaceId ? spaces.find((s) => s.id === activeSpaceId) : null;
  const filteredActiveNotes = activeSpaceId
    ? notes.filter((n) => !n.isArchived && n.spaceId === activeSpaceId)
    : notes.filter((n) => !n.isArchived);
  const displayNotes =
    searchResults !== null ? searchResults.filter((n) => !n.isArchived) : filteredActiveNotes;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerTitleGroup}>
          {onToggleSideMenu && (
            <TouchableOpacity
              onPress={onToggleSideMenu}
              style={styles.menuToggleBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Open menu"
            >
              <Text style={[styles.menuToggleText, { color: colors.text }]}>☰</Text>
            </TouchableOpacity>
          )}
          {activeSpace && onSelectSpace && (
            <TouchableOpacity
              onPress={() => onSelectSpace(null)}
              style={styles.backBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Back to All Notes"
            >
              <Text style={[styles.backBtnText, { color: colors.text }]}>←</Text>
            </TouchableOpacity>
          )}
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {activeSpace ? `📁 ${activeSpace.name}` : 'NoteBook'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={toggleTheme}
            style={styles.themeToggleBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Toggle theme"
          >
            <Text style={styles.themeToggleText}>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleLogoutPress}
            style={styles.logoutBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Sign out"
          >
            <Text style={[styles.logoutText, { color: colors.textMuted }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <MobileSearchBar onSearch={handleSearch} />
      </View>

      {loading || searching ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} size="large" />
        </View>
      ) : (
        <FlatList
          data={displayNotes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MobileNoteCard
              note={item}
              spaces={spaces}
              onPress={onSelectNote}
              onMovePress={(note) => setMovingNote(note)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {searchResults !== null
                  ? 'No matching notes found'
                  : activeSpace
                  ? `No notes in "${activeSpace.name}" yet`
                  : 'No notes found'}
              </Text>
            </View>
          }
        />
      )}

      {/* Move Note Modal */}
      {movingNote && (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={() => setMovingNote(null)}
        >
          <View style={styles.moveModalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              activeOpacity={1}
              onPress={() => setMovingNote(null)}
            />
            <View
              style={[
                styles.moveModalContent,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.moveModalTitle, { color: colors.text }]}>
                Move "{movingNote.title || 'Untitled Note'}" to space
              </Text>

              <TouchableOpacity
                style={[
                  styles.moveSpaceOption,
                  !movingNote.spaceId && {
                    backgroundColor: isDark ? '#292524' : '#e7e5e4',
                  },
                ]}
                onPress={() => handleSelectTargetSpace(null)}
              >
                <Text style={styles.optionIcon}>📑</Text>
                <Text
                  style={[
                    styles.moveSpaceOptionText,
                    {
                      color: !movingNote.spaceId ? colors.text : colors.textSecondary,
                      fontWeight: !movingNote.spaceId ? '700' : '500',
                    },
                  ]}
                >
                  No Space (General)
                </Text>
              </TouchableOpacity>

              {spaces.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.moveSpaceOption,
                    movingNote.spaceId === s.id && {
                      backgroundColor: isDark ? '#292524' : '#e7e5e4',
                    },
                  ]}
                  onPress={() => handleSelectTargetSpace(s.id)}
                >
                  <Text style={styles.optionIcon}>📁</Text>
                  <Text
                    style={[
                      styles.moveSpaceOptionText,
                      {
                        color: movingNote.spaceId === s.id ? colors.text : colors.textSecondary,
                        fontWeight: movingNote.spaceId === s.id ? '700' : '500',
                      },
                    ]}
                  >
                    {s.name}
                  </Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                onPress={() => setMovingNote(null)}
                style={[styles.cancelBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.buttonBg }]}
        activeOpacity={0.8}
        onPress={handleCreateNote}
        accessibilityLabel="Create note"
      >
        <Text style={[styles.fabText, { color: colors.buttonText }]}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuToggleBtn: {
    padding: 6,
  },
  menuToggleText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  backBtn: {
    padding: 6,
  },
  backBtnText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeToggleBtn: {
    padding: 6,
  },
  themeToggleText: {
    fontSize: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    maxWidth: 200,
  },
  logoutBtn: {
    padding: 6,
  },
  logoutText: {
    fontSize: 13,
  },
  searchContainer: {
    paddingHorizontal: 16,
  },
  moveModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  moveModalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    gap: 8,
  },
  moveModalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  moveSpaceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
  },
  optionIcon: {
    fontSize: 16,
  },
  moveSpaceOptionText: {
    fontSize: 14,
  },
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    color: '#a8a29e',
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1c1917',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  fabText: {
    fontSize: 28,
    color: '#ffffff',
    lineHeight: 32,
  },
});
