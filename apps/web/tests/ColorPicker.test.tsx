import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ColorPicker } from '../src/components/ColorPicker';
import { ThemeProvider, THEME_STORAGE_KEY, DARK_NOTE_COLORS } from '../src/context/ThemeContext';

describe('ColorPicker', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('renders light-mode swatch colors in light mode and emits canonical hex on click', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const onSelectColor = vi.fn();

    render(
      <ThemeProvider>
        <ColorPicker currentColor="#ffffff" onSelectColor={onSelectColor} />
      </ThemeProvider>
    );

    const coralBtn = screen.getByRole('button', { name: 'Coral' });
    expect(coralBtn).toHaveStyle({ backgroundColor: '#faafa8' });

    fireEvent.click(coralBtn);
    expect(onSelectColor).toHaveBeenCalledWith('#faafa8');
  });

  it('renders dark-mode swatch colors matching DARK_NOTE_COLORS in dark mode while still emitting canonical hex', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const onSelectColor = vi.fn();

    render(
      <ThemeProvider>
        <ColorPicker currentColor="#ffffff" onSelectColor={onSelectColor} />
      </ThemeProvider>
    );

    const defaultBtn = screen.getByRole('button', { name: 'Default' });
    const coralBtn = screen.getByRole('button', { name: 'Coral' });

    expect(defaultBtn).toHaveStyle({ backgroundColor: DARK_NOTE_COLORS['#ffffff'] });
    expect(coralBtn).toHaveStyle({ backgroundColor: DARK_NOTE_COLORS['#faafa8'] });
    expect(defaultBtn).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(coralBtn);
    expect(onSelectColor).toHaveBeenCalledWith('#faafa8');
  });
});
