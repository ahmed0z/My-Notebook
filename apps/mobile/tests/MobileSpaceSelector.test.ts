import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { Alert } from 'react-native';
import { MobileSpaceSelector } from '../src/components/MobileSpaceSelector';
import { MobileApiClient } from '../src/api/mobileClient';
import { SpaceDto } from '@notebook/shared';

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
  return {
    ...actual,
    default: {
      ...actual.default,
      useState: (init: any) => {
        const idx = stateIndex++;
        if (stateStore[idx] === undefined) {
          stateStore[idx] = typeof init === 'function' ? init() : init;
        }
        const set = (val: any) => {
          stateStore[idx] = typeof val === 'function' ? val(stateStore[idx]) : val;
        };
        return [stateStore[idx], set];
      },
      useEffect: (cb: () => void) => {
        effectCallbacks.push(cb);
      },
      useContext: (ctx: any) => null,
    },
    useState: (init: any) => {
      const idx = stateIndex++;
      if (stateStore[idx] === undefined) {
        stateStore[idx] = typeof init === 'function' ? init() : init;
      }
      const set = (val: any) => {
        stateStore[idx] = typeof val === 'function' ? val(stateStore[idx]) : val;
      };
      return [stateStore[idx], set];
    },
    useEffect: (cb: () => void) => {
      effectCallbacks.push(cb);
    },
    useContext: (ctx: any) => null,
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
  }),
}));

// Mock react-native
vi.mock('react-native', () => {
  const React = require('react');
  return {
    View: (props: any) => React.createElement('View', props, props.children),
    Text: (props: any) => React.createElement('Text', props, props.children),
    TextInput: (props: any) => React.createElement('TextInput', props, props.children),
    TouchableOpacity: (props: any) => React.createElement('TouchableOpacity', props, props.children),
    Alert: {
      alert: vi.fn((_title: string, _message?: string, buttons?: any[]) => {
        const deleteBtn = buttons?.find((b: any) => b.style === 'destructive' || b.text === 'Delete');
        if (deleteBtn?.onPress) {
          deleteBtn.onPress();
        }
      }),
    },
    StyleSheet: {
      create: (styles: any) => styles,
      absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    },
  };
});

// Mock authStorage
vi.mock('../src/storage/authStorage', () => ({
  getServerUrl: () => Promise.resolve('http://localhost:5000'),
  getToken: () => Promise.resolve('test-jwt-token'),
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
  const children = element.props?.children;
  if (children) {
    results.push(...findElements(children, predicate));
  }
  return results;
}

const mockSpaces: SpaceDto[] = [
  { id: 's-1', name: 'Work', parentSpaceId: null, position: 0, createdAt: '2026-01-01' },
  { id: 's-2', name: 'Personal', parentSpaceId: null, position: 1, createdAt: '2026-01-02' },
  { id: 's-3', name: 'Mobile App', parentSpaceId: 's-1', position: 0, createdAt: '2026-01-03' },
];

describe('MobileSpaceSelector Component', () => {
  beforeEach(() => {
    resetReactMock();
  });

  it('renders SPACES header, All Notes, and spaces list', () => {
    const element = MobileSpaceSelector({
      spaces: mockSpaces,
      activeSpaceId: null,
      onSelectSpace: vi.fn(),
      onCreateSpace: vi.fn(),
    });

    const texts = findElements(element, (el) => typeof el.props?.children === 'string').map(
      (el) => el.props.children
    );
    expect(texts).toContain('SPACES');
    expect(texts).toContain('All Notes');
    expect(texts).toContain('Work');
    expect(texts).toContain('Personal');
    expect(texts).toContain('Mobile App');
  });

  it('selects a space and All Notes on press', () => {
    const onSelect = vi.fn();
    const element = MobileSpaceSelector({
      spaces: mockSpaces,
      activeSpaceId: 's-1',
      onSelectSpace: onSelect,
      onCreateSpace: vi.fn(),
    });

    const workBtn = findElements(
      element,
      (el) => el.props?.accessibilityLabel === 'Select space Work'
    )[0];
    expect(workBtn).toBeDefined();
    workBtn.props.onPress();
    expect(onSelect).toHaveBeenCalledWith('s-1');

    const allNotesBtn = findElements(
      element,
      (el) => el.props?.accessibilityLabel === 'All Notes'
    )[0];
    expect(allNotesBtn).toBeDefined();
    allNotesBtn.props.onPress();
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('allows starting creation and confirming root space', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const element = MobileSpaceSelector({
      spaces: mockSpaces,
      activeSpaceId: null,
      onSelectSpace: vi.fn(),
      onCreateSpace: onCreate,
    });

    const addBtn = findElements(
      element,
      (el) => el.props?.accessibilityLabel === 'Add new space'
    )[0];
    expect(addBtn).toBeDefined();
    addBtn.props.onPress();
  });

  it('deletes a space when delete button is pressed', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const element = MobileSpaceSelector({
      spaces: mockSpaces,
      activeSpaceId: null,
      onSelectSpace: vi.fn(),
      onCreateSpace: vi.fn(),
      onDeleteSpace: onDelete,
    });

    const deleteBtn = findElements(
      element,
      (el) => el.props?.accessibilityLabel === 'Delete Personal'
    )[0];
    expect(deleteBtn).toBeDefined();
    await deleteBtn.props.onPress();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Delete Space',
      'Are you sure you want to delete this space and its sub-spaces? Notes will be moved to unassigned.',
      expect.any(Array)
    );
    expect(onDelete).toHaveBeenCalledWith('s-2');
  });
});

describe('MobileApiClient space methods', () => {
  it('getSpaces sends GET to /api/spaces', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSpaces,
    });
    global.fetch = mockFetch;

    const spaces = await MobileApiClient.getSpaces();
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/spaces',
      expect.objectContaining({ headers: expect.any(Headers) })
    );
    expect(spaces).toEqual(mockSpaces);
  });

  it('createSpace sends POST to /api/spaces with name and parentSpaceId', async () => {
    const newSpace: SpaceDto = { id: 's-99', name: 'New Project', parentSpaceId: 's-1', position: 2, createdAt: '2026-01-05' };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => newSpace,
    });
    global.fetch = mockFetch;

    const result = await MobileApiClient.createSpace('New Project', 's-1');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/spaces',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'New Project', parentSpaceId: 's-1' }),
      })
    );
    expect(result).toEqual(newSpace);
  });

  it('moveNote sends PUT to /api/notes/{id}/move with spaceId', async () => {
    const movedNote = { id: 'note-1', title: 'Note', spaceId: 's-2' };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => movedNote,
    });
    global.fetch = mockFetch;

    const result = await MobileApiClient.moveNote('note-1', 's-2');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/notes/note-1/move',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ spaceId: 's-2' }),
      })
    );
    expect(result).toEqual(movedNote);
  });

  it('deleteSpace sends DELETE to /api/spaces/{id}', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => ({}),
    });
    global.fetch = mockFetch;

    await MobileApiClient.deleteSpace('s-1');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/spaces/s-1',
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });
});
