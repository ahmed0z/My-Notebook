import { BlockDto, BlockContent } from '@notebook/shared';

export type BlockAction =
  | { type: 'SET_BLOCKS'; payload: BlockDto[] }
  | { type: 'ADD_BLOCK'; payload: BlockDto }
  | { type: 'UPDATE_BLOCK_CONTENT'; payload: { id: string; content: BlockContent } }
  | { type: 'DELETE_BLOCK'; payload: string }
  | { type: 'REORDER_BLOCKS'; payload: { fromIndex: number; toIndex: number } };

export function reorderBlocks(blocks: BlockDto[], fromIndex: number, toIndex: number): BlockDto[] {
  if (fromIndex < 0 || fromIndex >= blocks.length || toIndex < 0 || toIndex >= blocks.length) {
    return blocks;
  }
  const result = [...blocks];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result.map((b, idx) => ({ ...b, position: idx }));
}

export function blockReducer(state: BlockDto[], action: BlockAction): BlockDto[] {
  switch (action.type) {
    case 'SET_BLOCKS':
      return [...action.payload].sort((a, b) => a.position - b.position);

    case 'ADD_BLOCK':
      return [...state, action.payload].map((b, idx) => ({ ...b, position: idx }));

    case 'UPDATE_BLOCK_CONTENT':
      return state.map(b =>
        b.id === action.payload.id ? { ...b, content: action.payload.content } : b
      );

    case 'DELETE_BLOCK':
      return state
        .filter(b => b.id !== action.payload)
        .map((b, idx) => ({ ...b, position: idx }));

    case 'REORDER_BLOCKS':
      return reorderBlocks(state, action.payload.fromIndex, action.payload.toIndex);

    default:
      return state;
  }
}
