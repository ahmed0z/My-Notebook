import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { NotesGridScreen } from '../src/screens/NotesGridScreen';
import { MobileApiClient } from '../src/api/mobileClient';
import { SpaceDto } from '@notebook/shared';

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
      buttonBg: '#1c1917',
      buttonText: '#ffffff',
      inputBg: '#f5f5f4',
    },
    getNoteCardColor: () => '#ffffff',
  }),
}));

vi.mock('react-native', () => {
  const React = require('react');
  return {
    View: (props: any) => React.createElement('View', props, props.children),
    Text: (props: any) => React.createElement('Text', props, props.children),
    FlatList: (props: any) => React.createElement('FlatList', props, null),
    TouchableOpacity: (props: any) => React.createElement('TouchableOpacity', props, props.children),
    ActivityIndicator: (props: any) => React.createElement('ActivityIndicator', props, props.children),
    RefreshControl: (props: any) => React.createElement('RefreshControl', props, props.children),
    Modal: (props: any) => React.createElement('Modal', props, props.children),
    ScrollView: (props: any) => React.createElement('ScrollView', props, props.children),
    StyleSheet: {
      create: (styles: any) => styles,
      absoluteFillObject: {},
    },
  };
});

vi.mock('../src/api/mobileClient', () => ({
  MobileApiClient: {
    getNotes: vi.fn().mockResolvedValue([]),
    createNote: vi.fn().mockResolvedValue({ id: 'new-1', title: 'New Note' }),
    searchNotes: vi.fn().mockResolvedValue([]),
    moveNote: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../src/storage/authStorage', () => ({
  clearToken: vi.fn(),
  clearUsername: vi.fn(),
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

function renderNotesGridScreen(props: any) {
  stateIndex = 0;
  return NotesGridScreen(props);
}

describe('NotesGridScreen (Mobile)', () => {
  const mockSpaces: SpaceDto[] = [
    {
      id: 'space-1',
      name: 'Personal Space',
      parentSpaceId: null,
      position: 0,
      createdAt: '',
    },
  ];

  beforeEach(() => {
    resetReactMock();
    vi.clearAllMocks();
  });

  it('renders default NoteBook title when no space is active', () => {
    const element = renderNotesGridScreen({
      onSelectNote: vi.fn(),
      onLogout: vi.fn(),
      spaces: mockSpaces,
      activeSpaceId: null,
    });

    const titleEl = findElements(element, (el) => el.type === 'Text' && el.props?.children === 'NoteBook')[0];
    expect(titleEl).toBeDefined();

    const backBtn = findElements(
      element,
      (el) => el.props?.accessibilityLabel === 'Back to All Notes'
    )[0];
    expect(backBtn).toBeUndefined();
  });

  it('renders active space name and Back to All Notes button in header when space is active', () => {
    const onSelectSpace = vi.fn();
    const element = renderNotesGridScreen({
      onSelectNote: vi.fn(),
      onLogout: vi.fn(),
      spaces: mockSpaces,
      activeSpaceId: 'space-1',
      onSelectSpace,
    });

    const titleEl = findElements(
      element,
      (el) => el.type === 'Text' && el.props?.children === '📁 Personal Space'
    )[0];
    expect(titleEl).toBeDefined();

    const backBtn = findElements(
      element,
      (el) => el.props?.accessibilityLabel === 'Back to All Notes'
    )[0];
    expect(backBtn).toBeDefined();

    backBtn.props.onPress();
    expect(onSelectSpace).toHaveBeenCalledWith(null);
  });
});
