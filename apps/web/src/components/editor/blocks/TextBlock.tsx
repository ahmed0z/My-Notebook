import React, { useState, useRef, useMemo } from 'react';
import { TextBlockContent, NoteDto } from '@notebook/shared';
import { ArrowUpRight } from 'lucide-react';
import { NoteAutocomplete } from '../NoteAutocomplete';
import { SlashCommandMenu, SlashCommandOption } from '../SlashCommandMenu';

interface TextBlockProps {
  content: TextBlockContent;
  onChange: (updated: TextBlockContent) => void;
  onOpenNote?: (noteIdOrTitle: string) => void;
  onSlashCommand?: (option: SlashCommandOption) => void;
  notes?: NoteDto[];
  autoFocus?: boolean;
}

export const TextBlock: React.FC<TextBlockProps> = ({
  content,
  onChange,
  onOpenNote,
  onSlashCommand,
  notes,
  autoFocus
}) => {
  const currentText = content?.text || '';
  const currentLevel = content?.level || 'paragraph';

  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const levelClasses = {
    paragraph: 'text-base font-normal text-stone-800 dark:text-stone-200',
    h1: 'text-2xl font-bold text-stone-900 dark:text-white',
    h2: 'text-xl font-semibold text-stone-900 dark:text-white',
    h3: 'text-lg font-medium text-stone-900 dark:text-stone-100'
  };

  // Detect completed [[Note Title]] links
  const detectedLinks = useMemo(() => {
    if (!currentText) return [];
    const matches = currentText.match(/\[\[(.*?)\]\]/g) || [];
    const titles = matches
      .map(m => m.slice(2, -2).trim())
      .filter(Boolean);
    return Array.from(new Set(titles));
  }, [currentText]);

  const checkTriggers = (text: string, cursorPos: number) => {
    const before = text.slice(0, cursorPos);

    // 1. Check [[ autocomplete
    const linkMatch = before.match(/\[\[([^\]\n]*)$/);
    if (linkMatch) {
      setShowAutocomplete(true);
      setAutocompleteQuery(linkMatch[1]);
      setShowSlashMenu(false);
      return;
    } else {
      setShowAutocomplete(false);
    }

    // 2. Check / slash command
    const slashMatch = before.match(/(?:^|\n)\/([a-zA-Z0-9]*)$/);
    if (slashMatch) {
      setShowSlashMenu(true);
      setSlashQuery(slashMatch[1]);
    } else {
      setShowSlashMenu(false);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange({ ...content, level: currentLevel, text: val });
    checkTriggers(val, e.target.selectionStart || val.length);
  };

  const handleCursorEvent = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    checkTriggers(currentText, target.selectionStart || currentText.length);
  };

  const handleSelectNote = (selectedTitle: string) => {
    const rawCursor = textareaRef.current?.selectionStart;
    const cursor = typeof rawCursor === 'number' && rawCursor > 0 ? rawCursor : currentText.length;
    let before = currentText.slice(0, cursor);
    let after = currentText.slice(cursor);

    let linkIndex = before.lastIndexOf('[[');
    if (linkIndex === -1) {
      linkIndex = currentText.lastIndexOf('[[');
      before = currentText.slice(0, linkIndex);
      after = currentText.slice(linkIndex + 2 + autocompleteQuery.length);
    }

    if (linkIndex !== -1) {
      const newBefore = before.slice(0, linkIndex) + `[[${selectedTitle}]]`;
      const newAfter = after.startsWith(']]') ? after.slice(2) : after.startsWith(']') ? after.slice(1) : after;
      const newText = newBefore + newAfter;
      onChange({ ...content, level: currentLevel, text: newText });
      setShowAutocomplete(false);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.selectionStart = newBefore.length;
          textareaRef.current.selectionEnd = newBefore.length;
        }
      }, 0);
    }
  };

  const handleSelectSlashCommand = (option: SlashCommandOption) => {
    setShowSlashMenu(false);
    // Remove the slash command text (e.g. "/todo" or "/")
    const cleanedText = currentText.replace(/(?:^|\n)\/([a-zA-Z0-9]*)$/, '').trim();

    if (option.type === 'text') {
      onChange({
        ...content,
        level: option.level || 'paragraph',
        text: cleanedText
      });
      setTimeout(() => textareaRef.current?.focus(), 0);
      return;
    }

    if (onSlashCommand) {
      onSlashCommand(option);
    }
  };

  const handleLinkClick = (title: string) => {
    if (!onOpenNote) return;
    if (notes && notes.length > 0) {
      const found = notes.find(n => n.title.toLowerCase() === title.toLowerCase());
      if (found) {
        onOpenNote(found.id);
        return;
      }
    }
    onOpenNote(title);
  };

  return (
    <div className="group/block relative w-full">
      {/* Text Area */}
      <textarea
        ref={textareaRef}
        autoFocus={autoFocus}
        value={currentText}
        placeholder={currentLevel === 'paragraph' ? 'Type something or type "/" for commands...' : 'Heading...'}
        aria-label="Text block content"
        onChange={handleTextChange}
        onFocus={handleCursorEvent}
        onClick={handleCursorEvent}
        onKeyUp={handleCursorEvent}
        rows={Math.max(1, currentText.split('\n').length)}
        className={`w-full bg-transparent resize-none border-none focus:outline-none placeholder-stone-400 dark:placeholder-stone-500 select-text ${levelClasses[currentLevel]}`}
      />

      {/* Slash Command Menu */}
      {showSlashMenu && (
        <div className="absolute top-8 left-0 z-50">
          <SlashCommandMenu
            filterText={slashQuery}
            onSelect={handleSelectSlashCommand}
            onClose={() => setShowSlashMenu(false)}
          />
        </div>
      )}

      {/* [[ Autocomplete Popup */}
      {showAutocomplete && (
        <NoteAutocomplete
          query={autocompleteQuery}
          notes={notes}
          onSelect={handleSelectNote}
          onClose={() => setShowAutocomplete(false)}
          position={{ top: 32, left: 0 }}
        />
      )}

      {/* Rendered Note Link Badges */}
      {detectedLinks.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-1" data-testid="text-block-links">
          {detectedLinks.map((title) => (
            <button
              key={title}
              type="button"
              data-testid={`note-link-${title}`}
              onClick={(e) => {
                e.stopPropagation();
                handleLinkClick(title);
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
              title={`Open note "${title}"`}
            >
              <span>[[{title}]]</span>
              <ArrowUpRight className="w-3 h-3 opacity-60" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
