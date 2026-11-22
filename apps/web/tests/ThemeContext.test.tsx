import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeProvider, useTheme, getNoteCardColor } from '../src/context/ThemeContext';

const TestConsumer: React.FC = () => {
  const { theme, isDark, toggleTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <span data-testid="is-dark-value">{isDark ? 'true' : 'false'}</span>
      <button data-testid="toggle-btn" onClick={toggleTheme}>Toggle</button>
      <button data-testid="set-dark-btn" onClick={() => setTheme('dark')}>Set Dark</button>
      <button data-testid="set-light-btn" onClick={() => setTheme('light')}>Set Light</button>
      <button data-testid="set-system-btn" onClick={() => setTheme('system')}>Set System</button>
    </div>
  );
};

describe('ThemeContext (Web)', () => {
  let mediaQueryListeners: ((e: MediaQueryListEvent) => void)[] = [];
  let prefersDark = false;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    mediaQueryListeners = [];
    prefersDark = false;

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: prefersDark,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
          if (event === 'change') mediaQueryListeners.push(handler);
        }),
        removeEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
          mediaQueryListeners = mediaQueryListeners.filter(h => h !== handler);
        }),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    document.documentElement.className = '';
    localStorage.clear();
  });

  it('initializes to system mode and applies prefers-color-scheme match', () => {
    prefersDark = true;
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme-value')).toHaveTextContent('system');
    expect(screen.getByTestId('is-dark-value')).toHaveTextContent('true');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('initializes from localStorage if existing theme is stored', () => {
    localStorage.setItem('notebook_theme', 'dark');
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
    expect(screen.getByTestId('is-dark-value')).toHaveTextContent('true');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('toggles theme between light and dark, updating document class and localStorage', () => {
    prefersDark = false;
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('is-dark-value')).toHaveTextContent('false');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    // Toggle to dark
    fireEvent.click(screen.getByTestId('toggle-btn'));
    expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
    expect(screen.getByTestId('is-dark-value')).toHaveTextContent('true');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('notebook_theme')).toBe('dark');

    // Toggle back to light
    fireEvent.click(screen.getByTestId('toggle-btn'));
    expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
    expect(screen.getByTestId('is-dark-value')).toHaveTextContent('false');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('notebook_theme')).toBe('light');
  });

  it('allows setting explicit theme mode', () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByTestId('set-dark-btn'));
    expect(localStorage.getItem('notebook_theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    fireEvent.click(screen.getByTestId('set-light-btn'));
    expect(localStorage.getItem('notebook_theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    fireEvent.click(screen.getByTestId('set-system-btn'));
    expect(localStorage.getItem('notebook_theme')).toBe('system');
  });

  describe('getNoteCardColor helper', () => {
    it('returns original or default color when isDark is false', () => {
      expect(getNoteCardColor('#faafa8', false)).toBe('#faafa8');
      expect(getNoteCardColor('', false)).toBe('#ffffff');
      expect(getNoteCardColor(null, false)).toBe('#ffffff');
      expect(getNoteCardColor(undefined, false)).toBe('#ffffff');
    });

    it('returns dark pastel color when isDark is true', () => {
      expect(getNoteCardColor('#faafa8', true)).toBe('#492321');
      expect(getNoteCardColor('#ffffff', true)).toBe('#1c1917');
      expect(getNoteCardColor('', true)).toBe('#1c1917');
      expect(getNoteCardColor(null, true)).toBe('#1c1917');
    });
  });
});
