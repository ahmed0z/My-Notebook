import { BlockDto } from './block.js';

export interface NoteDto {
  id: string;
  title: string;
  color: string;
  position: number;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  blocks?: BlockDto[];
  spaceId?: string | null;
}
