import { NoteDto, BlockDto, SpaceDto } from '@notebook/shared';
import { getToken, getServerUrl } from '../storage/authStorage';

export class MobileApiClient {
  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const serverUrl = await getServerUrl();
    const token = await getToken();
    const headers = new Headers(options.headers || {});

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }

    const cleanBase = serverUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanBase}/api${endpoint}`, {
      ...options,
      headers
    });

    if (!res.ok) {
      let errMsg = `Error ${res.status}`;
      try {
        const data = await res.json();
        if (data.error) errMsg = data.error;
      } catch {
        // ignore
      }
      throw new Error(errMsg);
    }

    if (res.status === 204) {
      return {} as T;
    }

    return await res.json();
  }

  public static async login(serverUrl: string, username: string, password: string): Promise<{ token: string; username: string }> {
    const cleanBase = serverUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
      throw new Error('Invalid credentials or server unreachable');
    }

    return await res.json();
  }

  public static async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  }

  public static async createUser(username: string, password: string, email?: string): Promise<{ token: string; username: string }> {
    return this.request<{ token: string; username: string }>('/auth/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, email })
    });
  }

  public static async forgotPassword(serverUrl: string, email: string): Promise<{ success: boolean; message: string; devCode?: string }> {
    const cleanBase = serverUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanBase}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (!res.ok) {
      throw new Error('Failed to request password reset');
    }
    return await res.json();
  }

  public static async resetPassword(serverUrl: string, email: string, code: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const cleanBase = serverUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanBase}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, newPassword })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to reset password');
    }
    return await res.json();
  }

  // Spaces
  public static async getSpaces(): Promise<SpaceDto[]> {
    return this.request<SpaceDto[]>('/spaces');
  }

  public static async createSpace(name: string, parentSpaceId?: string | null): Promise<SpaceDto> {
    return this.request<SpaceDto>('/spaces', {
      method: 'POST',
      body: JSON.stringify({ name, parentSpaceId: parentSpaceId ?? null })
    });
  }

  public static async updateSpace(id: string, updates: { name?: string; parentSpaceId?: string | null; position?: number; clearParent?: boolean }): Promise<SpaceDto> {
    const payload = {
      ...updates,
      clearParent: updates.clearParent ?? (updates.parentSpaceId === null)
    };
    return this.request<SpaceDto>(`/spaces/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  public static async deleteSpace(id: string): Promise<void> {
    return this.request<void>(`/spaces/${id}`, {
      method: 'DELETE'
    });
  }

  // Notes
  public static async getNotes(spaceId?: string | null): Promise<NoteDto[]> {
    const query = spaceId ? `?spaceId=${encodeURIComponent(spaceId)}` : '';
    return this.request<NoteDto[]>(`/notes${query}`);
  }

  public static async getNote(id: string): Promise<NoteDto> {
    return this.request<NoteDto>(`/notes/${id}`);
  }

  public static async createNote(title: string, color?: string, spaceId?: string | null): Promise<NoteDto> {
    return this.request<NoteDto>('/notes', {
      method: 'POST',
      body: JSON.stringify({ title, color, spaceId: spaceId ?? null })
    });
  }

  public static async moveNote(noteId: string, spaceId: string | null): Promise<NoteDto> {
    return this.request<NoteDto>(`/notes/${noteId}/move`, {
      method: 'PUT',
      body: JSON.stringify({ spaceId: spaceId ?? null })
    });
  }

  public static async updateNote(id: string, updates: Partial<NoteDto>): Promise<NoteDto> {
    return this.request<NoteDto>(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  public static async deleteNote(id: string): Promise<void> {
    return this.request<void>(`/notes/${id}`, {
      method: 'DELETE'
    });
  }

  public static async getBacklinks(noteId: string): Promise<NoteDto[]> {
    return this.request<NoteDto[]>(`/notes/${noteId}/backlinks`);
  }

  public static async searchNotes(query: string): Promise<NoteDto[]> {
    return this.request<NoteDto[]>(`/search?q=${encodeURIComponent(query)}`);
  }

  public static async addBlock(noteId: string, type: string, contentJson: string, position: number): Promise<BlockDto> {
    return this.request<BlockDto>(`/notes/${noteId}/blocks`, {
      method: 'POST',
      body: JSON.stringify({ type, contentJson, position })
    });
  }

  public static async patchBlock(id: string, updates: { contentJson?: string; position?: number }): Promise<BlockDto> {
    return this.request<BlockDto>(`/blocks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  public static async deleteBlock(id: string): Promise<void> {
    return this.request<void>(`/blocks/${id}`, {
      method: 'DELETE'
    });
  }

  public static async reorderBlocks(noteId: string, blockIds: string[]): Promise<void> {
    return this.request<void>(`/notes/${noteId}/blocks/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ blockIds })
    });
  }

  // Uploads
  public static async uploadImage(formData: FormData): Promise<{ url: string; filename: string; sizeBytes: number }> {
    return this.request<{ url: string; filename: string; sizeBytes: number }>('/uploads', {
      method: 'POST',
      body: formData
    });
  }
}
