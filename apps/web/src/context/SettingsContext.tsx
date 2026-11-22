import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

export type DefaultView = 'fullscreen' | 'compact';

export const DEFAULT_VIEW_STORAGE_KEY = 'notebook_default_view';

export interface SettingsContextValue {
  defaultView: DefaultView;
  setDefaultView: (view: DefaultView) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [defaultView, setDefaultViewState] = useState<DefaultView>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(DEFAULT_VIEW_STORAGE_KEY) as DefaultView;
        if (saved === 'fullscreen' || saved === 'compact') {
          return saved;
        }
      } catch {
        // ignore storage errors
      }
    }
    return 'compact';
  });

  const setDefaultView = useCallback((view: DefaultView) => {
    setDefaultViewState(view);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(DEFAULT_VIEW_STORAGE_KEY, view);
      } catch {
        // ignore storage errors
      }
    }
  }, []);

  const value = useMemo<SettingsContextValue>(() => ({
    defaultView,
    setDefaultView,
  }), [defaultView, setDefaultView]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextValue => {
  try {
    const ctx = useContext(SettingsContext);
    if (!ctx) {
      return {
        defaultView: 'compact',
        setDefaultView: () => {},
      };
    }
    return ctx;
  } catch {
    return {
      defaultView: 'compact',
      setDefaultView: () => {},
    };
  }
};
