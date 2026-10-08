'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, tokenStore } from './api';
import type { Module, SessionUser } from './types';

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  error: Error | null;
  // Why the last session ended (e.g. password changed elsewhere), shown on the login page
  notice: string | null;
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => void;
  refresh: () => Promise<void>;
  // Replace the session after a profile edit or password change
  setSession: (user: SessionUser, token?: string) => void;
  can: (module: Module) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Generic 401s (missing token) aren't worth showing; specific reasons are.
const isWorthShowing = (message?: string) => Boolean(message) && message !== 'Authentication required';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const endSession = useCallback((reason?: string) => {
    tokenStore.clear();
    setUser(null);
    if (isWorthShowing(reason)) setNotice(reason ?? null);
  }, []);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user } = await api<{ user: SessionUser }>('/auth/me');
      setUser(user);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) endSession(err.message);
      else setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [endSession]);

  useEffect(() => {
    refresh();
    const onUnauthorized = (e: Event) => endSession((e as CustomEvent<string>).detail);
    window.addEventListener('bp:unauthorized', onUnauthorized);
    return () => window.removeEventListener('bp:unauthorized', onUnauthorized);
  }, [refresh, endSession]);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await api<{ token: string; user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    tokenStore.set(token);
    setUser(user);
    setError(null);
    setNotice(null);
    return user;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setNotice(null);
  }, []);

  const setSession = useCallback((next: SessionUser, token?: string) => {
    if (token) tokenStore.set(token);
    setUser(next);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      notice,
      login,
      logout,
      refresh,
      setSession,
      can: (module) => Boolean(user?.modules.includes(module)),
    }),
    [user, loading, error, notice, login, logout, refresh, setSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// For pages under the authenticated (app) layout, which only renders once a user is loaded.
export function useSessionUser() {
  const { user, ...rest } = useAuth();
  if (!user) throw new Error('useSessionUser called without a signed-in user');
  return { user, ...rest };
}
