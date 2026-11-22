import React, { useMemo } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { TextBlockContent } from '@notebook/shared';
import { useTheme } from '../../context/ThemeContext';

interface MobileTextBlockProps {
  content: TextBlockContent;
  onChange: (updated: TextBlockContent) => void;
  onOpenNote?: (targetTitleOrId: string) => void;
}

export const MobileTextBlock: React.FC<MobileTextBlockProps> = ({ content, onChange, onOpenNote }) => {
  const { isDark, colors } = useTheme();
  const levels: Array<'paragraph' | 'h1' | 'h2' | 'h3'> = ['paragraph', 'h1', 'h2', 'h3'];
  const currentLevel = content?.level || 'paragraph';
  const currentText = content?.text || '';

  const detectedLinks = currentText
    ? Array.from(new Set((currentText.match(/\[\[(.*?)\]\]/g) || []).map(m => m.slice(2, -2).trim()).filter(Boolean)))
    : [];

  return (
    <View style={styles.container}>
      <View style={styles.levelRow}>
        {levels.map(lvl => (
          <TouchableOpacity
            key={lvl}
            onPress={() => onChange({ ...content, level: lvl, text: currentText })}
            style={[
              styles.levelBtn,
              { backgroundColor: colors.inputBg },
              currentLevel === lvl && { backgroundColor: colors.buttonBg }
            ]}
          >
            <Text
              style={[
                styles.levelBtnText,
                { color: colors.textMuted },
                currentLevel === lvl && { color: colors.buttonText }
              ]}
            >
              {lvl === 'paragraph' ? 'P' : lvl.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={[
          styles.input,
          { color: colors.text },
          currentLevel === 'h1' && styles.h1,
          currentLevel === 'h2' && styles.h2,
          currentLevel === 'h3' && styles.h3,
        ]}
        value={currentText}
        placeholder={currentLevel === 'paragraph' ? 'Start typing...' : 'Heading...'}
        placeholderTextColor={colors.textMuted}
        multiline
        scrollEnabled={false}
        onChangeText={(text) => onChange({ ...content, level: currentLevel, text })}
      />

      {detectedLinks.length > 0 && (
        <View style={styles.linksRow}>
          {detectedLinks.map(linkTitle => (
            <TouchableOpacity
              key={linkTitle}
              onPress={() => onOpenNote?.(linkTitle)}
              style={[
                styles.linkPill,
                {
                  backgroundColor: isDark ? '#1e1b4b' : '#eef2ff',
                  borderColor: isDark ? '#3730a3' : '#c7d2fe'
                }
              ]}
            >
              <Text style={[styles.linkPillText, { color: isDark ? '#a5b4fc' : '#4338ca' }]}>
                {`[[${linkTitle}]]`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  levelRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  levelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#f5f5f4',
  },
  levelBtnActive: {
    backgroundColor: '#1c1917',
  },
  levelBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#78716c',
  },
  levelBtnTextActive: {
    color: '#ffffff',
  },
  input: {
    fontSize: 15,
    color: '#1c1917',
    paddingVertical: 4,
    lineHeight: 22,
  },
  h1: {
    fontSize: 22,
    fontWeight: 'bold',
    lineHeight: 28,
  },
  h2: {
    fontSize: 19,
    fontWeight: 'bold',
    lineHeight: 25,
  },
  h3: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 23,
  },
  linksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    marginBottom: 2,
  },
  linkPill: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  linkPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4338ca',
  },
});
