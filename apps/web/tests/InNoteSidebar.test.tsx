import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { InNoteSidebar } from '../src/components/editor/InNoteSidebar';
import { SpaceDto, NoteDto } from '@notebook/shared';

describe('InNoteSidebar', () => {
  const spaces: SpaceDto[] = [
    { id: 's1', name: 'Work', parentSpaceId: null, position: 0, createdAt: '' },
    { id: 's2', name: 'Projects', parentSpaceId: 's1', position: 0, createdAt: '' }
  ];

  const notes: NoteDto[] = [
    { id: 'n1', title: 'Work Note', color: '#fff', position: 0, isPinned: false, isArchived: false, spaceId: 's1', createdAt: '', updatedAt: '' },
    { id: 'n2', title: 'Archived Note', color: '#fff', position: 1, isPinned: false, isArchived: true, spaceId: 's1', createdAt: '', updatedAt: '' },
    { id: 'n3', title: 'General Note', color: '#fff', position: 0, isPinned: false, isArchived: false, spaceId: null, createdAt: '', updatedAt: '' }
  ];

  it('renders folders and active notes while excluding archived notes from folder trees', () => {
    render(
      <InNoteSidebar
        isOpen={true}
        onToggle={() => {}}
        currentNoteId="n1"
        spaces={spaces}
        notes={notes}
        onSelectNote={() => {}}
      />
    );

    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Work Note')).toBeInTheDocument();
    expect(screen.getByText('General Note')).toBeInTheDocument();
    expect(screen.queryByText('Archived Note')).not.toBeInTheDocument();
  });

  it('highlights current active note and calls onSelectNote on click', () => {
    const onSelectNote = vi.fn();
    render(
      <InNoteSidebar
        isOpen={true}
        onToggle={() => {}}
        currentNoteId="n1"
        spaces={spaces}
        notes={notes}
        onSelectNote={onSelectNote}
      />
    );

    const activeItem = screen.getByText('Work Note').closest('button');
    expect(activeItem).toHaveClass('font-semibold');

    const generalItem = screen.getByText('General Note');
    fireEvent.click(generalItem);
    expect(onSelectNote).toHaveBeenCalledWith('n3');
  });

  it('collapses folders when chevron is clicked', () => {
    render(
      <InNoteSidebar
        isOpen={true}
        onToggle={() => {}}
        currentNoteId="n1"
        spaces={spaces}
        notes={notes}
        onSelectNote={() => {}}
      />
    );

    const collapseBtn = screen.getByLabelText('Toggle Work folder');
    fireEvent.click(collapseBtn);
    expect(screen.queryByText('Work Note')).not.toBeInTheDocument();
  });

  it('renders nothing or hides when isOpen is false', () => {
    const { container } = render(
      <InNoteSidebar
        isOpen={false}
        onToggle={() => {}}
        currentNoteId="n1"
        spaces={spaces}
        notes={notes}
        onSelectNote={() => {}}
      />
    );

    expect(container.querySelector('[data-testid="in-note-sidebar"]')).toBeNull();
  });
});
