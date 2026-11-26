import React, { useEffect, useState } from 'react';
import { NoteDto, BlockDto } from '@notebook/shared';
import { ApiClient } from '../../api/client';
import { Link2, Loader2, ArrowRight, ChevronDown, ChevronRight } from 'lucide-react';

export function extractBacklinkSnippet(blocks?: BlockDto[] | any[]): string {
  if (!blocks || blocks.length === 0) return '';

  const parsedBlocks = blocks.map(block => {
    let content: any = block.content;
    if (typeof content === 'string') {
      try {
        content = JSON.parse(content);
      } catch {
        content = {};
      }
    }
    if (!content) return '';

    if (content.text && typeof content.text === 'string' && content.text.trim()) {
      return content.text.trim();
    }
    if (Array.isArray(content.items) && content.items.length > 0) {
      return content.items
        .map((i: any) => i.text)
        .filter(Boolean)
        .join(', ');
    }
    if (content.caption && typeof content.caption === 'string' && content.caption.trim()) {
      return content.caption.trim();
    }
    return '';
  }).filter(Boolean);

  if (parsedBlocks.length === 0) return '';

  // Prioritize blocks containing "[["
  const linkBlock = parsedBlocks.find(txt => txt.includes('[['));
  if (linkBlock) return linkBlock;

  return parsedBlocks[0];
}

export interface BacklinksPanelProps {
  noteId: string;
  onOpenNote: (noteId: string) => void;
  className?: string;
  defaultExpanded?: boolean;
}

export const BacklinksPanel: React.FC<BacklinksPanelProps> = ({
  noteId,
  onOpenNote,
  className = '',
  defaultExpanded = false
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [backlinks, setBacklinks] = useState<NoteDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchBacklinks = async () => {
      try {
        setLoading(true);
        if (typeof ApiClient.getBacklinks === 'function') {
          const data = await ApiClient.getBacklinks(noteId);
          if (isMounted) {
            setBacklinks(data || []);
          }
        } else {
          if (isMounted) {
            setBacklinks([]);
          }
        }
      } catch (err) {
        console.error('Failed to load backlinks', err);
        if (isMounted) {
          setBacklinks([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (noteId) {
      fetchBacklinks();
    }
    return () => {
      isMounted = false;
    };
  }, [noteId]);

  return (
    <div className={`mt-2 pt-2 border-t border-black/10 dark:border-stone-800 ${className}`}>
      <button
        type="button"
        data-testid="backlinks-toggle"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        className="flex items-center gap-2 cursor-pointer py-1 px-2 rounded-lg hover:bg-black/[0.05] dark:hover:bg-stone-800 transition text-black/70 dark:text-stone-300 text-xs font-medium select-none"
      >
        <Link2 className="w-3.5 h-3.5 text-black/60 dark:text-stone-400" />
        <span className="font-semibold uppercase tracking-wider text-[11px] text-black/60 dark:text-stone-400">
          Backlinks
        </span>
        <span className="text-[10px] bg-black/[0.08] dark:bg-stone-700 text-stone-800 dark:text-stone-300 px-1.5 py-0.5 rounded-full font-semibold">
          {backlinks.length}
        </span>
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-black/50 dark:text-stone-400" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-black/50 dark:text-stone-400" />
        )}
      </button>

      {isExpanded && (
        <div className={`mt-2 ${backlinks.length > 0 ? 'pb-4' : ''}`}>
          {loading ? (
            <div className="flex items-center gap-2 py-3 text-xs text-stone-400 dark:text-stone-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Loading backlinks...</span>
            </div>
          ) : backlinks.length === 0 ? (
            <div className="py-3 text-xs text-stone-400 dark:text-stone-500 italic">
              No backlinks yet. Notes that mention this note will appear here.
            </div>
          ) : (
            <div className="space-y-2">
              {backlinks.map((note) => {
                const snippet = extractBacklinkSnippet(note.blocks);
                return (
                  <button
                    key={note.id}
                    type="button"
                    data-testid={`backlink-item-${note.id}`}
                    onClick={() => onOpenNote(note.id)}
                    className="w-full text-left p-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white/70 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700/70 hover:border-stone-300 dark:hover:border-stone-600 transition group cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-stone-800 dark:text-stone-200 group-hover:text-stone-900 dark:group-hover:text-white transition-colors">
                        {note.title || 'Untitled Note'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-600 dark:group-hover:text-stone-300 transition-transform group-hover:translate-x-0.5" />
                    </div>
                    {snippet && (
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 line-clamp-2">
                        {snippet}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
