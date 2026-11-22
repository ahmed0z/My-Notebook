import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { SpaceSelector } from '../src/components/SpaceSelector';
import { SpaceDto } from '@notebook/shared';

const mockSpaces: SpaceDto[] = [
  { id: 'space-1', name: 'Work', parentSpaceId: null, position: 0, createdAt: '2026-01-01' },
  { id: 'space-2', name: 'Personal', parentSpaceId: null, position: 1, createdAt: '2026-01-02' },
  { id: 'space-3', name: 'Project Alpha', parentSpaceId: 'space-1', position: 0, createdAt: '2026-01-03' },
  { id: 'space-4', name: 'Sub Alpha Task', parentSpaceId: 'space-3', position: 0, createdAt: '2026-01-04' },
];

describe('SpaceSelector', () => {
  it('renders "All Notes" and root spaces', () => {
    render(
      <SpaceSelector
        spaces={mockSpaces}
        activeSpaceId={null}
        onSelectSpace={vi.fn()}
        onCreateSpace={vi.fn()}
        onUpdateSpace={vi.fn()}
        onDeleteSpace={vi.fn()}
      />
    );

    expect(screen.getByTestId('space-all-notes')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    expect(screen.getByText('Sub Alpha Task')).toBeInTheDocument();
  });

  it('calls onSelectSpace when clicking a space or All Notes', () => {
    const onSelect = vi.fn();
    render(
      <SpaceSelector
        spaces={mockSpaces}
        activeSpaceId="space-1"
        onSelectSpace={onSelect}
        onCreateSpace={vi.fn()}
        onUpdateSpace={vi.fn()}
        onDeleteSpace={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Personal'));
    expect(onSelect).toHaveBeenCalledWith('space-2');

    fireEvent.click(screen.getByTestId('space-all-notes'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('toggles collapse for child spaces', () => {
    render(
      <SpaceSelector
        spaces={mockSpaces}
        activeSpaceId={null}
        onSelectSpace={vi.fn()}
        onCreateSpace={vi.fn()}
        onUpdateSpace={vi.fn()}
        onDeleteSpace={vi.fn()}
      />
    );

    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    // Collapse Work space
    const collapseBtn = screen.getAllByRole('button', { name: /collapse sub-spaces/i })[0];
    fireEvent.click(collapseBtn);

    // Project Alpha should now be hidden
    expect(screen.queryByText('Project Alpha')).not.toBeInTheDocument();

    // Expand Work space
    const expandBtn = screen.getByRole('button', { name: /expand sub-spaces/i });
    fireEvent.click(expandBtn);
    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
  });

  it('creates root space via inline input', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(
      <SpaceSelector
        spaces={mockSpaces}
        activeSpaceId={null}
        onSelectSpace={vi.fn()}
        onCreateSpace={onCreate}
        onUpdateSpace={vi.fn()}
        onDeleteSpace={vi.fn()}
      />
    );

    const addBtn = screen.getByRole('button', { name: 'New Space' });
    fireEvent.click(addBtn);

    const input = screen.getByPlaceholderText('Space name...');
    fireEvent.change(input, { target: { value: 'New Root Space' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(onCreate).toHaveBeenCalledWith('New Root Space', undefined);
  });

  it('creates sub-space under parent space', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(
      <SpaceSelector
        spaces={mockSpaces}
        activeSpaceId={null}
        onSelectSpace={vi.fn()}
        onCreateSpace={onCreate}
        onUpdateSpace={vi.fn()}
        onDeleteSpace={vi.fn()}
      />
    );

    const workItem = screen.getByTestId('space-item-space-1');
    const addSubBtn = workItem.querySelector('button[title="Add sub-space"]');
    expect(addSubBtn).not.toBeNull();
    fireEvent.click(addSubBtn!);

    const input = screen.getByPlaceholderText('Sub-space name...');
    fireEvent.change(input, { target: { value: 'New Sub Space' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(onCreate).toHaveBeenCalledWith('New Sub Space', 'space-1');
  });

  it('renames a space', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <SpaceSelector
        spaces={mockSpaces}
        activeSpaceId={null}
        onSelectSpace={vi.fn()}
        onCreateSpace={vi.fn()}
        onUpdateSpace={onUpdate}
        onDeleteSpace={vi.fn()}
      />
    );

    const workItem = screen.getByTestId('space-item-space-1');
    const renameBtn = workItem.querySelector('button[title="Rename space"]');
    expect(renameBtn).not.toBeNull();
    fireEvent.click(renameBtn!);

    const editInput = screen.getByDisplayValue('Work');
    fireEvent.change(editInput, { target: { value: 'Work Updated' } });
    fireEvent.keyDown(editInput, { key: 'Enter', code: 'Enter' });

    expect(onUpdate).toHaveBeenCalledWith('space-1', { name: 'Work Updated' });
  });

  it('deletes a space after confirmation', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <SpaceSelector
        spaces={mockSpaces}
        activeSpaceId="space-2"
        onSelectSpace={vi.fn()}
        onCreateSpace={vi.fn()}
        onUpdateSpace={vi.fn()}
        onDeleteSpace={onDelete}
      />
    );

    const personalItem = screen.getByTestId('space-item-space-2');
    const deleteBtn = personalItem.querySelector('button[title="Delete space"]');
    expect(deleteBtn).not.toBeNull();
    fireEvent.click(deleteBtn!);

    expect(onDelete).toHaveBeenCalledWith('space-2');
  });
});
