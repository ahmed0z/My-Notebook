import React from 'react';
import { SpaceDto } from '@notebook/shared';
import { SearchBar } from './SearchBar';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Sun, Moon, LogOut, Menu, ArrowLeft, Folder } from 'lucide-react';

export interface HeaderProps {
  onSearch: (query: string) => void;
  username?: string | null;
  avatarUrl?: string | null;
  onLogout: () => void;
  onToggleSideMenu?: () => void;
  activeSpace?: SpaceDto | null;
  onBackToAllNotes?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onSearch,
  username,
  avatarUrl,
  onLogout,
  onToggleSideMenu,
  activeSpace,
  onBackToAllNotes,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const { avatarUrl: contextAvatarUrl } = useAuth();
  const activeAvatar = avatarUrl !== undefined ? avatarUrl : contextAvatarUrl;

  return (
    <header className="sticky top-0 z-10 bg-stone-50/80 dark:bg-stone-900/90 backdrop-blur-md border-b border-stone-200/60 dark:border-stone-800 px-4 py-3 sm:px-6 lg:px-8 transition-colors">
      <div className="w-full flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          {onToggleSideMenu && (
            <button
              type="button"
              onClick={onToggleSideMenu}
              title="Open menu"
              aria-label="Open menu"
              className="p-1.5 rounded-lg text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {activeSpace && onBackToAllNotes && (
            <button
              type="button"
              onClick={onBackToAllNotes}
              title="Back to All Notes"
              aria-label="Back to All Notes"
              className="p-1.5 rounded-lg text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition shrink-0 mr-1"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2 min-w-0">
            {activeSpace ? (
              <>
                <Folder className="w-5 h-5 text-amber-500 shrink-0" />
                <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100 truncate max-w-[200px] sm:max-w-xs">
                  {activeSpace.name}
                </h1>
              </>
            ) : (
              <span className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                NoteBook
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 max-w-md mx-4">
          <SearchBar onSearch={onSearch} />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-1.5 rounded-lg text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-stone-600 dark:text-stone-300" />
            )}
          </button>

          {username && (
            <div className="flex items-center gap-1.5 py-1 px-2 rounded-xl bg-stone-100/70 dark:bg-stone-800/60 border border-stone-200/50 dark:border-stone-700/50">
              {activeAvatar ? (
                activeAvatar.startsWith('http') || activeAvatar.startsWith('/api') || activeAvatar.startsWith('data:') ? (
                  <img
                    src={activeAvatar}
                    alt={username}
                    className="w-5 h-5 rounded-full object-cover border border-stone-300 dark:border-stone-600 shadow-sm"
                  />
                ) : (
                  <span className="w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-xs">
                    {activeAvatar}
                  </span>
                )
              ) : (
                <span className="w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 flex items-center justify-center text-xs font-bold uppercase">
                  {username.charAt(0)}
                </span>
              )}
              <span className="text-xs font-medium text-stone-700 dark:text-stone-300 hidden sm:inline">
                {username}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={onLogout}
            title="Sign out"
            aria-label="Sign out"
            className="p-1.5 rounded-lg text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
