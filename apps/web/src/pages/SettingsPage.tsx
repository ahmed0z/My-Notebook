import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Menu,
  Settings,
  Palette,
  Layout,
  User,
  Sun,
  Moon,
  Monitor,
  Minimize2,
  Maximize2,
  KeyRound,
  LogOut,
  Mail,
  Camera,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Send,
  Upload
} from 'lucide-react';
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

const PRESET_AVATARS = ['🦊', '🚀', '🎨', '🌟', '💡', '🐱', '☕', '🔥', '🎯', '💎', '⚡', '👤'];

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onBack,
  onToggleSideMenu
}) => {
  const { theme, setTheme } = useTheme();
  const { defaultView, setDefaultView } = useSettings();
  const { username, email, avatarUrl, updateUser, logout } = useAuth();

  // Profile Edit state
  const [profileUsername, setProfileUsername] = useState(username || '');
  const [profileEmail, setProfileEmail] = useState(email || '');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(avatarUrl || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync profile state when auth context changes
  useEffect(() => {
    if (username) setProfileUsername(username);
    if (email) setProfileEmail(email);
    if (avatarUrl !== undefined) setProfileAvatarUrl(avatarUrl || '');
  }, [username, email, avatarUrl]);

  // Password Reset with Code state
  const [pwStep, setPwStep] = useState<'request' | 'verify'>('request');
  const [pwCode, setPwCode] = useState('');
  const [pwNewPassword, setPwNewPassword] = useState('');
  const [pwConfirmPassword, setPwConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Avatar file upload handler
  const handleAvatarFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setAvatarUploading(true);
      setProfileMessage(null);
      const res = await ApiClient.uploadImage(file);
      setProfileAvatarUrl(res.url);
      setProfileMessage({ type: 'success', text: 'Avatar uploaded! Click "Save Profile" to apply changes.' });
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: err.message || 'Failed to upload avatar image.' });
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Profile save handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);

    const trimmedUsername = profileUsername.trim();
    if (!trimmedUsername || trimmedUsername.length < 3) {
      setProfileMessage({ type: 'error', text: 'Username must be at least 3 characters.' });
      return;
    }

    try {
      setProfileLoading(true);
      const res = await ApiClient.updateProfile({
        username: trimmedUsername,
        avatarUrl: profileAvatarUrl.trim() || null,
        email: profileEmail.trim() || null,
      });

      updateUser(res.username, res.email, res.avatarUrl, res.token);
      setProfileMessage({ type: 'success', text: 'Profile updated successfully across your workspace.' });
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setProfileLoading(false);
    }
  };

  // Request password verification code handler
  const handleRequestPasswordCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage(null);

    const targetEmail = profileEmail.trim() || email?.trim();
    if (!targetEmail) {
      setPwMessage({ type: 'error', text: 'Please set and save an email address on your profile first.' });
      return;
    }

    try {
      setPwLoading(true);
      const res = await ApiClient.requestPasswordCode();
      setPwMessage({
        type: 'success',
        text: res.message || `A 6-digit verification code has been sent to ${targetEmail}. Please check your inbox and enter it below.`
      });
      setPwStep('verify');
    } catch (err: any) {
      // Fallback: try calling forgotPassword directly with the email
      try {
        const fallbackRes = await ApiClient.forgotPassword(targetEmail);
        setPwMessage({
          type: 'success',
          text: fallbackRes.message || `A verification code has been sent to ${targetEmail}.`
        });
        setPwStep('verify');
      } catch (fallbackErr: any) {
        setPwMessage({ type: 'error', text: fallbackErr.message || err.message || 'Failed to send verification code.' });
      }
    } finally {
      setPwLoading(false);
    }
  };

  // Verify code and reset password handler
  const handleResetPasswordWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage(null);

    const targetEmail = profileEmail.trim() || email?.trim();
    if (!targetEmail) {
      setPwMessage({ type: 'error', text: 'Email is required to verify code.' });
      return;
    }

    if (!pwCode.trim()) {
      setPwMessage({ type: 'error', text: 'Please enter the 6-digit verification code sent to your email.' });
      return;
    }

    if (!pwNewPassword || pwNewPassword.length < 6) {
      setPwMessage({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }

    if (pwNewPassword !== pwConfirmPassword) {
      setPwMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    try {
      setPwLoading(true);
      await ApiClient.resetPassword(targetEmail, pwCode.trim(), pwNewPassword);
      setPwCode('');
      setPwNewPassword('');
      setPwConfirmPassword('');
      setPwStep('request');
      setPwMessage({ type: 'success', text: 'Password changed successfully!' });
    } catch (err: any) {
      setPwMessage({ type: 'error', text: err.message || 'Failed to reset password. Please verify the code and try again.' });
    } finally {
      setPwLoading(false);
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
                className="p-1.5 rounded-lg text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition md:hidden"
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
                className="p-1.5 rounded-lg text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-stone-600 dark:text-stone-400" />
              <h1 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                Settings
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={logout}
              title="Sign out"
              aria-label="Sign out"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-stone-600 dark:text-stone-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Appearance Section */}
        <section
          data-testid="settings-section-theme"
          className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/70 dark:border-stone-800 p-6 shadow-sm"
        >
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Palette className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                  Appearance
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Customize the theme and interface styling
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {THEME_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isActive = theme === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      data-testid={`theme-option-${opt.value}`}
                      onClick={() => setTheme(opt.value)}
                      className={`flex flex-col items-center gap-2 p-3.5 rounded-xl border text-xs font-medium transition ${
                        isActive
                          ? 'border-stone-900 dark:border-stone-100 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-sm'
                          : 'border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Note Editor View Section */}
        <section
          data-testid="settings-section-layout"
          className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/70 dark:border-stone-800 p-6 shadow-sm"
        >
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <Layout className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                  Note Editor View
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Choose default modal or fullscreen presentation when opening notes
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {VIEW_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isActive = defaultView === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      data-testid={`view-option-${opt.value}`}
                      onClick={() => setDefaultView(opt.value)}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition ${
                        isActive
                          ? 'border-stone-900 dark:border-stone-100 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-sm'
                          : 'border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                      }`}
                    >
                      <Icon className="w-5 h-5 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                          {opt.label}
                        </div>
                        <div className="text-xs text-stone-500 dark:text-stone-400">
                          {opt.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Profile & Account Section */}
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
                  Profile & Workspace
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Update your username, avatar icon, and registered recovery email
                </p>
              </div>

              {/* Profile Edit Form */}
              <form onSubmit={handleSaveProfile} className="space-y-4">
                {profileMessage && (
                  <div
                    data-testid="profile-message"
                    className={`text-xs p-3 rounded-2xl border flex items-center gap-2 ${
                      profileMessage.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                        : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/60'
                    }`}
                  >
                    {profileMessage.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{profileMessage.text}</span>
                  </div>
                )}

                {/* Avatar Selection & Preview */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Profile Avatar
                  </label>
                  <div className="flex items-center gap-4">
                    {/* Live Avatar Preview */}
                    <div className="w-14 h-14 rounded-2xl bg-stone-100 dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-700 flex items-center justify-center overflow-hidden shadow-sm shrink-0">
                      {profileAvatarUrl ? (
                        profileAvatarUrl.startsWith('http') || profileAvatarUrl.startsWith('/api') || profileAvatarUrl.startsWith('data:') ? (
                          <img
                            src={profileAvatarUrl}
                            alt="Avatar preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-2xl">{profileAvatarUrl}</span>
                        )
                      ) : (
                        <span className="text-xl font-bold text-stone-600 dark:text-stone-300 uppercase">
                          {profileUsername ? profileUsername.charAt(0) : 'U'}
                        </span>
                      )}
                    </div>

                    {/* Preset Emoji Avatars */}
                    <div className="flex-1">
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 mb-1.5">
                        Choose a preset icon or upload an image:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {PRESET_AVATARS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setProfileAvatarUrl(emoji)}
                            className={`w-8 h-8 rounded-xl text-sm flex items-center justify-center border transition ${
                              profileAvatarUrl === emoji
                                ? 'border-stone-900 dark:border-stone-100 bg-stone-200/70 dark:bg-stone-700 scale-105'
                                : 'border-stone-200 dark:border-stone-700/60 hover:bg-stone-100 dark:hover:bg-stone-800'
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}

                        {/* File Upload Button */}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={avatarUploading}
                          title="Upload avatar image"
                          className="px-2.5 py-1 rounded-xl text-xs flex items-center gap-1 border border-dashed border-stone-300 dark:border-stone-600 hover:border-stone-400 dark:hover:border-stone-500 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>{avatarUploading ? 'Uploading...' : 'Upload'}</span>
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarFileUpload}
                          className="hidden"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="profile-username"
                      className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
                    >
                      Username
                    </label>
                    <input
                      id="profile-username"
                      type="text"
                      data-testid="current-username"
                      value={profileUsername}
                      onChange={(e) => setProfileUsername(e.target.value)}
                      placeholder="Your unique username"
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/50 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-stone-400/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="profile-email"
                      className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
                    >
                      Email Address
                    </label>
                    <input
                      id="profile-email"
                      type="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/50 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-stone-400/20"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={profileLoading}
                  data-testid="save-profile-submit"
                  className="px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium hover:bg-stone-800 dark:hover:bg-stone-200 transition shadow-sm disabled:opacity-50"
                >
                  {profileLoading ? 'Saving...' : 'Save Profile'}
                </button>
              </form>

              {/* Password Change via Email Code Section */}
              <div className="pt-6 border-t border-stone-200/70 dark:border-stone-800 space-y-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                  <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                    Change Password via Email Code
                  </h3>
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  To ensure security, a 6-digit verification code is delivered to your registered email address before changing your password.
                </p>

                {pwMessage && (
                  <div
                    data-testid="password-message"
                    className={`text-xs p-3 rounded-2xl border flex items-center gap-2 ${
                      pwMessage.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                        : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/60'
                    }`}
                  >
                    {pwMessage.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{pwMessage.text}</span>
                  </div>
                )}

                {pwStep === 'request' ? (
                  <form onSubmit={handleRequestPasswordCode} className="space-y-3">
                    <p className="text-xs text-stone-600 dark:text-stone-400">
                      Verification code will be sent to: <span className="font-semibold text-stone-900 dark:text-stone-100">{profileEmail || email || '(no email set)'}</span>
                    </p>
                    <button
                      type="submit"
                      disabled={pwLoading || (!profileEmail && !email)}
                      data-testid="request-pw-code-btn"
                      className="px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium hover:bg-stone-800 dark:hover:bg-stone-200 transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{pwLoading ? 'Sending...' : 'Send Verification Code via Email'}</span>
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleResetPasswordWithCode} className="space-y-3.5">
                    <div>
                      <label
                        htmlFor="pw-reset-code"
                        className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
                      >
                        6-Digit Verification Code
                      </label>
                      <input
                        id="pw-reset-code"
                        type="text"
                        maxLength={6}
                        data-testid="pw-reset-code-input"
                        value={pwCode}
                        onChange={(e) => setPwCode(e.target.value)}
                        placeholder="123456"
                        className="w-full max-w-xs text-sm font-mono tracking-widest text-center px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/50 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-stone-400/20"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="pw-new-password"
                          className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
                        >
                          New Password
                        </label>
                        <input
                          id="pw-new-password"
                          type="password"
                          data-testid="new-password-input"
                          value={pwNewPassword}
                          onChange={(e) => setPwNewPassword(e.target.value)}
                          placeholder="Min 6 characters"
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/50 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-stone-400/20"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="pw-confirm-password"
                          className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
                        >
                          Confirm New Password
                        </label>
                        <input
                          id="pw-confirm-password"
                          type="password"
                          data-testid="confirm-password-input"
                          value={pwConfirmPassword}
                          onChange={(e) => setPwConfirmPassword(e.target.value)}
                          placeholder="Re-enter new password"
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/50 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-stone-400/20"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={pwLoading}
                        data-testid="confirm-pw-change-btn"
                        className="px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium hover:bg-stone-800 dark:hover:bg-stone-200 transition shadow-sm disabled:opacity-50"
                      >
                        {pwLoading ? 'Updating...' : 'Change Password'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setPwStep('request')}
                        className="text-xs text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
                      >
                        Resend code
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* App Version & Info */}
        <div className="pt-2 pb-6 text-center text-xs text-stone-400 dark:text-stone-500 flex items-center justify-center gap-2">
          <span>NoteBook</span>
          <span>•</span>
          <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700 font-medium">
            v0.0.1-beta
          </span>
        </div>
      </main>
    </div>
  );
};
