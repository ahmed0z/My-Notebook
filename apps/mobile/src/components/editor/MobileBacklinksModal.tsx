import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet
} from 'react-native';
import { NoteDto, BlockDto } from '@notebook/shared';
import { MobileApiClient } from '../../api/mobileClient';
import { useTheme } from '../../context/ThemeContext';

export function extractMobileBacklinkSnippet(blocks?: BlockDto[] | any[]): string {
  if (!blocks || blocks.length === 0) return '';

  const parsedBlocks = blocks.map(block => {
    let content: any = block.content;
    if (typeof content === 'string') {
      try {
        content = JSON.parse(content);
      } catch {
        content = {};
      }
    }
    if (!content) return '';

    if (content.text && typeof content.text === 'string' && content.text.trim()) {
      return content.text.trim();
    }
    if (Array.isArray(content.items) && content.items.length > 0) {
      return content.items
        .map((i: any) => i.text)
        .filter(Boolean)
        .join(', ');
    }
    if (content.caption && typeof content.caption === 'string' && content.caption.trim()) {
      return content.caption.trim();
    }
    return '';
  }).filter(Boolean);

  if (parsedBlocks.length === 0) return '';

  // Prioritize blocks containing "[["
  const linkBlock = parsedBlocks.find(txt => txt.includes('[['));
  if (linkBlock) return linkBlock;

  return parsedBlocks[0];
}

export interface MobileBacklinksModalProps {
  visible: boolean;
  noteId: string;
  onClose: () => void;
  onSelectNote: (noteId: string) => void;
}

export const MobileBacklinksModal: React.FC<MobileBacklinksModalProps> = ({
  visible,
  noteId,
  onClose,
  onSelectNote
}) => {
  const [backlinks, setBacklinks] = useState<NoteDto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchBacklinks = async () => {
      if (!visible || !noteId) return;
      try {
        setLoading(true);
        const data = await MobileApiClient.getBacklinks(noteId);
        if (isMounted) {
          setBacklinks(data || []);
        }
      } catch (err) {
        console.error('Failed to load mobile backlinks', err);
        if (isMounted) setBacklinks([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchBacklinks();
    return () => { isMounted = false; };
  }, [visible, noteId]);

  const { isDark, colors } = useTheme();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheetContainer, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Backlinks {backlinks.length > 0 ? `(${backlinks.length})` : ''}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Close backlinks"
            >
              <Text style={[styles.closeBtnText, { color: colors.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Body */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.text} size="small" />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading backlinks...</Text>
            </View>
          ) : backlinks.length === 0 ? (
            <View style={styles.center}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No backlinks yet</Text>
              <Text style={[styles.emptySubText, { color: colors.textMuted }]}>
                Other notes mentioning [[this note]] will appear here.
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.list}>
              {backlinks.map((note) => {
                const snippet = extractMobileBacklinkSnippet(note.blocks);
                return (
                  <TouchableOpacity
                    key={note.id}
                    onPress={() => {
                      onSelectNote(note.id);
                      onClose();
                    }}
                    style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={styles.cardHeader}>
                      <Text style={[styles.noteTitle, { color: colors.text }]}>
                        {note.title || 'Untitled Note'}
                      </Text>
                      <Text style={[styles.arrowIcon, { color: colors.textMuted }]}>→</Text>
                    </View>
                    {snippet ? (
                      <Text style={[styles.snippet, { color: colors.textMuted }]} numberOfLines={2}>
                        {snippet}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    maxHeight: '50%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f4',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1c1917',
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 16,
    color: '#78716c',
  },
  center: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    color: '#78716c',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#78716c',
    marginBottom: 4,
  },
  emptySubText: {
    fontSize: 12,
    color: '#a8a29e',
    textAlign: 'center',
  },
  list: {
    marginTop: 12,
  },
  card: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#fafaf9',
    borderWidth: 1,
    borderColor: '#e7e5e4',
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1c1917',
    flex: 1,
  },
  arrowIcon: {
    fontSize: 14,
    color: '#78716c',
    marginLeft: 8,
  },
  snippet: {
    fontSize: 12,
    color: '#78716c',
    marginTop: 6,
    lineHeight: 16,
  },
});
