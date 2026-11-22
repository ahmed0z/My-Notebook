import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { ImageBlockContent } from '@notebook/shared';
import { getServerUrl } from '../../storage/authStorage';
import { useTheme } from '../../context/ThemeContext';

export interface MobileImageBlockProps {
  content: ImageBlockContent;
  onChange: (updated: ImageBlockContent) => void;
  onDelete?: () => void;
}

export function resolveImageUrl(url: string, serverUrl?: string): string {
  if (!url) return '';
  if (url.startsWith('/')) {
    const base = (serverUrl || '').replace(/\/+$/, '');
    return base ? `${base}${url}` : url;
  }
  return url;
}

export const MobileImageBlock: React.FC<MobileImageBlockProps> = ({
  content,
  onChange,
  onDelete,
}) => {
  const { url = '', caption = '' } = content || {};
  const [urlInput, setUrlInput] = useState('');
  const [resolvedUrl, setResolvedUrl] = useState<string>(() => resolveImageUrl(url));
  const { colors } = useTheme();

  useEffect(() => {
    let isMounted = true;
    if (url.startsWith('/')) {
      getServerUrl().then((serverUrl) => {
        if (isMounted) {
          setResolvedUrl(resolveImageUrl(url, serverUrl));
        }
      });
    } else {
      setResolvedUrl(url);
    }
    return () => {
      isMounted = false;
    };
  }, [url]);

  const handleSetUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    onChange({
      ...(content || {}),
      url: trimmed,
    });
    setUrlInput('');
  };

  const handleClear = () => {
    onChange({
      ...(content || {}),
      url: '',
    });
  };

  // Empty state: prompt for URL
  if (!url) {
    return (
      <View style={styles.container}>
        <View style={[styles.emptyCard, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Add Image</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>Enter an image URL to embed:</Text>

          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder="Paste image URL (http://...)"
              accessibilityLabel="Image URL"
              placeholderTextColor={colors.textMuted}
              value={urlInput}
              onChangeText={setUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.buttonBg }, !urlInput.trim() && styles.disabledBtn]}
              disabled={!urlInput.trim()}
              onPress={handleSetUrl}
              accessibilityLabel="Add image"
            >
              <Text style={[styles.addBtnText, { color: colors.buttonText }]}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Loaded state: display image, caption, and actions
  return (
    <View style={styles.container}>
      <View style={styles.imageCard}>
        <Image
          source={{ uri: resolvedUrl || url }}
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel={caption || 'Note image'}
        />

        <TextInput
          style={styles.captionInput}
          placeholder="Add caption..."
          accessibilityLabel="Image caption"
          placeholderTextColor="#a8a29e"
          value={caption}
          onChangeText={(newCaption) => onChange({ ...(content || {}), caption: newCaption })}
        />

        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={handleClear}
            style={styles.actionBtn}
            accessibilityLabel="Replace image"
          >
            <Text style={styles.actionBtnText}>Replace</Text>
          </TouchableOpacity>
          {onDelete && (
            <TouchableOpacity
              onPress={onDelete}
              style={[styles.actionBtn, styles.deleteBtn]}
              accessibilityLabel="Remove image"
            >
              <Text style={[styles.actionBtnText, styles.deleteBtnText]}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    width: '100%',
  },
  emptyCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d6d3d1',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#fafaf9',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#292524',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#78716c',
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e7e5e4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#1c1917',
  },
  addBtn: {
    backgroundColor: '#1c1917',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.4,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  imageCard: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f5f5f4',
    borderWidth: 1,
    borderColor: '#e7e5e4',
    paddingBottom: 8,
  },
  image: {
    width: '100%',
    height: 220,
    backgroundColor: '#e7e5e4',
  },
  captionInput: {
    fontSize: 13,
    color: '#44403c',
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0eeee',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#e7e5e4',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#44403c',
  },
  deleteBtn: {
    backgroundColor: '#fee2e2',
  },
  deleteBtnText: {
    color: '#b91c1c',
  },
});
