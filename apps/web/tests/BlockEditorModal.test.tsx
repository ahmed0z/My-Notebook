import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { BlockEditorModal } from '../src/components/editor/BlockEditorModal';
import { SettingsProvider } from '../src/context/SettingsContext';
import { NoteDto } from '@notebook/shared';
import { ApiClient } from '../src/api/client';

// Mock ApiClient
vi.mock('../src/api/client', () => ({
  ApiClient: {
    getNote: vi.fn().mockResolvedValue({
      id: 'n1',
      title: 'Modal Test Note',
      color: '#ffffff',
      position: 0,
      isPinned: false,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
      blocks: [
        {
          id: 'b1',
          noteId: 'n1',
          type: 'text',
          content: { text: 'Block item content', level: 'paragraph' },
          position: 0,
          createdAt: '',
          updatedAt: ''
        }
      ]
    }),
    getNotes: vi.fn().mockResolvedValue([]),
    getBacklinks: vi.fn().mockResolvedValue([]),
    updateNote: vi.fn().mockResolvedValue({}),
    patchBlock: vi.fn().mockResolvedValue({}),
    reorderBlocks: vi.fn().mockResolvedValue({}),
    deleteBlock: vi.fn().mockResolvedValue(undefined),
    addBlock: vi.fn().mockImplementation((noteId, type, contentJson, position) => Promise.resolve({
      id: `new-${type}-block`,
      noteId,
      type,
      contentJson,
      position,
      createdAt: '',
      updatedAt: ''
    }))
  }
}));

describe('BlockEditorModal', () => {
  it('renders modal with note title and block controls', async () => {
    const note: NoteDto = {
      id: 'n1',
      title: 'Modal Test Note',
      color: '#ffffff',
      position: 0,
      isPinned: false,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
      blocks: []
    };

    render(<BlockEditorModal note={note} onClose={() => {}} onNoteUpdated={() => {}} />);
    expect(screen.getByDisplayValue('Modal Test Note')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Block item content')).toBeInTheDocument();
  });

  it('toggles fullscreen mode when clicking fullscreen button', async () => {
    const note: NoteDto = {
      id: 'n1',
      title: 'Modal Test Note',
      color: '#ffffff',
      position: 0,
      isPinned: false,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
      blocks: []
    };

    render(<BlockEditorModal note={note} onClose={() => {}} onNoteUpdated={() => {}} />);
    const fullscreenBtn = screen.getByTitle('Full screen');
    expect(fullscreenBtn).toBeInTheDocument();

    fireEvent.click(fullscreenBtn);
    expect(screen.getByTitle('Exit full screen')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Exit full screen'));
    expect(screen.getByTitle('Full screen')).toBeInTheDocument();
  });

  it('initializes in fullscreen mode when defaultView is fullscreen', async () => {
    localStorage.setItem('notebook_default_view', 'fullscreen');
    const note: NoteDto = {
      id: 'n1',
      title: 'Modal Test Note',
      color: '#ffffff',
      position: 0,
      isPinned: false,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
      blocks: []
    };

    render(
      <SettingsProvider>
        <BlockEditorModal note={note} onClose={() => {}} onNoteUpdated={() => {}} />
      </SettingsProvider>
    );

    expect(screen.getByTitle('Exit full screen')).toBeInTheDocument();
  });

  it('successfully inserts To-Do, Table, and Image blocks without crashing', async () => {
    const note: NoteDto = {
      id: 'n1',
      title: 'Modal Test Note',
      color: '#ffffff',
      position: 0,
      isPinned: false,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
      blocks: []
    };

    render(<BlockEditorModal note={note} onClose={() => {}} onNoteUpdated={() => {}} />);
    expect(await screen.findByDisplayValue('Block item content')).toBeInTheDocument();

    // Click To-Do
    const todoBtn = screen.getByRole('button', { name: /to-do/i });
    fireEvent.click(todoBtn);
    expect(await screen.findByPlaceholderText(/to-do/i)).toBeInTheDocument();

    // Click Table
    const tableBtn = screen.getByRole('button', { name: /table/i });
    fireEvent.click(tableBtn);
    expect(await screen.findByText('Column 1')).toBeInTheDocument();

    // Click Image
    const imageBtn = screen.getByRole('button', { name: /image/i });
    fireEvent.click(imageBtn);
    expect(await screen.findByText(/drag & drop an image/i)).toBeInTheDocument();
  });

  it('displays indicator line when dragging block over another block and resets on drop', async () => {
    (ApiClient.getNote as any).mockResolvedValueOnce({
      id: 'n-multi',
      title: 'Multi Block Note',
      color: '#ffffff',
      position: 0,
      isPinned: false,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
      blocks: [
        {
          id: 'b1',
          noteId: 'n-multi',
          type: 'text',
          content: { text: 'Block 1', level: 'paragraph' },
          position: 0,
          createdAt: '',
          updatedAt: ''
        },
        {
          id: 'b2',
          noteId: 'n-multi',
          type: 'text',
          content: { text: 'Block 2', level: 'paragraph' },
          position: 1,
          createdAt: '',
          updatedAt: ''
        }
      ]
    });

    const note: NoteDto = {
      id: 'n-multi',
      title: 'Multi Block Note',
      color: '#ffffff',
      position: 0,
      isPinned: false,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
      blocks: []
    };

    render(<BlockEditorModal note={note} onClose={() => {}} onNoteUpdated={() => {}} />);
    expect(await screen.findByDisplayValue('Block 1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Block 2')).toBeInTheDocument();

    const handleButtons = screen.getAllByRole('button', { name: /drag to move or click for options/i });
    const blockWrappers = handleButtons.map(btn => btn.closest('[data-testid="block-wrapper"]')!);

    expect(handleButtons.length).toBe(2);

    // Initially no indicator line
    expect(screen.queryByTestId('drag-indicator-line')).not.toBeInTheDocument();

    // Drag block 0 over block 0 (itself) -> should NOT show indicator
    fireEvent.dragStart(handleButtons[0], { dataTransfer: { effectAllowed: 'move' } });
    fireEvent.dragOver(blockWrappers[0], { dataTransfer: { dropEffect: 'move' } });
    expect(screen.queryByTestId('drag-indicator-line')).not.toBeInTheDocument();

    // Drag block 0 over block 1 (dragging downwards) -> indicator line below block 1
    fireEvent.dragOver(blockWrappers[1], { dataTransfer: { dropEffect: 'move' } });
    const indicatorBelow = screen.getByTestId('drag-indicator-line');
    expect(indicatorBelow).toBeInTheDocument();
    expect(blockWrappers[1].nextElementSibling).toBe(indicatorBelow);

    // Cancel / dragEnd -> indicator line should disappear
    fireEvent.dragEnd(handleButtons[0]);
    expect(screen.queryByTestId('drag-indicator-line')).not.toBeInTheDocument();

    // Drag block 1 over block 0 (dragging upwards) -> indicator line above block 0
    fireEvent.dragStart(handleButtons[1], { dataTransfer: { effectAllowed: 'move' } });
    fireEvent.dragOver(blockWrappers[0], { dataTransfer: { dropEffect: 'move' } });
    const indicatorAbove = screen.getByTestId('drag-indicator-line');
    expect(indicatorAbove).toBeInTheDocument();
    expect(blockWrappers[0].previousElementSibling).toBe(indicatorAbove);

    fireEvent.dragEnd(handleButtons[1]);
    expect(screen.queryByTestId('drag-indicator-line')).not.toBeInTheDocument();

    // Drag block 0 over block 1 again and drop
    fireEvent.dragStart(handleButtons[0], { dataTransfer: { effectAllowed: 'move' } });
    fireEvent.dragOver(blockWrappers[1], { dataTransfer: { dropEffect: 'move' } });
    expect(screen.getByTestId('drag-indicator-line')).toBeInTheDocument();

    fireEvent.drop(blockWrappers[1], { dataTransfer: { dropEffect: 'move' } });
    expect(screen.queryByTestId('drag-indicator-line')).not.toBeInTheDocument();
    expect(ApiClient.reorderBlocks).toHaveBeenCalledWith('n-multi', ['b2', 'b1']);
  });

  it('displays indicator line at end when dragging over bottom canvas area', async () => {
    (ApiClient.getNote as any).mockResolvedValueOnce({
      id: 'n-end',
      title: 'End Drag Note',
      color: '#ffffff',
      position: 0,
      isPinned: false,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
      blocks: [
        {
          id: 'b1',
          noteId: 'n-end',
          type: 'text',
          content: { text: 'Block First', level: 'paragraph' },
          position: 0,
          createdAt: '',
          updatedAt: ''
        },
        {
          id: 'b2',
          noteId: 'n-end',
          type: 'text',
          content: { text: 'Block Last', level: 'paragraph' },
          position: 1,
          createdAt: '',
          updatedAt: ''
        }
      ]
    });

    const note: NoteDto = {
      id: 'n-end',
      title: 'End Drag Note',
      color: '#ffffff',
      position: 0,
      isPinned: false,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
      blocks: []
    };

    render(<BlockEditorModal note={note} onClose={() => {}} onNoteUpdated={() => {}} />);
    expect(await screen.findByDisplayValue('Block First')).toBeInTheDocument();

    const handleButtons = screen.getAllByRole('button', { name: /drag to move or click for options/i });

    // Start dragging block 0
    fireEvent.dragStart(handleButtons[0], { dataTransfer: { effectAllowed: 'move' } });

    // Drag over bottom canvas
    const canvas = screen.getByTestId('block-canvas-area');
    fireEvent.dragOver(canvas, { dataTransfer: { dropEffect: 'move' } });

    expect(screen.getByTestId('drag-indicator-line')).toBeInTheDocument();

    // Drop on canvas
    fireEvent.drop(canvas, { dataTransfer: { dropEffect: 'move' } });
    expect(screen.queryByTestId('drag-indicator-line')).not.toBeInTheDocument();
    expect(ApiClient.reorderBlocks).toHaveBeenCalledWith('n-end', ['b2', 'b1']);
  });

  it('renders 6-dots handle without external trash icon and opens rich options menu with delete inside', async () => {
    (ApiClient.getNote as any).mockResolvedValueOnce({
      id: 'n-menu-test',
      title: 'Menu Test Note',
      color: '#ffffff',
      position: 0,
      isPinned: false,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
      blocks: [
        {
          id: 'b-single',
          noteId: 'n-menu-test',
          type: 'text',
          content: { text: 'Convertible text', level: 'paragraph' },
          position: 0,
          createdAt: '',
          updatedAt: ''
        }
      ]
    });

    const note: NoteDto = {
      id: 'n-menu-test',
      title: 'Menu Test Note',
      color: '#ffffff',
      position: 0,
      isPinned: false,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
      blocks: []
    };

    render(<BlockEditorModal note={note} onClose={() => {}} onNoteUpdated={() => {}} />);
    expect(await screen.findByDisplayValue('Convertible text')).toBeInTheDocument();

    // 1. External trash icon beside the 6-dots grip handle must NOT exist
    const blockContainer = screen.getByDisplayValue('Convertible text').closest('.group')!;
    const gripHandle = blockContainer.querySelector('button[aria-label="Drag to move or click for options"]');
    expect(gripHandle).toBeInTheDocument();

    // No sibling delete button beside grip handle in the handle bar
    const handleBar = gripHandle!.parentElement!;
    expect(handleBar.querySelectorAll('button').length).toBe(1);

    // 2. Click 6-dots grip handle to open popover menu
    fireEvent.click(gripHandle!);
    const menu = await screen.findByTestId('block-options-menu');
    expect(menu).toBeInTheDocument();

    // 3. Menu contains Turn Into options
    expect(within(menu).getByRole('button', { name: /heading 1/i })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: /heading 2/i })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: /to-do list/i })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: /table/i })).toBeInTheDocument();

    // 4. Menu contains actions & Delete block inside
    expect(within(menu).getByRole('button', { name: /duplicate/i })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: /copy content/i })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: /delete block/i })).toBeInTheDocument();

    // 5. Clicking Delete block inside the menu triggers delete
    fireEvent.click(within(menu).getByRole('button', { name: /delete block/i }));
    expect(ApiClient.deleteBlock).toHaveBeenCalledWith('b-single');
  });
});
