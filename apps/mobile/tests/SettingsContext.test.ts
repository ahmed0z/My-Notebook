import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSavedDefaultView,
  DEFAULT_VIEW_STORAGE_KEY,
  useSettings
} from '../src/context/SettingsContext';

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
  StyleSheet: {
    create: (styles: any) => styles,
  },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
}));

describe('SettingsContext (Mobile)', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockSecureStore)) {
      delete mockSecureStore[key];
    }
  });

  describe('Storage & Default View Loading', () => {
    it('uses notebook_default_view as storage key', () => {
      expect(DEFAULT_VIEW_STORAGE_KEY).toBe('notebook_default_view');
    });

    it('defaults to compact when no stored preference exists', async () => {
      const view = await getSavedDefaultView();
      expect(view).toBe('compact');
    });

    it('returns fullscreen when stored in secure storage', async () => {
      mockSecureStore[DEFAULT_VIEW_STORAGE_KEY] = 'fullscreen';
      const view = await getSavedDefaultView();
      expect(view).toBe('fullscreen');
    });

    it('returns compact when stored in secure storage', async () => {
      mockSecureStore[DEFAULT_VIEW_STORAGE_KEY] = 'compact';
      const view = await getSavedDefaultView();
      expect(view).toBe('compact');
    });

    it('falls back to compact if an invalid value is in storage', async () => {
      mockSecureStore[DEFAULT_VIEW_STORAGE_KEY] = 'unknown_value';
      const view = await getSavedDefaultView();
      expect(view).toBe('compact');
    });
  });

  describe('useSettings Hook Fallback', () => {
    it('provides safe fallback when invoked without provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const settings = useSettings();
      expect(settings.defaultView).toBe('compact');
      expect(typeof settings.setDefaultView).toBe('function');
      expect(() => settings.setDefaultView('fullscreen')).not.toThrow();
      consoleSpy.mockRestore();
    });
  });
});
