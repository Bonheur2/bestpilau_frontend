'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, errorMessage } from './api';
import { useLiveStatus, useLiveTopics, type LiveTopic } from './realtime';
import type { AppSettings } from './types';

interface ApiState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

// While live updates are connected, polling is only a safety net.
const LIVE_SAFETY_INTERVAL = 60_000;

interface UseApiOptions {
  /** Poll every `interval` ms (relaxed to once a minute while live updates are connected). */
  interval?: number;
  enabled?: boolean;
  /** Reload as soon as the server announces a change to these topics. */
  live?: LiveTopic[];
}

/** One page of an already-loaded list. The page is clamped, so a list that shrinks never shows an empty page. */
export function paginate<T>(items: T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(page, 1), pages);
  return { items: items.slice((current - 1) * size, current * size), page: current, pages, total: items.length, size };
}

/** Page number that goes back to 1 whenever `resetKey` (a filter or search) changes. */
export function usePageState(resetKey: string) {
  const [state, setState] = useState({ key: resetKey, page: 1 });
  const page = state.key === resetKey ? state.page : 1;
  const setPage = useCallback((next: number) => setState({ key: resetKey, page: next }), [resetKey]);
  return [page, setPage] as const;
}

// Fetches `path` through React Query: a path seen before shows its last data straight away while a fresh
// copy loads, identical requests are shared, and it reloads on live updates and/or on an interval.
export function useApi<T>(path: string, { interval, enabled = true, live }: UseApiOptions = {}) {
  const liveStatus = useLiveStatus();
  const effectiveInterval =
    interval && live && liveStatus === 'live' ? Math.max(interval, LIVE_SAFETY_INTERVAL) : interval;

  const query = useQuery<T, Error>({
    queryKey: [path],
    queryFn: () => api<T>(path),
    enabled,
    refetchInterval: effectiveInterval || false,
    // Switching filters keeps the previous list on screen until the new one arrives
    placeholderData: keepPreviousData,
  });

  const { refetch } = query;
  const reload = useCallback(async () => {
    if (enabled) await refetch();
  }, [enabled, refetch]);
  useLiveTopics(enabled ? live : undefined, reload);

  return {
    data: query.data ?? null,
    error: query.error,
    loading: enabled && query.isPending,
    reload,
  } satisfies ApiState<T> & { reload: () => Promise<void> };
}

// Runs one async action at a time and captures its error message.
export function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T>(key: string, fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(key);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }, []);

  return { busy, error, setError, run };
}

// Current timestamp, refreshed every `interval` ms (pass null to stop ticking).
export function useNow(interval: number | null = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!interval) return;
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [interval]);
  return now;
}

/**
 * A value kept in the page address (?key=value), so reloading, the back button and shared
 * links open the same tab or filter. Unknown values fall back to `fallback`, which is left
 * out of the address to keep it clean. Pages using this must render inside <Suspense>.
 */
export function useQueryState<T extends string>(
  key: string,
  allowed: readonly T[] | ((value: string) => boolean),
  fallback: T,
) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get(key);
  const valid = typeof allowed === 'function' ? allowed : (v: string) => (allowed as readonly string[]).includes(v);
  const value = raw !== null && valid(raw) ? (raw as T) : fallback;

  const setValue = useCallback(
    (next: T) => {
      const query = new URLSearchParams(params.toString());
      if (next === fallback) query.delete(key);
      else query.set(key, next);
      const qs = query.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, router, pathname, key, fallback],
  );

  return [value, setValue] as const;
}

/** Accepts "all" or a positive whole number, e.g. a station or category id in the address. */
export const isAllOrId = (value: string) => value === 'all' || /^[1-9]\d*$/.test(value);

const DEFAULT_SETTINGS: AppSettings = { confirmWindowMinutes: 5 };

/** Business settings (Settings → Business); updates live when an admin changes them. */
export function useAppSettings() {
  const { data, reload } = useApi<{ settings: AppSettings }>('/settings', { live: ['settings'] });
  return { settings: data?.settings ?? DEFAULT_SETTINGS, loaded: Boolean(data), reload };
}
