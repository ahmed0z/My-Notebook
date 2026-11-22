import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { NoteCard } from '../src/components/NoteCard';
import { NoteDto } from '@notebook/shared';

describe('NoteCard (Web)', () => {
  it('renders checklist preview with curved corners and transparent background', () => {
    const note: NoteDto = {
      id: '1',
      title: 'Note with Checklist',
      color: '#ffffff',
      position: 0,
      isPinned: false,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
      blocks: [
        {
          id: 'b1',
          noteId: '1',
          type: 'checklist',
          content: {
            items: [
              { id: 'i1', text: 'Unchecked item', checked: false },
              { id: 'i2', text: 'Checked item', checked: true },
            ],
          },
          position: 0,
          createdAt: '',
          updatedAt: '',
        },
      ],
    };

    const { container } = render(
      <NoteCard
        note={note}
        onSelect={() => {}}
        onPinToggle={() => {}}
        onArchiveToggle={() => {}}
        onColorChange={() => {}}
      />
    );

    expect(screen.getByText('Unchecked item')).toBeInTheDocument();
    expect(screen.getByText('Checked item')).toBeInTheDocument();

    // Checkbox preview spans
    const previewCheckboxes = container.querySelectorAll('.space-y-0\\.5 span.w-3\\.5');
    expect(previewCheckboxes.length).toBe(2);

    // Both should have curved corners (rounded-md) and transparent background (bg-transparent)
    expect(previewCheckboxes[0].className).toContain('rounded-md');
    expect(previewCheckboxes[0].className).toContain('bg-transparent');
    expect(previewCheckboxes[0].className).not.toContain('bg-stone-700');
    expect(previewCheckboxes[0].textContent).toBe('');

    // Checked one should have checkmark text '✓' and still have bg-transparent (no solid background)
    expect(previewCheckboxes[1].className).toContain('rounded-md');
    expect(previewCheckboxes[1].className).toContain('bg-transparent');
    expect(previewCheckboxes[1].className).not.toContain('bg-stone-700');
    expect(previewCheckboxes[1].textContent).toBe('✓');
  });
});
