import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export interface MobileSearchBarProps {
  value?: string;
  onSearch: (query: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export const MobileSearchBar: React.FC<MobileSearchBarProps> = ({
  value = '',
  onSearch,
  placeholder = 'Search notes...',
  debounceMs = 300
}) => {
  const [query, setQuery] = useState(value);
  const isFirstRender = useRef(true);
  const prevValueRef = useRef(value);
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (prevValueRef.current !== value) {
      prevValueRef.current = value;
      setQuery(value);
    }
  }, [value]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      onSearchRef.current(query);
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [query, debounceMs]);

  const handleClear = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setQuery('');
    onSearchRef.current('');
  };

  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <TextInput
        style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]}
        placeholder={placeholder}
        value={query}
        onChangeText={setQuery}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {query.length > 0 && (
        <TouchableOpacity
          onPress={handleClear}
          style={[styles.clearBtn, { backgroundColor: colors.border }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Clear search"
        >
          <Text style={[styles.clearText, { color: colors.textMuted }]}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#f5f5f4',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingRight: 38,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1c1917',
  },
  clearBtn: {
    position: 'absolute',
    right: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#e7e5e4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    fontSize: 11,
    color: '#78716c',
    fontWeight: 'bold',
    lineHeight: 13,
  },
});
