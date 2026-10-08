const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? 'RWF';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: CURRENCY, maximumFractionDigits: 0 });

export const formatMoney = (amount: number | null | undefined) => money.format(amount ?? 0);

export function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

export function timeAgo(date: string | Date, now = Date.now()) {
  const seconds = Math.floor((now - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(date).toLocaleDateString();
}

export const formatTime = (date: string | null | undefined) =>
  date ? new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

// 75 → "1m 15s"; null → "—"
export function formatSeconds(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export const formatDateTime = (date: string | null | undefined) =>
  date
    ? new Date(date).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';

// "2026-10-08" → "Wed 8 Oct" (parsed as a local date)
export function formatDay(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

// "Grace Uwase" → "GU", "Aline (Grill)" → "AG"
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
