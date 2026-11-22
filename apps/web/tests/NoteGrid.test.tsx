import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { NoteGrid } from '../src/components/NoteGrid';
import { NoteDto } from '@notebook/shared';

describe('NoteGrid', () => {
  it('renders pinned and unpinned note sections correctly', () => {
    const notes: NoteDto[] = [
      { id: '1', title: 'Pinned Note', color: '#ffffff', position: 0, isPinned: true, isArchived: false, createdAt: '', updatedAt: '' },
      { id: '2', title: 'Regular Note', color: '#fff475', position: 1, isPinned: false, isArchived: false, createdAt: '', updatedAt: '' }
    ];
    render(<NoteGrid notes={notes} onSelectNote={() => {}} onPinToggle={() => {}} onArchiveToggle={() => {}} onColorChange={() => {}} />);
    expect(screen.getByText('Pinned Note')).toBeInTheDocument();
    expect(screen.getByText('Regular Note')).toBeInTheDocument();
  });
});
