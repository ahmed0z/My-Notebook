import React, { useState } from 'react';
import { ApiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Sparkles, ShieldCheck } from 'lucide-react';

export const SetupPage: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    try {
      setLoading(true);
      setError(null);
      const res = await ApiClient.setup(username, password);
      login(res.token, res.username);
    } catch (err: any) {
      setError(err.message || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-stone-50 via-white to-stone-100 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950 dark:bg-stone-950 transition-colors">
      <div className="max-w-md w-full bg-white/80 dark:bg-stone-900/90 backdrop-blur-xl p-8 rounded-3xl border border-stone-200/70 dark:border-stone-800 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-stone-900 dark:bg-stone-800 text-white flex items-center justify-center mx-auto shadow-md border border-transparent dark:border-stone-700">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">Welcome to NoteBook</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Create your owner credentials. This is a one-time setup and will lock permanently after creation.
          </p>
        </div>

        {error && (
          <div className="p-3 text-xs bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/60">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-400 focus:outline-none text-sm"
              placeholder="e.g. owner"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Master Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-400 focus:outline-none text-sm"
              placeholder="••••••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 font-medium text-sm hover:bg-stone-800 dark:hover:bg-stone-200 transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            {loading ? 'Configuring...' : 'Initialize NoteBook'}
          </button>
        </form>
      </div>
    </div>
  );
};
