import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsPage } from '../src/pages/SettingsPage';
import { ThemeProvider } from '../src/context/ThemeContext';
import { SettingsProvider } from '../src/context/SettingsContext';
import { ApiClient } from '../src/api/client';

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders settings title and sections', () => {
    render(<SettingsPage onBack={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /settings/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId('settings-section-appearance')).toBeInTheDocument();
    expect(screen.getByTestId('settings-section-view-preferences')).toBeInTheDocument();
    expect(screen.getByTestId('settings-section-account')).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', () => {
    const handleBack = vi.fn();
    render(<SettingsPage onBack={handleBack} />);

    const backBtn = screen.getByRole('button', { name: /back to notes/i });
    fireEvent.click(backBtn);
    expect(handleBack).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleSideMenu when menu button is clicked', () => {
    const handleToggle = vi.fn();
    render(<SettingsPage onToggleSideMenu={handleToggle} />);

    const menuBtn = screen.getByRole('button', { name: /open menu/i });
    fireEvent.click(menuBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('renders theme options (Light, Dark, System) and switches themes', () => {
    render(
      <ThemeProvider>
        <SettingsPage onBack={vi.fn()} />
      </ThemeProvider>
    );

    const lightOption = screen.getByTestId('theme-option-light');
    const darkOption = screen.getByTestId('theme-option-dark');
    const systemOption = screen.getByTestId('theme-option-system');

    expect(lightOption).toBeInTheDocument();
    expect(darkOption).toBeInTheDocument();
    expect(systemOption).toBeInTheDocument();

    // Default theme is system
    expect(systemOption).toHaveAttribute('aria-checked', 'true');
    expect(lightOption).toHaveAttribute('aria-checked', 'false');
    expect(darkOption).toHaveAttribute('aria-checked', 'false');

    // Switch to dark
    fireEvent.click(darkOption);
    expect(darkOption).toHaveAttribute('aria-checked', 'true');
    expect(systemOption).toHaveAttribute('aria-checked', 'false');
    expect(lightOption).toHaveAttribute('aria-checked', 'false');
    expect(localStorage.getItem('notebook_theme')).toBe('dark');

    // Switch to light
    fireEvent.click(lightOption);
    expect(lightOption).toHaveAttribute('aria-checked', 'true');
    expect(darkOption).toHaveAttribute('aria-checked', 'false');
    expect(systemOption).toHaveAttribute('aria-checked', 'false');
    expect(localStorage.getItem('notebook_theme')).toBe('light');

    // Switch back to system
    fireEvent.click(systemOption);
    expect(systemOption).toHaveAttribute('aria-checked', 'true');
    expect(lightOption).toHaveAttribute('aria-checked', 'false');
    expect(darkOption).toHaveAttribute('aria-checked', 'false');
    expect(localStorage.getItem('notebook_theme')).toBe('system');
  });

  it('renders default view options (Compact, Full Screen) and switches active view', () => {
    render(
      <SettingsProvider>
        <SettingsPage onBack={vi.fn()} />
      </SettingsProvider>
    );

    const compactOption = screen.getByTestId('view-option-compact');
    const fullscreenOption = screen.getByTestId('view-option-fullscreen');

    expect(compactOption).toBeInTheDocument();
    expect(fullscreenOption).toBeInTheDocument();
    expect(compactOption).toHaveTextContent(/Compact/i);
    expect(fullscreenOption).toHaveTextContent(/Full Screen/i);

    // Default view is compact
    expect(compactOption).toHaveAttribute('aria-checked', 'true');
    expect(fullscreenOption).toHaveAttribute('aria-checked', 'false');

    // Switch to fullscreen
    fireEvent.click(fullscreenOption);
    expect(fullscreenOption).toHaveAttribute('aria-checked', 'true');
    expect(compactOption).toHaveAttribute('aria-checked', 'false');
    expect(localStorage.getItem('notebook_default_view')).toBe('fullscreen');

    // Switch back to compact
    fireEvent.click(compactOption);
    expect(compactOption).toHaveAttribute('aria-checked', 'true');
    expect(fullscreenOption).toHaveAttribute('aria-checked', 'false');
    expect(localStorage.getItem('notebook_default_view')).toBe('compact');
  });

  it('renders current username indicator', () => {
    localStorage.setItem('notebook_username', 'alice_admin');
    render(<SettingsPage onBack={vi.fn()} />);

    const userBadge = screen.getByTestId('current-username');
    expect(userBadge).toBeInTheDocument();
    expect(userBadge).toHaveTextContent('alice_admin');
  });

  it('validates password mismatch and successfully changes password', async () => {
    const changePasswordSpy = vi.spyOn(ApiClient, 'changePassword').mockResolvedValue({ success: true });

    render(<SettingsPage onBack={vi.fn()} />);

    const currentInput = screen.getByTestId('current-password-input');
    const newInput = screen.getByTestId('new-password-input');
    const confirmInput = screen.getByTestId('confirm-password-input');
    const submitBtn = screen.getByTestId('change-password-submit');

    // Mismatched passwords
    fireEvent.change(currentInput, { target: { value: 'oldPass123' } });
    fireEvent.change(newInput, { target: { value: 'newPass123' } });
    fireEvent.change(confirmInput, { target: { value: 'differentPass' } });
    fireEvent.click(submitBtn);

    expect(screen.getByTestId('password-message')).toHaveTextContent(/passwords do not match/i);
    expect(changePasswordSpy).not.toHaveBeenCalled();

    // Matching passwords
    fireEvent.change(confirmInput, { target: { value: 'newPass123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(changePasswordSpy).toHaveBeenCalledWith('oldPass123', 'newPass123');
      expect(screen.getByTestId('password-message')).toHaveTextContent(/changed successfully/i);
    });
  });

  it('handles change password error response from api', async () => {
    vi.spyOn(ApiClient, 'changePassword').mockRejectedValue(new Error('Invalid current password'));

    render(<SettingsPage onBack={vi.fn()} />);

    fireEvent.change(screen.getByTestId('current-password-input'), { target: { value: 'wrongPass' } });
    fireEvent.change(screen.getByTestId('new-password-input'), { target: { value: 'newPass123' } });
    fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: 'newPass123' } });
    fireEvent.click(screen.getByTestId('change-password-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('password-message')).toHaveTextContent('Invalid current password');
    });
  });

  it('validates and creates new user successfully', async () => {
    const createUserSpy = vi.spyOn(ApiClient, 'createUser').mockResolvedValue({
      token: 'jwt-token-xyz',
      username: 'bob_user'
    });

    render(<SettingsPage onBack={vi.fn()} />);

    const usernameInput = screen.getByTestId('new-user-username-input');
    const passwordInput = screen.getByTestId('new-user-password-input');
    const submitBtn = screen.getByTestId('create-user-submit');

    // Empty fields error
    fireEvent.click(submitBtn);
    expect(screen.getByTestId('user-message')).toHaveTextContent(/required/i);
    expect(createUserSpy).not.toHaveBeenCalled();

    // Valid fields
    fireEvent.change(usernameInput, { target: { value: 'bob_user' } });
    fireEvent.change(passwordInput, { target: { value: 'Secret456!' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createUserSpy).toHaveBeenCalledWith('bob_user', 'Secret456!');
      expect(screen.getByTestId('user-message')).toHaveTextContent(/bob_user.*created successfully/i);
    });
  });

  it('handles create user error response from api', async () => {
    vi.spyOn(ApiClient, 'createUser').mockRejectedValue(new Error('Username already exists'));

    render(<SettingsPage onBack={vi.fn()} />);

    fireEvent.change(screen.getByTestId('new-user-username-input'), { target: { value: 'existing_user' } });
    fireEvent.change(screen.getByTestId('new-user-password-input'), { target: { value: 'Pass123!' } });
    fireEvent.click(screen.getByTestId('create-user-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('user-message')).toHaveTextContent('Username already exists');
    });
  });
});
