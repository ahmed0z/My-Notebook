import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { SpaceDto } from '@notebook/shared';
import { useTheme } from '../context/ThemeContext';

export interface MobileSpaceSelectorProps {
  spaces: SpaceDto[];
  activeSpaceId: string | null;
  onSelectSpace: (spaceId: string | null) => void;
  onCreateSpace: (name: string, parentSpaceId?: string | null) => Promise<void>;
  onUpdateSpace?: (id: string, updates: { name?: string; parentSpaceId?: string | null }) => Promise<void>;
  onDeleteSpace?: (id: string) => Promise<void>;
}

interface SpaceNode {
  space: SpaceDto;
  children: SpaceNode[];
}

function buildSpaceTree(spaces: SpaceDto[]): SpaceNode[] {
  const map = new Map<string, SpaceNode>();
  for (const s of spaces) {
    map.set(s.id, { space: s, children: [] });
  }
  const roots: SpaceNode[] = [];
  for (const s of spaces) {
    const node = map.get(s.id)!;
    if (s.parentSpaceId && map.has(s.parentSpaceId)) {
      map.get(s.parentSpaceId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export const MobileSpaceSelector: React.FC<MobileSpaceSelectorProps> = ({
  spaces,
  activeSpaceId,
  onSelectSpace,
  onCreateSpace,
  onUpdateSpace,
  onDeleteSpace,
}) => {
  const { colors, isDark } = useTheme();
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [creatingUnderParentId, setCreatingUnderParentId] = useState<string | null | undefined>(undefined);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editSpaceName, setEditSpaceName] = useState('');

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStartCreate = (parentId: string | null = null) => {
    setCreatingUnderParentId(parentId);
    setNewSpaceName('');
    if (parentId && collapsedIds.has(parentId)) {
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        next.delete(parentId);
        return next;
      });
    }
  };

  const handleConfirmCreate = async () => {
    const trimmed = newSpaceName.trim();
    if (!trimmed) {
      setCreatingUnderParentId(undefined);
      return;
    }
    const parent = creatingUnderParentId === null ? undefined : creatingUnderParentId;
    try {
      await onCreateSpace(trimmed, parent);
    } catch (err) {
      console.error('Failed to create space on mobile', err);
    } finally {
      setCreatingUnderParentId(undefined);
      setNewSpaceName('');
    }
  };

  const handleStartEdit = (space: SpaceDto) => {
    setEditingSpaceId(space.id);
    setEditSpaceName(space.name);
  };

  const handleConfirmEdit = async () => {
    if (!editingSpaceId || !onUpdateSpace) return;
    const trimmed = editSpaceName.trim();
    if (trimmed) {
      try {
        await onUpdateSpace(editingSpaceId, { name: trimmed });
      } catch (err) {
        console.error('Failed to update space on mobile', err);
      }
    }
    setEditingSpaceId(null);
    setEditSpaceName('');
  };

  const handleDelete = (spaceId: string) => {
    if (!onDeleteSpace) return;
    Alert.alert(
      'Delete Space',
      'Are you sure you want to delete this space and its sub-spaces? Notes will be moved to unassigned.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await onDeleteSpace(spaceId);
              if (activeSpaceId === spaceId) {
                onSelectSpace(null);
              }
            } catch (err) {
              console.error('Failed to delete space on mobile', err);
            }
          },
        },
      ]
    );
  };

  const tree = buildSpaceTree(spaces);

  const renderNode = (node: SpaceNode, depth: number = 0) => {
    const { space, children } = node;
    const isCollapsed = collapsedIds.has(space.id);
    const hasChildren = children.length > 0;
    const isActive = activeSpaceId === space.id;
    const isEditing = editingSpaceId === space.id;

    return (
      <View key={space.id} style={styles.nodeWrapper}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => onSelectSpace(space.id)}
          accessibilityLabel={`Select space ${space.name}`}
          style={[
            styles.spaceItem,
            { paddingLeft: Math.max(depth * 16 + 10, 10) },
            isActive && {
              backgroundColor: isDark ? '#292524' : '#e7e5e4',
            },
          ]}
        >
          <View style={styles.leftRow}>
            {hasChildren ? (
              <TouchableOpacity
                onPress={() => toggleCollapse(space.id)}
                style={styles.chevronBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel={isCollapsed ? 'Expand sub-spaces' : 'Collapse sub-spaces'}
              >
                <Text style={[styles.chevronText, { color: colors.textMuted }]}>
                  {isCollapsed ? '▶' : '▼'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.chevronPlaceholder} />
            )}
            <Text style={styles.folderIcon}>{isActive ? '📂' : '📁'}</Text>
            {isEditing ? (
              <View style={styles.inlineEditRow}>
                <TextInput
                  value={editSpaceName}
                  onChangeText={setEditSpaceName}
                  style={[
                    styles.inlineInput,
                    {
                      color: colors.text,
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                  autoFocus
                />
                <TouchableOpacity
                  onPress={handleConfirmEdit}
                  style={styles.actionBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Save space name"
                >
                  <Text style={styles.confirmText}>✓</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setEditingSpaceId(null)}
                  style={styles.actionBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Cancel editing"
                >
                  <Text style={styles.cancelText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text
                style={[
                  styles.spaceName,
                  {
                    color: isActive ? colors.text : colors.textSecondary,
                    fontWeight: isActive ? '700' : '500',
                  },
                ]}
                numberOfLines={1}
              >
                {space.name}
              </Text>
            )}
          </View>

          {!isEditing && (
            <View style={styles.actionsRow}>
              <TouchableOpacity
                onPress={() => handleStartCreate(space.id)}
                style={styles.iconBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel={`Add sub-space to ${space.name}`}
              >
                <Text style={[styles.iconBtnText, { color: colors.textMuted }]}>+</Text>
              </TouchableOpacity>
              {onUpdateSpace && (
                <TouchableOpacity
                  onPress={() => handleStartEdit(space)}
                  style={styles.iconBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={`Rename ${space.name}`}
                >
                  <Text style={[styles.iconBtnText, { color: colors.textMuted }]}>✏️</Text>
                </TouchableOpacity>
              )}
              {onDeleteSpace && (
                <TouchableOpacity
                  onPress={() => handleDelete(space.id)}
                  style={styles.iconBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={`Delete ${space.name}`}
                >
                  <Text style={[styles.iconBtnText, { color: '#ef4444' }]}>🗑️</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </TouchableOpacity>

        {creatingUnderParentId === space.id && (
          <View
            style={[
              styles.inlineCreateRow,
              { paddingLeft: (depth + 1) * 16 + 10 },
            ]}
          >
            <Text style={styles.folderIcon}>📁</Text>
            <TextInput
              value={newSpaceName}
              onChangeText={setNewSpaceName}
              placeholder="Sub-space name..."
              placeholderTextColor={colors.textMuted}
              style={[
                styles.createInput,
                {
                  color: colors.text,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
              autoFocus
            />
            <TouchableOpacity onPress={handleConfirmCreate} style={styles.actionBtn}>
              <Text style={styles.confirmText}>✓</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCreatingUnderParentId(undefined)} style={styles.actionBtn}>
              <Text style={styles.cancelText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {hasChildren && !isCollapsed && (
          <View>{children.map((child) => renderNode(child, depth + 1))}</View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textMuted }]}>SPACES</Text>
        <TouchableOpacity
          onPress={() => handleStartCreate(null)}
          style={styles.addBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Add new space"
        >
          <Text style={[styles.addBtnText, { color: colors.text }]}>+</Text>
        </TouchableOpacity>
      </View>

      {/* All Notes */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onSelectSpace(null)}
        accessibilityLabel="All Notes"
        style={[
          styles.allNotesItem,
          activeSpaceId === null && {
            backgroundColor: isDark ? '#292524' : '#e7e5e4',
          },
        ]}
      >
        <Text style={styles.folderIcon}>📑</Text>
        <Text
          style={[
            styles.spaceName,
            {
              color: activeSpaceId === null ? colors.text : colors.textSecondary,
              fontWeight: activeSpaceId === null ? '700' : '500',
            },
          ]}
        >
          All Notes
        </Text>
      </TouchableOpacity>

      {/* Tree of spaces */}
      <View style={styles.treeContainer}>
        {tree.map((node) => renderNode(node, 0))}
      </View>

      {/* Root creation input */}
      {creatingUnderParentId === null && (
        <View style={styles.inlineCreateRow}>
          <Text style={styles.folderIcon}>📁</Text>
          <TextInput
            value={newSpaceName}
            onChangeText={setNewSpaceName}
            placeholder="Space name..."
            placeholderTextColor={colors.textMuted}
            style={[
              styles.createInput,
              {
                color: colors.text,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            autoFocus
          />
          <TouchableOpacity onPress={handleConfirmCreate} style={styles.actionBtn}>
            <Text style={styles.confirmText}>✓</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCreatingUnderParentId(undefined)} style={styles.actionBtn}>
            <Text style={styles.cancelText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  addBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  addBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  allNotesItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
    marginBottom: 4,
  },
  treeContainer: {
    gap: 2,
  },
  nodeWrapper: {
    marginVertical: 1,
  },
  spaceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingRight: 8,
    borderRadius: 8,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  chevronBtn: {
    padding: 3,
  },
  chevronText: {
    fontSize: 9,
  },
  chevronPlaceholder: {
    width: 14,
  },
  folderIcon: {
    fontSize: 14,
  },
  spaceName: {
    fontSize: 14,
    flexShrink: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    padding: 4,
  },
  iconBtnText: {
    fontSize: 13,
  },
  inlineEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  inlineInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderRadius: 6,
  },
  inlineCreateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    gap: 6,
  },
  createInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 6,
  },
  actionBtn: {
    padding: 4,
  },
  confirmText: {
    color: '#10b981',
    fontWeight: 'bold',
    fontSize: 14,
  },
  cancelText: {
    color: '#6b7280',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
