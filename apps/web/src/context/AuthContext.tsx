import React, { createContext, useContext, useState, useEffect } from 'react';
import { ApiClient } from '../api/client';

interface AuthContextType {
  token: string | null;
  username: string | null;
  email: string | null;
  avatarUrl: string | null;
  isConfigured: boolean | null;
  isLoading: boolean;
  serverWaking: boolean;
  login: (token: string, username: string, email?: string | null, avatarUrl?: string | null) => void;
  updateUser: (username: string, email?: string | null, avatarUrl?: string | null, newToken?: string | null) => void;
  logout: () => void;
  checkStatus: () => Promise<void>;
  fetchProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(ApiClient.getToken());
  const [username, setUsername] = useState<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('notebook_username') : null
  );
  const [email, setEmail] = useState<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('notebook_email') : null
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('notebook_avatar') : null
  );
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [serverWaking, setServerWaking] = useState<boolean>(false);

  const fetchProfile = async () => {
    if (!ApiClient.getToken()) return;
    try {
      const profile = await ApiClient.getProfile();
      setUsername(profile.username);
      setEmail(profile.email || null);
      setAvatarUrl(profile.avatarUrl || null);
      if (typeof window !== 'undefined') {
        localStorage.setItem('notebook_username', profile.username);
        if (profile.email) localStorage.setItem('notebook_email', profile.email);
        else localStorage.removeItem('notebook_email');
        if (profile.avatarUrl) localStorage.setItem('notebook_avatar', profile.avatarUrl);
        else localStorage.removeItem('notebook_avatar');
      }
    } catch (err) {
      // ignore transient fetch error
    }
  };

  const checkStatus = async (retryCount = 0) => {
    try {
      setIsLoading(true);
      const status = await ApiClient.getAuthStatus();
      setIsConfigured(status.isConfigured);
      setServerWaking(false);
      setIsLoading(false);
    } catch (err) {
      if (retryCount < 4) {
        setServerWaking(true);
        setTimeout(() => checkStatus(retryCount + 1), 2000);
        return;
      }
      setIsConfigured(true);
      setServerWaking(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();

    if (token) {
      fetchProfile();
    }

    const handleExpired = () => {
      setToken(null);
      setUsername(null);
      setEmail(null);
      setAvatarUrl(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('notebook_username');
        localStorage.removeItem('notebook_email');
        localStorage.removeItem('notebook_avatar');
      }
    };

    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, []);

  const login = (newToken: string, newUsername: string, newEmail?: string | null, newAvatarUrl?: string | null) => {
    ApiClient.setToken(newToken);
    setToken(newToken);
    setUsername(newUsername);
    setEmail(newEmail || null);
    setAvatarUrl(newAvatarUrl || null);
    setIsConfigured(true);

    if (typeof window !== 'undefined') {
      localStorage.setItem('notebook_username', newUsername);
      if (newEmail) localStorage.setItem('notebook_email', newEmail);
      else localStorage.removeItem('notebook_email');
      if (newAvatarUrl) localStorage.setItem('notebook_avatar', newAvatarUrl);
      else localStorage.removeItem('notebook_avatar');
    }
  };

  const updateUser = (newUsername: string, newEmail?: string | null, newAvatarUrl?: string | null, newToken?: string | null) => {
    if (newToken) {
      ApiClient.setToken(newToken);
      setToken(newToken);
    }
    setUsername(newUsername);
    setEmail(newEmail || null);
    setAvatarUrl(newAvatarUrl || null);

    if (typeof window !== 'undefined') {
      localStorage.setItem('notebook_username', newUsername);
      if (newEmail) localStorage.setItem('notebook_email', newEmail);
      else localStorage.removeItem('notebook_email');
      if (newAvatarUrl) localStorage.setItem('notebook_avatar', newAvatarUrl);
      else localStorage.removeItem('notebook_avatar');
    }
  };

  const logout = () => {
    ApiClient.setToken(null);
    setToken(null);
    setUsername(null);
    setEmail(null);
    setAvatarUrl(null);

    if (typeof window !== 'undefined') {
      localStorage.removeItem('notebook_username');
      localStorage.removeItem('notebook_email');
      localStorage.removeItem('notebook_avatar');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        username,
        email,
        avatarUrl,
        isConfigured,
        isLoading,
        serverWaking,
        login,
        updateUser,
        logout,
        checkStatus,
        fetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

const defaultAuthContext: AuthContextType = {
  token: null,
  username: typeof window !== 'undefined' ? localStorage.getItem('notebook_username') : null,
  email: typeof window !== 'undefined' ? localStorage.getItem('notebook_email') : null,
  avatarUrl: typeof window !== 'undefined' ? localStorage.getItem('notebook_avatar') : null,
  isConfigured: null,
  isLoading: false,
  serverWaking: false,
  login: () => {},
  updateUser: () => {},
  logout: () => {},
  checkStatus: async () => {},
  fetchProfile: async () => {},
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (ctx) return ctx;
  return {
    ...defaultAuthContext,
    username: typeof window !== 'undefined' ? localStorage.getItem('notebook_username') : null,
    email: typeof window !== 'undefined' ? localStorage.getItem('notebook_email') : null,
    avatarUrl: typeof window !== 'undefined' ? localStorage.getItem('notebook_avatar') : null,
  };
};
