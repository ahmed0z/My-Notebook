import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { SideMenu } from '../src/components/SideMenu';

describe('SideMenu', () => {
  it('renders closed side menu without backdrop', () => {
    render(
      <SideMenu
        isOpen={false}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        currentPage="home"
      />
    );

    const menu = screen.getByTestId('side-menu');
    expect(menu).toHaveClass('-translate-x-full');
    expect(screen.queryByTestId('side-menu-backdrop')).not.toBeInTheDocument();
  });

  it('renders open side menu with backdrop and items', () => {
    render(
      <SideMenu
        isOpen={true}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        currentPage="home"
      />
    );

    const menu = screen.getByTestId('side-menu');
    expect(menu).toHaveClass('translate-x-0');
    expect(screen.getByTestId('side-menu-backdrop')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <SideMenu
        isOpen={true}
        onClose={handleClose}
        onNavigate={vi.fn()}
        currentPage="home"
      />
    );

    const closeBtn = screen.getByRole('button', { name: /collapse menu/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop overlay is clicked', () => {
    const handleClose = vi.fn();
    render(
      <SideMenu
        isOpen={true}
        onClose={handleClose}
        onNavigate={vi.fn()}
        currentPage="home"
      />
    );

    const backdrop = screen.getByTestId('side-menu-backdrop');
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onNavigate and onClose when a nav item is clicked', () => {
    const handleNavigate = vi.fn();
    const handleClose = vi.fn();
    render(
      <SideMenu
        isOpen={true}
        onClose={handleClose}
        onNavigate={handleNavigate}
        currentPage="home"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /archive/i }));
    expect(handleNavigate).toHaveBeenCalledWith('archive');
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(handleNavigate).toHaveBeenCalledWith('settings');

    fireEvent.click(screen.getByRole('button', { name: /notes/i }));
    expect(handleNavigate).toHaveBeenCalledWith('home');
  });

  it('highlights active item', () => {
    render(
      <SideMenu
        isOpen={true}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        currentPage="archive"
      />
    );

    const archiveBtn = screen.getByRole('button', { name: /archive/i });
    expect(archiveBtn).toHaveClass('font-semibold');
  });

  it('renders spaces tree with nested notes and triggers onSelectNote', () => {
    const handleSelectNote = vi.fn();
    const spaces = [
      { id: 's1', name: 'Engineering', parentSpaceId: null, position: 0, createdAt: '' }
    ];
    const notes = [
      { id: 'n1', title: 'Architecture RFC', color: '#fff', position: 0, isPinned: false, isArchived: false, spaceId: 's1', createdAt: '', updatedAt: '' },
      { id: 'n2', title: 'Quick Memo', color: '#fff', position: 0, isPinned: false, isArchived: false, spaceId: null, createdAt: '', updatedAt: '' }
    ];

    render(
      <SideMenu
        isOpen={true}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        currentPage="home"
        spaces={spaces}
        notes={notes}
        selectedNoteId="n1"
        onSelectNote={handleSelectNote}
      />
    );

    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('Architecture RFC')).toBeInTheDocument();
    expect(screen.getByText('Quick Memo')).toBeInTheDocument();

    const activeNoteBtn = screen.getByText('Architecture RFC').closest('button');
    expect(activeNoteBtn).toHaveClass('font-semibold');

    fireEvent.click(screen.getByText('Quick Memo'));
    expect(handleSelectNote).toHaveBeenCalledWith(expect.objectContaining({ id: 'n2' }));
  });
});
