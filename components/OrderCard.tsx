'use client';

import { Children, type ReactNode } from 'react';
import { useNow } from '@/lib/hooks';
import { formatDuration, formatMoney, formatTime, timeAgo } from '@/lib/format';
import { TICKET_STATUS_LABELS } from '@/lib/constants';
import { Icon } from './Icon';
import { StatusBadge } from './ui';
import type { Order } from '@/lib/types';

function Countdown({ deadline, now }: { deadline: string; now: number }) {
  const remaining = new Date(deadline).getTime() - now;
  if (remaining > 0) {
    return (
      <span className={`countdown ${remaining < 60_000 ? 'countdown-warn' : ''}`}>
        <Icon name="clock" size={15} />
        {formatDuration(remaining)} to confirm
      </span>
    );
  }
  return (
    <span className="countdown countdown-late">
      <Icon name="alert" size={15} />
      Late by {formatDuration(-remaining)}
    </span>
  );
}

const TIMELINE: [keyof Order & `${string}At`, string][] = [
  ['createdAt', 'Placed'],
  ['confirmedAt', 'Confirmed'],
  ['completedAt', 'Ready'],
  ['acceptedAt', 'Picked up'],
  ['deliveredAt', 'Delivered'],
];

interface OrderCardProps {
  order: Order;
  children?: ReactNode;
  showTimeline?: boolean;
}

export function OrderCard({ order, children, showTimeline = false }: OrderCardProps) {
  const isPending = order.status === 'PENDING';
  const now = useNow(isPending ? 1000 : 30_000);
  const overdue = isPending && new Date(order.confirmDeadline).getTime() < now;

  return (
    <article className={`card order-card ${overdue ? 'is-overdue' : ''}`}>
      <header className="order-head">
        <div className="order-head-left">
          <span className="order-number">#{order.id}</span>
          <StatusBadge status={order.status} overdue={overdue} />
          {order.isDelayed && !overdue && <span className="badge badge-flag">Confirmed late</span>}
        </div>
        {isPending ? (
          <Countdown deadline={order.confirmDeadline} now={now} />
        ) : (
          <span className="muted small">{timeAgo(order.createdAt, now)}</span>
        )}
      </header>

      <div className="order-customer">
        <strong>{order.customerName}</strong>
        {order.customerPhone && (
          <a href={`tel:${order.customerPhone}`} className="order-phone">
            <Icon name="phone" size={14} />
            {order.customerPhone}
          </a>
        )}
      </div>
      <div className="order-location">
        <Icon name="pin" size={15} />
        {order.location}
      </div>

      <ul className="order-items">
        {order.items.map((item) => (
          <li key={item.productId}>
            <span className="qty">{item.quantity}×</span>
            <span className="item-name">{item.name}</span>
            <span className="muted">{formatMoney(item.subtotal)}</span>
          </li>
        ))}
      </ul>

      {order.status !== 'DELIVERED' && order.tickets.length > 0 && (
        <ul className="station-progress" aria-label="Kitchen stations">
          {order.tickets.map((t) => (
            <li key={t.id} className={`station-chip station-${t.status.toLowerCase()} ${overdue && t.status === 'PENDING' ? 'is-late' : ''}`}>
              {t.stationName}: {TICKET_STATUS_LABELS[t.status]}
            </li>
          ))}
        </ul>
      )}

      {order.notes && <p className="order-notes">Note: {order.notes}</p>}

      <div className="order-meta">
        <span className="order-total">{formatMoney(order.totalAmount)}</span>
        <span className="muted small">
          <Icon name="truck" size={14} /> {order.driver ? order.driver.name : 'No driver yet'}
          {order.driver && !order.acceptedAt && order.status !== 'DELIVERED' && ' (not accepted)'}
        </span>
        {order.recheckCount > 0 && <span className="muted small">Rechecked {order.recheckCount}×</span>}
      </div>

      {showTimeline && (
        <ol className="timeline">
          {TIMELINE.map(([key, label]) => (
            <li key={key} className={order[key] ? 'done' : ''}>
              <span>{label}</span>
              <time>{formatTime(order[key] as string | null)}</time>
            </li>
          ))}
        </ol>
      )}

      {Children.toArray(children).length > 0 && <div className="order-actions">{children}</div>}
    </article>
  );
}
