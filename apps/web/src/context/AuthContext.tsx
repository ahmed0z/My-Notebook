import React, { createContext, useContext, useState, useEffect } from 'react';
import { ApiClient } from '../api/client';

interface AuthContextType {
  token: string | null;
  username: string | null;
  isConfigured: boolean | null;
  isLoading: boolean;
  serverWaking: boolean;
  login: (token: string, username: string) => void;
  logout: () => void;
  checkStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(ApiClient.getToken());
  const [username, setUsername] = useState<string | null>(localStorage.getItem('notebook_username'));
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [serverWaking, setServerWaking] = useState<boolean>(false);

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

    const handleExpired = () => {
      setToken(null);
      setUsername(null);
      localStorage.removeItem('notebook_username');
    };

    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, []);

  const login = (newToken: string, newUsername: string) => {
    ApiClient.setToken(newToken);
    localStorage.setItem('notebook_username', newUsername);
    setToken(newToken);
    setUsername(newUsername);
    setIsConfigured(true);
  };

  const logout = () => {
    ApiClient.setToken(null);
    localStorage.removeItem('notebook_username');
    setToken(null);
    setUsername(null);
  };

  return (
    <AuthContext.Provider value={{ token, username, isConfigured, isLoading, serverWaking, login, logout, checkStatus }}>
      {children}
    </AuthContext.Provider>
  );
};

const defaultAuthContext: AuthContextType = {
  token: null,
  username: typeof window !== 'undefined' ? localStorage.getItem('notebook_username') : null,
  isConfigured: null,
  isLoading: false,
  serverWaking: false,
  login: () => {},
  logout: () => {},
  checkStatus: async () => {},
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (ctx) return ctx;
  return {
    ...defaultAuthContext,
    username: typeof window !== 'undefined' ? localStorage.getItem('notebook_username') : null,
  };
};
