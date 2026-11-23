import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { NoteActionsMenu } from '../src/components/editor/NoteActionsMenu';
import { NoteDto, SpaceDto } from '@notebook/shared';

describe('NoteActionsMenu', () => {
  const note: NoteDto = {
    id: 'n1',
    title: 'Test Note',
    color: '#fff',
    position: 0,
    isPinned: false,
    isArchived: false,
    spaceId: null,
    createdAt: '',
    updatedAt: ''
  };

  const spaces: SpaceDto[] = [
    { id: 's1', name: 'Work', parentSpaceId: null, position: 0, createdAt: '' }
  ];

  it('renders trigger button and opens menu on click', () => {
    render(
      <NoteActionsMenu
        note={note}
        spaces={spaces}
        onArchiveToggle={() => {}}
        onDelete={() => {}}
        onMoveToSpace={() => {}}
      />
    );

    const trigger = screen.getByTitle('Note options');
    fireEvent.click(trigger);

    expect(screen.getByText('Archive note')).toBeInTheDocument();
    expect(screen.getByText('Change folder')).toBeInTheDocument();
    expect(screen.getByText('Delete note')).toBeInTheDocument();
  });

  it('shows Unarchive note when note is already archived', () => {
    const archivedNote = { ...note, isArchived: true };
    render(
      <NoteActionsMenu
        note={archivedNote}
        spaces={spaces}
        onArchiveToggle={() => {}}
        onDelete={() => {}}
        onMoveToSpace={() => {}}
      />
    );

    fireEvent.click(screen.getByTitle('Note options'));
    expect(screen.getByText('Unarchive note')).toBeInTheDocument();
  });

  it('triggers delete callback with confirmation', () => {
    const onDelete = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <NoteActionsMenu
        note={note}
        spaces={spaces}
        onArchiveToggle={() => {}}
        onDelete={onDelete}
        onMoveToSpace={() => {}}
      />
    );

    fireEvent.click(screen.getByTitle('Note options'));
    fireEvent.click(screen.getByText('Delete note'));
    expect(onDelete).toHaveBeenCalled();
  });

  it('opens folder list and allows changing space', () => {
    const onMoveToSpace = vi.fn();
    render(
      <NoteActionsMenu
        note={note}
        spaces={spaces}
        onArchiveToggle={() => {}}
        onDelete={() => {}}
        onMoveToSpace={onMoveToSpace}
      />
    );

    fireEvent.click(screen.getByTitle('Note options'));
    fireEvent.click(screen.getByText('Change folder'));
    expect(screen.getByText('Work')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Work'));
    expect(onMoveToSpace).toHaveBeenCalledWith('s1');
  });
});
