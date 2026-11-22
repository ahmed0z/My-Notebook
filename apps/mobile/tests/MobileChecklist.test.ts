import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { MobileChecklistBlock } from '../src/components/editor/MobileChecklistBlock';
import { MobileNoteCard } from '../src/components/MobileNoteCard';
import { ChecklistBlockContent, NoteDto } from '@notebook/shared';

// Simulated React Hooks state for Node Vitest environment
vi.mock('react', async () => {
  const actual: any = await vi.importActual('react');
  return {
    ...actual,
    default: actual.default,
  };
});

// Mock ThemeContext
vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: false,
    colors: {
      text: '#1c1917',
      textMuted: '#78716c',
      border: '#e7e5e4',
      cardBg: '#ffffff',
      buttonBg: '#1c1917',
      buttonText: '#ffffff',
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
    TextInput: (props: any) => React.createElement('TextInput', props, props.children),
    TouchableOpacity: (props: any) => React.createElement('TouchableOpacity', props, props.children),
    StyleSheet: {
      create: (styles: any) => styles,
    },
  };
});

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

describe('MobileChecklistBlock', () => {
  it('renders checkboxes with curved corners (borderRadius: 6), borderWidth: 1.5, and transparent background', () => {
    const content: ChecklistBlockContent = {
      items: [
        { id: '1', text: 'Task 1', checked: false },
        { id: '2', text: 'Task 2', checked: true },
      ],
    };
    const onChange = vi.fn();

    const element = MobileChecklistBlock({ content, onChange });
    const checkboxes = findElements(element, (el) => el.props?.accessibilityRole === 'checkbox');

    expect(checkboxes.length).toBe(2);

    // Style checks for checkbox 1 (unchecked)
    const cb1Style = Array.isArray(checkboxes[0].props.style)
      ? Object.assign({}, ...checkboxes[0].props.style.filter(Boolean))
      : checkboxes[0].props.style;

    expect(cb1Style.borderRadius).toBe(6);
    expect(cb1Style.borderWidth).toBe(1.5);
    expect(cb1Style.backgroundColor).toBe('transparent');

    // Style checks for checkbox 2 (checked) - must NOT have solid/button background
    const cb2Style = Array.isArray(checkboxes[1].props.style)
      ? Object.assign({}, ...checkboxes[1].props.style.filter(Boolean))
      : checkboxes[1].props.style;

    expect(cb2Style.borderRadius).toBe(6);
    expect(cb2Style.borderWidth).toBe(1.5);
    expect(cb2Style.backgroundColor).toBe('transparent');

    // Checkmark text should be colored with colors.text
    const checkmarks = findElements(checkboxes[1], (el) => el.props?.children === '✓');
    expect(checkmarks.length).toBe(1);
    const checkmarkStyle = Array.isArray(checkmarks[0].props.style)
      ? Object.assign({}, ...checkmarks[0].props.style.filter(Boolean))
      : checkmarks[0].props.style;
    expect(checkmarkStyle.color).toBe('#1c1917');
  });

  it('toggles checked state when checkbox is pressed', () => {
    const content: ChecklistBlockContent = {
      items: [{ id: 'item-1', text: 'Task 1', checked: false }],
    };
    const onChange = vi.fn();

    const element = MobileChecklistBlock({ content, onChange });
    const checkbox = findElements(element, (el) => el.props?.accessibilityRole === 'checkbox')[0];

    checkbox.props.onPress();
    expect(onChange).toHaveBeenCalledWith({
      items: [{ id: 'item-1', text: 'Task 1', checked: true }],
    });
  });
});

describe('MobileNoteCard Checklist Preview', () => {
  it('previews checklist items with curved-corner transparent checkboxes', () => {
    const note: NoteDto = {
      id: 'n1',
      title: 'Checklist Note',
      color: '#ffffff',
      position: 0,
      isPinned: false,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
      blocks: [
        {
          id: 'b1',
          noteId: 'n1',
          type: 'checklist',
          content: {
            items: [
              { id: 'i1', text: 'Buy milk', checked: false },
              { id: 'i2', text: 'Walk dog', checked: true },
            ],
          },
          position: 0,
          createdAt: '',
          updatedAt: '',
        },
      ],
    };

    const element = MobileNoteCard({ note, onPress: vi.fn() });

    // Find preview checkmark
    const checkmarks = findElements(element, (el) => el.props?.children === '✓');
    expect(checkmarks.length).toBe(1);

    // Find preview checkbox views
    const previewCheckboxes = findElements(element, (el) => {
      const style = Array.isArray(el.props?.style)
        ? Object.assign({}, ...el.props.style.filter(Boolean))
        : el.props?.style;
      return style?.width === 14 && style?.height === 14;
    });

    expect(previewCheckboxes.length).toBe(2);
    const cbStyle = Array.isArray(previewCheckboxes[0].props.style)
      ? Object.assign({}, ...previewCheckboxes[0].props.style.filter(Boolean))
      : previewCheckboxes[0].props.style;

    expect(cbStyle.borderRadius).toBe(4);
    expect(cbStyle.backgroundColor).toBe('transparent');
  });
});
