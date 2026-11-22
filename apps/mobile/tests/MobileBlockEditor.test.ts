import { describe, it, expect } from 'vitest';
import { blockReducer, reorderBlocks } from '../src/components/editor/blockReducer';
import { BlockDto } from '@notebook/shared';

describe('blockReducer', () => {
  it('reorders blocks correctly when dragged', () => {
    const blocks: BlockDto[] = [
      { id: '1', noteId: 'n', type: 'text', content: { text: 'A', level: 'paragraph' }, position: 0, createdAt: '', updatedAt: '' },
      { id: '2', noteId: 'n', type: 'text', content: { text: 'B', level: 'paragraph' }, position: 1, createdAt: '', updatedAt: '' }
    ];
    const reordered = reorderBlocks(blocks, 0, 1);
    expect(reordered[0].id).toBe('2');
    expect(reordered[0].position).toBe(0);
    expect(reordered[1].id).toBe('1');
    expect(reordered[1].position).toBe(1);
  });

  it('updates a block content in state', () => {
    const blocks: BlockDto[] = [
      { id: '1', noteId: 'n', type: 'text', content: { text: 'Old', level: 'paragraph' }, position: 0, createdAt: '', updatedAt: '' }
    ];
    const updated = blockReducer(blocks, {
      type: 'UPDATE_BLOCK_CONTENT',
      payload: { id: '1', content: { text: 'New', level: 'paragraph' } }
    });
    expect((updated[0].content as any).text).toBe('New');
  });

  it('safely handles contentJson string from backend API payload', () => {
    const rawBackendBlock: any = {
      id: '1',
      noteId: 'n',
      type: 'text',
      contentJson: '{"text":"From backend","level":"h2"}',
      position: 0
    };
    const parsed = JSON.parse(rawBackendBlock.contentJson);
    expect(parsed.text).toBe('From backend');
    expect(parsed.level).toBe('h2');
  });
});
