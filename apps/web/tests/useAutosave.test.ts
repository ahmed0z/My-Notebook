import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useAutosave } from '../src/components/editor/useAutosave';

describe('useAutosave', () => {
  it('triggers save callback only after debounce delay', () => {
    vi.useFakeTimers();
    const saveMock = vi.fn();
    const { rerender } = renderHook(({ val }) => useAutosave(val, saveMock, 1000), { initialProps: { val: 'initial' } });

    rerender({ val: 'change 1' });
    rerender({ val: 'change 2' });
    expect(saveMock).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(1000); });
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenCalledWith('change 2');
    vi.useRealTimers();
  });
});
