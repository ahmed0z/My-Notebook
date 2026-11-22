import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { Header } from '../src/components/Header';

describe('Header', () => {
  it('renders Header brand and controls', () => {
    render(
      <Header
        onSearch={vi.fn()}
        username="alice"
        onLogout={vi.fn()}
      />
    );

    expect(screen.getByText('NoteBook')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open menu/i })).not.toBeInTheDocument();
  });

  it('renders hamburger menu button when onToggleSideMenu is provided', () => {
    const handleToggle = vi.fn();
    render(
      <Header
        onSearch={vi.fn()}
        username="alice"
        onLogout={vi.fn()}
        onToggleSideMenu={handleToggle}
      />
    );

    const menuBtn = screen.getByRole('button', { name: /open menu/i });
    expect(menuBtn).toBeInTheDocument();
    fireEvent.click(menuBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('renders active space name and back button when activeSpace is provided', () => {
    const handleBack = vi.fn();
    render(
      <Header
        onSearch={vi.fn()}
        username="alice"
        onLogout={vi.fn()}
        activeSpace={{ id: 's1', name: 'Work Project', parentSpaceId: null, position: 0, createdAt: '' }}
        onBackToAllNotes={handleBack}
      />
    );

    expect(screen.getByText('Work Project')).toBeInTheDocument();
    expect(screen.queryByText('NoteBook')).not.toBeInTheDocument();

    const backBtn = screen.getByRole('button', { name: /back to all notes/i });
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(handleBack).toHaveBeenCalledTimes(1);
  });
});
