import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MobileApiClient } from '../src/api/mobileClient';
import { MobileBacklinksModal, extractMobileBacklinkSnippet } from '../src/components/editor/MobileBacklinksModal';
import { MobileTextBlock } from '../src/components/editor/MobileTextBlock';
import { MobileBlockEditor } from '../src/components/editor/MobileBlockEditor';
import { NoteDto, BlockDto } from '@notebook/shared';

// Simulated React Hooks state for Node Vitest environment
let stateStore: any[] = [];
let stateIndex = 0;
let effectCallbacks: (() => void)[] = [];

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

  const mockUseReducer = (reducer: any, init: any) => {
    const idx = stateIndex++;
    if (stateStore[idx] === undefined) {
      stateStore[idx] = init;
    }
    const dispatch = (action: any) => {
      stateStore[idx] = reducer(stateStore[idx], action);
    };
    return [stateStore[idx], dispatch];
  };

  const mockUseEffect = (cb: () => void) => {
    effectCallbacks.push(cb);
  };

  const mockUseMemo = (fn: any) => fn();
  const mockUseRef = (init: any) => ({ current: init });
  const mockUseContext = (ctx: any) => null;

  return {
    ...actual,
    default: {
      ...actual.default,
      useState: mockUseState,
      useEffect: mockUseEffect,
      useReducer: mockUseReducer,
      useMemo: mockUseMemo,
      useRef: mockUseRef,
      useContext: mockUseContext,
    },
    useState: mockUseState,
    useEffect: mockUseEffect,
    useReducer: mockUseReducer,
    useMemo: mockUseMemo,
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
    ScrollView: 'ScrollView',
    Modal: 'Modal',
    ActivityIndicator: 'ActivityIndicator',
    StyleSheet: {
      create: (styles: any) => styles,
    },
  };
});

vi.mock('../src/storage/authStorage', () => ({
  getServerUrl: vi.fn().mockResolvedValue('http://localhost:5000'),
  getToken: vi.fn().mockResolvedValue('test-token'),
}));

// Helper to recursively find elements in rendered React element tree
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
  if (Array.isArray(children)) {
    for (const child of children) {
      results.push(...findElements(child, predicate));
    }
  } else if (children && typeof children === 'object') {
    results.push(...findElements(children, predicate));
  }
  return results;
}

async function renderBacklinksModal(props: any) {
  stateIndex = 0;
  MobileBacklinksModal(props);
  const effectsToRun = [...effectCallbacks];
  effectCallbacks = [];
  for (const eff of effectsToRun) {
    eff();
  }
  // Allow microtasks to complete (ApiClient.getBacklinks promise)
  await new Promise(resolve => setTimeout(resolve, 0));
  stateIndex = 0;
  return MobileBacklinksModal(props);
}

describe('Mobile Backlinks and Note Linking', () => {
  beforeEach(() => {
    stateStore = [];
    stateIndex = 0;
    effectCallbacks = [];
    vi.clearAllMocks();
    (global as any).fetch = vi.fn();
  });

  describe('MobileApiClient.getBacklinks', () => {
    it('sends GET request to /notes/{id}/backlinks with token and returns notes', async () => {
      const mockNotes: NoteDto[] = [
        {
          id: 'source-1',
          title: 'Referencing Note',
          color: '#ffffff',
          position: 0,
          isPinned: false,
          isArchived: false,
          createdAt: '',
          updatedAt: ''
        }
      ];

      (global as any).fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockNotes
      });

      const result = await MobileApiClient.getBacklinks('target-1');
      expect((global as any).fetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/notes/target-1/backlinks',
        expect.objectContaining({
          headers: expect.any(Headers)
        })
      );
      expect(result).toEqual(mockNotes);
    });
  });

  describe('extractMobileBacklinkSnippet', () => {
    it('returns empty string for missing or empty blocks', () => {
      expect(extractMobileBacklinkSnippet(undefined)).toBe('');
      expect(extractMobileBacklinkSnippet([])).toBe('');
    });

    it('extracts text from blocks with text content', () => {
      const blocks: BlockDto[] = [
        {
          id: 'b1',
          noteId: 'n1',
          type: 'text',
          content: { text: 'Mobile reference to [[Target]].', level: 'paragraph' },
          position: 0,
          createdAt: '',
          updatedAt: ''
        }
      ];
      expect(extractMobileBacklinkSnippet(blocks)).toBe('Mobile reference to [[Target]].');
    });
  });

  describe('MobileBacklinksModal', () => {
    it('renders null when visible is false', () => {
      stateIndex = 0;
      const element = MobileBacklinksModal({
        visible: false,
        noteId: 'note-1',
        onClose: vi.fn(),
        onSelectNote: vi.fn()
      });
      expect(element).toBeNull();
    });

    it('fetches backlinks and renders empty message when no backlinks exist', async () => {
      vi.spyOn(MobileApiClient, 'getBacklinks').mockResolvedValueOnce([]);

      const updatedElement = await renderBacklinksModal({
        visible: true,
        noteId: 'note-1',
        onClose: vi.fn(),
        onSelectNote: vi.fn()
      });

      const textNodes = findElements(updatedElement, el => el.type === 'Text');
      const emptyText = textNodes.find(t => String(t.props?.children).includes('No backlinks yet'));
      expect(emptyText).toBeDefined();
    });

    it('renders backlink item and invokes onSelectNote on tap', async () => {
      const mockBacklinks: NoteDto[] = [
        {
          id: 'source-123',
          title: 'Linking Note',
          color: '#ffffff',
          position: 0,
          isPinned: false,
          isArchived: false,
          createdAt: '',
          updatedAt: '',
          blocks: [
            {
              id: 'b1',
              noteId: 'source-123',
              type: 'text',
              content: { text: 'Snippet content mentioning [[Target]]', level: 'paragraph' },
              position: 0,
              createdAt: '',
              updatedAt: ''
            }
          ]
        }
      ];

      vi.spyOn(MobileApiClient, 'getBacklinks').mockResolvedValueOnce(mockBacklinks);
      const onSelectNote = vi.fn();
      const onClose = vi.fn();

      const element = await renderBacklinksModal({
        visible: true,
        noteId: 'target-1',
        onClose,
        onSelectNote
      });

      const textNodes = findElements(element, el => el.type === 'Text');
      const titleNode = textNodes.find(t => t.props?.children === 'Linking Note');
      expect(titleNode).toBeDefined();

      // Find the touchable item for this backlink
      const touchables = findElements(element, el => el.type === 'TouchableOpacity' && el.props?.onPress);
      const backlinkTouchable = touchables.find(t => {
        const texts = findElements(t, sub => sub.type === 'Text');
        return texts.some(tx => tx.props?.children === 'Linking Note');
      });

      expect(backlinkTouchable).toBeDefined();
      backlinkTouchable.props.onPress();

      expect(onSelectNote).toHaveBeenCalledWith('source-123');
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('MobileTextBlock Note Links', () => {
    it('renders clickable link pill when text contains [[Link Title]]', () => {
      const onOpenNote = vi.fn();
      stateIndex = 0;
      const element = MobileTextBlock({
        content: { text: 'See [[Roadmap Spec]] for details', level: 'paragraph' },
        onChange: vi.fn(),
        onOpenNote
      });

      const touchables = findElements(element, el => el.type === 'TouchableOpacity');
      const linkTouchable = touchables.find(t => {
        const textChild = findElements(t, sub => sub.type === 'Text');
        return textChild.some(tx => {
          const content = Array.isArray(tx.props?.children) ? tx.props.children.join('') : String(tx.props?.children || '');
          return content === '[[Roadmap Spec]]';
        });
      });

      expect(linkTouchable).toBeDefined();
      linkTouchable.props.onPress();
      expect(onOpenNote).toHaveBeenCalledWith('Roadmap Spec');
    });
  });

  describe('MobileBlockEditor Backlinks Integration', () => {
    it('renders Backlinks drawer button and opens modal', () => {
      const onOpenNote = vi.fn();
      stateIndex = 0;
      const initialBlocks: BlockDto[] = [
        { id: '1', noteId: 'n1', type: 'text', content: { text: 'Hello', level: 'paragraph' }, position: 0, createdAt: '', updatedAt: '' }
      ];

      const element = MobileBlockEditor({
        noteId: 'n1',
        initialBlocks,
        onOpenNote
      });

      const touchables = findElements(element, el => el.type === 'TouchableOpacity');
      const backlinksBtn = touchables.find(t => {
        const texts = findElements(t, sub => sub.type === 'Text');
        return texts.some(tx => String(tx.props?.children).includes('Backlinks'));
      });

      expect(backlinksBtn).toBeDefined();
    });
  });
});
