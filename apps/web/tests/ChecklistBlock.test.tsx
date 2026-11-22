import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { ChecklistBlock } from '../src/components/editor/blocks/ChecklistBlock';
import { ChecklistBlockContent } from '@notebook/shared';

describe('ChecklistBlock (Web)', () => {
  it('renders custom styled checkbox buttons with curved corners and transparent background', () => {
    const content: ChecklistBlockContent = {
      items: [
        { id: 'item-1', text: 'Task 1', checked: false },
        { id: 'item-2', text: 'Task 2', checked: true },
      ],
    };
    const onChange = vi.fn();

    render(<ChecklistBlock content={content} onChange={onChange} />);

    // Custom checkbox buttons (role="checkbox")
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(2);

    // Should NOT be native input checkboxes
    expect(checkboxes[0].tagName).toBe('BUTTON');
    expect(checkboxes[0]).toHaveAttribute('type', 'button');

    // Checkbox 1 (unchecked): has rounded-md, border, bg-transparent, aria-checked="false"
    expect(checkboxes[0]).toHaveAttribute('aria-checked', 'false');
    expect(checkboxes[0].className).toContain('rounded-md');
    expect(checkboxes[0].className).toContain('border');
    expect(checkboxes[0].className).toContain('bg-transparent');

    // Checkbox 2 (checked): aria-checked="true", transparent background, contains checkmark
    expect(checkboxes[1]).toHaveAttribute('aria-checked', 'true');
    expect(checkboxes[1].className).toContain('bg-transparent');
    expect(checkboxes[1].querySelector('svg')).toBeInTheDocument();
  });

  it('toggles item on click and triggers onChange', () => {
    const content: ChecklistBlockContent = {
      items: [{ id: 'item-1', text: 'Task 1', checked: false }],
    };
    const onChange = vi.fn();

    render(<ChecklistBlock content={content} onChange={onChange} />);

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      items: [{ id: 'item-1', text: 'Task 1', checked: true }],
    });
  });

  it('toggles item with Space or Enter key on the checkbox button', () => {
    const content: ChecklistBlockContent = {
      items: [{ id: 'item-1', text: 'Task 1', checked: false }],
    };
    const onChange = vi.fn();

    render(<ChecklistBlock content={content} onChange={onChange} />);

    const checkbox = screen.getByRole('checkbox');
    fireEvent.keyDown(checkbox, { key: ' ' });

    expect(onChange).toHaveBeenCalledWith({
      items: [{ id: 'item-1', text: 'Task 1', checked: true }],
    });
  });

  it('updates item text on input change', () => {
    const content: ChecklistBlockContent = {
      items: [{ id: 'item-1', text: 'Initial', checked: false }],
    };
    const onChange = vi.fn();

    render(<ChecklistBlock content={content} onChange={onChange} />);

    const textInput = screen.getByPlaceholderText('To-do item...');
    fireEvent.change(textInput, { target: { value: 'Updated text' } });

    expect(onChange).toHaveBeenCalledWith({
      items: [{ id: 'item-1', text: 'Updated text', checked: false }],
    });
  });

  it('inserts a new row and moves focus when Enter is pressed in an item input', () => {
    const content: ChecklistBlockContent = {
      items: [
        { id: 'item-1', text: 'First task', checked: false },
        { id: 'item-2', text: 'Second task', checked: false },
      ],
    };
    const onChange = vi.fn();

    render(<ChecklistBlock content={content} onChange={onChange} />);

    const inputs = screen.getAllByPlaceholderText('To-do item...');
    fireEvent.keyDown(inputs[0], { key: 'Enter' });

    expect(onChange).toHaveBeenCalledTimes(1);
    const updatedItems = onChange.mock.calls[0][0].items;
    expect(updatedItems.length).toBe(3);
    expect(updatedItems[0].id).toBe('item-1');
    expect(updatedItems[1].text).toBe('');
    expect(updatedItems[2].id).toBe('item-2');
  });

  it('removes empty item and triggers onChange when Backspace is pressed on empty item', () => {
    const content: ChecklistBlockContent = {
      items: [
        { id: 'item-1', text: 'First task', checked: false },
        { id: 'item-2', text: '', checked: false },
      ],
    };
    const onChange = vi.fn();

    render(<ChecklistBlock content={content} onChange={onChange} />);

    const inputs = screen.getAllByPlaceholderText('To-do item...');
    fireEvent.keyDown(inputs[1], { key: 'Backspace' });

    expect(onChange).toHaveBeenCalledWith({
      items: [{ id: 'item-1', text: 'First task', checked: false }],
    });
  });
});
