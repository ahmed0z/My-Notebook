import React, { useState } from 'react';
import { ArrowLeft, Menu, Settings, Palette, Layout, User, Sun, Moon, Monitor, Minimize2, Maximize2, KeyRound, UserPlus, LogOut, Mail } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { ApiClient } from '../api/client';

export interface SettingsPageProps {
  onBack?: () => void;
  onToggleSideMenu?: () => void;
}

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

const VIEW_OPTIONS = [
  { value: 'compact', label: 'Compact', description: 'modal layout', icon: Minimize2 },
  { value: 'fullscreen', label: 'Full Screen', description: 'expanded layout', icon: Maximize2 },
] as const;

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onBack,
  onToggleSideMenu
}) => {
  const { theme, setTheme } = useTheme();
  const { defaultView, setDefaultView } = useSettings();
  const { username, logout } = useAuth();
  const activeUsername = username || (typeof window !== 'undefined' ? localStorage.getItem('notebook_username') : null);

  // Account Email state
  const [accountEmail, setAccountEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add User state
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [userLoading, setUserLoading] = useState(false);
  const [userMessage, setUserMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailMessage(null);
    if (!accountEmail.trim()) {
      setEmailMessage({ type: 'error', text: 'Email address is required.' });
      return;
    }
    try {
      setEmailLoading(true);
      await ApiClient.updateEmail(accountEmail.trim());
      setEmailMessage({ type: 'success', text: `Email updated to ${accountEmail.trim()} successfully.` });
    } catch (err: any) {
      setEmailMessage({ type: 'error', text: err.message || 'Failed to update email.' });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'All password fields are required.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    try {
      setPasswordLoading(true);
      await ApiClient.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage({ type: 'success', text: 'Password changed successfully.' });
    } catch (err: any) {
      setPasswordMessage({ type: 'error', text: err.message || 'Failed to change password.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserMessage(null);

    if (!newUsername.trim() || !newUserPassword) {
      setUserMessage({ type: 'error', text: 'Username and password are required.' });
      return;
    }

    try {
      setUserLoading(true);
      await ApiClient.createUser(newUsername.trim(), newUserPassword);
      const createdName = newUsername.trim();
      setNewUsername('');
      setNewUserPassword('');
      setUserMessage({ type: 'success', text: `User "${createdName}" created successfully.` });
    } catch (err: any) {
      setUserMessage({ type: 'error', text: err.message || 'Failed to create user.' });
    } finally {
      setUserLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 pb-20 transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-stone-50/80 dark:bg-stone-900/90 backdrop-blur-md border-b border-stone-200/60 dark:border-stone-800 px-4 py-3 sm:px-6 lg:px-8 transition-colors">
        <div className="w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {onToggleSideMenu && (
              <button
                type="button"
                onClick={onToggleSideMenu}
                title="Open menu"
                aria-label="Open menu"
                className="p-1.5 rounded-lg text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                title="Back to notes"
                aria-label="Back to notes"
                className="p-1.5 rounded-lg text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition mr-1"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-stone-700 dark:text-stone-300" />
              <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                Settings
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeUsername && (
              <span className="text-xs font-medium text-stone-500 dark:text-stone-400 hidden sm:inline">
                {activeUsername}
              </span>
            )}

            <button
              type="button"
              onClick={logout}
              title="Sign out"
              aria-label="Sign out"
              className="p-1.5 rounded-lg text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Settings Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 pt-8 space-y-6">
        {/* Appearance Section */}
        <section
          data-testid="settings-section-appearance"
          className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/70 dark:border-stone-800 p-6 shadow-sm"
        >
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Palette className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                Appearance
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Customize color theme and visual preferences
              </p>
              <div className="mt-5">
                <label className="text-xs font-medium text-stone-700 dark:text-stone-300 block mb-2">
                  Theme mode
                </label>
                <div
                  role="radiogroup"
                  aria-label="Theme selection"
                  className="inline-flex p-1 rounded-xl bg-stone-100 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 gap-1"
                >
                  {THEME_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = theme === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        data-testid={`theme-option-${option.value}`}
                        onClick={() => setTheme(option.value)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm border border-stone-200/80 dark:border-stone-700/80'
                            : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-200/50 dark:hover:bg-stone-700/50 border border-transparent'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* View Preferences Section */}
        <section
          data-testid="settings-section-view-preferences"
          className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/70 dark:border-stone-800 p-6 shadow-sm"
        >
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <Layout className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                View Preferences
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Set default opening layout for notes and workspace density
              </p>
              <div className="mt-5">
                <label className="text-xs font-medium text-stone-700 dark:text-stone-300 block mb-2">
                  Default opening view
                </label>
                <div
                  role="radiogroup"
                  aria-label="Default view selection"
                  className="inline-flex p-1 rounded-xl bg-stone-100 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 gap-1"
                >
                  {VIEW_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = defaultView === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        data-testid={`view-option-${option.value}`}
                        onClick={() => setDefaultView(option.value)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm border border-stone-200/80 dark:border-stone-700/80'
                            : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-200/50 dark:hover:bg-stone-700/50 border border-transparent'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{option.label}</span>
                        <span className="text-[10px] text-stone-400 dark:text-stone-500 font-normal">
                          ({option.description})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Account & Users Section */}
        <section
          data-testid="settings-section-account"
          className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/70 dark:border-stone-800 p-6 shadow-sm"
        >
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <User className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-6">
              <div>
                <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                  Account & Security
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Manage your credentials and user access
                </p>
              </div>

              {/* Current logged-in user indicator */}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/70 dark:border-stone-700/60">
                <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
                  Current user:
                </span>
                <span
                  data-testid="current-username"
                  className="text-xs font-semibold px-2 py-0.5 rounded-md bg-stone-200/80 dark:bg-stone-700 text-stone-800 dark:text-stone-200"
                >
                  {activeUsername || 'Anonymous'}
                </span>
              </div>

              {/* Account Email Form */}
              <div className="pt-2 border-t border-stone-200/70 dark:border-stone-800">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                  <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                    Account Email
                  </h3>
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
                  Set or update your registered email address for account recovery and sign in.
                </p>

                <form onSubmit={handleUpdateEmail} className="space-y-3">
                  {emailMessage && (
                    <div
                      data-testid="email-message"
                      className={`text-xs p-2.5 rounded-xl border ${
                        emailMessage.type === 'success'
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                          : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/60'
                      }`}
                    >
                      {emailMessage.text}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={accountEmail}
                      onChange={(e) => setAccountEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full max-w-sm px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/50 text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-stone-400/20"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={emailLoading}
                    className="px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium hover:bg-stone-800 dark:hover:bg-stone-200 transition shadow-sm disabled:opacity-50"
                  >
                    {emailLoading ? 'Saving...' : 'Update Email'}
                  </button>
                </form>
              </div>

              {/* Change Password Form */}
              <div className="pt-2 border-t border-stone-200/70 dark:border-stone-800">
                <div className="flex items-center gap-2 mb-1">
                  <KeyRound className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                  <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                    Change Password
                  </h3>
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
                  Note: Changing your password will not immediately disconnect other active browser or mobile sessions until token expiration.
                </p>

                <form onSubmit={handleChangePassword} className="space-y-3">
                  {passwordMessage && (
                    <div
                      data-testid="password-message"
                      className={`text-xs p-2.5 rounded-xl border ${
                        passwordMessage.type === 'success'
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                          : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/60'
                      }`}
                    >
                      {passwordMessage.text}
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="current-password"
                      className="text-xs font-medium text-stone-700 dark:text-stone-300 block mb-1"
                    >
                      Current Password
                    </label>
                    <input
                      id="current-password"
                      type="password"
                      data-testid="current-password-input"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-stone-400/20 focus:border-stone-400 dark:focus:border-stone-600"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="new-password"
                        className="text-xs font-medium text-stone-700 dark:text-stone-300 block mb-1"
                      >
                        New Password
                      </label>
                      <input
                        id="new-password"
                        type="password"
                        data-testid="new-password-input"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-stone-400/20 focus:border-stone-400 dark:focus:border-stone-600"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="confirm-password"
                        className="text-xs font-medium text-stone-700 dark:text-stone-300 block mb-1"
                      >
                        Confirm New Password
                      </label>
                      <input
                        id="confirm-password"
                        type="password"
                        data-testid="confirm-password-input"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-stone-400/20 focus:border-stone-400 dark:focus:border-stone-600"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={passwordLoading}
                    data-testid="change-password-submit"
                    className="px-4 py-2 rounded-xl text-xs font-medium bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition disabled:opacity-50"
                  >
                    {passwordLoading ? 'Updating...' : 'Change Password'}
                  </button>
                </form>
              </div>

              {/* Add New User Form */}
              <div className="pt-4 border-t border-stone-200/70 dark:border-stone-800">
                <div className="flex items-center gap-2 mb-3">
                  <UserPlus className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                  <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                    Add New User
                  </h3>
                </div>

                <form onSubmit={handleCreateUser} className="space-y-3">
                  {userMessage && (
                    <div
                      data-testid="user-message"
                      className={`text-xs p-2.5 rounded-xl border ${
                        userMessage.type === 'success'
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                          : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/60'
                      }`}
                    >
                      {userMessage.text}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="new-user-username"
                        className="text-xs font-medium text-stone-700 dark:text-stone-300 block mb-1"
                      >
                        Username
                      </label>
                      <input
                        id="new-user-username"
                        type="text"
                        data-testid="new-user-username-input"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="Username for new user"
                        className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-stone-400/20 focus:border-stone-400 dark:focus:border-stone-600"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="new-user-password"
                        className="text-xs font-medium text-stone-700 dark:text-stone-300 block mb-1"
                      >
                        Password
                      </label>
                      <input
                        id="new-user-password"
                        type="password"
                        data-testid="new-user-password-input"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        placeholder="Password for new user"
                        className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-stone-400/20 focus:border-stone-400 dark:focus:border-stone-600"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={userLoading}
                    data-testid="create-user-submit"
                    className="px-4 py-2 rounded-xl text-xs font-medium bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition disabled:opacity-50"
                  >
                    {userLoading ? 'Creating...' : 'Add User'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
