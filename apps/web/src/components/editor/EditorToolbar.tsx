import React from 'react';
import { Type, CheckSquare, Table, Image as ImageIcon, Check, Loader2 } from 'lucide-react';
import { BlockType } from '@notebook/shared';

interface EditorToolbarProps {
  onAddBlock: (type: BlockType) => void;
  isSaving: boolean;
  lastSaved: Date | null;
  className?: string;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  onAddBlock,
  isSaving,
  lastSaved,
  className = ''
}) => {
  return (
    <div
      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/90 dark:bg-stone-900/90 backdrop-blur-md border border-stone-200/80 dark:border-stone-800 shadow-lg shadow-stone-950/5 text-xs text-stone-600 dark:text-stone-300 transition-all ${className}`}
    >
      <button
        type="button"
        onClick={() => onAddBlock('text')}
        title="Add text block (or type '/' inside note)"
        className="flex items-center gap-1 px-2.5 py-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition text-stone-700 dark:text-stone-300 font-medium"
      >
        <Type className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
        <span>Text</span>
      </button>

      <button
        type="button"
        onClick={() => onAddBlock('checklist')}
        title="Add to-do list"
        className="flex items-center gap-1 px-2.5 py-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition text-stone-700 dark:text-stone-300 font-medium"
      >
        <CheckSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        <span>To-Do</span>
      </button>

      <button
        type="button"
        onClick={() => onAddBlock('table')}
        title="Add table"
        className="flex items-center gap-1 px-2.5 py-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition text-stone-700 dark:text-stone-300 font-medium"
      >
        <Table className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        <span>Table</span>
      </button>

      <button
        type="button"
        onClick={() => onAddBlock('image')}
        title="Add image"
        className="flex items-center gap-1 px-2.5 py-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition text-stone-700 dark:text-stone-300 font-medium"
      >
        <ImageIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
        <span>Image</span>
      </button>

      <div className="h-3.5 w-px bg-stone-200 dark:border-stone-800 mx-1" />

      <div className="flex items-center gap-1 pl-1 pr-1 text-stone-400 dark:text-stone-500" aria-live="polite">
        {isSaving ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin text-stone-500 dark:text-stone-400" aria-hidden="true" />
            <span className="text-[11px]">Saving...</span>
          </>
        ) : lastSaved ? (
          <>
            <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <span className="text-[11px] text-stone-400 dark:text-stone-500">Saved</span>
          </>
        ) : (
          <span className="text-[11px] text-stone-400 dark:text-stone-500">Ready</span>
        )}
      </div>
    </div>
  );
};
