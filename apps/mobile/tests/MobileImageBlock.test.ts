import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MobileImageBlock, resolveImageUrl } from '../src/components/editor/MobileImageBlock';
import { MobileApiClient } from '../src/api/mobileClient';
import { blockReducer } from '../src/components/editor/blockReducer';
import { ImageBlockContent, BlockDto } from '@notebook/shared';

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

// Mock react-native
vi.mock('react-native', () => {
  const React = require('react');
  return {
    View: (props: any) => React.createElement('View', props, props.children),
    Text: (props: any) => React.createElement('Text', props, props.children),
    Image: (props: any) => React.createElement('Image', props, props.children),
    TextInput: (props: any) => React.createElement('TextInput', props, props.children),
    TouchableOpacity: (props: any) => React.createElement('TouchableOpacity', {
      ...props,
      onPress: props.onPress,
    }, props.children),
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
  if (!element || typeof element !== 'object') return results;
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

function renderComponent(props: any) {
  stateIndex = 0;
  const element = MobileImageBlock(props);
  const effectsToRun = [...effectCallbacks];
  effectCallbacks = [];
  for (const eff of effectsToRun) {
    eff();
  }
  return element;
}

describe('MobileImageBlock', () => {
  const mockOnChange = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetReactMock();
  });

  describe('resolveImageUrl helper', () => {
    it('prepends serverUrl to relative paths', () => {
      expect(resolveImageUrl('/uploads/pic.jpg', 'http://example.com')).toBe('http://example.com/uploads/pic.jpg');
    });

    it('handles trailing slash on serverUrl', () => {
      expect(resolveImageUrl('/uploads/pic.jpg', 'http://example.com/')).toBe('http://example.com/uploads/pic.jpg');
    });

    it('returns absolute URLs unchanged', () => {
      expect(resolveImageUrl('https://cdn.example.com/pic.jpg', 'http://example.com')).toBe('https://cdn.example.com/pic.jpg');
    });

    it('returns empty string when url is empty or undefined', () => {
      expect(resolveImageUrl('', 'http://example.com')).toBe('');
      expect(resolveImageUrl(undefined as any, 'http://example.com')).toBe('');
    });
  });

  describe('Empty state (no URL)', () => {
    const emptyContent: ImageBlockContent = {
      url: '',
      caption: '',
    };

    it('renders input for image URL and Add Image button', () => {
      const element = renderComponent({
        content: emptyContent,
        onChange: mockOnChange,
        onDelete: mockOnDelete,
      });

      expect(element).toBeDefined();
      const textInputs = findElements(element, el => el.type?.name === 'TextInput');
      expect(textInputs.length).toBeGreaterThan(0);
      expect(textInputs[0].props.placeholder).toMatch(/paste image url/i);

      const buttons = findElements(element, el => el.type?.name === 'TouchableOpacity');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('updates text input and invokes onChange when Add button is pressed', () => {
      const element = renderComponent({
        content: emptyContent,
        onChange: mockOnChange,
        onDelete: mockOnDelete,
      });

      const textInputs = findElements(element, el => el.type?.name === 'TextInput');
      expect(textInputs.length).toBeGreaterThan(0);

      // Simulate typing image URL
      textInputs[0].props.onChangeText('https://example.com/mobile-img.jpg');

      // Re-render to observe state update and press Add button
      const reRendered = renderComponent({
        content: emptyContent,
        onChange: mockOnChange,
        onDelete: mockOnDelete,
      });

      const buttons = findElements(reRendered, el => el.type?.name === 'TouchableOpacity');
      const addBtn = buttons[0];
      expect(addBtn).toBeDefined();

      // Trigger button press
      addBtn.props.onPress();

      expect(mockOnChange).toHaveBeenCalledWith({
        url: 'https://example.com/mobile-img.jpg',
        caption: '',
      });
    });
  });

  describe('Rendered Image state (with URL)', () => {
    const loadedContent: ImageBlockContent = {
      url: 'https://example.com/mobile-img.jpg',
      caption: 'Mobile Photo Caption',
    };

    it('renders Image component and caption TextInput with matching props', () => {
      const element = renderComponent({
        content: loadedContent,
        onChange: mockOnChange,
        onDelete: mockOnDelete,
      });

      const images = findElements(element, el => el.type?.name === 'Image');
      expect(images).toHaveLength(1);
      expect(images[0].props.source.uri).toBe('https://example.com/mobile-img.jpg');

      const textInputs = findElements(element, el => el.type?.name === 'TextInput');
      expect(textInputs).toHaveLength(1);
      expect(textInputs[0].props.value).toBe('Mobile Photo Caption');
    });

    it('invokes onChange when caption TextInput onChangeText is called', () => {
      const element = renderComponent({
        content: loadedContent,
        onChange: mockOnChange,
        onDelete: mockOnDelete,
      });

      const textInputs = findElements(element, el => el.type?.name === 'TextInput');
      expect(textInputs).toHaveLength(1);

      // Invoke onChangeText directly on the rendered input
      textInputs[0].props.onChangeText('Updated mobile caption');

      expect(mockOnChange).toHaveBeenCalledWith({
        url: 'https://example.com/mobile-img.jpg',
        caption: 'Updated mobile caption',
      });
    });

    it('invokes onDelete when Remove button is pressed', () => {
      const element = renderComponent({
        content: loadedContent,
        onChange: mockOnChange,
        onDelete: mockOnDelete,
      });

      const buttons = findElements(element, el => el.type?.name === 'TouchableOpacity');
      const removeBtn = buttons.find(b => {
        const textNodes = findElements(b, el => el.type?.name === 'Text');
        return textNodes.some(t => t.props?.children === 'Remove');
      });

      expect(removeBtn).toBeDefined();
      removeBtn!.props.onPress();

      expect(mockOnDelete).toHaveBeenCalled();
    });

    it('invokes onChange to clear url when Replace button is pressed', () => {
      const element = renderComponent({
        content: loadedContent,
        onChange: mockOnChange,
        onDelete: mockOnDelete,
      });

      const buttons = findElements(element, el => el.type?.name === 'TouchableOpacity');
      const replaceBtn = buttons.find(b => {
        const textNodes = findElements(b, el => el.type?.name === 'Text');
        return textNodes.some(t => t.props?.children === 'Replace');
      });

      expect(replaceBtn).toBeDefined();
      replaceBtn!.props.onPress();

      expect(mockOnChange).toHaveBeenCalledWith({
        url: '',
        caption: 'Mobile Photo Caption',
      });
    });

    it('resolves relative URLs to full server URLs via getServerUrl()', async () => {
      const relativeContent: ImageBlockContent = {
        url: '/uploads/server-image.png',
        caption: 'Relative image',
      };

      // First render initiates useEffect with getServerUrl()
      renderComponent({
        content: relativeContent,
        onChange: mockOnChange,
        onDelete: mockOnDelete,
      });

      // Allow async getServerUrl() promise to settle
      await new Promise((r) => setTimeout(r, 20));

      // Second render reflects resolved URL in state
      const resolvedTree = renderComponent({
        content: relativeContent,
        onChange: mockOnChange,
        onDelete: mockOnDelete,
      });

      const images = findElements(resolvedTree, el => el.type?.name === 'Image');
      expect(images).toHaveLength(1);
      expect(images[0].props.source.uri).toBe('http://localhost:5000/uploads/server-image.png');
    });
  });

  describe('MobileApiClient.uploadImage', () => {
    it('sends POST request to /uploads with formData', async () => {
      const fakeFormData = {} as FormData;
      const fakeResponse = {
        url: '/uploads/mobile-upload.png',
        filename: 'mobile-upload.png',
        sizeBytes: 9999,
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => fakeResponse,
      });
      global.fetch = mockFetch as any;

      const result = await MobileApiClient.uploadImage(fakeFormData);
      expect(result).toEqual(fakeResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/uploads',
        expect.objectContaining({
          method: 'POST',
          body: fakeFormData,
          headers: expect.any(Object),
        })
      );
    });
  });

  describe('blockReducer with image blocks', () => {
    it('handles adding and updating an image block', () => {
      const initialBlocks: BlockDto[] = [];
      const imageBlock: BlockDto = {
        id: 'img-1',
        noteId: 'note-1',
        type: 'image',
        content: { url: '', caption: '' },
        position: 0,
        createdAt: '',
        updatedAt: '',
      };

      const withNewBlock = blockReducer(initialBlocks, {
        type: 'ADD_BLOCK',
        payload: imageBlock,
      });
      expect(withNewBlock).toHaveLength(1);
      expect(withNewBlock[0].type).toBe('image');

      const updated = blockReducer(withNewBlock, {
        type: 'UPDATE_BLOCK_CONTENT',
        payload: {
          id: 'img-1',
          content: { url: '/uploads/img1.jpg', caption: 'Test' },
        },
      });
      expect((updated[0].content as ImageBlockContent).url).toBe('/uploads/img1.jpg');
      expect((updated[0].content as ImageBlockContent).caption).toBe('Test');
    });
  });
});
