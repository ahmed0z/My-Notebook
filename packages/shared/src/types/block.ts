import { ImageBlockContent } from './imageBlock.js';

export type BlockType = 'text' | 'checklist' | 'table' | 'image';

export interface TextBlockContent {
  text: string;
  level: 'paragraph' | 'h1' | 'h2' | 'h3';
}

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface ChecklistBlockContent {
  items: ChecklistItem[];
}

export interface TableBlockContent {
  columns: string[];
  rows: string[][];
  columnWidths?: number[];
  rowHeights?: number[];
  hasHeaderRow?: boolean;
  hasHeaderColumn?: boolean;
  fitToWidth?: boolean;
}

export type BlockContent = TextBlockContent | ChecklistBlockContent | TableBlockContent | ImageBlockContent;

export interface BlockDto {
  id: string;
  noteId: string;
  type: BlockType;
  content: BlockContent;
  position: number;
  createdAt: string;
  updatedAt: string;
}
