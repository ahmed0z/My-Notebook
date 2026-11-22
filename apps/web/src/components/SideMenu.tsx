import React from 'react';
import { StickyNote, Archive, Settings, ChevronLeft } from 'lucide-react';
import { SpaceDto } from '@notebook/shared';
import { SpaceSelector } from './SpaceSelector';
import { useAuth } from '../context/AuthContext';

export interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: 'home' | 'archive' | 'settings') => void;
  currentPage: 'home' | 'archive' | 'settings';
  spaces?: SpaceDto[];
  activeSpaceId?: string | null;
  onSelectSpace?: (spaceId: string | null) => void;
  onCreateSpace?: (name: string, parentSpaceId?: string | null) => Promise<void>;
  onUpdateSpace?: (id: string, updates: { name?: string; parentSpaceId?: string | null }) => Promise<void>;
  onDeleteSpace?: (id: string) => Promise<void>;
}

interface NavItem {
  id: 'home' | 'archive' | 'settings';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Notes', icon: StickyNote },
  { id: 'archive', label: 'Archive', icon: Archive },
  { id: 'settings', label: 'Settings', icon: Settings }
];

export const SideMenu: React.FC<SideMenuProps> = ({
  isOpen,
  onClose,
  onNavigate,
  currentPage,
  spaces = [],
  activeSpaceId = null,
  onSelectSpace,
  onCreateSpace,
  onUpdateSpace,
  onDeleteSpace
}) => {
  const { username, avatarUrl } = useAuth();
  return (
    <>
      {/* Backdrop overlay */}
      {isOpen && (
        <div
          data-testid="side-menu-backdrop"
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden transition-opacity animate-in fade-in duration-200"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sliding sidebar */}
      <aside
        data-testid="side-menu"
        aria-label="Main Navigation"
        className={`fixed top-0 bottom-0 left-0 w-64 bg-stone-50 dark:bg-stone-900 border-r border-stone-200/80 dark:border-stone-800 z-50 flex flex-col shadow-xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200/60 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100">
              NoteBook
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Collapse menu"
            aria-label="Collapse menu"
            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onNavigate(item.id);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                    isActive
                      ? 'bg-stone-200/70 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-semibold shadow-sm'
                      : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200/40 dark:hover:bg-stone-800/60 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-stone-900 dark:text-stone-100' : 'text-stone-500 dark:text-stone-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Spaces Tree Selector */}
          {onSelectSpace && (
            <div className="pt-3 border-t border-stone-200/60 dark:border-stone-800">
              <SpaceSelector
                spaces={spaces}
                activeSpaceId={activeSpaceId}
                onSelectSpace={(spaceId) => {
                  onSelectSpace(spaceId);
                  onNavigate('home');
                  onClose();
                }}
                onCreateSpace={onCreateSpace || (async () => {})}
                onUpdateSpace={onUpdateSpace || (async () => {})}
                onDeleteSpace={onDeleteSpace || (async () => {})}
              />
            </div>
          )}
        </nav>

        {/* Footer info & Profile */}
        <div className="px-4 py-3 border-t border-stone-200/60 dark:border-stone-800 flex items-center gap-2.5">
          {avatarUrl ? (
            avatarUrl.startsWith('http') || avatarUrl.startsWith('/api') || avatarUrl.startsWith('data:') ? (
              <img
                src={avatarUrl}
                alt={username || 'Profile'}
                className="w-8 h-8 rounded-full object-cover border border-stone-200 dark:border-stone-700 shadow-sm"
              />
            ) : (
              <span className="w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-800 flex items-center justify-center text-base border border-stone-300 dark:border-stone-700">
                {avatarUrl}
              </span>
            )
          ) : (
            <span className="w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center text-xs font-bold uppercase border border-stone-300 dark:border-stone-700">
              {username ? username.charAt(0) : 'U'}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-stone-800 dark:text-stone-200 truncate">
              {username || 'NoteBook User'}
            </p>
            <div className="flex items-center justify-between gap-1 text-[11px] text-stone-400 dark:text-stone-500">
              <span className="truncate">Personal Workspace</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 font-medium shrink-0">v0.0.1-beta</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
