import React, { useState } from 'react';
import { NoteDto, SpaceDto } from '@notebook/shared';
import { Pin, Palette, Archive, Trash2, Folder, FolderInput } from 'lucide-react';
import { ColorPicker } from './ColorPicker';
import { useTheme } from '../context/ThemeContext';

interface NoteCardProps {
  note: NoteDto;
  onSelect: (note: NoteDto) => void;
  onPinToggle: (note: NoteDto) => void;
  onArchiveToggle: (note: NoteDto) => void;
  onColorChange: (note: NoteDto, color: string) => void;
  onDelete?: (note: NoteDto) => void;
  spaces?: SpaceDto[];
  onMoveNote?: (note: NoteDto, spaceId: string | null) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  onSelect,
  onPinToggle,
  onArchiveToggle,
  onColorChange,
  onDelete,
  spaces = [],
  onMoveNote
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSpacePicker, setShowSpacePicker] = useState(false);
  const { isDark, getNoteCardColor } = useTheme();

  const cardBg = getNoteCardColor(note.color, isDark);
  const currentSpace = spaces.find(s => s.id === note.spaceId);

  return (
    <div
      onClick={() => onSelect(note)}
      style={{ backgroundColor: cardBg }}
      className={`group relative rounded-2xl p-4 border border-black/[0.12] hover:border-black/30 dark:border-stone-800 dark:hover:border-stone-700 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between ${
        (showColorPicker || showSpacePicker) ? 'z-30' : 'z-0'
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-base leading-snug line-clamp-2">
              {note.title || 'Untitled Note'}
            </h3>
            {currentSpace && (
              <div className="flex items-center gap-1 mt-1 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                <Folder className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate">{currentSpace.name}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            title={note.isPinned ? 'Unpin' : 'Pin note'}
            aria-label={note.isPinned ? 'Unpin' : 'Pin note'}
            onClick={(e) => {
              e.stopPropagation();
              onPinToggle(note);
            }}
            className={`p-1 rounded-lg text-black/60 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 transition-opacity ${
              note.isPinned ? 'opacity-100 text-stone-900 dark:text-stone-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            <Pin className={`w-4 h-4 ${note.isPinned ? 'fill-stone-900 dark:fill-stone-100' : ''}`} />
          </button>
        </div>

        {note.blocks && note.blocks.length > 0 ? (
          <div className="text-sm text-stone-800/85 dark:text-stone-300 space-y-1.5 my-2">
            {note.blocks.slice(0, 3).map(b => {
              try {
                const raw = (b as any).contentJson ?? b.content;
                const parsed = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
                if (b.type === 'text') {
                  return <p key={b.id} className="line-clamp-2">{parsed.text || '...'}</p>;
                }
                if (b.type === 'checklist') {
                  const items = parsed.items || [];
                  return (
                    <div key={b.id} className="space-y-0.5">
                      {items.slice(0, 2).map((it: any) => (
                        <div key={it.id} className="flex items-center gap-1.5 text-xs text-stone-800/85 dark:text-stone-300">
                          <span className="w-3.5 h-3.5 rounded-md border border-black/40 dark:border-stone-500 bg-transparent flex items-center justify-center text-[9px] text-stone-900 dark:text-stone-300 shrink-0">
                            {it.checked ? '✓' : ''}
                          </span>
                          <span className={`line-clamp-1 ${it.checked ? 'line-through text-black/45 dark:text-stone-500' : ''}`}>{it.text}</span>
                        </div>
                      ))}
                    </div>
                  );
                }
                if (b.type === 'table') {
                  return <p key={b.id} className="text-xs text-black/60 dark:text-stone-400 italic">Table ({parsed.columns?.length || 0} cols)</p>;
                }
                if (b.type === 'image') {
                  return (
                    <div key={b.id} className="w-full h-24 rounded-lg overflow-hidden bg-black/[0.06] dark:bg-stone-800 flex items-center justify-center my-1">
                      <img src={parsed.url} alt={parsed.caption || 'Note attachment'} className="w-full h-full object-cover" />
                    </div>
                  );
                }
              } catch {
                return null;
              }
              return null;
            })}
          </div>
        ) : (
          <p className="text-xs text-black/45 dark:text-stone-500 italic">Empty note</p>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 mt-2 border-t border-black/5 dark:border-white/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              type="button"
              title="Change color"
              aria-label="Change color"
              onClick={(e) => {
                e.stopPropagation();
                setShowColorPicker(!showColorPicker);
              }}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-black/60 dark:text-stone-400 hover:text-stone-900 hover:dark:text-stone-200 transition"
            >
              <Palette className="w-3.5 h-3.5" />
            </button>
            {showColorPicker && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowColorPicker(false);
                  }}
                />
                <div className="absolute bottom-11 left-0 z-50">
                  <ColorPicker
                    currentColor={note.color}
                    onSelectColor={(hex) => {
                      onColorChange(note, hex);
                      setShowColorPicker(false);
                    }}
                  />
                </div>
              </>
            )}
          </div>

          {onMoveNote && (
            <div className="relative">
              <button
                type="button"
                title="Move to space"
                aria-label="Move to space"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSpacePicker(!showSpacePicker);
                }}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-black/60 dark:text-stone-400 hover:text-stone-900 hover:dark:text-stone-200 transition"
              >
                <FolderInput className="w-3.5 h-3.5" />
              </button>
              {showSpacePicker && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSpacePicker(false);
                    }}
                  />
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-11 left-0 z-50 w-48 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl shadow-lg p-1.5 text-xs text-stone-800 dark:text-stone-200 max-h-56 overflow-y-auto"
                  >
                    <div className="px-2 py-1 font-semibold text-stone-400 dark:text-stone-500 uppercase text-[10px] tracking-wider">
                      Move to space
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onMoveNote(note, null);
                        setShowSpacePicker(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-1.5 ${
                        !note.spaceId ? 'font-semibold text-amber-600 dark:text-amber-400' : ''
                      }`}
                    >
                      <span className="truncate">No space (General)</span>
                    </button>
                    {spaces.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          onMoveNote(note, s.id);
                          setShowSpacePicker(false);
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-1.5 ${
                          note.spaceId === s.id ? 'font-semibold text-amber-600 dark:text-amber-400' : ''
                        }`}
                      >
                        <Folder className="w-3 h-3 text-stone-400 shrink-0" />
                        <span className="truncate">{s.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            title={note.isArchived ? 'Unarchive' : 'Archive'}
            aria-label={note.isArchived ? 'Unarchive' : 'Archive'}
            onClick={(e) => {
              e.stopPropagation();
              onArchiveToggle(note);
            }}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-stone-600 dark:text-stone-400 hover:dark:text-stone-200 transition"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
          {onDelete && (
            <button
              type="button"
              title="Delete note"
              aria-label="Delete note"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Delete "${note.title || 'Untitled Note'}"?`)) {
                  onDelete(note);
                }
              }}
              className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 text-stone-600 dark:text-stone-400 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
