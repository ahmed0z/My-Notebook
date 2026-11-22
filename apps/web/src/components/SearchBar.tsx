import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchBarProps {
  value?: string;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  onSearch: (query: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value = '',
  placeholder = 'Search notes...',
  debounceMs = 300,
  className = '',
  onSearch
}) => {
  const [query, setQuery] = useState(value);
  const isFirstRender = useRef(true);
  const prevValueRef = useRef(value);
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external value changes if provided
  useEffect(() => {
    if (prevValueRef.current !== value) {
      prevValueRef.current = value;
      setQuery(value);
    }
  }, [value]);

  // Debounced callback
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      onSearchRef.current(query);
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [query, debounceMs]);

  const handleClear = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setQuery('');
    onSearchRef.current('');
  };

  return (
    <div className={`relative flex items-center w-full ${className}`}>
      <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="text"
        role="textbox"
        aria-label="Search notes"
        value={query}
        placeholder={placeholder}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-stone-100/80 dark:bg-stone-800 border border-transparent dark:border-stone-700 text-sm text-stone-800 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-stone-400/20 transition"
      />
      {query && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
