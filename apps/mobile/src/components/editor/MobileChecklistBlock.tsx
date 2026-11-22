import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { ChecklistBlockContent } from '@notebook/shared';
import { useTheme } from '../../context/ThemeContext';

interface MobileChecklistBlockProps {
  content: ChecklistBlockContent;
  onChange: (updated: ChecklistBlockContent) => void;
}

export const MobileChecklistBlock: React.FC<MobileChecklistBlockProps> = ({ content, onChange }) => {
  const items = content.items || [];

  const toggleItem = (id: string) => {
    const updated = items.map(it => it.id === id ? { ...it, checked: !it.checked } : it);
    onChange({ items: updated });
  };

  const updateText = (id: string, text: string) => {
    const updated = items.map(it => it.id === id ? { ...it, text } : it);
    onChange({ items: updated });
  };

  const addItem = () => {
    const newItem = {
      id: Math.random().toString(36).substring(2, 9),
      text: '',
      checked: false,
    };
    onChange({ items: [...items, newItem] });
  };

  const deleteItem = (id: string) => {
    onChange({ items: items.filter(it => it.id !== id) });
  };

  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {items.map(it => (
        <View key={it.id} style={styles.itemRow}>
          <TouchableOpacity
            onPress={() => toggleItem(it.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!it.checked }}
            style={[
              styles.checkbox,
              { borderColor: colors.border, backgroundColor: 'transparent' }
            ]}
          >
            {it.checked && <Text style={[styles.checkmark, { color: colors.text }]}>✓</Text>}
          </TouchableOpacity>

          <TextInput
            style={[
              styles.input,
              { color: colors.text },
              it.checked && [styles.inputChecked, { color: colors.textMuted }]
            ]}
            value={it.text}
            placeholder="To-do item..."
            placeholderTextColor={colors.textMuted}
            onChangeText={(text) => updateText(it.id, text)}
            onSubmitEditing={addItem}
          />

          <TouchableOpacity
            onPress={() => deleteItem(it.id)}
            style={styles.deleteBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Delete to-do item"
          >
            <Text style={[styles.deleteText, { color: colors.textMuted }]}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity
        onPress={addItem}
        style={styles.addBtn}
        accessibilityLabel="Add to-do item"
      >
        <Text style={[styles.addBtnText, { color: colors.textMuted }]}>+ Add to-do item</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#78716c',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkmark: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#1c1917',
    paddingVertical: 2,
  },
  inputChecked: {
    textDecorationLine: 'line-through',
    color: '#a8a29e',
  },
  deleteBtn: {
    padding: 4,
    marginLeft: 6,
  },
  deleteText: {
    color: '#a8a29e',
    fontSize: 14,
  },
  addBtn: {
    paddingVertical: 6,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#78716c',
  },
});
