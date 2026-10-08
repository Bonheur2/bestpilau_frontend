'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useSessionUser } from '@/lib/auth';
import { useApi, useNow } from '@/lib/hooks';
import { useLiveStatus } from '@/lib/realtime';
import { audioLocked, onSoundChange, playSound, setSoundEnabled, soundEnabled, unlockAudio, type SoundKind } from '@/lib/sound';
import type { Order, Ticket } from '@/lib/types';
import { Icon } from './Icon';

// Calls `onNew` for ids that weren't in the previous list. The first load only
// records what is already there, so opening a screen doesn't set off every alert.
function useNewIds(ids: number[] | undefined, onNew: (ids: number[]) => void) {
  const seen = useRef<Set<number> | null>(null);
  const callback = useRef(onNew);
  callback.current = onNew;
  const key = ids?.join(',');

  useEffect(() => {
    if (!ids) return;
    if (seen.current) {
      const fresh = ids.filter((id) => !seen.current!.has(id));
      if (fresh.length) callback.current(fresh);
    }
    seen.current = new Set(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

const sound = (kind: SoundKind) => () => playSound(kind);

// Kitchen: chime for each new ticket at my station(s); urgent beep when one goes overdue.
function KitchenAlerts() {
  const { data } = useApi<{ tickets: Ticket[] }>('/tickets?status=PENDING', { interval: 15_000, live: ['tickets'] });
  const tickets = data?.tickets;
  useNewIds(tickets?.map((t) => t.id), sound('new'));

  const now = useNow(1000);
  const overdueIds = tickets?.filter((t) => new Date(t.order.confirmDeadline).getTime() <= now).map((t) => t.id);
  useNewIds(overdueIds, sound('alert'));
  return null;
}

// Customer Care: beep when an order misses the kitchen's confirmation window.
function CareAlerts() {
  const { data } = useApi<{ orders: Order[] }>('/orders?overdue=true', { interval: 15_000, live: ['orders'] });
  useNewIds(data?.orders.map((o) => o.id), sound('alert'));
  return null;
}

// Driver: chime when a delivery is assigned to me, and again when it's ready for pickup.
function DriverAlerts() {
  const { data } = useApi<{ orders: Order[] }>('/orders?mine=true&status=PENDING,CONFIRMED,COMPLETED', {
    interval: 15_000,
    live: ['orders'],
  });
  const orders = data?.orders;
  useNewIds(orders?.map((o) => o.id), sound('new'));
  useNewIds(orders?.filter((o) => o.status === 'COMPLETED').map((o) => o.id), sound('ready'));
  return null;
}

/** Background watchers that play sounds for the signed-in user's role. */
export function LiveAlerts() {
  const { user, can } = useSessionUser();
  return (
    <>
      {can('kitchen') && <KitchenAlerts />}
      {can('orders') && <CareAlerts />}
      {can('delivery') && user.driverId && <DriverAlerts />}
    </>
  );
}

const subscribeSound = (cb: () => void) => onSoundChange(cb);

/** Header controls: live connection status and the sound switch. */
export function LiveControls() {
  const { can } = useSessionUser();
  const status = useLiveStatus();
  const enabled = useSyncExternalStore(subscribeSound, soundEnabled, () => true);
  const locked = useSyncExternalStore(subscribeSound, audioLocked, () => true);
  const hasAlerts = can('kitchen') || can('orders') || can('delivery');

  const label = status === 'live' ? 'Live' : status === 'connecting' ? 'Connecting…' : 'Reconnecting…';

  return (
    <div className="live-controls">
      <span
        className={`live-status live-${status ?? 'offline'}`}
        title={status === 'live' ? 'Updates arrive instantly' : 'Live updates paused; refreshing every few seconds'}
      >
        <span className="live-dot" aria-hidden="true" />
        {label}
      </span>

      {hasAlerts &&
        (enabled && locked ? (
          <button
            className="sound-toggle sound-locked"
            onClick={() => {
              unlockAudio();
              setTimeout(() => playSound('new'), 50);
            }}
          >
            <Icon name="volumeOff" size={16} />
            Turn on sound
          </button>
        ) : (
          <button
            className={`sound-toggle ${enabled ? '' : 'sound-off'}`}
            aria-pressed={enabled}
            title={enabled ? 'Sound alerts on, click to mute' : 'Sound alerts off, click to turn on'}
            onClick={() => {
              setSoundEnabled(!enabled);
              if (!enabled) setTimeout(() => playSound('new'), 50);
            }}
          >
            <Icon name={enabled ? 'volume' : 'volumeOff'} size={16} />
            <span className="sound-toggle-label">{enabled ? 'Sound on' : 'Muted'}</span>
          </button>
        ))}
    </div>
  );
}
