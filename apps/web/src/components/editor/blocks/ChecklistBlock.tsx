import React, { useState, useRef, useEffect } from 'react';
import { ChecklistBlockContent, ChecklistItem } from '@notebook/shared';
import { Plus, X, Check } from 'lucide-react';

interface ChecklistBlockProps {
  content: ChecklistBlockContent;
  onChange: (updated: ChecklistBlockContent) => void;
}

export const ChecklistBlock: React.FC<ChecklistBlockProps> = ({ content, onChange }) => {
  const items = content?.items || [];
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (focusedItemId && inputRefs.current[focusedItemId]) {
      inputRefs.current[focusedItemId]?.focus();
      setFocusedItemId(null);
    }
  }, [focusedItemId, items]);

  const toggleItem = (id: string) => {
    const updated = items.map(it => it.id === id ? { ...it, checked: !it.checked } : it);
    onChange({ items: updated });
  };

  const updateItemText = (id: string, text: string) => {
    const updated = items.map(it => it.id === id ? { ...it, text } : it);
    onChange({ items: updated });
  };

  const removeItem = (id: string) => {
    const updated = items.filter(it => it.id !== id);
    onChange({ items: updated });
  };

  const insertItemAfter = (index: number) => {
    const newItem: ChecklistItem = {
      id: Math.random().toString(36).substring(2, 9),
      text: '',
      checked: false
    };
    const updated = [...items];
    updated.splice(index + 1, 0, newItem);
    onChange({ items: updated });
    setFocusedItemId(newItem.id);
  };

  const addItem = () => {
    const newItem: ChecklistItem = {
      id: Math.random().toString(36).substring(2, 9),
      text: '',
      checked: false
    };
    onChange({ items: [...items, newItem] });
    setFocusedItemId(newItem.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number, item: ChecklistItem) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      insertItemAfter(index);
    } else if (e.key === 'Backspace' && item.text === '' && items.length > 1) {
      e.preventDefault();
      const prevItem = items[index - 1];
      removeItem(item.id);
      if (prevItem) {
        setFocusedItemId(prevItem.id);
      }
    }
  };

  return (
    <div className="space-y-1.5 w-full">
      {items.map((it, idx) => (
        <div key={it.id} className="group/item flex items-center gap-2">
          <button
            type="button"
            role="checkbox"
            aria-checked={it.checked}
            aria-label={it.text || 'To-do item'}
            onClick={() => toggleItem(it.id)}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                toggleItem(it.id);
              }
            }}
            className="w-4 h-4 rounded-md border border-black/40 dark:border-stone-500 bg-transparent flex items-center justify-center shrink-0 cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-black/40 dark:focus:ring-stone-500"
          >
            {it.checked && <Check className="w-3 h-3 text-stone-900 dark:text-stone-300" strokeWidth={3} />}
          </button>
          <input
            ref={(el) => {
              inputRefs.current[it.id] = el;
            }}
            type="text"
            value={it.text}
            placeholder="To-do item..."
            onChange={(e) => updateItemText(it.id, e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, idx, it)}
            className={`flex-1 bg-transparent border-none focus:outline-none text-sm text-stone-900 dark:text-stone-100 placeholder:text-black/45 dark:placeholder:text-stone-500 ${
              it.checked ? 'line-through text-black/45 dark:text-stone-500' : ''
            }`}
          />
          <button
            type="button"
            onClick={() => removeItem(it.id)}
            title="Delete item"
            aria-label="Delete item"
            className="opacity-0 group-hover/item:opacity-100 p-1 rounded text-black/45 dark:text-stone-500 hover:text-red-600 dark:hover:text-red-400 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addItem}
        aria-label="Add to-do item"
        className="flex items-center gap-1.5 text-xs text-black/65 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 pt-1 font-medium"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Add to-do item</span>
      </button>
    </div>
  );
};
