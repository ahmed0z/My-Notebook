import React from 'react';
import { NoteDto, SpaceDto } from '@notebook/shared';
import { NoteCard } from './NoteCard';

interface NoteGridProps {
  notes: NoteDto[];
  onSelectNote: (note: NoteDto) => void;
  onPinToggle: (note: NoteDto) => void;
  onArchiveToggle: (note: NoteDto) => void;
  onColorChange: (note: NoteDto, color: string) => void;
  onDeleteNote?: (note: NoteDto) => void;
  spaces?: SpaceDto[];
  onMoveNote?: (note: NoteDto, spaceId: string | null) => void;
  showArchived?: boolean;
  emptyMessage?: string;
}

export const NoteGrid: React.FC<NoteGridProps> = ({
  notes,
  onSelectNote,
  onPinToggle,
  onArchiveToggle,
  onColorChange,
  onDeleteNote,
  spaces,
  onMoveNote,
  showArchived = false,
  emptyMessage
}) => {
  const pinnedNotes = showArchived
    ? notes.filter(n => n.isPinned && n.isArchived)
    : notes.filter(n => n.isPinned && !n.isArchived);
  const otherNotes = showArchived
    ? notes.filter(n => !n.isPinned && n.isArchived)
    : notes.filter(n => !n.isPinned && !n.isArchived);

  return (
    <div className="space-y-8">
      {pinnedNotes.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wider font-semibold text-stone-400 dark:text-stone-500 mb-3 px-1">
            Pinned
          </h2>
          <div className="masonry-grid">
            {pinnedNotes.map(n => (
              <div key={n.id} className="masonry-item">
                <NoteCard
                  note={n}
                  onSelect={onSelectNote}
                  onPinToggle={onPinToggle}
                  onArchiveToggle={onArchiveToggle}
                  onColorChange={onColorChange}
                  onDelete={onDeleteNote}
                  spaces={spaces}
                  onMoveNote={onMoveNote}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {otherNotes.length > 0 && (
        <section>
          {pinnedNotes.length > 0 && (
            <h2 className="text-xs uppercase tracking-wider font-semibold text-stone-400 dark:text-stone-500 mb-3 px-1">
              Others
            </h2>
          )}
          <div className="masonry-grid">
            {otherNotes.map(n => (
              <div key={n.id} className="masonry-item">
                <NoteCard
                  note={n}
                  onSelect={onSelectNote}
                  onPinToggle={onPinToggle}
                  onArchiveToggle={onArchiveToggle}
                  onColorChange={onColorChange}
                  onDelete={onDeleteNote}
                  spaces={spaces}
                  onMoveNote={onMoveNote}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {pinnedNotes.length === 0 && otherNotes.length === 0 && (
        <div className="py-24 text-center">
          <p className="text-stone-400 dark:text-stone-500 text-sm">
            {emptyMessage || (showArchived ? 'No archived notes' : 'Notes you add appear here')}
          </p>
        </div>
      )}
    </div>
  );
};
