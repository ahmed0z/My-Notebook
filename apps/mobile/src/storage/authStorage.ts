import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'notebook_auth_token';
const SERVER_URL_KEY = 'notebook_server_url';
const USERNAME_KEY = 'notebook_username';
const THEME_KEY = 'notebook_theme';
export const DEFAULT_VIEW_KEY = 'notebook_default_view';

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function saveUsername(username: string): Promise<void> {
  await SecureStore.setItemAsync(USERNAME_KEY, username);
}

export async function getUsername(): Promise<string | null> {
  return await SecureStore.getItemAsync(USERNAME_KEY);
}

export async function clearUsername(): Promise<void> {
  await SecureStore.deleteItemAsync(USERNAME_KEY);
}

export async function saveServerUrl(url: string): Promise<void> {
  await SecureStore.setItemAsync(SERVER_URL_KEY, url);
}

export async function getServerUrl(): Promise<string> {
  const url = await SecureStore.getItemAsync(SERVER_URL_KEY);
  return url || 'http://mynotebook.runasp.net';
}

export async function saveTheme(theme: string): Promise<void> {
  await SecureStore.setItemAsync(THEME_KEY, theme);
}

export async function getTheme(): Promise<string | null> {
  return await SecureStore.getItemAsync(THEME_KEY);
}

export async function saveDefaultView(view: string): Promise<void> {
  await SecureStore.setItemAsync(DEFAULT_VIEW_KEY, view);
}

export async function getDefaultView(): Promise<string | null> {
  return await SecureStore.getItemAsync(DEFAULT_VIEW_KEY);
}
