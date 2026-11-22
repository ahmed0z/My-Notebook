import React from 'react';
import { render, screen, fireEvent, renderHook } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SettingsProvider, useSettings, DEFAULT_VIEW_STORAGE_KEY } from '../src/context/SettingsContext';

const TestSettingsConsumer: React.FC = () => {
  const { defaultView, setDefaultView } = useSettings();
  return (
    <div>
      <span data-testid="default-view-val">{defaultView}</span>
      <button data-testid="btn-compact" onClick={() => setDefaultView('compact')}>Set Compact</button>
      <button data-testid="btn-fullscreen" onClick={() => setDefaultView('fullscreen')}>Set Fullscreen</button>
    </div>
  );
};

describe('SettingsContext (Web)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to compact view when no storage entry exists', () => {
    render(
      <SettingsProvider>
        <TestSettingsConsumer />
      </SettingsProvider>
    );

    expect(screen.getByTestId('default-view-val')).toHaveTextContent('compact');
  });

  it('initializes to fullscreen if stored in localStorage', () => {
    localStorage.setItem(DEFAULT_VIEW_STORAGE_KEY, 'fullscreen');

    render(
      <SettingsProvider>
        <TestSettingsConsumer />
      </SettingsProvider>
    );

    expect(screen.getByTestId('default-view-val')).toHaveTextContent('fullscreen');
  });

  it('updates view state and saves to localStorage when setDefaultView is called', () => {
    render(
      <SettingsProvider>
        <TestSettingsConsumer />
      </SettingsProvider>
    );

    expect(screen.getByTestId('default-view-val')).toHaveTextContent('compact');

    // Switch to fullscreen
    fireEvent.click(screen.getByTestId('btn-fullscreen'));
    expect(screen.getByTestId('default-view-val')).toHaveTextContent('fullscreen');
    expect(localStorage.getItem(DEFAULT_VIEW_STORAGE_KEY)).toBe('fullscreen');

    // Switch back to compact
    fireEvent.click(screen.getByTestId('btn-compact'));
    expect(screen.getByTestId('default-view-val')).toHaveTextContent('compact');
    expect(localStorage.getItem(DEFAULT_VIEW_STORAGE_KEY)).toBe('compact');
  });

  it('provides safe fallback if useSettings is called outside provider', () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.defaultView).toBe('compact');
    expect(typeof result.current.setDefaultView).toBe('function');
    // Ensure invoking fallback function does not throw
    expect(() => result.current.setDefaultView('fullscreen')).not.toThrow();
  });
});
