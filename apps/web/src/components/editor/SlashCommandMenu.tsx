import React, { useEffect, useState, useRef } from 'react';
import { Type, Heading1, Heading2, Heading3, CheckSquare, Table, Image as ImageIcon } from 'lucide-react';
import { BlockType } from '@notebook/shared';

export interface SlashCommandOption {
  id: string;
  type: BlockType;
  title: string;
  description: string;
  icon: React.ReactNode;
  level?: 'paragraph' | 'h1' | 'h2' | 'h3';
  keywords: string[];
}

export const SLASH_COMMANDS: SlashCommandOption[] = [
  {
    id: 'text',
    type: 'text',
    level: 'paragraph',
    title: 'Text',
    description: 'Just start writing with plain text.',
    icon: <Type className="w-4 h-4 text-stone-500 dark:text-stone-400" />,
    keywords: ['text', 'paragraph', 'plain']
  },
  {
    id: 'h1',
    type: 'text',
    level: 'h1',
    title: 'Heading 1',
    description: 'Large section heading.',
    icon: <Heading1 className="w-4 h-4 text-stone-700 dark:text-stone-300" />,
    keywords: ['heading1', 'h1', 'title', 'large']
  },
  {
    id: 'h2',
    type: 'text',
    level: 'h2',
    title: 'Heading 2',
    description: 'Medium section heading.',
    icon: <Heading2 className="w-4 h-4 text-stone-600 dark:text-stone-400" />,
    keywords: ['heading2', 'h2', 'subtitle', 'medium']
  },
  {
    id: 'h3',
    type: 'text',
    level: 'h3',
    title: 'Heading 3',
    description: 'Small section heading.',
    icon: <Heading3 className="w-4 h-4 text-stone-500 dark:text-stone-400" />,
    keywords: ['heading3', 'h3', 'subheading', 'small']
  },
  {
    id: 'checklist',
    type: 'checklist',
    title: 'To-do list',
    description: 'Track tasks with a checklist.',
    icon: <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
    keywords: ['todo', 'task', 'check', 'checklist']
  },
  {
    id: 'table',
    type: 'table',
    title: 'Table',
    description: 'Add a simple structured table.',
    icon: <Table className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
    keywords: ['table', 'grid', 'columns', 'rows']
  },
  {
    id: 'image',
    type: 'image',
    title: 'Image',
    description: 'Upload or embed with a link.',
    icon: <ImageIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />,
    keywords: ['image', 'photo', 'picture', 'upload']
  }
];

interface SlashCommandMenuProps {
  filterText: string;
  onSelect: (option: SlashCommandOption) => void;
  onClose: () => void;
  className?: string;
}

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  filterText,
  onSelect,
  onClose,
  className = ''
}) => {
  const query = filterText.toLowerCase().trim();
  const filtered = SLASH_COMMANDS.filter(cmd =>
    cmd.title.toLowerCase().includes(query) ||
    cmd.keywords.some(k => k.toLowerCase().includes(query))
  );

  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filterText]);

  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (filtered.length === 0) {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filtered, selectedIndex, onSelect, onClose]);

  if (filtered.length === 0) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className={`w-72 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-stone-200/80 dark:border-stone-800 p-1.5 z-50 overflow-hidden ${className}`}
    >
      <div className="px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase text-stone-400 dark:text-stone-500">
        Basic blocks
      </div>
      <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-0.5">
        {filtered.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={item.id}
              ref={el => { itemRefs.current[idx] = el; }}
              type="button"
              onClick={() => onSelect(item)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors ${
                isSelected
                  ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-850'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center flex-shrink-0 border border-stone-200/50 dark:border-stone-700/50">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold leading-tight">{item.title}</div>
                <div className="text-[11px] text-stone-400 dark:text-stone-500 truncate">{item.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
