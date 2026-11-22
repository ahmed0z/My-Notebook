import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Modal
} from 'react-native';
import { NoteDto, BlockDto, SpaceDto } from '@notebook/shared';
import { MobileApiClient } from '../api/mobileClient';
import { MobileBlockEditor } from '../components/editor/MobileBlockEditor';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';

interface NoteDetailScreenProps {
  noteId: string;
  onBack: () => void;
  onOpenNote?: (noteId: string) => void;
  spaces?: SpaceDto[];
}

export const NoteDetailScreen: React.FC<NoteDetailScreenProps> = ({ noteId, onBack, onOpenNote, spaces: initialSpaces }) => {
  const { defaultView } = useSettings();
  const [activeNoteId, setActiveNoteId] = useState(noteId);
  const [note, setNote] = useState<NoteDto | null>(null);
  const [blocks, setBlocks] = useState<BlockDto[]>([]);
  const [spaces, setSpaces] = useState<SpaceDto[]>(initialSpaces || []);
  const [loading, setLoading] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(defaultView === 'fullscreen');
  const [showSpaceModal, setShowSpaceModal] = useState(false);

  useEffect(() => {
    setActiveNoteId(noteId);
  }, [noteId]);

  useEffect(() => {
    const fetchNote = async () => {
      try {
        setLoading(true);
        const data = await MobileApiClient.getNote(activeNoteId);
        setNote(data);
        setBlocks(data.blocks || []);
      } catch (err) {
        console.error('Failed to load note details on mobile', err);
      } finally {
        setLoading(false);
      }
    };
    fetchNote();
  }, [activeNoteId]);

  useEffect(() => {
    MobileApiClient.getSpaces().then(setSpaces).catch(() => {});
  }, []);

  const handleMoveNote = async (targetSpaceId: string | null) => {
    if (!note) return;
    try {
      const updated = await MobileApiClient.moveNote(note.id, targetSpaceId);
      setNote(updated);
    } catch (err) {
      console.error('Failed to move note on mobile detail', err);
    } finally {
      setShowSpaceModal(false);
    }
  };

  const handleOpenNote = async (targetIdOrTitle: string) => {
    let targetId = targetIdOrTitle;
    try {
      const allNotes = await MobileApiClient.getNotes();
      const match = allNotes.find(n => n.id === targetIdOrTitle || n.title.toLowerCase() === targetIdOrTitle.toLowerCase());
      if (match) targetId = match.id;
    } catch {
      // ignore
    }

    if (onOpenNote) {
      onOpenNote(targetId);
    } else {
      setActiveNoteId(targetId);
    }
  };

  const handleTitleChange = async (newTitle: string) => {
    if (!note) return;
    setNote({ ...note, title: newTitle });
    try {
      await MobileApiClient.updateNote(note.id, { title: newTitle });
    } catch (err) {
      console.error('Failed to update title', err);
    }
  };

  const handlePinToggle = async () => {
    if (!note) return;
    const isPinned = !note.isPinned;
    setNote({ ...note, isPinned });
    try {
      await MobileApiClient.updateNote(note.id, { isPinned });
    } catch (err) {
      console.error('Failed to toggle pin', err);
    }
  };

  const handleDelete = async () => {
    if (!note) return;
    try {
      await MobileApiClient.deleteNote(note.id);
      onBack();
    } catch (err) {
      console.error('Failed to delete note', err);
    }
  };

  const { isDark, colors, getNoteCardColor } = useTheme();

  if (loading || !note) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.text} size="large" />
      </View>
    );
  }

  const cardBg = getNoteCardColor(note.color, isDark);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[
        styles.container,
        isFullScreen ? styles.fullscreenContainer : styles.compactContainer,
        { backgroundColor: cardBg },
        !isFullScreen && { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }
      ]}
    >
      {/* Header bar */}
      <View style={[styles.header, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Back to notes"
        >
          <Text style={[styles.backText, { color: colors.text }]}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setIsFullScreen(prev => !prev)}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={isFullScreen ? 'Exit full screen' : 'Full screen'}
            testID="toggle-fullscreen-btn"
          >
            <Text style={styles.iconText}>{isFullScreen ? '🗗' : '⛶'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowSpaceModal(true)}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Move note to space"
          >
            <Text style={styles.iconText}>📁</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePinToggle}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={note.isPinned ? 'Unpin' : 'Pin note'}
          >
            <Text style={styles.iconText}>{note.isPinned ? '📌' : '📍'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDelete}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Delete note"
          >
            <Text style={styles.iconText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <TextInput
          style={[styles.titleInput, { color: colors.text }]}
          value={note.title}
          placeholder="Title"
          accessibilityLabel="Note title"
          placeholderTextColor={colors.textMuted}
          onChangeText={handleTitleChange}
        />

        <MobileBlockEditor noteId={note.id} initialBlocks={blocks} onOpenNote={handleOpenNote} />
      </ScrollView>

      {/* Move to Space Modal */}
      {showSpaceModal && (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSpaceModal(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              activeOpacity={1}
              onPress={() => setShowSpaceModal(false)}
            />
            <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Move to Space</Text>

              <TouchableOpacity
                style={[
                  styles.spaceOption,
                  !note.spaceId && { backgroundColor: isDark ? '#292524' : '#e7e5e4' },
                ]}
                onPress={() => handleMoveNote(null)}
              >
                <Text style={styles.optionIcon}>📑</Text>
                <Text
                  style={[
                    styles.spaceOptionText,
                    {
                      color: !note.spaceId ? colors.text : colors.textSecondary,
                      fontWeight: !note.spaceId ? '700' : '500',
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
                    styles.spaceOption,
                    note.spaceId === s.id && { backgroundColor: isDark ? '#292524' : '#e7e5e4' },
                  ]}
                  onPress={() => handleMoveNote(s.id)}
                >
                  <Text style={styles.optionIcon}>📁</Text>
                  <Text
                    style={[
                      styles.spaceOptionText,
                      {
                        color: note.spaceId === s.id ? colors.text : colors.textSecondary,
                        fontWeight: note.spaceId === s.id ? '700' : '500',
                      },
                    ]}
                  >
                    {s.name}
                  </Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                onPress={() => setShowSpaceModal(false)}
                style={[styles.cancelBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  compactContainer: {
    marginHorizontal: 12,
    marginVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fullscreenContainer: {
    marginHorizontal: 0,
    marginVertical: 0,
    borderRadius: 0,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafaf9',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1c1917',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    padding: 6,
  },
  iconText: {
    fontSize: 16,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1c1917',
    marginBottom: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  spaceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
  },
  optionIcon: {
    fontSize: 16,
  },
  spaceOptionText: {
    fontSize: 14,
  },
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});
