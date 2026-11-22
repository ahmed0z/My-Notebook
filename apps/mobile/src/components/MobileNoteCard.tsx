import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NoteDto, SpaceDto } from '@notebook/shared';
import { useTheme } from '../context/ThemeContext';

interface MobileNoteCardProps {
  note: NoteDto;
  onPress: (note: NoteDto) => void;
  onUnarchive?: (note: NoteDto) => void;
  onDelete?: (note: NoteDto) => void;
  spaces?: SpaceDto[];
  onMovePress?: (note: NoteDto) => void;
}

export const MobileNoteCard: React.FC<MobileNoteCardProps> = ({
  note,
  onPress,
  onUnarchive,
  onDelete,
  spaces = [],
  onMovePress,
}) => {
  const { isDark, colors, getNoteCardColor } = useTheme();
  const cardBg = getNoteCardColor(note.color, isDark);
  const currentSpace = spaces.find((s) => s.id === note.spaceId);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(note)}
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'
        }
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleWrapper}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {note.title || 'Untitled Note'}
          </Text>
          {currentSpace && (
            <View style={styles.spaceBadge}>
              <Text style={styles.spaceBadgeText}>📁 {currentSpace.name}</Text>
            </View>
          )}
        </View>
        {note.isPinned && <Text style={styles.pinIcon} accessibilityLabel="Pinned">📌</Text>}
      </View>

      {note.blocks && note.blocks.length > 0 && (
        <View style={styles.blocksContainer}>
          {note.blocks.slice(0, 3).map((b) => {
            try {
              const raw = (b as any).contentJson ?? (b as any).content;
              const parsed = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
              if (b.type === 'checklist') {
                const items = parsed.items || [];
                return (
                  <View key={b.id} style={styles.checklistContainer}>
                    {items.slice(0, 2).map((it: any, idx: number) => (
                      <View key={it.id || idx} style={styles.checklistItem}>
                        <View
                          style={[
                            styles.previewCheckbox,
                            { borderColor: colors.border }
                          ]}
                        >
                          {it.checked ? (
                            <Text style={[styles.previewCheckmark, { color: colors.text }]}>✓</Text>
                          ) : null}
                        </View>
                        <Text
                          style={[
                            styles.itemText,
                            { color: it.checked ? colors.textMuted : colors.text },
                            it.checked && styles.itemTextChecked
                          ]}
                          numberOfLines={1}
                        >
                          {it.text}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              }
              if (b.type === 'text' && parsed.text) {
                return (
                  <Text key={b.id} style={[styles.textPreview, { color: colors.textMuted }]} numberOfLines={2}>
                    {parsed.text}
                  </Text>
                );
              }
            } catch {
              return null;
            }
            return null;
          })}
        </View>
      )}

      <View style={styles.cardFooter}>
        <Text style={[styles.timestamp, { color: colors.textMuted }]}>
          {new Date(note.updatedAt || Date.now()).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric'
          })}
        </Text>
        {(onUnarchive || onDelete || onMovePress) && (
          <View style={styles.cardActions}>
            {onMovePress && (
              <TouchableOpacity
                onPress={() => onMovePress(note)}
                style={styles.actionBtn}
                accessibilityLabel="Move note to space"
              >
                <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>
                  📂
                </Text>
              </TouchableOpacity>
            )}
            {onUnarchive && (
              <TouchableOpacity
                onPress={() => onUnarchive(note)}
                style={styles.actionBtn}
                accessibilityLabel="Unarchive note"
              >
                <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>
                  📦 Unarchive
                </Text>
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                onPress={() => onDelete(note)}
                style={styles.actionBtn}
                accessibilityLabel="Delete note"
              >
                <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>
                  🗑️
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1917',
    flex: 1,
  },
  titleWrapper: {
    flex: 1,
  },
  spaceBadge: {
    marginTop: 3,
    alignSelf: 'flex-start',
  },
  spaceBadgeText: {
    fontSize: 11,
    color: '#b45309',
    fontWeight: '500',
  },
  pinIcon: {
    fontSize: 12,
    marginLeft: 6,
  },
  blocksContainer: {
    marginVertical: 4,
  },
  checklistContainer: {
    marginVertical: 2,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 1.5,
  },
  previewCheckbox: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#78716c',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  previewCheckmark: {
    fontSize: 9,
    fontWeight: 'bold',
    lineHeight: 11,
  },
  itemText: {
    fontSize: 12,
    flex: 1,
  },
  itemTextChecked: {
    textDecorationLine: 'line-through',
  },
  textPreview: {
    fontSize: 12,
    lineHeight: 16,
    marginVertical: 2,
  },
  timestamp: {
    fontSize: 11,
    color: '#78716c',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
