'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, tokenStore } from './api';
import type { Permission, SessionUser } from './types';

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
  /**
   * Runs a request that invalidates every token (password change, "sign out of other devices")
   * and switches this device to the fresh token it returns, without signing this device out.
   */
  rotateSession: <T extends { token: string; user: SessionUser }>(request: () => Promise<T>) => Promise<T>;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ---- Compatibility with the previous backend (fixed roles + modules) ----
// Lets this frontend keep working while the backend is being redeployed. Safe to remove once
// every backend returns `permissions`.
const LEGACY_MODULE_PERMISSIONS: Record<string, Permission[]> = {
  orders: ['orders.view', 'orders.create', 'orders.manage', 'deliveries.view'],
  kitchen: ['kitchen.view', 'kitchen.prepare'],
  delivery: ['deliveries.deliver'],
  menu: ['menu.view', 'menu.create', 'menu.update', 'menu.delete'],
  users: ['users.view', 'users.create', 'users.update'],
  permissions: ['roles.view', 'roles.manage'],
};
const LEGACY_ROLE_NAMES: Record<string, string> = {
  ADMIN: 'Admin',
  CUSTOMER_CARE: 'Customer Care',
  KITCHEN: 'Kitchen',
  DRIVER: 'Driver',
};

type LegacyUser = Partial<SessionUser> & { role?: string; modules?: string[] };

export function normalizeUser<T extends SessionUser>(raw: T): T {
  if (Array.isArray(raw.permissions)) return raw;
  const legacy = raw as unknown as LegacyUser;
  const permissions = [...new Set((legacy.modules ?? []).flatMap((m) => LEGACY_MODULE_PERMISSIONS[m] ?? []))];
  return {
    ...raw,
    roleId: legacy.roleId ?? 0,
    roleName: legacy.roleName ?? LEGACY_ROLE_NAMES[legacy.role ?? ''] ?? legacy.role ?? 'Staff',
    isSuperAdmin: legacy.isSuperAdmin ?? legacy.role === 'ADMIN',
    permissions,
  };
}

// Generic 401s (missing token) aren't worth showing; specific reasons are.
const isWorthShowing = (message?: string) => Boolean(message) && message !== 'Authentication required';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // While this device swaps to a fresh token, "you were signed out" signals (the server closing
  // our live connection, or a request that still used the old token) refer to the old token only.
  const rotating = useRef(false);

  const endSession = useCallback((reason?: string) => {
    if (rotating.current) return;
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
      setUser(normalizeUser(user));
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
    setUser(normalizeUser(user));
    setError(null);
    setNotice(null);
    return normalizeUser(user);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setNotice(null);
  }, []);

  const setSession = useCallback((next: SessionUser, token?: string) => {
    if (token) tokenStore.set(token);
    setUser(normalizeUser(next));
  }, []);

  const rotateSession = useCallback(
    async <T extends { token: string; user: SessionUser }>(request: () => Promise<T>) => {
      rotating.current = true;
      try {
        const result = await request();
        tokenStore.set(result.token);
        setUser(normalizeUser(result.user));
        return result;
      } finally {
        // Give in-flight requests that used the old token a moment to come back and be ignored
        setTimeout(() => {
          rotating.current = false;
        }, 3000);
      }
    },
    [],
  );

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
      rotateSession,
      can: (permission) => Boolean(user?.permissions.includes(permission)),
    }),
    [user, loading, error, notice, login, logout, refresh, setSession, rotateSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

type Access = { isSuperAdmin: boolean; permissions: Permission[] };
/** Kitchen staff can be given a station; Admin has every permission but isn't kitchen staff. */
export const isKitchenStaff = (a: Access) => !a.isSuperAdmin && a.permissions.includes('kitchen.view');
/** Drivers get deliveries assigned; Admin has every permission but isn't a driver. */
export const isDriverStaff = (a: Access) => !a.isSuperAdmin && a.permissions.includes('deliveries.deliver');

/** "Kitchen · Grill", "Kitchen · All stations", "Customer Care" */
export function roleLabel(u: Access & { roleName: string; stationName: string | null }) {
  if (!isKitchenStaff(u)) return u.roleName;
  return `${u.roleName} · ${u.stationName ?? 'All stations'}`;
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
