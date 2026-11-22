import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import * as ReactNative from 'react-native';
import { saveTheme as persistTheme, getTheme as fetchSavedTheme } from '../storage/authStorage';

const getSystemDark = (): boolean => {
  try {
    return (ReactNative as any).Appearance?.getColorScheme?.() === 'dark';
  } catch {
    return false;
  }
};

export type Theme = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'notebook_theme';

export interface ThemeColors {
  background: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  inputBg: string;
  accent: string;
  accentText: string;
  buttonBg: string;
  buttonText: string;
}

export const lightThemeColors: ThemeColors = {
  background: '#fafaf9',
  surface: '#ffffff',
  card: '#ffffff',
  text: '#1c1917',
  textSecondary: '#44403c',
  textMuted: '#78716c',
  border: '#e7e5e4',
  inputBg: '#f5f5f4',
  accent: '#1c1917',
  accentText: '#ffffff',
  buttonBg: '#1c1917',
  buttonText: '#ffffff',
};

export const darkThemeColors: ThemeColors = {
  background: '#0c0a09',
  surface: '#1c1917',
  card: '#1c1917',
  text: '#f5f5f4',
  textSecondary: '#d6d3d1',
  textMuted: '#a8a29e',
  border: '#292524',
  inputBg: '#292524',
  accent: '#f5f5f4',
  accentText: '#1c1917',
  buttonBg: '#f5f5f4',
  buttonText: '#1c1917',
};

export const DARK_NOTE_COLORS: Record<string, string> = {
  '#ffffff': '#1c1917',
  '#faafa8': '#492321',
  '#f39f76': '#4e2c11',
  '#fff8b8': '#423d0e',
  '#e2f6d3': '#233f16',
  '#b4ddd3': '#163b36',
  '#d4e4ed': '#1c3644',
  '#aeccdc': '#1e293b',
  '#d3bfdb': '#341f48',
  '#f6e2dd': '#451f2b',
  '#e9e3d4': '#3a3223',
  '#efeff1': '#262626',
};

export function getNoteCardColor(color?: string | null, isDark?: boolean): string {
  if (!isDark) {
    return color || '#ffffff';
  }

  if (!color) {
    return '#1c1917';
  }

  const normalized = color.toLowerCase().trim();
  if (normalized === '#ffffff' || normalized === '#fff' || normalized === 'white') {
    return '#1c1917';
  }

  return DARK_NOTE_COLORS[normalized] || color;
}

export async function getSavedTheme(): Promise<Theme> {
  try {
    const val = typeof fetchSavedTheme === 'function' ? await fetchSavedTheme() : null;
    if (val === 'dark' || val === 'light' || val === 'system') {
      return val as Theme;
    }
  } catch {
    // fallback
  }
  return 'system';
}

export async function saveThemePreference(theme: Theme): Promise<void> {
  try {
    if (typeof persistTheme === 'function') {
      await persistTheme(theme);
    }
  } catch {
    // fallback
  }
}

export async function getInitialThemeState(): Promise<{ theme: Theme; isDark: boolean }> {
  const theme = await getSavedTheme();
  let isDark = false;
  if (theme === 'dark') {
    isDark = true;
  } else if (theme === 'light') {
    isDark = false;
  } else {
    isDark = getSystemDark();
  }
  return { theme, isDark };
}

export interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  getNoteCardColor: (color?: string | null, isDarkOverride?: boolean) => string;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('system');
  const [systemDark, setSystemDark] = useState<boolean>(getSystemDark);

  // Load saved preference on mount
  useEffect(() => {
    let isMounted = true;
    getSavedTheme().then((saved) => {
      if (isMounted) setThemeState(saved);
    });

    const subscription = (ReactNative as any).Appearance?.addChangeListener ? (ReactNative as any).Appearance.addChangeListener(({ colorScheme }: any) => {
      if (isMounted) setSystemDark(colorScheme === 'dark');
    }) : null;

    return () => {
      isMounted = false;
      subscription?.remove?.();
    };
  }, []);

  const isDark = useMemo(() => {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    return systemDark;
  }, [theme, systemDark]);

  const colors = useMemo(() => {
    return isDark ? darkThemeColors : lightThemeColors;
  }, [isDark]);

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme);
    saveThemePreference(nextTheme);
  };

  const toggleTheme = () => {
    const nextTheme: Theme = isDark ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  const value: ThemeContextValue = useMemo(() => ({
    theme,
    isDark,
    colors,
    toggleTheme,
    setTheme,
    getNoteCardColor: (c?: string | null, dark?: boolean) => getNoteCardColor(c, dark !== undefined ? dark : isDark),
  }), [theme, isDark, colors]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  try {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
      const isDark = getSystemDark();
      const colors = isDark ? darkThemeColors : lightThemeColors;
      return {
        theme: 'system',
        isDark,
        colors,
        toggleTheme: () => {},
        setTheme: () => {},
        getNoteCardColor: (c?: string | null, dark?: boolean) => getNoteCardColor(c, dark !== undefined ? dark : isDark),
      };
    }
    return ctx;
  } catch {
    const isDark = getSystemDark();
    const colors = isDark ? darkThemeColors : lightThemeColors;
    return {
      theme: 'system',
      isDark,
      colors,
      toggleTheme: () => {},
      setTheme: () => {},
      getNoteCardColor: (c?: string | null, dark?: boolean) => getNoteCardColor(c, dark !== undefined ? dark : isDark),
    };
  }
};
