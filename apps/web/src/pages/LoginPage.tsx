import React, { useState } from 'react';
import { ApiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Lock,
  Mail,
  User,
  KeyRound,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [resetStep, setResetStep] = useState<'request' | 'verify'>('request');

  // Sign In state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Sign Up state
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);

  // Forgot Password state
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);

  // Status state
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTabSwitch = (newMode: 'login' | 'signup') => {
    setMode(newMode);
    setError(null);
    setSuccessMessage(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword) return;

    try {
      setLoading(true);
      setError(null);
      const res = await ApiClient.login(loginUsername.trim(), loginPassword);
      login(res.token, res.username);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUsername = signupUsername.trim();
    const trimmedEmail = signupEmail.trim();

    if (!trimmedUsername || !trimmedEmail || !signupPassword || !signupConfirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    if (signupPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      const res = await ApiClient.register(trimmedUsername, trimmedEmail, signupPassword);
      login(res.token, res.username);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const res = await ApiClient.forgotPassword(resetEmail.trim());
      setSuccessMessage('Reset code sent! Enter the 6-digit verification code below.');
      if (res.devCode) {
        setDevCode(res.devCode);
        setResetCode(res.devCode);
      }
      setResetStep('verify');
    } catch (err: any) {
      setError(err.message || 'Failed to request reset code');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetCode.trim() || !newPassword || !confirmNewPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await ApiClient.resetPassword(resetEmail.trim(), resetCode.trim(), newPassword);
      setSuccessMessage('Password reset successfully! You can now sign in with your new password.');
      setMode('login');
      setLoginUsername(resetEmail.trim());
      setLoginPassword(newPassword);
      setResetStep('request');
      setDevCode(null);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-stone-50 via-white to-stone-100 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950 dark:bg-stone-950 transition-colors">
      <div className="max-w-md w-full bg-white/90 dark:bg-stone-900/90 backdrop-blur-xl p-8 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-xl space-y-6 transition-all">
        {mode !== 'forgot' ? (
          <>
            {/* Material Design 3 Pill Segmented Control */}
            <div
              role="tablist"
              aria-label="Authentication Options"
              className="grid grid-cols-2 p-1.5 bg-stone-100 dark:bg-stone-800 rounded-2xl border border-stone-200/70 dark:border-stone-700/60"
            >
              <button
                type="button"
                role="tab"
                id="tab-login"
                aria-selected={mode === 'login'}
                aria-controls="panel-login"
                onClick={() => handleTabSwitch('login')}
                className={`py-2 text-sm font-medium rounded-xl transition-all ${
                  mode === 'login'
                    ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 font-semibold shadow-sm'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                id="tab-signup"
                aria-selected={mode === 'signup'}
                aria-controls="panel-signup"
                onClick={() => handleTabSwitch('signup')}
                className={`py-2 text-sm font-medium rounded-xl transition-all ${
                  mode === 'signup'
                    ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 font-semibold shadow-sm'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Header / Hero */}
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-stone-900 dark:bg-stone-800 text-white flex items-center justify-center mx-auto shadow-md border border-transparent dark:border-stone-700">
                {mode === 'login' ? <Lock className="w-5 h-5" /> : <User className="w-5 h-5" />}
              </div>
              <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
                {mode === 'login' ? 'Unlock NoteBook' : 'Create Account'}
              </h1>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {mode === 'login'
                  ? 'Sign in to access your personal workspace'
                  : 'Start your journey with a private, dedicated workspace'}
              </p>
            </div>

            {/* Error & Success Feedback Banners */}
            {error && (
              <div
                role="alert"
                className="p-3.5 text-xs bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-200 border border-red-200 dark:border-red-800 rounded-2xl flex items-center gap-2.5 animate-in fade-in"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div
                role="status"
                className="p-3.5 text-xs bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-2.5 animate-in fade-in"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Forms */}
            {mode === 'login' ? (
              <form
                id="panel-login"
                role="tabpanel"
                aria-labelledby="tab-login"
                onSubmit={handleLoginSubmit}
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="login-username"
                    className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
                  >
                    Username or Email
                  </label>
                  <div className="relative">
                    <input
                      id="login-username"
                      type="text"
                      required
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-400 focus:outline-none text-sm transition-all"
                      placeholder="Username or email"
                      aria-label="Username or Email"
                    />
                    <User className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-3 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-semibold text-stone-700 dark:text-stone-300"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setError(null);
                        setSuccessMessage(null);
                      }}
                      className="text-xs text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 transition"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-400 focus:outline-none text-sm transition-all"
                      placeholder="••••••••••••"
                      aria-label="Password"
                    />
                    <Lock className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-3 pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-2.5 p-0.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                      aria-label="Toggle password visibility"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 font-medium text-sm hover:bg-stone-800 dark:hover:bg-stone-200 transition-all shadow-md active:scale-[0.99] disabled:opacity-50"
                >
                  {loading ? 'Authenticating...' : 'Sign In'}
                </button>
              </form>
            ) : (
              <form
                id="panel-signup"
                role="tabpanel"
                aria-labelledby="tab-signup"
                onSubmit={handleSignupSubmit}
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="signup-username"
                    className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
                  >
                    Username
                  </label>
                  <div className="relative">
                    <input
                      id="signup-username"
                      type="text"
                      required
                      value={signupUsername}
                      onChange={(e) => setSignupUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-400 focus:outline-none text-sm transition-all"
                      placeholder="Your username"
                      aria-label="Username"
                    />
                    <User className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-3 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="signup-email"
                    className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      id="signup-email"
                      type="email"
                      required
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-400 focus:outline-none text-sm transition-all"
                      placeholder="name@example.com"
                      aria-label="Email Address"
                    />
                    <Mail className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-3 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="signup-password"
                    className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="signup-password"
                      type={showSignupPassword ? 'text' : 'password'}
                      required
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-400 focus:outline-none text-sm transition-all"
                      placeholder="••••••••••••"
                      aria-label="Password"
                    />
                    <Lock className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-3 pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      className="absolute right-3 top-2.5 p-0.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                      aria-label="Toggle password visibility"
                    >
                      {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="signup-confirm-password"
                    className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="signup-confirm-password"
                      type={showSignupConfirmPassword ? 'text' : 'password'}
                      required
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-400 focus:outline-none text-sm transition-all"
                      placeholder="••••••••••••"
                      aria-label="Confirm Password"
                    />
                    <KeyRound className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-3 pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)}
                      className="absolute right-3 top-2.5 p-0.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                      aria-label="Toggle password visibility"
                    >
                      {showSignupConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Workspace Privacy & Isolation Hint */}
                <div className="p-3 rounded-2xl bg-stone-100/80 dark:bg-stone-800/50 border border-stone-200/70 dark:border-stone-700/50 text-xs text-stone-600 dark:text-stone-300 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>Your workspace, spaces, and notes are private and isolated to your account.</span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 font-medium text-sm hover:bg-stone-800 dark:hover:bg-stone-200 transition-all shadow-md active:scale-[0.99] disabled:opacity-50"
                >
                  {loading ? 'Creating Account...' : 'Create Workspace & Account'}
                </button>
              </form>
            )}
          </>
        ) : (
          /* Forgot Password Mode */
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccessMessage(null);
                setDevCode(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>

            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-400/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-sm border border-amber-200 dark:border-amber-800/40">
                <KeyRound className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
                {resetStep === 'request' ? 'Reset Password' : 'Enter Reset Code'}
              </h1>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {resetStep === 'request'
                  ? 'Enter your account email to receive a 6-digit verification code'
                  : `Verification code sent to ${resetEmail}. Enter your 6-digit code and choose a new password.`}
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="p-3.5 text-xs bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-200 border border-red-200 dark:border-red-800 rounded-2xl flex items-center gap-2.5 animate-in fade-in"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div
                role="status"
                className="p-3.5 text-xs bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-2.5 animate-in fade-in"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {devCode && (
              <div className="p-3 text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 rounded-2xl border border-amber-200 dark:border-amber-900/60 flex flex-col gap-1">
                <span className="font-semibold">Development Code:</span>
                <span className="font-mono text-base tracking-widest">{devCode}</span>
              </div>
            )}

            {resetStep === 'request' ? (
              <form onSubmit={handleRequestResetCode} className="space-y-4">
                <div>
                  <label
                    htmlFor="reset-email"
                    className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      id="reset-email"
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-400 focus:outline-none text-sm transition-all"
                      placeholder="name@example.com"
                      aria-label="Email Address"
                    />
                    <Mail className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-3 pointer-events-none" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 font-medium text-sm hover:bg-stone-800 dark:hover:bg-stone-200 transition shadow-md disabled:opacity-50"
                >
                  {loading ? 'Sending code...' : 'Send Verification Code via Email'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleConfirmResetPassword} className="space-y-4">
                <div>
                  <label
                    htmlFor="reset-code"
                    className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
                  >
                    6-Digit Verification Code
                  </label>
                  <input
                    id="reset-code"
                    type="text"
                    required
                    maxLength={6}
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono tracking-widest text-center text-lg placeholder-stone-400 dark:placeholder-stone-500 focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-400 focus:outline-none"
                    placeholder="123456"
                    aria-label="6-Digit Verification Code"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reset-new-password"
                    className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="reset-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-400 focus:outline-none text-sm"
                      placeholder="••••••••••••"
                      aria-label="New Password"
                    />
                    <Lock className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-3 pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-2.5 p-0.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                      aria-label="Toggle password visibility"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="reset-confirm-new-password"
                    className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1"
                  >
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      id="reset-confirm-new-password"
                      type={showConfirmNewPassword ? 'text' : 'password'}
                      required
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-400 focus:outline-none text-sm"
                      placeholder="••••••••••••"
                      aria-label="Confirm New Password"
                    />
                    <KeyRound className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-3 pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                      className="absolute right-3 top-2.5 p-0.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                      aria-label="Toggle password visibility"
                    >
                      {showConfirmNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResetStep('request');
                      setError(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-sm font-medium hover:bg-stone-100 dark:hover:bg-stone-800 transition"
                  >
                    Resend Code
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 font-medium text-sm hover:bg-stone-800 dark:hover:bg-stone-200 transition shadow-md disabled:opacity-50"
                  >
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
