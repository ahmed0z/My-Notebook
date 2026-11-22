import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { MobileSideMenu } from '../src/components/MobileSideMenu';

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
    TouchableOpacity: (props: any) => React.createElement('TouchableOpacity', props, props.children),
    Modal: (props: any) => React.createElement('Modal', props, props.children),
    Dimensions: {
      get: () => ({ width: 375, height: 812 }),
    },
    StyleSheet: {
      create: (styles: any) => styles,
      absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
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

describe('MobileSideMenu', () => {
  it('returns null when isOpen is false', () => {
    const result = MobileSideMenu({
      isOpen: false,
      onClose: vi.fn(),
      onNavigate: vi.fn(),
      currentScreen: 'notes',
    });
    expect(result).toBeNull();
  });

  it('renders Modal with NoteBook brand and nav items when isOpen is true', () => {
    const element = MobileSideMenu({
      isOpen: true,
      onClose: vi.fn(),
      onNavigate: vi.fn(),
      currentScreen: 'notes',
    });

    expect(element).not.toBeNull();
    const texts = findElements(element, (el) => typeof el.props?.children === 'string').map(
      (el) => el.props.children
    );
    expect(texts).toContain('NoteBook');
    expect(texts).toContain('Notes');
    expect(texts).toContain('Archive');
    expect(texts).toContain('Settings');
  });

  it('triggers onClose when close button is pressed', () => {
    const onClose = vi.fn();
    const element = MobileSideMenu({
      isOpen: true,
      onClose,
      onNavigate: vi.fn(),
      currentScreen: 'notes',
    });

    const closeBtn = findElements(
      element,
      (el) => el.props?.accessibilityLabel === 'Close menu'
    )[0];
    expect(closeBtn).toBeDefined();
    closeBtn.props.onPress();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('triggers onClose when backdrop is pressed', () => {
    const onClose = vi.fn();
    const element = MobileSideMenu({
      isOpen: true,
      onClose,
      onNavigate: vi.fn(),
      currentScreen: 'notes',
    });

    const backdrop = findElements(
      element,
      (el) => el.props?.accessibilityLabel === 'Close menu backdrop'
    )[0];
    expect(backdrop).toBeDefined();
    backdrop.props.onPress();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('triggers onNavigate and onClose when Archive nav item is pressed', () => {
    const onClose = vi.fn();
    const onNavigate = vi.fn();
    const element = MobileSideMenu({
      isOpen: true,
      onClose,
      onNavigate,
      currentScreen: 'notes',
    });

    const archiveItem = findElements(
      element,
      (el) => el.props?.accessibilityLabel === 'Archive'
    )[0];
    expect(archiveItem).toBeDefined();
    archiveItem.props.onPress();

    expect(onNavigate).toHaveBeenCalledWith('archive');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('triggers onNavigate and onClose when Settings nav item is pressed', () => {
    const onClose = vi.fn();
    const onNavigate = vi.fn();
    const element = MobileSideMenu({
      isOpen: true,
      onClose,
      onNavigate,
      currentScreen: 'notes',
    });

    const settingsItem = findElements(
      element,
      (el) => el.props?.accessibilityLabel === 'Settings'
    )[0];
    expect(settingsItem).toBeDefined();
    settingsItem.props.onPress();

    expect(onNavigate).toHaveBeenCalledWith('settings');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
