import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginPage } from '../src/pages/LoginPage';
import { ApiClient } from '../src/api/client';

const mockLogin = vi.fn();

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    token: null,
    username: null,
    isConfigured: true,
    isLoading: false,
    serverWaking: false,
    logout: vi.fn(),
    checkStatus: vi.fn(),
  }),
}));

describe('LoginPage with Material Design 3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Sign In mode (default)', () => {
    it('renders segmented control tabs and default login form', () => {
      render(<LoginPage />);

      expect(screen.getByRole('tab', { name: /sign in/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /create account/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /sign in to notebook|unlock notebook/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/username or email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /forgot password/i })).toBeInTheDocument();
    });

    it('submits login successfully and calls login from useAuth', async () => {
      const loginSpy = vi.spyOn(ApiClient, 'login').mockResolvedValueOnce({
        token: 'test-token',
        username: 'alice',
      });

      render(<LoginPage />);

      fireEvent.change(screen.getByLabelText(/username or email/i), {
        target: { value: 'alice' },
      });
      fireEvent.change(screen.getByLabelText(/^password/i), {
        target: { value: 'secret123' },
      });

      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

      await waitFor(() => {
        expect(loginSpy).toHaveBeenCalledWith('alice', 'secret123');
        expect(mockLogin).toHaveBeenCalledWith('test-token', 'alice', undefined, undefined);
      });
    });

    it('displays error alert when login fails', async () => {
      vi.spyOn(ApiClient, 'login').mockRejectedValueOnce(new Error('Invalid credentials'));

      render(<LoginPage />);

      fireEvent.change(screen.getByLabelText(/username or email/i), {
        target: { value: 'alice' },
      });
      fireEvent.change(screen.getByLabelText(/^password/i), {
        target: { value: 'wrongpass' },
      });

      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials');
      });
    });
  });

  describe('Create Account (Sign Up) mode', () => {
    it('switches to create account tab and shows signup fields and isolation note', () => {
      render(<LoginPage />);

      fireEvent.click(screen.getByRole('tab', { name: /create account/i }));

      expect(screen.getByLabelText(/^username$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^email address$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^confirm password$/i)).toBeInTheDocument();
      expect(screen.getByText(/your workspace, spaces, and notes are private/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create workspace & account/i })).toBeInTheDocument();
    });

    it('toggles password visibility', () => {
      render(<LoginPage />);

      fireEvent.click(screen.getByRole('tab', { name: /create account/i }));

      const passwordInput = screen.getByLabelText(/^password$/i);
      expect(passwordInput).toHaveAttribute('type', 'password');

      const toggleButtons = screen.getAllByRole('button', { name: /toggle password visibility|show password|hide password/i });
      fireEvent.click(toggleButtons[0]);

      expect(passwordInput).toHaveAttribute('type', 'text');

      fireEvent.click(toggleButtons[0]);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('validates password mismatch on registration', async () => {
      const registerSpy = vi.fn();
      (ApiClient as any).register = registerSpy;

      render(<LoginPage />);

      fireEvent.click(screen.getByRole('tab', { name: /create account/i }));

      fireEvent.change(screen.getByLabelText(/^username$/i), { target: { value: 'newuser' } });
      fireEvent.change(screen.getByLabelText(/^email address$/i), { target: { value: 'new@example.com' } });
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
      fireEvent.change(screen.getByLabelText(/^confirm password$/i), { target: { value: 'different123' } });

      fireEvent.click(screen.getByRole('button', { name: /create workspace & account/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/passwords do not match/i);
      });
      expect(registerSpy).not.toHaveBeenCalled();
    });

    it('validates password minimum length (< 6 characters)', async () => {
      const registerSpy = vi.fn();
      (ApiClient as any).register = registerSpy;

      render(<LoginPage />);

      fireEvent.click(screen.getByRole('tab', { name: /create account/i }));

      fireEvent.change(screen.getByLabelText(/^username$/i), { target: { value: 'newuser' } });
      fireEvent.change(screen.getByLabelText(/^email address$/i), { target: { value: 'new@example.com' } });
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: '12345' } });
      fireEvent.change(screen.getByLabelText(/^confirm password$/i), { target: { value: '12345' } });

      fireEvent.click(screen.getByRole('button', { name: /create workspace & account/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/at least 6 characters/i);
      });
      expect(registerSpy).not.toHaveBeenCalled();
    });

    it('submits registration successfully and logs in', async () => {
      const registerSpy = vi.fn().mockResolvedValueOnce({
        token: 'new-user-token',
        username: 'bob',
        email: 'bob@example.com',
      });
      (ApiClient as any).register = registerSpy;

      render(<LoginPage />);

      fireEvent.click(screen.getByRole('tab', { name: /create account/i }));

      fireEvent.change(screen.getByLabelText(/^username$/i), { target: { value: 'bob' } });
      fireEvent.change(screen.getByLabelText(/^email address$/i), { target: { value: 'bob@example.com' } });
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'securepassword' } });
      fireEvent.change(screen.getByLabelText(/^confirm password$/i), { target: { value: 'securepassword' } });

      fireEvent.click(screen.getByRole('button', { name: /create workspace & account/i }));

      await waitFor(() => {
        expect(registerSpy).toHaveBeenCalledWith('bob', 'bob@example.com', 'securepassword');
        expect(mockLogin).toHaveBeenCalledWith('new-user-token', 'bob', 'bob@example.com', undefined);
      });
    });

    it('displays error alert when registration API rejects', async () => {
      const registerSpy = vi.fn().mockRejectedValueOnce(new Error('Username or email already exists'));
      (ApiClient as any).register = registerSpy;

      render(<LoginPage />);

      fireEvent.click(screen.getByRole('tab', { name: /create account/i }));

      fireEvent.change(screen.getByLabelText(/^username$/i), { target: { value: 'bob' } });
      fireEvent.change(screen.getByLabelText(/^email address$/i), { target: { value: 'bob@example.com' } });
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'securepassword' } });
      fireEvent.change(screen.getByLabelText(/^confirm password$/i), { target: { value: 'securepassword' } });

      fireEvent.click(screen.getByRole('button', { name: /create workspace & account/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Username or email already exists');
      });
    });
  });

  describe('Forgot Password flow', () => {
    it('switches to forgot password mode and can return to sign in', () => {
      render(<LoginPage />);

      fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));

      expect(screen.getByRole('heading', { name: /reset password/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send.*code/i })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /back to sign in/i }));
      expect(screen.getByRole('tab', { name: /sign in/i })).toBeInTheDocument();
    });

    it('requests reset code, transitions to step 2 verification, and completes reset', async () => {
      const forgotSpy = vi.spyOn(ApiClient, 'forgotPassword').mockResolvedValueOnce({
        success: true,
        message: 'Reset code sent',
      });
      const resetSpy = vi.spyOn(ApiClient, 'resetPassword').mockResolvedValueOnce({
        success: true,
        message: 'Password reset successfully',
      });

      render(<LoginPage />);

      fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));

      fireEvent.change(screen.getByLabelText(/email address/i), {
        target: { value: 'alice@example.com' },
      });

      fireEvent.click(screen.getByRole('button', { name: /send.*code/i }));

      await waitFor(() => {
        expect(forgotSpy).toHaveBeenCalledWith('alice@example.com');
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
        expect(screen.getByText(/verification code sent to/i)).toBeInTheDocument();
      });

      // Step 2: user enters code received in email
      fireEvent.change(screen.getByLabelText(/verification code/i), {
        target: { value: '654321' },
      });

      fireEvent.change(screen.getByLabelText(/^new password$/i), {
        target: { value: 'newpassword123' },
      });
      fireEvent.change(screen.getByLabelText(/^confirm new password$/i), {
        target: { value: 'newpassword123' },
      });

      fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(resetSpy).toHaveBeenCalledWith('alice@example.com', '654321', 'newpassword123');
        // Back to login mode with success notification
        expect(screen.getByRole('tab', { name: /sign in/i })).toBeInTheDocument();
        expect(screen.getByText(/password reset successfully/i)).toBeInTheDocument();
      });
    });

    it('validates password mismatch on password reset step 2', async () => {
      vi.spyOn(ApiClient, 'forgotPassword').mockResolvedValueOnce({
        success: true,
        message: 'Reset code sent',
      });
      const resetSpy = vi.spyOn(ApiClient, 'resetPassword');

      render(<LoginPage />);

      fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));
      fireEvent.change(screen.getByLabelText(/email address/i), {
        target: { value: 'alice@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: /send.*code/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/verification code/i), {
        target: { value: '112233' },
      });
      fireEvent.change(screen.getByLabelText(/^new password$/i), {
        target: { value: 'pass111' },
      });
      fireEvent.change(screen.getByLabelText(/^confirm new password$/i), {
        target: { value: 'pass222' },
      });

      fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/passwords do not match/i);
      });
      expect(resetSpy).not.toHaveBeenCalled();
    });
  });
});
