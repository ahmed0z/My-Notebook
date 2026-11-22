import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MobileApiClient } from '../src/api/mobileClient';
import { MobileSearchBar } from '../src/components/MobileSearchBar';

// Simulated React Hooks state for Node Vitest environment
let stateStore: any[] = [];
let stateIndex = 0;
let refStore: any[] = [];
let refIndex = 0;
let effectCallbacks: (() => void)[] = [];

function resetReactMock() {
  stateStore = [];
  stateIndex = 0;
  refStore = [];
  refIndex = 0;
  effectCallbacks = [];
}

vi.mock('react', async () => {
  const actual: any = await vi.importActual('react');
  const mockUseState = (init: any) => {
    const idx = stateIndex++;
    if (stateStore[idx] === undefined) {
      stateStore[idx] = typeof init === 'function' ? init() : init;
    }
    const set = (val: any) => {
      stateStore[idx] = typeof val === 'function' ? val(stateStore[idx]) : val;
    };
    return [stateStore[idx], set];
  };

  const mockUseEffect = (cb: () => void) => {
    effectCallbacks.push(cb);
  };

  const mockUseRef = (init: any) => {
    const idx = refIndex++;
    if (refStore[idx] === undefined) {
      refStore[idx] = { current: init };
    }
    return refStore[idx];
  };

  const mockUseContext = (ctx: any) => null;

  return {
    ...actual,
    default: {
      ...actual.default,
      useState: mockUseState,
      useEffect: mockUseEffect,
      useRef: mockUseRef,
      useContext: mockUseContext,
    },
    useState: mockUseState,
    useEffect: mockUseEffect,
    useRef: mockUseRef,
    useContext: mockUseContext,
  };
});

// Mock react-native
vi.mock('react-native', () => {
  return {
    View: 'View',
    Text: 'Text',
    TextInput: 'TextInput',
    TouchableOpacity: 'TouchableOpacity',
    StyleSheet: {
      create: (styles: any) => styles,
    },
  };
});

vi.mock('../src/storage/authStorage', () => ({
  getServerUrl: vi.fn().mockResolvedValue('http://localhost:5000'),
  getToken: vi.fn().mockResolvedValue('test-token'),
}));

function findElements(element: any, predicate: (el: any) => boolean): any[] {
  const results: any[] = [];
  if (!element) return results;
  if (Array.isArray(element)) {
    for (const item of element) {
      results.push(...findElements(item, predicate));
    }
    return results;
  }
  if (predicate(element)) {
    results.push(element);
  }
  if (element.props && element.props.children) {
    results.push(...findElements(element.props.children, predicate));
  }
  return results;
}

function renderSearchBar(props: any) {
  stateIndex = 0;
  refIndex = 0;
  return MobileSearchBar(props);
}

describe('MobileSearchBar and MobileApiClient.searchNotes', () => {
  beforeEach(() => {
    resetReactMock();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  describe('MobileApiClient.searchNotes', () => {
    it('requests /search with properly URL-encoded query', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [{ id: '1', title: 'Found Note', blocks: [] }],
      });
      global.fetch = mockFetch;

      const results = await MobileApiClient.searchNotes('hello world & more');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('/api/search?q=hello%20world%20%26%20more');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Found Note');
    });
  });

  describe('MobileSearchBar Component', () => {
    it('renders input with placeholder and initial state', () => {
      resetReactMock();
      const element: any = renderSearchBar({ onSearch: vi.fn(), placeholder: 'Search all notes...' });
      const inputs = findElements(element, el => el.type === 'TextInput');
      expect(inputs.length).toBe(1);
      expect(inputs[0].props.placeholder).toBe('Search all notes...');
    });

    it('debounces calls to onSearch when typing', () => {
      resetReactMock();
      const onSearch = vi.fn();
      let element: any = renderSearchBar({ onSearch, debounceMs: 300 });
      // Execute initial mount effects
      effectCallbacks.forEach(cb => cb());
      effectCallbacks = [];

      const inputs = findElements(element, el => el.type === 'TextInput');
      expect(inputs.length).toBe(1);

      inputs[0].props.onChangeText('react native');
      // Re-render
      element = renderSearchBar({ onSearch, debounceMs: 300 });
      // Execute update effects
      effectCallbacks.forEach(cb => cb());
      effectCallbacks = [];

      expect(onSearch).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);

      expect(onSearch).toHaveBeenCalledTimes(1);
      expect(onSearch).toHaveBeenCalledWith('react native');
    });

    it('clears input and invokes onSearch with empty string when clear button is pressed', () => {
      resetReactMock();
      const onSearch = vi.fn();
      let element: any = renderSearchBar({ onSearch, debounceMs: 300 });
      effectCallbacks.forEach(cb => cb());
      effectCallbacks = [];

      const inputs = findElements(element, el => el.type === 'TextInput');
      inputs[0].props.onChangeText('search phrase');
      element = renderSearchBar({ onSearch, debounceMs: 300 });
      effectCallbacks.forEach(cb => cb());
      effectCallbacks = [];

      vi.advanceTimersByTime(300);
      expect(onSearch).toHaveBeenCalledWith('search phrase');

      // Re-render element with updated state to find clear button
      element = renderSearchBar({ onSearch, debounceMs: 300 });
      const clearBtns = findElements(element, el => el.type === 'TouchableOpacity');
      expect(clearBtns.length).toBe(1);

      clearBtns[0].props.onPress();
      expect(onSearch).toHaveBeenLastCalledWith('');
    });
  });
});
