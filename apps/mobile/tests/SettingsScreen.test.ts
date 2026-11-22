import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { SettingsScreen } from '../src/screens/SettingsScreen';
import { MobileApiClient } from '../src/api/mobileClient';

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

const mockSetTheme = vi.fn();
let mockCurrentTheme = 'system';
const mockSetDefaultView = vi.fn();
let mockCurrentDefaultView = 'compact';

// Mock ThemeContext
vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    theme: mockCurrentTheme,
    isDark: mockCurrentTheme === 'dark',
    setTheme: mockSetTheme,
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

// Mock SettingsContext
vi.mock('../src/context/SettingsContext', () => ({
  useSettings: () => ({
    defaultView: mockCurrentDefaultView,
    setDefaultView: mockSetDefaultView,
  }),
}));

// Mock authStorage
vi.mock('../src/storage/authStorage', () => ({
  getUsername: vi.fn().mockResolvedValue('stored_user'),
  saveUsername: vi.fn().mockResolvedValue(undefined),
  clearUsername: vi.fn().mockResolvedValue(undefined),
}));

// Mock MobileApiClient
vi.mock('../src/api/mobileClient', () => ({
  MobileApiClient: {
    changePassword: vi.fn().mockResolvedValue({ success: true }),
    createUser: vi.fn().mockResolvedValue({ token: 'mock-token', username: 'newuser' }),
  },
}));

// Mock react-native
vi.mock('react-native', () => {
  const React = require('react');
  return {
    View: (props: any) => React.createElement('View', props, props.children),
    Text: (props: any) => React.createElement('Text', props, props.children),
    TextInput: (props: any) => React.createElement('TextInput', props, props.children),
    ScrollView: (props: any) => React.createElement('ScrollView', props, props.children),
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

function renderSettingsScreen(props: any = {}) {
  stateIndex = 0;
  return SettingsScreen({
    onBack: vi.fn(),
    ...props,
  });
}

describe('SettingsScreen (Mobile)', () => {
  beforeEach(() => {
    resetReactMock();
    vi.clearAllMocks();
  });

  it('renders Settings title and all 3 sections', () => {
    const element = renderSettingsScreen();

    const texts = findElements(element, (el) => typeof el.props?.children === 'string').map(
      (el) => el.props.children
    );

    expect(texts).toContain('Settings');
    expect(texts).toContain('Appearance');
    expect(texts).toContain('View Preferences');
    expect(texts).toContain('Account & Security');
  });

  it('triggers onBack when back button pressed', () => {
    const onBack = vi.fn();
    const element = renderSettingsScreen({
      onBack,
    });

    const backBtn = findElements(
      element,
      (el) => el.props?.accessibilityLabel === 'Back to notes'
    )[0];
    expect(backBtn).toBeDefined();
    backBtn.props.onPress();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('triggers onToggleSideMenu when menu button pressed', () => {
    const onToggleSideMenu = vi.fn();
    const element = renderSettingsScreen({
      onBack: vi.fn(),
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

  it('renders theme options (Light, Dark, System) with active state', () => {
    mockCurrentTheme = 'system';
    const element = renderSettingsScreen({
      onBack: vi.fn(),
    });

    const lightBtn = findElements(element, (el) => el.props?.testID === 'theme-option-light')[0];
    const darkBtn = findElements(element, (el) => el.props?.testID === 'theme-option-dark')[0];
    const systemBtn = findElements(element, (el) => el.props?.testID === 'theme-option-system')[0];

    expect(lightBtn).toBeDefined();
    expect(darkBtn).toBeDefined();
    expect(systemBtn).toBeDefined();

    expect(systemBtn.props.accessibilityState).toEqual({ selected: true });
    expect(lightBtn.props.accessibilityState).toEqual({ selected: false });
    expect(darkBtn.props.accessibilityState).toEqual({ selected: false });
  });

  it('calls setTheme with light, dark, and system when options are pressed', () => {
    mockSetTheme.mockClear();
    const element = renderSettingsScreen({
      onBack: vi.fn(),
    });

    const lightBtn = findElements(element, (el) => el.props?.testID === 'theme-option-light')[0];
    const darkBtn = findElements(element, (el) => el.props?.testID === 'theme-option-dark')[0];
    const systemBtn = findElements(element, (el) => el.props?.testID === 'theme-option-system')[0];

    lightBtn.props.onPress();
    expect(mockSetTheme).toHaveBeenCalledWith('light');

    darkBtn.props.onPress();
    expect(mockSetTheme).toHaveBeenCalledWith('dark');

    systemBtn.props.onPress();
    expect(mockSetTheme).toHaveBeenCalledWith('system');
  });

  it('highlights dark mode option when theme is dark', () => {
    mockCurrentTheme = 'dark';
    const element = renderSettingsScreen({
      onBack: vi.fn(),
    });

    const darkBtn = findElements(element, (el) => el.props?.testID === 'theme-option-dark')[0];
    const lightBtn = findElements(element, (el) => el.props?.testID === 'theme-option-light')[0];

    expect(darkBtn.props.accessibilityState).toEqual({ selected: true });
    expect(lightBtn.props.accessibilityState).toEqual({ selected: false });
  });

  it('renders default view options (Compact, Full Screen) with active state', () => {
    mockCurrentDefaultView = 'compact';
    const element = renderSettingsScreen({
      onBack: vi.fn(),
    });

    const compactBtn = findElements(element, (el) => el.props?.testID === 'view-option-compact')[0];
    const fullscreenBtn = findElements(element, (el) => el.props?.testID === 'view-option-fullscreen')[0];

    expect(compactBtn).toBeDefined();
    expect(fullscreenBtn).toBeDefined();

    expect(compactBtn.props.accessibilityState).toEqual({ selected: true });
    expect(fullscreenBtn.props.accessibilityState).toEqual({ selected: false });
  });

  it('calls setDefaultView with compact and fullscreen when options are pressed', () => {
    mockSetDefaultView.mockClear();
    const element = renderSettingsScreen({
      onBack: vi.fn(),
    });

    const compactBtn = findElements(element, (el) => el.props?.testID === 'view-option-compact')[0];
    const fullscreenBtn = findElements(element, (el) => el.props?.testID === 'view-option-fullscreen')[0];

    fullscreenBtn.props.onPress();
    expect(mockSetDefaultView).toHaveBeenCalledWith('fullscreen');

    compactBtn.props.onPress();
    expect(mockSetDefaultView).toHaveBeenCalledWith('compact');
  });

  it('highlights fullscreen option when defaultView is fullscreen', () => {
    mockCurrentDefaultView = 'fullscreen';
    const element = renderSettingsScreen({
      onBack: vi.fn(),
    });

    const fullscreenBtn = findElements(element, (el) => el.props?.testID === 'view-option-fullscreen')[0];
    const compactBtn = findElements(element, (el) => el.props?.testID === 'view-option-compact')[0];

    expect(fullscreenBtn.props.accessibilityState).toEqual({ selected: true });
    expect(compactBtn.props.accessibilityState).toEqual({ selected: false });
  });

  it('renders current username indicator when provided', () => {
    const element = renderSettingsScreen({
      onBack: vi.fn(),
      currentUsername: 'mobile_hero',
    });

    const userBadge = findElements(element, (el) => el.props?.testID === 'current-username')[0];
    expect(userBadge).toBeDefined();
    expect(userBadge.props.children).toBe('mobile_hero');
  });

  it('renders change password and user creation form elements', () => {
    const element = renderSettingsScreen({
      onBack: vi.fn(),
    });

    const currPassInput = findElements(element, (el) => el.props?.testID === 'current-password-input')[0];
    const newPassInput = findElements(element, (el) => el.props?.testID === 'new-password-input')[0];
    const confirmPassInput = findElements(element, (el) => el.props?.testID === 'confirm-password-input')[0];
    const changePassBtn = findElements(element, (el) => el.props?.testID === 'change-password-submit')[0];

    const newUserInput = findElements(element, (el) => el.props?.testID === 'new-user-username-input')[0];
    const newUserPassInput = findElements(element, (el) => el.props?.testID === 'new-user-password-input')[0];
    const createUserBtn = findElements(element, (el) => el.props?.testID === 'create-user-submit')[0];

    expect(currPassInput).toBeDefined();
    expect(newPassInput).toBeDefined();
    expect(confirmPassInput).toBeDefined();
    expect(changePassBtn).toBeDefined();

    expect(newUserInput).toBeDefined();
    expect(newUserPassInput).toBeDefined();
    expect(createUserBtn).toBeDefined();
  });

  it('triggers changePassword on submit when inputs are valid', async () => {
    vi.mocked(MobileApiClient.changePassword).mockClear();
    const element = renderSettingsScreen({
      onBack: vi.fn(),
    });

    const currPassInput = findElements(element, (el) => el.props?.testID === 'current-password-input')[0];
    const newPassInput = findElements(element, (el) => el.props?.testID === 'new-password-input')[0];
    const confirmPassInput = findElements(element, (el) => el.props?.testID === 'confirm-password-input')[0];

    currPassInput.props.onChangeText('old123');
    newPassInput.props.onChangeText('new123');
    confirmPassInput.props.onChangeText('new123');

    const updatedElement = renderSettingsScreen({ onBack: vi.fn() });
    const changePassBtn = findElements(updatedElement, (el) => el.props?.testID === 'change-password-submit')[0];

    await changePassBtn.props.onPress();
    expect(MobileApiClient.changePassword).toHaveBeenCalledWith('old123', 'new123');
  });

  it('triggers createUser on submit when inputs are valid', async () => {
    vi.mocked(MobileApiClient.createUser).mockClear();
    const element = renderSettingsScreen({
      onBack: vi.fn(),
    });

    const newUserInput = findElements(element, (el) => el.props?.testID === 'new-user-username-input')[0];
    const newUserPassInput = findElements(element, (el) => el.props?.testID === 'new-user-password-input')[0];

    newUserInput.props.onChangeText('charlie_new');
    newUserPassInput.props.onChangeText('Secret789!');

    const updatedElement = renderSettingsScreen({ onBack: vi.fn() });
    const createUserBtn = findElements(updatedElement, (el) => el.props?.testID === 'create-user-submit')[0];

    await createUserBtn.props.onPress();
    expect(MobileApiClient.createUser).toHaveBeenCalledWith('charlie_new', 'Secret789!');
  });
});
