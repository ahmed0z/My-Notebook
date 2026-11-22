import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'notebook_theme';

export const DARK_NOTE_COLORS: Record<string, string> = {
  '#ffffff': '#1c1917', // stone-900
  '#faafa8': '#492321', // dark coral
  '#f39f76': '#4e2c11', // dark peach
  '#fff8b8': '#423d0e', // dark sand
  '#e2f6d3': '#233f16', // dark mint
  '#b4ddd3': '#163b36', // dark sage
  '#d4e4ed': '#1c3644', // dark fog
  '#aeccdc': '#1e293b', // dark storm (slate-800)
  '#d3bfdb': '#341f48', // dark dusk
  '#f6e2dd': '#451f2b', // dark blossom
  '#e9e3d4': '#3a3223', // dark clay
  '#efeff1': '#262626', // dark chalk
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

export interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  getNoteCardColor: (color?: string | null, isDark?: boolean) => string;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY) as Theme;
        if (saved === 'dark' || saved === 'light' || saved === 'system') {
          return saved;
        }
      } catch {
        // ignore
      }
    }
    return 'system';
  });

  const [systemDark, setSystemDark] = useState<boolean>(getSystemPrefersDark);

  // Listen to system changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemDark(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
    } else if ((mediaQuery as any).addListener) {
      (mediaQuery as any).addListener(handler);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handler);
      } else if ((mediaQuery as any).removeListener) {
        (mediaQuery as any).removeListener(handler);
      }
    };
  }, []);

  const isDark = useMemo(() => {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    return systemDark;
  }, [theme, systemDark]);

  // Sync class on documentElement
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', isDark);
    }
  }, [isDark]);

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // ignore
    }
  };

  const toggleTheme = () => {
    // If currently dark, switch to light; if light, switch to dark
    const nextTheme: Theme = isDark ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  const contextValue: ThemeContextValue = useMemo(() => ({
    theme,
    isDark,
    setTheme,
    toggleTheme,
    getNoteCardColor: (c?: string | null, dark?: boolean) => getNoteCardColor(c, dark !== undefined ? dark : isDark),
  }), [theme, isDark]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  try {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
      const systemDark = getSystemPrefersDark();
      return {
        theme: 'system',
        isDark: systemDark,
        setTheme: () => {},
        toggleTheme: () => {},
        getNoteCardColor: (c?: string | null, dark?: boolean) => getNoteCardColor(c, dark !== undefined ? dark : systemDark),
      };
    }
    return ctx;
  } catch {
    const systemDark = getSystemPrefersDark();
    return {
      theme: 'system',
      isDark: systemDark,
      setTheme: () => {},
      toggleTheme: () => {},
      getNoteCardColor: (c?: string | null, dark?: boolean) => getNoteCardColor(c, dark !== undefined ? dark : systemDark),
    };
  }
};
