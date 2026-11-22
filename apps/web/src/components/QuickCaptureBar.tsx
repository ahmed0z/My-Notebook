import React, { useState } from 'react';
import { Plus } from 'lucide-react';

interface QuickCaptureBarProps {
  onCreate: (title: string) => void;
}

export const QuickCaptureBar: React.FC<QuickCaptureBarProps> = ({ onCreate }) => {
  const [title, setTitle] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate(title.trim());
    setTitle('');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-xl mx-auto mb-8 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-sm hover:shadow-md transition-all p-2 flex items-center gap-2"
    >
      <input
        type="text"
        placeholder="Take a note..."
        aria-label="Take a note"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="flex-1 px-3 py-1.5 text-stone-900 dark:text-stone-100 bg-transparent placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none text-sm font-medium"
      />
      <button
        type="submit"
        disabled={!title.trim()}
        title="Create note"
        aria-label="Create note"
        className="p-2 rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 disabled:opacity-30 disabled:pointer-events-none hover:bg-stone-800 dark:hover:bg-stone-200 transition"
      >
        <Plus className="w-4 h-4" />
      </button>
    </form>
  );
};
