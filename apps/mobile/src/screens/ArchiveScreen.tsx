import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { NoteDto } from '@notebook/shared';
import { MobileApiClient } from '../api/mobileClient';
import { MobileNoteCard } from '../components/MobileNoteCard';
import { useTheme } from '../context/ThemeContext';

export interface ArchiveScreenProps {
  onBack: () => void;
  onSelectNote: (note: NoteDto) => void;
  onToggleSideMenu?: () => void;
}

export const ArchiveScreen: React.FC<ArchiveScreenProps> = ({
  onBack,
  onSelectNote,
  onToggleSideMenu,
}) => {
  const [archivedNotes, setArchivedNotes] = useState<NoteDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { colors, isDark, toggleTheme } = useTheme();

  const loadArchivedNotes = useCallback(async () => {
    try {
      const allNotes = await MobileApiClient.getNotes();
      const filtered = allNotes.filter((n) => n.isArchived);
      setArchivedNotes(filtered);
    } catch (err) {
      console.error('Failed to load archived notes on mobile', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadArchivedNotes();
  }, [loadArchivedNotes]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadArchivedNotes();
  };

  const handleUnarchive = async (note: NoteDto) => {
    // Optimistic UI update
    setArchivedNotes((prev) => prev.filter((n) => n.id !== note.id));
    try {
      await MobileApiClient.updateNote(note.id, { isArchived: false });
    } catch (err) {
      console.error('Failed to unarchive note on mobile', err);
      // Revert if error
      loadArchivedNotes();
    }
  };

  const handleDelete = async (note: NoteDto) => {
    setArchivedNotes((prev) => prev.filter((n) => n.id !== note.id));
    try {
      await MobileApiClient.deleteNote(note.id);
    } catch (err) {
      console.error('Failed to delete archived note on mobile', err);
      loadArchivedNotes();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {onToggleSideMenu && (
            <TouchableOpacity
              onPress={onToggleSideMenu}
              style={styles.headerBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Open menu"
            >
              <Text style={[styles.headerBtnText, { color: colors.text }]}>☰</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={onBack}
            style={styles.headerBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Back to notes"
          >
            <Text style={[styles.headerBtnText, { color: colors.text }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Archive</Text>
        </View>
        <TouchableOpacity
          onPress={toggleTheme}
          style={styles.headerBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Toggle theme"
        >
          <Text style={{ fontSize: 16 }}>{isDark ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} size="large" />
        </View>
      ) : (
        <FlatList
          data={archivedNotes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MobileNoteCard
              note={item}
              onPress={onSelectNote}
              onUnarchive={handleUnarchive}
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No archived notes
              </Text>
            </View>
          }
        />
      )}
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
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBtn: {
    padding: 6,
  },
  headerBtnText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 22,
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
    paddingTop: 80,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyText: {
    fontSize: 15,
  },
});
