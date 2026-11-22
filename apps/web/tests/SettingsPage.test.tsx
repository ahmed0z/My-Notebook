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
    expect(screen.getByTestId('settings-section-theme')).toBeInTheDocument();
    expect(screen.getByTestId('settings-section-layout')).toBeInTheDocument();
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
    expect(localStorage.getItem('notebook_theme')).toBeNull();

    // Switch to dark
    fireEvent.click(darkOption);
    expect(localStorage.getItem('notebook_theme')).toBe('dark');

    // Switch to light
    fireEvent.click(lightOption);
    expect(localStorage.getItem('notebook_theme')).toBe('light');

    // Switch back to system
    fireEvent.click(systemOption);
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

    // Switch to fullscreen
    fireEvent.click(fullscreenOption);
    expect(localStorage.getItem('notebook_default_view')).toBe('fullscreen');

    // Switch back to compact
    fireEvent.click(compactOption);
    expect(localStorage.getItem('notebook_default_view')).toBe('compact');
  });

  it('renders current username and allows editing profile (username, avatar, email)', async () => {
    localStorage.setItem('notebook_username', 'alice_admin');
    localStorage.setItem('notebook_email', 'alice@example.com');
    const updateProfileSpy = vi.spyOn(ApiClient, 'updateProfile').mockResolvedValue({
      token: 'new-token-123',
      username: 'alice_updated',
      email: 'alice_new@example.com',
      avatarUrl: '🦊',
    });

    render(<SettingsPage onBack={vi.fn()} />);

    const usernameInput = screen.getByTestId('current-username') as HTMLInputElement;
    expect(usernameInput.value).toBe('alice_admin');

    // Select emoji avatar
    const foxBtn = screen.getByRole('button', { name: '🦊' });
    fireEvent.click(foxBtn);

    // Change username and email
    fireEvent.change(usernameInput, { target: { value: 'alice_updated' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'alice_new@example.com' } });

    fireEvent.click(screen.getByTestId('save-profile-submit'));

    await waitFor(() => {
      expect(updateProfileSpy).toHaveBeenCalledWith({
        username: 'alice_updated',
        avatarUrl: '🦊',
        email: 'alice_new@example.com',
      });
      expect(screen.getByTestId('profile-message')).toHaveTextContent(/profile updated successfully/i);
    });
  });

  it('handles profile update error from API', async () => {
    localStorage.setItem('notebook_username', 'current_user');
    vi.spyOn(ApiClient, 'updateProfile').mockRejectedValue(new Error('Username already taken'));

    render(<SettingsPage onBack={vi.fn()} />);

    const usernameInput = screen.getByTestId('current-username');
    fireEvent.change(usernameInput, { target: { value: 'taken_user' } });
    fireEvent.click(screen.getByTestId('save-profile-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('profile-message')).toHaveTextContent('Username already taken');
    });
  });

  it('requests password code and completes password change via verification code', async () => {
    localStorage.setItem('notebook_email', 'user@example.com');
    const requestCodeSpy = vi.spyOn(ApiClient, 'requestPasswordCode').mockResolvedValue({
      success: true,
      message: 'Verification code sent to user@example.com',
    });
    const resetPasswordSpy = vi.spyOn(ApiClient, 'resetPassword').mockResolvedValue({
      success: true,
      message: 'Password reset successfully',
    });

    render(<SettingsPage onBack={vi.fn()} />);

    // Request code
    const requestCodeBtn = screen.getByTestId('request-pw-code-btn');
    fireEvent.click(requestCodeBtn);

    await waitFor(() => {
      expect(requestCodeSpy).toHaveBeenCalled();
      expect(screen.getByTestId('pw-reset-code-input')).toBeInTheDocument();
    });

    // Enter verification code and matching passwords
    fireEvent.change(screen.getByTestId('pw-reset-code-input'), { target: { value: '123456' } });
    fireEvent.change(screen.getByTestId('new-password-input'), { target: { value: 'NewSecret123!' } });
    fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: 'NewSecret123!' } });

    fireEvent.click(screen.getByTestId('confirm-pw-change-btn'));

    await waitFor(() => {
      expect(resetPasswordSpy).toHaveBeenCalledWith('user@example.com', '123456', 'NewSecret123!');
      expect(screen.getByTestId('password-message')).toHaveTextContent(/password changed successfully/i);
    });
  });

  it('validates password mismatch when changing password with code', async () => {
    localStorage.setItem('notebook_email', 'user@example.com');
    vi.spyOn(ApiClient, 'requestPasswordCode').mockResolvedValue({
      success: true,
      message: 'Code sent',
    });
    const resetPasswordSpy = vi.spyOn(ApiClient, 'resetPassword');

    render(<SettingsPage onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId('request-pw-code-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('pw-reset-code-input')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('pw-reset-code-input'), { target: { value: '123456' } });
    fireEvent.change(screen.getByTestId('new-password-input'), { target: { value: 'NewSecret123!' } });
    fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: 'DifferentSecret!' } });

    fireEvent.click(screen.getByTestId('confirm-pw-change-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('password-message')).toHaveTextContent(/passwords do not match/i);
      expect(resetPasswordSpy).not.toHaveBeenCalled();
    });
  });
});
