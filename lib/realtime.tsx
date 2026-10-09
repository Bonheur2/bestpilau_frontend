'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { API_URL, tokenStore } from './api';
import { useAuth } from './auth';
import { audioLocked, onSoundChange, soundEnabled } from './sound';

// Live updates from the API over WebSocket. Messages are only "something changed"
// signals; screens reload the affected data through the REST API.

export type LiveTopic = 'tickets' | 'orders' | 'presence' | 'settings';
export type LiveMessage =
  | { type: LiveTopic; reason: string; orderId: number; stationIds?: number[] }
  // Sent locally after every (re)connect, so screens catch up on anything missed while offline
  | { type: 'resync' };
export type LiveStatus = 'connecting' | 'live' | 'offline';

const WS_URL = `${API_URL.replace(/^http/, 'ws')}/ws`;
const MAX_RETRY_MS = 30_000;

interface RealtimeContextValue {
  status: LiveStatus;
  subscribe: (listener: (message: LiveMessage) => void) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { refresh } = useAuth();
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const listeners = useRef(new Set<(message: LiveMessage) => void>());

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let stopped = false;

    const emit = (message: LiveMessage) => listeners.current.forEach((l) => l(message));

    // Tell the server whether this device can play alerts, so admins can spot silent screens.
    const soundState = () => (!soundEnabled() ? 'muted' : audioLocked() ? 'locked' : 'on');
    let reportedSound: string | null = null;
    const reportSound = () => {
      const state = soundState();
      if (socket?.readyState !== WebSocket.OPEN || state === reportedSound || !authed) return;
      socket.send(JSON.stringify({ type: 'sound', state }));
      reportedSound = state;
    };
    let authed = false;
    const stopSoundWatch = onSoundChange(reportSound);

    const connect = () => {
      const token = tokenStore.get();
      if (!token || stopped) return;
      socket = new WebSocket(WS_URL);

      socket.onopen = () => socket?.send(JSON.stringify({ type: 'auth', token }));
      authed = false;
      reportedSound = null;
      socket.onmessage = (event) => {
        let message: { type?: string };
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (message.type === 'ready') {
          attempt = 0;
          authed = true;
          reportSound();
          setStatus('live');
          emit({ type: 'resync' });
        } else if (['tickets', 'orders', 'presence', 'settings'].includes(message.type ?? '')) {
          emit(message as LiveMessage);
        }
      };
      socket.onclose = (event) => {
        socket = null;
        if (stopped) return;
        setStatus('offline');
        // 4401: session changed (password, role, deactivation). Re-check it; this signs
        // the user out if it is no longer valid, otherwise we reconnect with fresh access.
        if (event.code === 4401) refresh();
        const delay = Math.min(MAX_RETRY_MS, 1000 * 2 ** attempt++);
        retryTimer = setTimeout(connect, delay);
      };
    };

    connect();
    // Reconnect right away when the device comes back online or the tab wakes up
    const wake = () => {
      if (!socket && !stopped) {
        clearTimeout(retryTimer);
        attempt = 0;
        connect();
      }
    };
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', wake);

    return () => {
      stopped = true;
      stopSoundWatch();
      clearTimeout(retryTimer);
      window.removeEventListener('online', wake);
      document.removeEventListener('visibilitychange', wake);
      socket?.close();
    };
  }, [refresh]);

  const subscribe = useCallback((listener: (message: LiveMessage) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  return <RealtimeContext.Provider value={{ status, subscribe }}>{children}</RealtimeContext.Provider>;
}

export function useLiveStatus(): LiveStatus | null {
  return useContext(RealtimeContext)?.status ?? null;
}

/** Calls `onChange` (debounced) when any of `topics` changes, and after every reconnect. */
export function useLiveTopics(topics: LiveTopic[] | undefined, onChange: () => void) {
  const ctx = useContext(RealtimeContext);
  const callback = useRef(onChange);
  callback.current = onChange;
  const key = topics?.join(',') ?? '';

  useEffect(() => {
    if (!ctx || !key) return;
    const wanted = key.split(',');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = ctx.subscribe((message) => {
      if (message.type !== 'resync' && !wanted.includes(message.type)) return;
      // Several events often arrive together (e.g. ticket + order); reload once
      clearTimeout(timer);
      timer = setTimeout(() => callback.current(), 150);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [ctx, key]);
}
