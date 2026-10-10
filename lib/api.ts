import { signProof, syncClock } from './device';
import { queryClient } from './queryClient';

// Accepts the server address with or without the /api suffix (and trailing slashes)
export const API_URL = (() => {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? 'https://bestpilau-backend.onrender.com/api').replace(/\/+$/, '');
  return base.endsWith('/api') ? base : `${base}/api`;
})();
const TOKEN_KEY = 'bp_token';

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    queryClient.clear();
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {}
  },
  clear() {
    queryClient.clear();
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
  },
};

export interface ErrorDetail {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: ErrorDetail[],
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;
  const token = tokenStore.get();

  // Up to two attempts: the second only after the server says this device's clock is off
  for (let attempt = 0; attempt < 2; attempt++) {
    // Proves the request comes from the browser that signed in (see lib/device.ts)
    const proof = token ? await signProof(token) : null;
    let res: Response;
    try {
      res = await fetch(`${API_URL}${path}`, {
        method,
        signal,
        headers: {
          ...(body !== undefined && { 'Content-Type': 'application/json' }),
          ...(token && { Authorization: `Bearer ${token}` }),
          ...(proof && { 'X-Proof': proof }),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError(0, 'Cannot reach the server. Check your connection.');
    }

    const serverDate = res.headers.get('date');
    if (serverDate) syncClock(Date.parse(serverDate));

    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (res.ok) return data as T;

    if (res.status === 401 && data?.code === 'CLOCK_SKEW' && attempt === 0) {
      syncClock(Number(data.serverTime));
      continue;
    }
    if (res.status === 401 && token) {
      window.dispatchEvent(new CustomEvent('bp:unauthorized', { detail: data?.error }));
    }
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`, data?.details);
  }
  throw new ApiError(401, "This device's clock is wrong. Set the correct date and time, then try again.");
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong');

// Maps server-side Zod details ([{ path, message }]) to { field: message }.
export function apiFieldErrors(err: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const details = err instanceof ApiError ? (err.details ?? []) : [];
  for (const d of details) {
    const key = (d.path ?? '').split('.')[0] || 'form';
    out[key] ??= d.message;
  }
  if (!Object.keys(out).length) out.form = errorMessage(err);
  return out;
}
