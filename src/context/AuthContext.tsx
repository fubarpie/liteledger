import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AuthUser } from '../types.ts';
import { apiGet, apiPost, UNAUTHORIZED_EVENT } from '../api.ts';

interface AuthContextType {
  /** true until the first /api/auth/status response arrives */
  loading: boolean;
  /** true on a fresh install: no administrator exists yet */
  setupRequired: boolean;
  user: AuthUser | null;
  aiEnabled: boolean;
  aiModel: string;
  /** Create the first administrator account (only works on a fresh install). Throws ApiError. */
  setup: (input: { name: string; email: string; password: string }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiModel, setAiModel] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [status, config] = await Promise.all([apiGet('/api/auth/status'), apiGet('/api/config')]);
      setSetupRequired(Boolean(status.setupRequired));
      setUser(status.user || null);
      setAiEnabled(Boolean(config.ai));
      setAiModel(config.model || '');
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onUnauthorized = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [refresh]);

  const setup = useCallback(async (input: { name: string; email: string; password: string }) => {
    const r = await apiPost('/api/auth/setup', input);
    setUser(r.user);
    setSetupRequired(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await apiPost('/api/auth/login', { email, password });
    setUser(r.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiPost('/api/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await apiPost('/api/auth/change-password', { currentPassword, newPassword });
  }, []);

  return (
    <AuthContext.Provider
      value={{ loading, setupRequired, user, aiEnabled, aiModel, setup, login, logout, changePassword }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
