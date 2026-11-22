import { describe, it, expect, vi } from 'vitest';
import { saveToken, getToken, clearToken, saveUsername, getUsername, clearUsername, saveDefaultView, getDefaultView } from '../src/storage/authStorage';

vi.mock('expo-secure-store', () => {
  const store: Record<string, string> = {};
  return {
    setItemAsync: vi.fn(async (k: string, v: string) => { store[k] = v; }),
    getItemAsync: vi.fn(async (k: string) => store[k] ?? null),
    deleteItemAsync: vi.fn(async (k: string) => { delete store[k]; })
  };
});

describe('authStorage', () => {
  it('saves and retrieves jwt securely', async () => {
    await saveToken('token-123');
    const token = await getToken();
    expect(token).toBe('token-123');
    await clearToken();
    expect(await getToken()).toBeNull();
  });

  it('saves, retrieves, and clears username securely', async () => {
    expect(await getUsername()).toBeNull();
    await saveUsername('alice');
    expect(await getUsername()).toBe('alice');
    await clearUsername();
    expect(await getUsername()).toBeNull();
  });

  it('saves and retrieves default opening view', async () => {
    expect(await getDefaultView()).toBeNull();
    await saveDefaultView('fullscreen');
    expect(await getDefaultView()).toBe('fullscreen');
    await saveDefaultView('compact');
    expect(await getDefaultView()).toBe('compact');
  });
});
