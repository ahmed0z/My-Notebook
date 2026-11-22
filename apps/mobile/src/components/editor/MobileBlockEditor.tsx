import React, { useReducer, useEffect, useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { BlockDto, BlockType } from '@notebook/shared';
import { blockReducer } from './blockReducer';
import { MobileTextBlock } from './MobileTextBlock';
import { MobileChecklistBlock } from './MobileChecklistBlock';
import { MobileTableBlock } from './MobileTableBlock';
import { MobileImageBlock } from './MobileImageBlock';
import { MobileBacklinksModal } from './MobileBacklinksModal';
import { BlockToolbar } from './BlockToolbar';
import { MobileApiClient } from '../../api/mobileClient';
import { useTheme } from '../../context/ThemeContext';

interface MobileBlockEditorProps {
  noteId: string;
  initialBlocks: BlockDto[];
  onOpenNote?: (targetTitleOrId: string) => void;
}

export const MobileBlockEditor: React.FC<MobileBlockEditorProps> = ({ noteId, initialBlocks, onOpenNote }) => {
  const [blocks, dispatch] = useReducer(blockReducer, initialBlocks);
  const [isSaving, setIsSaving] = useState(false);
  const [showBacklinks, setShowBacklinks] = useState(false);
  const debounceTimers = useRef<Record<string, any>>({});

  useEffect(() => {
    dispatch({ type: 'SET_BLOCKS', payload: initialBlocks });
  }, [initialBlocks]);

  useEffect(() => {
    return () => {
      // Flush and clear pending debounce timers on unmount to prevent data loss
      Object.values(debounceTimers.current).forEach(t => clearTimeout(t));
    };
  }, []);

  const handleAddBlock = async (type: BlockType) => {
    let initialContentJson = '{}';
    if (type === 'text') initialContentJson = JSON.stringify({ text: '', level: 'paragraph' });
    if (type === 'checklist') initialContentJson = JSON.stringify({ items: [{ id: '1', text: '', checked: false }] });
    if (type === 'table') initialContentJson = JSON.stringify({ columns: ['Col 1', 'Col 2'], rows: [['', '']] });
    if (type === 'image') initialContentJson = JSON.stringify({ url: '', caption: '' });

    try {
      setIsSaving(true);
      const newBlock = await MobileApiClient.addBlock(noteId, type, initialContentJson, blocks.length);
      dispatch({ type: 'ADD_BLOCK', payload: newBlock });
    } catch (err) {
      console.error('Failed to add block on mobile', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBlockChange = (blockId: string, updatedContent: any) => {
    dispatch({ type: 'UPDATE_BLOCK_CONTENT', payload: { id: blockId, content: updatedContent } });

    // Debounce save to API
    if (debounceTimers.current[blockId]) {
      clearTimeout(debounceTimers.current[blockId]);
    }

    debounceTimers.current[blockId] = setTimeout(async () => {
      try {
        setIsSaving(true);
        await MobileApiClient.patchBlock(blockId, { contentJson: JSON.stringify(updatedContent) });
      } catch (err) {
        console.error('Failed to auto-save block on mobile', err);
      } finally {
        setIsSaving(false);
      }
    }, 1200);
  };

  const handleDeleteBlock = async (blockId: string) => {
    dispatch({ type: 'DELETE_BLOCK', payload: blockId });
    try {
      await MobileApiClient.deleteBlock(blockId);
    } catch (err) {
      console.error('Failed to delete block on mobile', err);
    }
  };

  const handleMove = async (fromIdx: number, toIdx: number) => {
    dispatch({ type: 'REORDER_BLOCKS', payload: { fromIndex: fromIdx, toIndex: toIdx } });
    const reorderedIds = [...blocks];
    const [moved] = reorderedIds.splice(fromIdx, 1);
    reorderedIds.splice(toIdx, 0, moved);

    try {
      await MobileApiClient.reorderBlocks(noteId, reorderedIds.map(b => b.id));
    } catch (err) {
      console.error('Failed to reorder blocks on mobile', err);
    }
  };

  const { isDark, colors } = useTheme();

  return (
    <View style={styles.container}>
      {blocks.map((block, idx) => {
        let rawContent: any = (block as any).contentJson ?? block.content;
        let parsed: any = rawContent;
        if (typeof rawContent === 'string') {
          try {
            parsed = JSON.parse(rawContent);
          } catch {
            parsed = {};
          }
        }
        if (!parsed || typeof parsed !== 'object') {
          parsed = {};
        }

        // Safe defaults
        if (block.type === 'text') {
          parsed = { text: parsed.text || '', level: parsed.level || 'paragraph' };
        } else if (block.type === 'checklist') {
          parsed = { items: Array.isArray(parsed.items) ? parsed.items : [] };
        } else if (block.type === 'table') {
          parsed = {
            columns: Array.isArray(parsed.columns) ? parsed.columns : ['Col 1', 'Col 2'],
            rows: Array.isArray(parsed.rows) ? parsed.rows : [['', '']]
          };
        } else if (block.type === 'image') {
          parsed = {
            url: parsed.url || '',
            caption: parsed.caption || ''
          };
        }

        return (
          <View key={block.id} style={[styles.blockRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)' }]}>
            {/* Reorder arrows */}
            <View style={styles.reorderControls}>
              <TouchableOpacity
                disabled={idx === 0}
                onPress={() => handleMove(idx, idx - 1)}
                style={styles.arrowBtn}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityLabel="Move block up"
              >
                <Text style={[styles.arrowText, { color: colors.textMuted }, idx === 0 && { color: colors.border }]}>▲</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={idx === blocks.length - 1}
                onPress={() => handleMove(idx, idx + 1)}
                style={styles.arrowBtn}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityLabel="Move block down"
              >
                <Text style={[styles.arrowText, { color: colors.textMuted }, idx === blocks.length - 1 && { color: colors.border }]}>▼</Text>
              </TouchableOpacity>
            </View>

            {/* Block Content */}
            <View style={styles.blockContent}>
              {block.type === 'text' && (
                <MobileTextBlock content={parsed} onChange={(up) => handleBlockChange(block.id, up)} onOpenNote={onOpenNote} />
              )}
              {block.type === 'checklist' && (
                <MobileChecklistBlock content={parsed} onChange={(up) => handleBlockChange(block.id, up)} />
              )}
              {block.type === 'table' && (
                <MobileTableBlock content={parsed} onChange={(up) => handleBlockChange(block.id, up)} />
              )}
              {block.type === 'image' && (
                <MobileImageBlock
                  content={parsed}
                  onChange={(up) => handleBlockChange(block.id, up)}
                  onDelete={() => handleDeleteBlock(block.id)}
                />
              )}
            </View>

            {/* Delete button */}
            <TouchableOpacity
              onPress={() => handleDeleteBlock(block.id)}
              style={styles.deleteBlockBtn}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityLabel="Delete block"
            >
              <Text style={[styles.deleteBlockText, { color: colors.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      <View style={styles.toolbarContainer}>
        <BlockToolbar onAddBlock={handleAddBlock} isSaving={isSaving} />
      </View>

      {/* Backlinks Drawer Trigger */}
      <TouchableOpacity
        onPress={() => setShowBacklinks(true)}
        accessibilityLabel="Open backlinks"
        style={[styles.backlinksBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
      >
        <Text style={[styles.backlinksBtnText, { color: colors.textSecondary }]}>🔗 Backlinks</Text>
      </TouchableOpacity>

      <MobileBacklinksModal
        visible={showBacklinks}
        noteId={noteId}
        onClose={() => setShowBacklinks(false)}
        onSelectNote={(targetId) => {
          setShowBacklinks(false);
          onOpenNote?.(targetId);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
  },
  toolbarContainer: {
    marginTop: 12,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  reorderControls: {
    paddingRight: 6,
    paddingTop: 4,
  },
  arrowBtn: {
    padding: 2,
  },
  arrowText: {
    fontSize: 10,
    color: '#78716c',
  },
  disabledText: {
    color: '#d6d3d1',
  },
  blockContent: {
    flex: 1,
  },
  deleteBlockBtn: {
    padding: 6,
    paddingTop: 8,
  },
  deleteBlockText: {
    fontSize: 13,
    color: '#a8a29e',
  },
  backlinksBtn: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f5f5f4',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  backlinksBtnText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#44403c',
  },
});
