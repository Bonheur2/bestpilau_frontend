export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
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
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {}
  },
  clear() {
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

export async function api<T = unknown>(path: string, { method = 'GET', body, signal }: RequestOptions = {}): Promise<T> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      signal,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection.');
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) {
      window.dispatchEvent(new CustomEvent('bp:unauthorized', { detail: data?.error }));
    }
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`, data?.details);
  }
  return data as T;
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
