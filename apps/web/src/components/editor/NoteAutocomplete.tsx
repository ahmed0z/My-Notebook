import React, { useEffect, useState, useRef } from 'react';
import { NoteDto } from '@notebook/shared';
import { ApiClient } from '../../api/client';
import { FileText } from 'lucide-react';

export interface NoteAutocompleteProps {
  query: string;
  onSelect: (noteTitle: string) => void;
  onClose: () => void;
  notes?: NoteDto[];
  position?: { top?: number; left?: number; bottom?: number; right?: number };
  className?: string;
}

export const NoteAutocomplete: React.FC<NoteAutocompleteProps> = ({
  query,
  onSelect,
  onClose,
  notes: propNotes,
  position,
  className = ''
}) => {
  const [notes, setNotes] = useState<NoteDto[]>(propNotes || []);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (propNotes) {
      setNotes(propNotes);
    } else {
      let isMounted = true;
      ApiClient.getNotes()
        .then(data => {
          if (isMounted) setNotes(data || []);
        })
        .catch(err => {
          console.error('Failed to load notes for autocomplete', err);
        });
      return () => { isMounted = false; };
    }
  }, [propNotes]);

  const cleanQuery = (query || '').toLowerCase().trim();
  const matchingNotes = notes.filter(n =>
    cleanQuery === '' || n.title.toLowerCase().includes(cleanQuery)
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle click outside to dismiss
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (matchingNotes.length > 0 ? (prev + 1) % matchingNotes.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (matchingNotes.length > 0 ? (prev - 1 + matchingNotes.length) % matchingNotes.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (matchingNotes.length > 0 && matchingNotes[selectedIndex]) {
          onSelect(matchingNotes[selectedIndex].title);
        } else if (query.trim()) {
          onSelect(query.trim());
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [matchingNotes, selectedIndex, query, onSelect, onClose]);

  return (
    <div
      ref={containerRef}
      style={position}
      data-testid="note-autocomplete-popup"
      className={`absolute z-50 w-64 max-h-56 overflow-y-auto rounded-xl shadow-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-1 animate-in fade-in zoom-in-95 duration-100 ${className}`}
    >
      <div className="px-2 py-1 text-[10px] font-semibold tracking-wider uppercase text-stone-400 dark:text-stone-500 border-b border-stone-100 dark:border-stone-700/50 mb-1">
        Link Note
      </div>

      {matchingNotes.length === 0 ? (
        <div className="px-3 py-2 text-xs text-stone-400 dark:text-stone-500 italic">
          No matching notes found
        </div>
      ) : (
        <ul className="space-y-0.5">
          {matchingNotes.map((n, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onSelect(n.title)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition cursor-pointer ${
                    isSelected
                      ? 'bg-stone-100 dark:bg-stone-700 text-stone-900 dark:text-white font-medium'
                      : 'text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700/50'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span className="truncate">{n.title || 'Untitled Note'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
