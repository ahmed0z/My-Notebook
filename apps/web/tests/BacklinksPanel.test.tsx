import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BacklinksPanel, extractBacklinkSnippet } from '../src/components/editor/BacklinksPanel';
import { NoteAutocomplete } from '../src/components/editor/NoteAutocomplete';
import { TextBlock } from '../src/components/editor/blocks/TextBlock';
import { BlockEditorModal } from '../src/components/editor/BlockEditorModal';
import { ApiClient } from '../src/api/client';
import { NoteDto } from '@notebook/shared';

vi.mock('../src/api/client', () => ({
  ApiClient: {
    getBacklinks: vi.fn(),
    getNotes: vi.fn().mockResolvedValue([]),
    getNote: vi.fn(),
    updateNote: vi.fn().mockResolvedValue({}),
    patchBlock: vi.fn().mockResolvedValue({}),
    addBlock: vi.fn().mockResolvedValue({}),
    deleteBlock: vi.fn().mockResolvedValue({}),
    reorderBlocks: vi.fn().mockResolvedValue({})
  }
}));

describe('BacklinksPanel (Web)', () => {
  const mockOnOpenNote = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractBacklinkSnippet helper', () => {
    it('returns empty string when blocks is undefined or empty', () => {
      expect(extractBacklinkSnippet(undefined)).toBe('');
      expect(extractBacklinkSnippet([])).toBe('');
    });

    it('extracts snippet from text block content object', () => {
      const blocks = [
        {
          id: 'b1',
          noteId: 'n1',
          type: 'text' as const,
          content: { text: 'This references [[Target Note]] with context.', level: 'paragraph' as const },
          position: 0,
          createdAt: '',
          updatedAt: ''
        }
      ];
      expect(extractBacklinkSnippet(blocks)).toBe('This references [[Target Note]] with context.');
    });

    it('extracts snippet from text block contentJson string', () => {
      const blocks = [
        {
          id: 'b1',
          noteId: 'n1',
          type: 'text' as const,
          content: '{"text":"Snippet from JSON string","level":"h1"}',
          position: 0,
          createdAt: '',
          updatedAt: ''
        }
      ];
      expect(extractBacklinkSnippet(blocks)).toBe('Snippet from JSON string');
    });

    it('extracts snippet from checklist items', () => {
      const blocks = [
        {
          id: 'b1',
          noteId: 'n1',
          type: 'checklist' as const,
          content: { items: [{ id: '1', text: 'Task 1', checked: false }, { id: '2', text: 'Task 2', checked: true }] },
          position: 0,
          createdAt: '',
          updatedAt: ''
        }
      ];
      expect(extractBacklinkSnippet(blocks)).toBe('Task 1, Task 2');
    });
  });

  describe('BacklinksPanel Component', () => {
    it('renders collapsed by default with badge and expands on click', async () => {
      const mockBacklinks: NoteDto[] = [
        {
          id: 'note-source-1',
          title: 'Project Roadmap',
          color: '#ffffff',
          position: 0,
          isPinned: false,
          isArchived: false,
          createdAt: '',
          updatedAt: '',
          blocks: []
        }
      ];

      vi.mocked(ApiClient.getBacklinks).mockResolvedValueOnce(mockBacklinks);

      render(<BacklinksPanel noteId="target-1" onOpenNote={mockOnOpenNote} />);

      const toggle = screen.getByTestId('backlinks-toggle');
      expect(toggle).toBeInTheDocument();
      expect(screen.getByText('Backlinks')).toBeInTheDocument();
      expect(screen.queryByText('Project Roadmap')).not.toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      // Expand
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByText('Project Roadmap')).toBeInTheDocument();
      });

      // Collapse again
      fireEvent.click(toggle);
      expect(screen.queryByText('Project Roadmap')).not.toBeInTheDocument();
    });

    it('renders empty state when no notes link to current note', async () => {
      vi.mocked(ApiClient.getBacklinks).mockResolvedValueOnce([]);

      render(<BacklinksPanel noteId="target-1" onOpenNote={mockOnOpenNote} defaultExpanded={true} />);

      expect(screen.getByText(/loading backlinks/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText(/no backlinks yet/i)).toBeInTheDocument();
      });
      expect(ApiClient.getBacklinks).toHaveBeenCalledWith('target-1');
    });

    it('renders list of backlinks with note title and preview snippet', async () => {
      const mockBacklinks: NoteDto[] = [
        {
          id: 'note-source-1',
          title: 'Project Roadmap',
          color: '#ffffff',
          position: 0,
          isPinned: false,
          isArchived: false,
          createdAt: '',
          updatedAt: '',
          blocks: [
            {
              id: 'b1',
              noteId: 'note-source-1',
              type: 'text',
              content: { text: 'See [[Target Note]] for milestones.', level: 'paragraph' },
              position: 0,
              createdAt: '',
              updatedAt: ''
            }
          ]
        },
        {
          id: 'note-source-2',
          title: 'Architecture Overview',
          color: '#ffffff',
          position: 1,
          isPinned: false,
          isArchived: false,
          createdAt: '',
          updatedAt: '',
          blocks: [
            {
              id: 'b2',
              noteId: 'note-source-2',
              type: 'text',
              content: { text: 'Core engine based on [[Target Note]].', level: 'paragraph' },
              position: 0,
              createdAt: '',
              updatedAt: ''
            }
          ]
        }
      ];

      vi.mocked(ApiClient.getBacklinks).mockResolvedValueOnce(mockBacklinks);

      render(<BacklinksPanel noteId="target-1" onOpenNote={mockOnOpenNote} defaultExpanded={true} />);

      await waitFor(() => {
        expect(screen.getByText('Project Roadmap')).toBeInTheDocument();
        expect(screen.getByText('Architecture Overview')).toBeInTheDocument();
      });

      expect(screen.getByText(/See \[\[Target Note\]\] for milestones\./i)).toBeInTheDocument();
      expect(screen.getByText(/Core engine based on \[\[Target Note\]\]\./i)).toBeInTheDocument();
    });

    it('invokes onOpenNote when clicking a backlink note card', async () => {
      const mockBacklinks: NoteDto[] = [
        {
          id: 'note-source-1',
          title: 'Project Roadmap',
          color: '#ffffff',
          position: 0,
          isPinned: false,
          isArchived: false,
          createdAt: '',
          updatedAt: '',
          blocks: []
        }
      ];

      vi.mocked(ApiClient.getBacklinks).mockResolvedValueOnce(mockBacklinks);

      render(<BacklinksPanel noteId="target-1" onOpenNote={mockOnOpenNote} defaultExpanded={true} />);

      await waitFor(() => {
        expect(screen.getByText('Project Roadmap')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Project Roadmap'));
      expect(mockOnOpenNote).toHaveBeenCalledWith('note-source-1');
    });

    it('contains dark mode classes on backlink elements', async () => {
      const mockBacklinks: NoteDto[] = [
        {
          id: 'note-source-1',
          title: 'Dark Mode Note',
          color: '#ffffff',
          position: 0,
          isPinned: false,
          isArchived: false,
          createdAt: '',
          updatedAt: '',
          blocks: []
        }
      ];

      vi.mocked(ApiClient.getBacklinks).mockResolvedValueOnce(mockBacklinks);

      render(<BacklinksPanel noteId="target-1" onOpenNote={mockOnOpenNote} defaultExpanded={true} />);

      await waitFor(() => {
        expect(screen.getByText('Dark Mode Note')).toBeInTheDocument();
      });

      const card = screen.getByTestId('backlink-item-note-source-1');
      expect(card.className).toContain('dark:bg-stone-800');
      expect(card.className).toContain('dark:border-stone-700');
    });
  });

  describe('NoteAutocomplete Component', () => {
    const mockNotes: NoteDto[] = [
      { id: '1', title: 'Architecture Plan', color: '#fff', position: 0, isPinned: false, isArchived: false, createdAt: '', updatedAt: '' },
      { id: '2', title: 'Action Items', color: '#fff', position: 1, isPinned: false, isArchived: false, createdAt: '', updatedAt: '' },
      { id: '3', title: 'Brainstorming Session', color: '#fff', position: 2, isPinned: false, isArchived: false, createdAt: '', updatedAt: '' }
    ];

    it('filters notes matching the query and invokes onSelect on click', () => {
      const handleSelect = vi.fn();
      const handleClose = vi.fn();

      render(
        <NoteAutocomplete
          query="Action"
          notes={mockNotes}
          onSelect={handleSelect}
          onClose={handleClose}
        />
      );

      expect(screen.getByText('Action Items')).toBeInTheDocument();
      expect(screen.queryByText('Brainstorming Session')).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('Action Items'));
      expect(handleSelect).toHaveBeenCalledWith('Action Items');
    });

    it('shows empty state when no notes match query', () => {
      render(
        <NoteAutocomplete
          query="NonExistent"
          notes={mockNotes}
          onSelect={() => {}}
          onClose={() => {}}
        />
      );

      expect(screen.getByText(/no matching notes/i)).toBeInTheDocument();
    });

    it('supports selecting via keyboard Enter', () => {
      const handleSelect = vi.fn();

      render(
        <NoteAutocomplete
          query="Plan"
          notes={mockNotes}
          onSelect={handleSelect}
          onClose={() => {}}
        />
      );

      const item = screen.getByText('Architecture Plan');
      expect(item).toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'Enter' });
      expect(handleSelect).toHaveBeenCalledWith('Architecture Plan');
    });
  });

  describe('TextBlock with Note Links and Autocomplete', () => {
    const mockNotes: NoteDto[] = [
      { id: 'target-10', title: 'Design System', color: '#fff', position: 0, isPinned: false, isArchived: false, createdAt: '', updatedAt: '' }
    ];

    it('renders clickable link badge when text contains [[Note Title]]', () => {
      const handleOpen = vi.fn();
      render(
        <TextBlock
          content={{ text: 'Check out [[Design System]] for guidance.', level: 'paragraph' }}
          onChange={() => {}}
          notes={mockNotes}
          onOpenNote={handleOpen}
        />
      );

      const linkPill = screen.getByTestId('note-link-Design System');
      expect(linkPill).toBeInTheDocument();
      expect(linkPill).toHaveTextContent('[[Design System]]');

      fireEvent.click(linkPill);
      expect(handleOpen).toHaveBeenCalledWith('target-10');
    });

    it('triggers autocomplete popup when typing [[', async () => {
      const handleChange = vi.fn();
      render(
        <TextBlock
          content={{ text: 'Let us see [[Des', level: 'paragraph' }}
          onChange={handleChange}
          notes={mockNotes}
        />
      );

      const textarea = screen.getByPlaceholderText(/Type something/i);
      fireEvent.focus(textarea);

      // Autocomplete list should show 'Design System'
      expect(await screen.findByText('Design System')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Design System'));

      expect(handleChange).toHaveBeenCalledWith({
        text: 'Let us see [[Design System]]',
        level: 'paragraph'
      });
    });
  });

  describe('BlockEditorModal Backlinks Integration', () => {
    it('mounts BacklinksPanel at the bottom and handles note navigation', async () => {
      const initialNote: NoteDto = {
        id: 'note-main',
        title: 'Main Spec',
        color: '#ffffff',
        position: 0,
        isPinned: false,
        isArchived: false,
        createdAt: '',
        updatedAt: '',
        blocks: []
      };

      const referencingNote: NoteDto = {
        id: 'note-ref',
        title: 'Referencing Note',
        color: '#ffffff',
        position: 0,
        isPinned: false,
        isArchived: false,
        createdAt: '',
        updatedAt: '',
        blocks: [
          {
            id: 'b99',
            noteId: 'note-ref',
            type: 'text',
            content: { text: 'See [[Main Spec]].', level: 'paragraph' },
            position: 0,
            createdAt: '',
            updatedAt: ''
          }
        ]
      };

      vi.mocked(ApiClient.getNote).mockResolvedValueOnce(initialNote);
      vi.mocked(ApiClient.getBacklinks).mockResolvedValueOnce([referencingNote]);

      const handleOpenNote = vi.fn();

      render(
        <BlockEditorModal
          note={initialNote}
          onClose={() => {}}
          onNoteUpdated={() => {}}
          onOpenNote={handleOpenNote}
        />
      );

      // Backlinks section is collapsed by default; click toggle to expand
      const toggleBtn = await screen.findByTestId('backlinks-toggle');
      fireEvent.click(toggleBtn);

      await waitFor(() => {
        expect(screen.getByText('Referencing Note')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Referencing Note'));
      expect(handleOpenNote).toHaveBeenCalledWith('note-ref');
    });
  });
});
