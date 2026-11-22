import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BlockType } from '@notebook/shared';
import { useTheme } from '../../context/ThemeContext';

interface BlockToolbarProps {
  onAddBlock: (type: BlockType) => void;
  isSaving: boolean;
}

export const BlockToolbar: React.FC<BlockToolbarProps> = ({ onAddBlock, isSaving }) => {
  const { isDark, colors } = useTheme();

  return (
    <View style={[styles.container, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
      <View style={styles.buttons}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.inputBg }]} onPress={() => onAddBlock('text')}>
          <Text style={[styles.btnText, { color: colors.text }]}>+ Text</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.inputBg }]} onPress={() => onAddBlock('checklist')}>
          <Text style={[styles.btnText, { color: colors.text }]}>+ To-Do</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.inputBg }]} onPress={() => onAddBlock('table')}>
          <Text style={[styles.btnText, { color: colors.text }]}>+ Table</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.inputBg }]} onPress={() => onAddBlock('image')}>
          <Text style={[styles.btnText, { color: colors.text }]}>+ Image</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.statusText, { color: colors.textMuted }]}>{isSaving ? 'Saving...' : 'Saved'}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    marginBottom: 10,
  },
  buttons: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    backgroundColor: '#f5f5f4',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  btnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1c1917',
  },
  statusText: {
    fontSize: 11,
    color: '#a8a29e',
  },
});
