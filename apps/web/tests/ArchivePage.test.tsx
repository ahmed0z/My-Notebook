import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { ArchivePage } from '../src/pages/ArchivePage';
import { NoteDto } from '@notebook/shared';
import { ApiClient } from '../src/api/client';

vi.mock('../src/api/client', () => ({
  ApiClient: {
    getNotes: vi.fn(),
    updateNote: vi.fn().mockResolvedValue({}),
    deleteNote: vi.fn().mockResolvedValue({})
  }
}));

describe('ArchivePage', () => {
  const sampleNotes: NoteDto[] = [
    {
      id: 'note-1',
      title: 'Active Note',
      color: '#ffffff',
      position: 0,
      isPinned: false,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
      blocks: []
    },
    {
      id: 'note-2',
      title: 'Archived Note 1',
      color: '#fff475',
      position: 1,
      isPinned: false,
      isArchived: true,
      createdAt: '',
      updatedAt: '',
      blocks: []
    },
    {
      id: 'note-3',
      title: 'Pinned Archived Note',
      color: '#ccff90',
      position: 2,
      isPinned: true,
      isArchived: true,
      createdAt: '',
      updatedAt: '',
      blocks: []
    }
  ];

  it('renders only archived notes', () => {
    render(
      <ArchivePage
        notes={sampleNotes}
        loading={false}
        onSelectNote={vi.fn()}
      />
    );

    expect(screen.getByText('Archived Note 1')).toBeInTheDocument();
    expect(screen.getByText('Pinned Archived Note')).toBeInTheDocument();
    expect(screen.queryByText('Active Note')).not.toBeInTheDocument();
  });

  it('renders empty message when no archived notes exist', () => {
    const activeOnly: NoteDto[] = [sampleNotes[0]];
    render(
      <ArchivePage
        notes={activeOnly}
        loading={false}
        onSelectNote={vi.fn()}
      />
    );

    expect(screen.getByText('No archived notes')).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', () => {
    const handleBack = vi.fn();
    render(
      <ArchivePage
        notes={sampleNotes}
        loading={false}
        onSelectNote={vi.fn()}
        onBack={handleBack}
      />
    );

    const backBtn = screen.getByRole('button', { name: /back to notes/i });
    fireEvent.click(backBtn);
    expect(handleBack).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleSideMenu when menu button is clicked', () => {
    const handleToggle = vi.fn();
    render(
      <ArchivePage
        notes={sampleNotes}
        loading={false}
        onSelectNote={vi.fn()}
        onToggleSideMenu={handleToggle}
      />
    );

    const menuBtn = screen.getByRole('button', { name: /open menu/i });
    fireEvent.click(menuBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('calls onSelectNote when an archived note card is clicked', () => {
    const handleSelect = vi.fn();
    render(
      <ArchivePage
        notes={sampleNotes}
        loading={false}
        onSelectNote={handleSelect}
      />
    );

    fireEvent.click(screen.getByText('Archived Note 1'));
    expect(handleSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'note-2' }));
  });

  it('unarchives note on unarchive button click', async () => {
    const handleUpdated = vi.fn();
    render(
      <ArchivePage
        notes={sampleNotes}
        loading={false}
        onSelectNote={vi.fn()}
        onNoteUpdated={handleUpdated}
      />
    );

    const unarchiveButtons = screen.getAllByTitle('Unarchive');
    expect(unarchiveButtons.length).toBeGreaterThan(0);
    fireEvent.click(unarchiveButtons[0]);

    await waitFor(() => {
      expect(ApiClient.updateNote).toHaveBeenCalledWith('note-3', { isArchived: false });
      expect(handleUpdated).toHaveBeenCalledWith(expect.objectContaining({ id: 'note-3', isArchived: false }));
    });
  });
});
