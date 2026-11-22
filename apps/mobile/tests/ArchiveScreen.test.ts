import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { ArchiveScreen } from '../src/screens/ArchiveScreen';
import { MobileApiClient } from '../src/api/mobileClient';
import { NoteDto } from '@notebook/shared';

// Simulated React Hooks state for Node Vitest environment
let stateStore: any[] = [];
let stateIndex = 0;
let effectCallbacks: (() => void)[] = [];

function resetReactMock() {
  stateStore = [];
  stateIndex = 0;
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

  const mockUseCallback = (cb: any) => cb;

  return {
    ...actual,
    default: {
      ...actual.default,
      useState: mockUseState,
      useEffect: mockUseEffect,
      useCallback: mockUseCallback,
    },
    useState: mockUseState,
    useEffect: mockUseEffect,
    useCallback: mockUseCallback,
  };
});

// Mock ThemeContext
vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: false,
    colors: {
      background: '#fafaf9',
      surface: '#ffffff',
      card: '#ffffff',
      text: '#1c1917',
      textSecondary: '#44403c',
      textMuted: '#78716c',
      border: '#e7e5e4',
    },
    getNoteCardColor: () => '#ffffff',
  }),
}));

// Mock react-native
vi.mock('react-native', () => {
  const React = require('react');
  return {
    View: (props: any) => React.createElement('View', props, props.children),
    Text: (props: any) => React.createElement('Text', props, props.children),
    FlatList: (props: any) => {
      const items = (props.data || []).map((item: any, index: number) =>
        props.renderItem ? props.renderItem({ item, index }) : null
      );
      const empty = (!props.data || props.data.length === 0) ? props.ListEmptyComponent : null;
      return React.createElement('FlatList', props, [items, empty]);
    },
    TouchableOpacity: (props: any) => React.createElement('TouchableOpacity', props, props.children),
    ActivityIndicator: (props: any) => React.createElement('ActivityIndicator', props, props.children),
    RefreshControl: (props: any) => React.createElement('RefreshControl', props, props.children),
    StyleSheet: {
      create: (styles: any) => styles,
    },
  };
});

vi.mock('../src/api/mobileClient', () => ({
  MobileApiClient: {
    getNotes: vi.fn(),
    updateNote: vi.fn().mockResolvedValue({}),
    deleteNote: vi.fn().mockResolvedValue({}),
  },
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
  if (typeof element !== 'object') return results;
  if (predicate(element)) {
    results.push(element);
  }
  if (typeof element.type === 'function') {
    try {
      const rendered = element.type(element.props);
      results.push(...findElements(rendered, predicate));
    } catch {
      // ignore
    }
  }
  const children = element.props?.children;
  if (children) {
    results.push(...findElements(children, predicate));
  }
  return results;
}

function renderArchiveScreen(props: any) {
  stateIndex = 0;
  return ArchiveScreen(props);
}

describe('ArchiveScreen (Mobile)', () => {
  const mockNotes: NoteDto[] = [
    {
      id: 'active-1',
      title: 'Active Note',
      color: '#ffffff',
      position: 0,
      isPinned: false,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
      blocks: [],
    },
    {
      id: 'archived-1',
      title: 'Archived Note 1',
      color: '#ffffff',
      position: 1,
      isPinned: false,
      isArchived: true,
      createdAt: '',
      updatedAt: '',
      blocks: [],
    },
    {
      id: 'archived-2',
      title: 'Archived Note 2',
      color: '#ccff90',
      position: 2,
      isPinned: false,
      isArchived: true,
      createdAt: '',
      updatedAt: '',
      blocks: [],
    },
  ];

  beforeEach(() => {
    resetReactMock();
    vi.clearAllMocks();
    (MobileApiClient.getNotes as any).mockResolvedValue(mockNotes);
  });

  it('renders title and triggers onBack when back button pressed', () => {
    const onBack = vi.fn();
    const element = renderArchiveScreen({
      onBack,
      onSelectNote: vi.fn(),
    });

    const backBtn = findElements(
      element,
      (el) => el.props?.accessibilityLabel === 'Back to notes'
    )[0];
    expect(backBtn).toBeDefined();
    backBtn.props.onPress();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders hamburger menu button when onToggleSideMenu is provided', () => {
    const onToggleSideMenu = vi.fn();
    const element = renderArchiveScreen({
      onBack: vi.fn(),
      onSelectNote: vi.fn(),
      onToggleSideMenu,
    });

    const menuBtn = findElements(
      element,
      (el) => el.props?.accessibilityLabel === 'Open menu'
    )[0];
    expect(menuBtn).toBeDefined();
    menuBtn.props.onPress();
    expect(onToggleSideMenu).toHaveBeenCalledTimes(1);
  });

  it('loads and filters archived notes', async () => {
    renderArchiveScreen({
      onBack: vi.fn(),
      onSelectNote: vi.fn(),
    });

    // Run effects and wait for async promises
    for (const cb of effectCallbacks) {
      cb();
    }
    await new Promise((r) => setTimeout(r, 10));

    expect(MobileApiClient.getNotes).toHaveBeenCalled();
    expect(stateStore[0]).toHaveLength(2);
    expect(stateStore[0][0].id).toBe('archived-1');
    expect(stateStore[0][1].id).toBe('archived-2');
  });

  it('renders archived notes in FlatList and handles unarchive', async () => {
    // Pre-populate state
    stateStore = [
      [mockNotes[1]], // archivedNotes
      false, // loading
      false, // refreshing
    ];

    const element = renderArchiveScreen({
      onBack: vi.fn(),
      onSelectNote: vi.fn(),
    });

    const unarchiveBtn = findElements(
      element,
      (el) => el.props?.accessibilityLabel === 'Unarchive note'
    )[0];
    expect(unarchiveBtn).toBeDefined();

    await unarchiveBtn.props.onPress();
    expect(MobileApiClient.updateNote).toHaveBeenCalledWith('archived-1', { isArchived: false });
  });
});
