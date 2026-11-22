import React, { useState, useEffect, useRef } from 'react';
import { NoteDto, BlockDto, BlockType, SpaceDto } from '@notebook/shared';
import { ApiClient } from '../../api/client';
import { TextBlock } from './blocks/TextBlock';
import { ChecklistBlock } from './blocks/ChecklistBlock';
import { TableBlock } from './blocks/TableBlock';
import { ImageBlock } from './blocks/ImageBlock';
import { BacklinksPanel } from './BacklinksPanel';
import { EditorToolbar } from './EditorToolbar';
import { ColorPicker } from '../ColorPicker';
import { SlashCommandOption } from './SlashCommandMenu';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';
import {
  X,
  Palette,
  Trash2,
  Pin,
  Maximize2,
  Minimize2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Folder,
  Type,
  Heading1,
  Heading2,
  Heading3,
  CheckSquare,
  Table,
  Image as ImageIcon,
  Copy,
  FileText
} from 'lucide-react';

interface BlockEditorModalProps {
  note: NoteDto;
  onClose: () => void;
  onNoteUpdated: (updated: NoteDto) => void;
  onOpenNote?: (noteId: string) => void;
  onDeleteNote?: (noteId: string) => void;
  spaces?: SpaceDto[];
}

export const BlockEditorModal: React.FC<BlockEditorModalProps> = ({
  note: initialNote,
  onClose,
  onNoteUpdated,
  onOpenNote,
  onDeleteNote,
  spaces
}) => {
  const [note, setNote] = useState<NoteDto>(initialNote);
  const [blocks, setBlocks] = useState<BlockDto[]>([]);
  const [allNotes, setAllNotes] = useState<NoteDto[]>([]);
  const [spacesList, setSpacesList] = useState<SpaceDto[]>(spaces || []);
  const [showSpacePicker, setShowSpacePicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const { defaultView } = useSettings();
  const [isFullscreen, setIsFullscreen] = useState(defaultView === 'fullscreen');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [activeMenuBlockId, setActiveMenuBlockId] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const blockSaveTimers = useRef<Record<string, any>>({});
  const metaSaveTimer = useRef<any>(null);

  // Clean up debounce timers on unmount
  useEffect(() => {
    return () => {
      Object.values(blockSaveTimers.current).forEach(t => clearTimeout(t));
      if (metaSaveTimer.current) clearTimeout(metaSaveTimer.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeMenuBlockId) {
          setActiveMenuBlockId(null);
        } else if (isFullscreen) {
          setIsFullscreen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, activeMenuBlockId]);

  // Load full note with blocks
  useEffect(() => {
    let isMounted = true;
    const fetchNote = async () => {
      try {
        setLoading(true);
        const data = await ApiClient.getNote(initialNote.id);
        if (isMounted) {
          setNote(data);
          const loadedBlocks = data.blocks || [];
          setBlocks(prev => {
            if (prev.length > (initialNote.blocks?.length || 0)) {
              return prev;
            }
            return loadedBlocks;
          });
          onNoteUpdated(data);
          // If note is brand new or has 0 blocks, add a ready text block so user can type immediately
          if (loadedBlocks.length === 0) {
            setTimeout(() => {
              if (isMounted) handleAddBlock('text');
            }, 50);
          }
        }
      } catch (err) {
        console.error('Failed to load note blocks', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchNote();
    return () => { isMounted = false; };
  }, [initialNote.id]);

  // Load all notes for autocomplete & link resolving
  useEffect(() => {
    let isMounted = true;
    if (typeof ApiClient.getNotes === 'function') {
      Promise.resolve(ApiClient.getNotes())
        .then(data => {
          if (isMounted) setAllNotes(data || []);
        })
        .catch(err => console.error('Failed to load notes for links', err));
    }
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (typeof ApiClient.getSpaces === 'function') {
      Promise.resolve(ApiClient.getSpaces())
        .then(data => {
          if (isMounted && data) setSpacesList(data);
        })
        .catch(err => console.error('Failed to load spaces in modal', err));
    }
    return () => { isMounted = false; };
  }, []);

  const handleMoveToSpace = async (targetSpaceId: string | null) => {
    try {
      await ApiClient.moveNote(note.id, targetSpaceId);
      const updated = { ...note, spaceId: targetSpaceId };
      setNote(updated);
      onNoteUpdated(updated);
      setShowSpacePicker(false);
    } catch (err) {
      console.error('Failed to move note in modal', err);
    }
  };

  const handleOpenNote = async (targetIdOrTitle: string) => {
    let targetId = targetIdOrTitle;
    const found = allNotes.find(
      n => n.title.toLowerCase() === targetIdOrTitle.toLowerCase() || n.id === targetIdOrTitle
    );
    if (found) {
      targetId = found.id;
    }

    if (onOpenNote) {
      onOpenNote(targetId);
    } else {
      try {
        setLoading(true);
        const nextNote = await ApiClient.getNote(targetId);
        setNote(nextNote);
        setBlocks(nextNote.blocks || []);
        onNoteUpdated(nextNote);
      } catch (err) {
        console.error('Failed to open linked note', err);
      } finally {
        setLoading(false);
      }
    }
  };

  // Debounce helper for title and color
  const saveNoteMeta = async (updates: Partial<NoteDto>) => {
    setIsSaving(true);
    const updatedNote = { ...note, ...updates };
    // Optimistically update parent state immediately
    onNoteUpdated(updatedNote);
    try {
      const serverUpdated = await ApiClient.updateNote(note.id, updates);
      setNote(prev => ({ ...prev, ...serverUpdated }));
      onNoteUpdated({ ...updatedNote, ...serverUpdated });
      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to update note meta', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTitleChange = (newTitle: string) => {
    const updated = { ...note, title: newTitle };
    setNote(updated);
    onNoteUpdated(updated);

    if (metaSaveTimer.current) clearTimeout(metaSaveTimer.current);
    metaSaveTimer.current = setTimeout(() => {
      saveNoteMeta({ title: newTitle });
    }, 800);
  };

  const handleColorChange = (newColor: string) => {
    const updated = { ...note, color: newColor };
    setNote(updated);
    onNoteUpdated(updated);
    saveNoteMeta({ color: newColor });
  };

  const handlePinToggle = () => {
    const updatedPinned = !note.isPinned;
    const updated = { ...note, isPinned: updatedPinned };
    setNote(updated);
    onNoteUpdated(updated);
    saveNoteMeta({ isPinned: updatedPinned });
  };

  const handleDeleteCurrentNote = async () => {
    if (!window.confirm(`Delete "${note.title || 'Untitled Note'}"?`)) return;
    if (onDeleteNote) {
      onDeleteNote(note.id);
    } else {
      try {
        await ApiClient.deleteNote(note.id);
      } catch (err) {
        console.error('Failed to delete note', err);
      }
    }
    onClose();
  };

  const handleAddBlock = async (type: BlockType, extraContent?: any) => {
    let initialContentJson = '{}';
    if (type === 'text') {
      initialContentJson = JSON.stringify({
        text: extraContent?.text || '',
        level: extraContent?.level || 'paragraph'
      });
    } else if (type === 'checklist') {
      initialContentJson = JSON.stringify({
        items: [{ id: Math.random().toString(36).substring(2, 9), text: extraContent?.text || '', checked: false }]
      });
    } else if (type === 'table') {
      initialContentJson = JSON.stringify({
        columns: ['Column 1', 'Column 2'],
        rows: [['', '']]
      });
    } else if (type === 'image') {
      initialContentJson = JSON.stringify({
        url: extraContent?.url || '',
        caption: extraContent?.caption || ''
      });
    }

    try {
      setIsSaving(true);
      const newBlock = await ApiClient.addBlock(note.id, type, initialContentJson, blocks.length);
      const raw = (newBlock as any).contentJson ?? initialContentJson;
      let parsed: any = raw;
      if (typeof raw === 'string') {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = {};
        }
      }
      const normalizedBlock: any = {
        ...newBlock,
        contentJson: raw,
        content: parsed
      };

      setBlocks(prev => {
        const next = [...prev, normalizedBlock];
        onNoteUpdated({ ...note, blocks: next });
        return next;
      });
      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to add block', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBlockChange = (blockId: string, updatedContent: any) => {
    const contentJson = JSON.stringify(updatedContent);
    setBlocks(prev => {
      const updatedBlocks = prev.map(b =>
        b.id === blockId ? { ...b, content: updatedContent, contentJson } as any : b
      );
      onNoteUpdated({ ...note, blocks: updatedBlocks });
      return updatedBlocks;
    });

    // Debounced autosave
    if (blockSaveTimers.current[blockId]) {
      clearTimeout(blockSaveTimers.current[blockId]);
    }

    blockSaveTimers.current[blockId] = setTimeout(async () => {
      setIsSaving(true);
      try {
        await ApiClient.patchBlock(blockId, { contentJson });
        setLastSaved(new Date());
      } catch (err) {
        console.error('Failed to auto-save block', err);
      } finally {
        setIsSaving(false);
      }
    }, 800);
  };

  const handleDeleteBlock = async (blockId: string) => {
    setBlocks(prev => {
      const remaining = prev.filter(b => b.id !== blockId);
      onNoteUpdated({ ...note, blocks: remaining });
      return remaining;
    });

    try {
      await ApiClient.deleteBlock(blockId);
      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to delete block', err);
    }
  };

  const handleMoveBlock = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;

    const newBlocks = [...blocks];
    const [moved] = newBlocks.splice(index, 1);
    newBlocks.splice(targetIndex, 0, moved);

    setBlocks(newBlocks);
    onNoteUpdated({ ...note, blocks: newBlocks });

    try {
      await ApiClient.reorderBlocks(note.id, newBlocks.map(b => b.id));
      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to reorder blocks', err);
    }
  };

  const handleConvertBlock = async (
    blockId: string,
    targetType: BlockType,
    targetLevel?: 'paragraph' | 'h1' | 'h2' | 'h3'
  ) => {
    const blockIndex = blocks.findIndex(b => b.id === blockId);
    if (blockIndex === -1) return;
    const currentBlock = blocks[blockIndex];

    let rawContent: any = (currentBlock as any).contentJson ?? currentBlock.content;
    let parsedContent: any = rawContent;
    if (typeof rawContent === 'string') {
      try { parsedContent = JSON.parse(rawContent); } catch { parsedContent = {}; }
    }

    let extractedText = '';
    if (currentBlock.type === 'text') {
      extractedText = parsedContent?.text || '';
    } else if (currentBlock.type === 'checklist') {
      extractedText = (parsedContent?.items || []).map((i: any) => i.text).join('\n');
    } else if (currentBlock.type === 'table') {
      const cols = parsedContent?.columns || [];
      const rows = parsedContent?.rows || [];
      extractedText = [cols.join(' | '), ...rows.map((r: any[]) => r.join(' | '))].join('\n');
    } else if (currentBlock.type === 'image') {
      extractedText = parsedContent?.caption || '';
    }

    // If both source and target are 'text', update in-place without recreating block
    if (currentBlock.type === 'text' && targetType === 'text') {
      const newContent = { text: extractedText, level: targetLevel || 'paragraph' };
      handleBlockChange(blockId, newContent);
      setActiveMenuBlockId(null);
      return;
    }

    let newContentObj: any = {};
    if (targetType === 'text') {
      newContentObj = { text: extractedText, level: targetLevel || 'paragraph' };
    } else if (targetType === 'checklist') {
      const lines = extractedText.split('\n').filter((l: string) => l.trim().length > 0);
      const items = lines.length > 0
        ? lines.map((line: string) => ({ id: Math.random().toString(36).substring(2, 9), text: line, checked: false }))
        : [{ id: Math.random().toString(36).substring(2, 9), text: '', checked: false }];
      newContentObj = { items };
    } else if (targetType === 'table') {
      const lines = extractedText.split('\n').filter((l: string) => l.trim().length > 0);
      const rows = lines.length > 0 ? lines.map((l: string) => [l, '']) : [['', '']];
      newContentObj = { columns: ['Column 1', 'Column 2'], rows };
    } else if (targetType === 'image') {
      newContentObj = { url: '', caption: extractedText };
    }

    const contentJson = JSON.stringify(newContentObj);
    const tempId = `temp-${Date.now()}`;
    const convertedBlock: any = {
      ...currentBlock,
      id: tempId,
      type: targetType,
      content: newContentObj,
      contentJson
    };

    const nextBlocks = [...blocks];
    nextBlocks[blockIndex] = convertedBlock;
    setBlocks(nextBlocks);
    onNoteUpdated({ ...note, blocks: nextBlocks });
    setActiveMenuBlockId(null);

    try {
      setIsSaving(true);
      await ApiClient.deleteBlock(blockId);
      const created = await ApiClient.addBlock(note.id, targetType, contentJson, blockIndex);
      const finalBlock: any = {
        ...created,
        content: newContentObj,
        contentJson
      };
      const finalBlocks = nextBlocks.map(b => b.id === tempId ? finalBlock : b);
      setBlocks(finalBlocks);
      onNoteUpdated({ ...note, blocks: finalBlocks });
      await ApiClient.reorderBlocks(note.id, finalBlocks.map(b => b.id));
      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to convert block', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicateBlock = async (blockId: string) => {
    const blockIndex = blocks.findIndex(b => b.id === blockId);
    if (blockIndex === -1) return;
    const currentBlock = blocks[blockIndex];
    const rawContent = (currentBlock as any).contentJson ?? JSON.stringify(currentBlock.content);

    try {
      setIsSaving(true);
      const created = await ApiClient.addBlock(note.id, currentBlock.type, rawContent, blockIndex + 1);
      let parsed: any = rawContent;
      try { parsed = JSON.parse(rawContent); } catch { parsed = {}; }
      const newBlock: any = { ...created, content: parsed, contentJson: rawContent };

      const newBlocks = [...blocks];
      newBlocks.splice(blockIndex + 1, 0, newBlock);
      setBlocks(newBlocks);
      onNoteUpdated({ ...note, blocks: newBlocks });
      await ApiClient.reorderBlocks(note.id, newBlocks.map(b => b.id));
      setActiveMenuBlockId(null);
      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to duplicate block', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyBlockContent = async (block: BlockDto) => {
    let rawContent: any = (block as any).contentJson ?? block.content;
    let parsed: any = rawContent;
    if (typeof rawContent === 'string') {
      try { parsed = JSON.parse(rawContent); } catch { parsed = {}; }
    }
    let str = '';
    if (block.type === 'text') {
      str = parsed?.text || '';
    } else if (block.type === 'checklist') {
      str = (parsed?.items || []).map((i: any) => `${i.checked ? '[x]' : '[ ]'} ${i.text}`).join('\n');
    } else if (block.type === 'table') {
      const cols = parsed?.columns || [];
      const rows = parsed?.rows || [];
      str = [cols.join('\t'), ...rows.map((r: any[]) => r.join('\t'))].join('\n');
    } else if (block.type === 'image') {
      str = parsed?.url || parsed?.caption || '';
    }
    if (str && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(str);
      } catch (err) {
        console.error('Failed to copy to clipboard', err);
      }
    }
    setActiveMenuBlockId(null);
  };

  // Drag and drop block reordering - initiated strictly via 6-dots handle
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      if (typeof e.dataTransfer.setData === 'function') {
        e.dataTransfer.setData('text/plain', String(index));
      }
    }
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleContainerDragLeave = (e: React.DragEvent) => {
    if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = draggedIndex;
    setDragOverIndex(null);
    setDraggedIndex(null);
    if (
      sourceIndex === null ||
      sourceIndex === targetIndex ||
      (sourceIndex === blocks.length - 1 && targetIndex >= blocks.length)
    ) {
      return;
    }

    const newBlocks = [...blocks];
    const [moved] = newBlocks.splice(sourceIndex, 1);
    const insertIndex = targetIndex >= newBlocks.length ? newBlocks.length : targetIndex;
    newBlocks.splice(insertIndex, 0, moved);

    setBlocks(newBlocks);
    onNoteUpdated({ ...note, blocks: newBlocks });

    try {
      await ApiClient.reorderBlocks(note.id, newBlocks.map(b => b.id));
      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to reorder blocks', err);
    }
  };

  // Slash command handler
  const handleSlashCommand = (blockId: string, option: SlashCommandOption) => {
    if (option.type === 'text') {
      handleBlockChange(blockId, { text: '', level: option.level || 'paragraph' });
      return;
    }
    // For checklist, table, image: convert block or add new block
    handleDeleteBlock(blockId);
    handleAddBlock(option.type);
  };

  // Canvas click to add block anywhere (Notion style)
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget && (e.target as HTMLElement).closest('button, input, textarea, a, table, th, td')) {
      return;
    }
    if (blocks.length === 0) {
      handleAddBlock('text');
      return;
    }
    const last = blocks[blocks.length - 1];
    let lastContent = (last as any).content ?? {};
    if (typeof lastContent === 'string') {
      try { lastContent = JSON.parse(lastContent); } catch { lastContent = {}; }
    }
    if (last.type === 'text' && !lastContent.text) {
      return; // Already an empty text block waiting
    }
    handleAddBlock('text');
  };

  const { isDark, getNoteCardColor } = useTheme();
  const modalBg = getNoteCardColor(note.color, isDark);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-all"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: modalBg }}
        className={`relative w-full flex flex-col shadow-2xl transition-all duration-200 border border-stone-200/80 dark:border-stone-800 ${
          isFullscreen
            ? 'h-full w-full rounded-none sm:rounded-none'
            : 'max-w-3xl h-full sm:h-[90vh] sm:rounded-3xl rounded-none'
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:px-8 border-b border-stone-200/40 dark:border-stone-800/60 transition-colors">
          <input
            type="text"
            value={note.title}
            placeholder="Title"
            aria-label="Note title"
            onChange={(e) => handleTitleChange(e.target.value)}
            className="text-xl sm:text-2xl font-bold bg-transparent border-none focus:outline-none w-full text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500"
          />

          <div className="flex items-center gap-1 sm:gap-1.5 ml-2">
            <button
              type="button"
              onClick={handlePinToggle}
              title={note.isPinned ? 'Unpin' : 'Pin note'}
              aria-label={note.isPinned ? 'Unpin' : 'Pin note'}
              className={`p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition ${note.isPinned ? 'text-stone-900 dark:text-stone-100' : 'text-stone-400 dark:text-stone-500'}`}
            >
              <Pin className={`w-4 h-4 ${note.isPinned ? 'fill-stone-900 dark:fill-stone-100' : ''}`} />
            </button>

            {/* Color Palette */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColorPicker(!showColorPicker)}
                title="Color palette"
                aria-label="Change color"
                className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-stone-500 dark:text-stone-400 transition"
              >
                <Palette className="w-4 h-4" />
              </button>
              {showColorPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowColorPicker(false)} />
                  <div className="absolute top-12 right-0 z-50">
                    <ColorPicker
                      currentColor={note.color}
                      onSelectColor={(hex) => {
                        handleColorChange(hex);
                        setShowColorPicker(false);
                      }}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Space Picker */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSpacePicker(!showSpacePicker)}
                title="Move to space"
                aria-label="Move to space"
                className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-stone-500 dark:text-stone-400 transition flex items-center gap-1.5"
              >
                <Folder className="w-4 h-4" />
                {note.spaceId && (
                  <span className="text-xs font-medium max-w-[90px] truncate hidden sm:inline">
                    {spacesList.find(s => s.id === note.spaceId)?.name || 'Space'}
                  </span>
                )}
              </button>
              {showSpacePicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSpacePicker(false)} />
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-12 right-0 z-50 w-48 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl shadow-xl p-1.5 text-xs text-stone-800 dark:text-stone-200 max-h-60 overflow-y-auto"
                  >
                    <div className="px-2 py-1 font-semibold text-stone-400 dark:text-stone-500 uppercase text-[10px] tracking-wider">
                      Move to space
                    </div>
                    <button
                      type="button"
                      onClick={() => handleMoveToSpace(null)}
                      className={`w-full text-left px-2 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-1.5 ${
                        !note.spaceId ? 'font-semibold text-amber-600 dark:text-amber-400' : ''
                      }`}
                    >
                      <span>No space (General)</span>
                    </button>
                    {spacesList.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleMoveToSpace(s.id)}
                        className={`w-full text-left px-2 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-1.5 ${
                          note.spaceId === s.id ? 'font-semibold text-amber-600 dark:text-amber-400' : ''
                        }`}
                      >
                        <Folder className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span className="truncate">{s.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Delete Note */}
            <button
              type="button"
              onClick={handleDeleteCurrentNote}
              title="Delete note"
              aria-label="Delete note"
              className="p-2 rounded-xl hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 text-stone-400 dark:text-stone-500 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Exit full screen' : 'Full screen'}
              aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
              className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              title="Close"
              aria-label="Close"
              className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Block List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8 pb-32 flex flex-col">
          <div className={`flex-1 flex flex-col ${isFullscreen ? 'max-w-4xl mx-auto w-full' : 'w-full'}`}>
            {loading ? (
              <div className="py-12 text-center text-xs text-stone-400 dark:text-stone-500">Loading blocks...</div>
            ) : (
              <div className="space-y-3" onDragLeave={handleContainerDragLeave}>
                {blocks.map((block, idx) => {
                  let rawContent: any = (block as any).contentJson ?? block.content;
                  let parsedContent: any = rawContent;
                  if (typeof rawContent === 'string') {
                    try {
                      parsedContent = JSON.parse(rawContent);
                    } catch {
                      parsedContent = {};
                    }
                  }
                  if (!parsedContent || typeof parsedContent !== 'object') {
                    parsedContent = {};
                  }

                  if (block.type === 'text') {
                    parsedContent = { text: parsedContent.text || '', level: parsedContent.level || 'paragraph' };
                  } else if (block.type === 'checklist') {
                    parsedContent = { items: Array.isArray(parsedContent.items) ? parsedContent.items : [{ id: '1', text: '', checked: false }] };
                  } else if (block.type === 'table') {
                    parsedContent = {
                      columns: Array.isArray(parsedContent.columns) && parsedContent.columns.length ? parsedContent.columns : ['Column 1', 'Column 2'],
                      rows: Array.isArray(parsedContent.rows) && parsedContent.rows.length ? parsedContent.rows : [['', '']]
                    };
                  } else if (block.type === 'image') {
                    parsedContent = { url: parsedContent.url || '', caption: parsedContent.caption || '' };
                  }

                  const isMenuOpen = activeMenuBlockId === block.id;

                  return (
                    <React.Fragment key={block.id}>
                      {dragOverIndex === idx && draggedIndex !== null && draggedIndex > idx && (
                        <div
                          data-testid="drag-indicator-line"
                          className="h-0.5 bg-blue-500 rounded-full mx-2 my-0.5 transition-all"
                        />
                      )}
                      <div
                        data-testid="block-wrapper"
                        data-block-id={block.id}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDrop={(e) => handleDrop(e, idx)}
                        className={`group relative flex items-start gap-1 p-1 rounded-xl transition-all ${
                          draggedIndex === idx ? 'opacity-40 border-2 border-dashed border-stone-300 dark:border-stone-700' : ''
                        }`}
                      >
                        {/* Notion Style Grip Handle & Menu (delete inside menu) */}
                        <div className="relative pt-1 flex items-center">
                          <button
                            type="button"
                            draggable={true}
                            data-drag-handle="true"
                            onDragStart={(e) => handleDragStart(e, idx)}
                            onDragEnd={handleDragEnd}
                            onClick={() => setActiveMenuBlockId(isMenuOpen ? null : block.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200 cursor-grab active:cursor-grabbing hover:bg-stone-200/50 dark:hover:bg-stone-800 transition"
                            title="Drag to move or click for options"
                            aria-label="Drag to move or click for options"
                          >
                            <GripVertical className="w-3.5 h-3.5 pointer-events-none" />
                          </button>

                          {/* Block Options Popover */}
                          {isMenuOpen && (
                            <>
                              <div className="fixed inset-0 z-30" onClick={() => setActiveMenuBlockId(null)} />
                              <div
                                data-testid="block-options-menu"
                                className="absolute left-6 top-0 z-40 w-48 bg-white dark:bg-stone-900 rounded-xl shadow-2xl border border-stone-200/90 dark:border-stone-800 p-1.5 text-xs space-y-1 animate-in fade-in zoom-in-95 duration-100"
                              >
                                <div className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                                  Turn Into
                                </div>
                                <div className="space-y-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleConvertBlock(block.id, 'text', 'paragraph')}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 text-left transition"
                                  >
                                    <Type className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                                    <span>Text</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleConvertBlock(block.id, 'text', 'h1')}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 text-left transition"
                                  >
                                    <Heading1 className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                                    <span>Heading 1</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleConvertBlock(block.id, 'text', 'h2')}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 text-left transition"
                                  >
                                    <Heading2 className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                                    <span>Heading 2</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleConvertBlock(block.id, 'text', 'h3')}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 text-left transition"
                                  >
                                    <Heading3 className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                                    <span>Heading 3</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleConvertBlock(block.id, 'checklist')}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 text-left transition"
                                  >
                                    <CheckSquare className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                                    <span>To-Do list</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleConvertBlock(block.id, 'table')}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 text-left transition"
                                  >
                                    <Table className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                                    <span>Table</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleConvertBlock(block.id, 'image')}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 text-left transition"
                                  >
                                    <ImageIcon className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                                    <span>Image</span>
                                  </button>
                                </div>

                                <div className="h-px bg-stone-100 dark:bg-stone-800 my-1" />

                                <div className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                                  Actions
                                </div>
                                <div className="space-y-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleDuplicateBlock(block.id)}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 text-left transition"
                                  >
                                    <Copy className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                                    <span>Duplicate</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyBlockContent(block)}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 text-left transition"
                                  >
                                    <FileText className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                                    <span>Copy content</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => {
                                      handleMoveBlock(idx, 'up');
                                      setActiveMenuBlockId(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-30 text-left transition"
                                  >
                                    <ChevronUp className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                                    <span>Move up</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === blocks.length - 1}
                                    onClick={() => {
                                      handleMoveBlock(idx, 'down');
                                      setActiveMenuBlockId(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-30 text-left transition"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                                    <span>Move down</span>
                                  </button>
                                </div>

                                <div className="h-px bg-stone-100 dark:bg-stone-800 my-1" />

                                <button
                                  type="button"
                                  onClick={() => {
                                    handleDeleteBlock(block.id);
                                    setActiveMenuBlockId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-left font-medium transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>Delete block</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>

                      {/* Block Component */}
                      <div className="flex-1 min-w-0">
                        {block.type === 'text' && (
                          <TextBlock
                            content={parsedContent}
                            onChange={(updated) => handleBlockChange(block.id, updated)}
                            onSlashCommand={(opt) => handleSlashCommand(block.id, opt)}
                            notes={allNotes}
                            onOpenNote={handleOpenNote}
                          />
                        )}
                        {block.type === 'checklist' && (
                          <ChecklistBlock
                            content={parsedContent}
                            onChange={(updated) => handleBlockChange(block.id, updated)}
                          />
                        )}
                        {block.type === 'table' && (
                          <TableBlock
                            content={parsedContent}
                            onChange={(updated) => handleBlockChange(block.id, updated)}
                          />
                        )}
                        {block.type === 'image' && (
                          <ImageBlock
                            content={parsedContent}
                            onChange={(updated) => handleBlockChange(block.id, updated)}
                            onDelete={() => handleDeleteBlock(block.id)}
                          />
                        )}
                      </div>
                    </div>
                    {((dragOverIndex === idx && draggedIndex !== null && draggedIndex < idx) ||
                      (idx === blocks.length - 1 && dragOverIndex === blocks.length && draggedIndex !== null && draggedIndex !== blocks.length - 1)) && (
                      <div
                        data-testid="drag-indicator-line"
                        className="h-0.5 bg-blue-500 rounded-full mx-2 my-0.5 transition-all"
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {/* Click anywhere below to add block (Notion style) */}
          <div
            data-testid="block-canvas-area"
            className="flex-1 min-h-[140px] cursor-text pb-20 pt-4"
            onClick={handleCanvasClick}
            onDragOver={(e) => {
              if (draggedIndex !== null) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragOverIndex(blocks.length);
              }
            }}
            onDragLeave={(e) => {
              if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) {
                if (dragOverIndex === blocks.length) {
                  setDragOverIndex(null);
                }
              }
            }}
            onDrop={(e) => {
              if (draggedIndex !== null) {
                handleDrop(e, blocks.length);
              }
            }}
          >
              {blocks.length === 0 && !loading && (
                <p className="text-stone-400 dark:text-stone-500 text-sm italic select-none">
                  Click here or type '/' for commands...
                </p>
              )}
            </div>

            {/* Inline Toolbar */}
            <div className="flex justify-center py-4">
              <EditorToolbar
                onAddBlock={handleAddBlock}
                isSaving={isSaving}
                lastSaved={lastSaved}
              />
            </div>

            {/* Backlinks panel */}
            <BacklinksPanel
              noteId={note.id}
              onOpenNote={handleOpenNote}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
