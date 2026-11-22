import { NoteDto, BlockDto, SpaceDto } from '@notebook/shared';

const API_BASE = '/api';

export class ApiClient {
  private static token: string | null = localStorage.getItem('notebook_token');

  public static setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('notebook_token', token);
    } else {
      localStorage.removeItem('notebook_token');
    }
  }

  public static getToken(): string | null {
    return this.token;
  }

  public static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }
    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (res.status === 401) {
      this.setToken(null);
      window.dispatchEvent(new CustomEvent('auth:expired'));
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      let errMsg = `Request failed: ${res.status}`;
      try {
        const data = await res.json();
        if (data.error) errMsg = data.error;
      } catch {
        // ignore json parse error
      }
      throw new Error(errMsg);
    }

    if (res.status === 204) {
      return {} as T;
    }

    return await res.json();
  }

  // Auth
  public static async getAuthStatus(): Promise<{ isConfigured: boolean }> {
    return this.request<{ isConfigured: boolean }>('/auth/status');
  }

  public static async register(username: string, email: string, password: string): Promise<{ token: string; username: string; email?: string | null; avatarUrl?: string | null }> {
    const data = await this.request<{ token: string; username: string; email?: string | null; avatarUrl?: string | null }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password })
    });
    this.setToken(data.token);
    return data;
  }

  public static async setup(username: string, password: string): Promise<{ token: string; username: string; email?: string | null; avatarUrl?: string | null }> {
    const data = await this.request<{ token: string; username: string; email?: string | null; avatarUrl?: string | null }>('/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    this.setToken(data.token);
    return data;
  }

  public static async login(username: string, password: string): Promise<{ token: string; username: string; email?: string | null; avatarUrl?: string | null }> {
    const data = await this.request<{ token: string; username: string; email?: string | null; avatarUrl?: string | null }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    this.setToken(data.token);
    return data;
  }

  public static async getProfile(): Promise<{ id: string; username: string; email?: string | null; avatarUrl?: string | null; createdAt: string }> {
    return this.request<{ id: string; username: string; email?: string | null; avatarUrl?: string | null; createdAt: string }>('/auth/profile');
  }

  public static async updateProfile(data: { username?: string; avatarUrl?: string | null; email?: string | null }): Promise<{ token: string; username: string; email?: string | null; avatarUrl?: string | null }> {
    const res = await this.request<{ token: string; username: string; email?: string | null; avatarUrl?: string | null }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  public static async requestPasswordCode(): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/auth/request-password-code', {
      method: 'POST'
    });
  }

  public static async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  }

  public static async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  public static async resetPassword(email: string, code: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, code, newPassword })
    });
  }

  public static async updateEmail(email: string): Promise<{ success: boolean; email: string }> {
    return this.request<{ success: boolean; email: string }>('/auth/email', {
      method: 'PUT',
      body: JSON.stringify({ email })
    });
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

  // Blocks
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
  public static async uploadImage(file: File): Promise<{ url: string; filename: string; sizeBytes: number }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<{ url: string; filename: string; sizeBytes: number }>('/uploads', {
      method: 'POST',
      body: formData
    });
  }
}
