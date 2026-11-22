import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SearchBar } from '../src/components/SearchBar';

describe('SearchBar (Web)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders input with default placeholder and search icon', () => {
    render(<SearchBar onSearch={() => {}} />);
    const input = screen.getByRole('textbox', { name: /search/i });
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Search notes...');
  });

  it('renders with custom placeholder and initial value', () => {
    render(<SearchBar value="Initial query" placeholder="Filter everything..." onSearch={() => {}} />);
    const input = screen.getByPlaceholderText('Filter everything...');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('Initial query');
  });

  it('debounces user input and calls onSearch with the typed query', () => {
    const handleSearch = vi.fn();
    render(<SearchBar onSearch={handleSearch} debounceMs={300} />);
    const input = screen.getByRole('textbox', { name: /search/i });

    fireEvent.change(input, { target: { value: 'meeting' } });
    expect(input).toHaveValue('meeting');

    // Should not have fired immediately
    expect(handleSearch).not.toHaveBeenCalled();

    // Fast-forward past debounce time
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(handleSearch).toHaveBeenCalledTimes(1);
    expect(handleSearch).toHaveBeenCalledWith('meeting');
  });

  it('only fires once for consecutive keystrokes within debounce interval', () => {
    const handleSearch = vi.fn();
    render(<SearchBar onSearch={handleSearch} debounceMs={300} />);
    const input = screen.getByRole('textbox', { name: /search/i });

    fireEvent.change(input, { target: { value: 'p' } });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    fireEvent.change(input, { target: { value: 'pr' } });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    fireEvent.change(input, { target: { value: 'project' } });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Still within debounce interval
    expect(handleSearch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(handleSearch).toHaveBeenCalledTimes(1);
    expect(handleSearch).toHaveBeenCalledWith('project');
  });

  it('displays clear button when input has text and clears on click', () => {
    const handleSearch = vi.fn();
    render(<SearchBar onSearch={handleSearch} debounceMs={300} />);
    const input = screen.getByRole('textbox', { name: /search/i });

    // Initially no clear button
    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'some query' } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(handleSearch).toHaveBeenCalledWith('some query');

    // Clear button should now be present
    const clearBtn = screen.getByRole('button', { name: /clear search/i });
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);

    expect(input).toHaveValue('');
    expect(handleSearch).toHaveBeenLastCalledWith('');
    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();
  });

  it('does not re-trigger search timer when onSearch reference changes without text input changes', () => {
    const handleSearch1 = vi.fn();
    const handleSearch2 = vi.fn();
    const { rerender } = render(<SearchBar onSearch={handleSearch1} debounceMs={300} />);
    const input = screen.getByRole('textbox', { name: /search/i });

    fireEvent.change(input, { target: { value: 'stable query' } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(handleSearch1).toHaveBeenCalledTimes(1);

    // Rerender with a new function reference
    rerender(<SearchBar onSearch={handleSearch2} debounceMs={300} />);
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // handleSearch2 should not have been called because input didn't change
    expect(handleSearch2).not.toHaveBeenCalled();
  });

  it('includes required dark mode Tailwind classes', () => {
    render(<SearchBar onSearch={() => {}} />);
    const input = screen.getByRole('textbox', { name: /search/i });

    expect(input.className).toContain('dark:bg-stone-800');
    expect(input.className).toContain('dark:border-stone-700');
    expect(input.className).toContain('dark:text-stone-100');
  });
});
