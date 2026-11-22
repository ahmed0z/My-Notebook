import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { saveDefaultView as persistDefaultView, getDefaultView as fetchSavedDefaultView, DEFAULT_VIEW_KEY } from '../storage/authStorage';

export type DefaultView = 'fullscreen' | 'compact';

export const DEFAULT_VIEW_STORAGE_KEY = DEFAULT_VIEW_KEY || 'notebook_default_view';

export interface SettingsContextValue {
  defaultView: DefaultView;
  setDefaultView: (view: DefaultView) => void;
}

const fallbackSettings: SettingsContextValue = {
  defaultView: 'compact',
  setDefaultView: () => {},
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export async function getSavedDefaultView(): Promise<DefaultView> {
  try {
    const saved = typeof fetchSavedDefaultView === 'function' ? await fetchSavedDefaultView() : null;
    if (saved === 'fullscreen' || saved === 'compact') {
      return saved as DefaultView;
    }
  } catch {
    // ignore
  }
  return 'compact';
}

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [defaultView, setDefaultViewState] = useState<DefaultView>('compact');

  useEffect(() => {
    let isMounted = true;
    getSavedDefaultView().then(saved => {
      if (isMounted && saved) {
        setDefaultViewState(saved);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const setDefaultView = useCallback((view: DefaultView) => {
    setDefaultViewState(view);
    try {
      if (typeof persistDefaultView === 'function') {
        persistDefaultView(view);
      }
    } catch {
      // ignore
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
      return fallbackSettings;
    }
    return ctx;
  } catch {
    return fallbackSettings;
  }
};
