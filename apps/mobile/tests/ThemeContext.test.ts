import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  lightThemeColors,
  darkThemeColors,
  getNoteCardColor,
  DARK_NOTE_COLORS,
  THEME_STORAGE_KEY,
  getInitialThemeState
} from '../src/context/ThemeContext';

const mockSecureStore: Record<string, string> = {};

vi.mock('expo-secure-store', () => ({
  setItemAsync: vi.fn(async (key: string, value: string) => {
    mockSecureStore[key] = value;
  }),
  getItemAsync: vi.fn(async (key: string) => {
    return mockSecureStore[key] ?? null;
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    delete mockSecureStore[key];
  }),
}));

vi.mock('react-native', () => ({
  Appearance: {
    getColorScheme: vi.fn(() => 'light'),
    addChangeListener: vi.fn(() => ({ remove: vi.fn() })),
  },
  StyleSheet: {
    create: (styles: any) => styles,
  },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
}));

describe('ThemeContext (Mobile)', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockSecureStore)) {
      delete mockSecureStore[key];
    }
  });

  describe('Theme Color Tokens', () => {
    it('provides all expected theme tokens for light theme', () => {
      expect(lightThemeColors.background).toBe('#fafaf9');
      expect(lightThemeColors.surface).toBe('#ffffff');
      expect(lightThemeColors.card).toBe('#ffffff');
      expect(lightThemeColors.text).toBe('#1c1917');
      expect(lightThemeColors.textSecondary).toBeDefined();
      expect(lightThemeColors.border).toBeDefined();
      expect(lightThemeColors.inputBg).toBeDefined();
    });

    it('provides all expected theme tokens for dark theme', () => {
      expect(darkThemeColors.background).toBe('#0c0a09');
      expect(darkThemeColors.surface).toBe('#1c1917');
      expect(darkThemeColors.card).toBe('#1c1917');
      expect(darkThemeColors.text).toBe('#f5f5f4');
      expect(darkThemeColors.textSecondary).toBeDefined();
      expect(darkThemeColors.border).toBeDefined();
      expect(darkThemeColors.inputBg).toBeDefined();
    });
  });

  describe('getNoteCardColor', () => {
    it('returns default white or original color when isDark is false', () => {
      expect(getNoteCardColor(undefined, false)).toBe('#ffffff');
      expect(getNoteCardColor(null, false)).toBe('#ffffff');
      expect(getNoteCardColor('', false)).toBe('#ffffff');
      expect(getNoteCardColor('#faafa8', false)).toBe('#faafa8');
    });

    it('returns dark pastel color mapping when isDark is true', () => {
      expect(getNoteCardColor(undefined, true)).toBe('#1c1917');
      expect(getNoteCardColor(null, true)).toBe('#1c1917');
      expect(getNoteCardColor('#ffffff', true)).toBe('#1c1917');
      expect(getNoteCardColor('#faafa8', true)).toBe('#492321');
      expect(getNoteCardColor('#fff8b8', true)).toBe('#423d0e');
      expect(getNoteCardColor('#d3bfdb', true)).toBe('#341f48');
    });

    it('handles case-insensitive hex lookup', () => {
      expect(getNoteCardColor('#FAAFA8', true)).toBe('#492321');
      expect(getNoteCardColor('#FFFFFF', true)).toBe('#1c1917');
    });
  });

  describe('Initial Theme Loading and Persistence helper', () => {
    it('resolves default stored theme or falls back to system', async () => {
      const state1 = await getInitialThemeState();
      expect(state1.theme).toBe('system');
      expect(state1.isDark).toBe(false);

      mockSecureStore[THEME_STORAGE_KEY] = 'dark';
      const state2 = await getInitialThemeState();
      expect(state2.theme).toBe('dark');
      expect(state2.isDark).toBe(true);
    });
  });
});
