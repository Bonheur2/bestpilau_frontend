'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { api, errorMessage } from './api';
import { useLiveStatus, useLiveTopics, type LiveTopic } from './realtime';

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

// Fetches `path`, reloading on live updates and/or on an interval.
export function useApi<T>(path: string, { interval, enabled = true, live }: UseApiOptions = {}) {
  const [state, setState] = useState<ApiState<T>>({ data: null, error: null, loading: enabled });
  const pathRef = useRef(path);
  pathRef.current = path;

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const data = await api<T>(path);
      if (pathRef.current === path) setState({ data, error: null, loading: false });
    } catch (error) {
      if (pathRef.current === path) setState((s) => ({ ...s, error: error as Error, loading: false }));
    }
  }, [path, enabled]);

  const liveStatus = useLiveStatus();
  const effectiveInterval =
    interval && live && liveStatus === 'live' ? Math.max(interval, LIVE_SAFETY_INTERVAL) : interval;
  useLiveTopics(enabled ? live : undefined, load);

  useEffect(() => {
    load();
  }, [load]);

  // Separate from the initial load, so switching poll speed (live ↔ offline) doesn't refetch
  useEffect(() => {
    if (!effectiveInterval || !enabled) return;
    const timer = setInterval(load, effectiveInterval);
    return () => clearInterval(timer);
  }, [load, effectiveInterval, enabled]);

  return { ...state, reload: load };
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
