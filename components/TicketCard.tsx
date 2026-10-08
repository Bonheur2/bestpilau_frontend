'use client';

import type { ReactNode } from 'react';
import { useNow } from '@/lib/hooks';
import { formatDuration, timeAgo } from '@/lib/format';
import { TICKET_STATUS_LABELS } from '@/lib/constants';
import type { Ticket } from '@/lib/types';
import { Icon } from './Icon';

interface TicketCardProps {
  ticket: Ticket;
  showStation: boolean;
  children: ReactNode;
}

export function TicketCard({ ticket, showStation, children }: TicketCardProps) {
  const isPending = ticket.status === 'PENDING';
  const now = useNow(isPending ? 1000 : 30_000);
  const remaining = new Date(ticket.order.confirmDeadline).getTime() - now;
  const overdue = isPending && remaining <= 0;

  return (
    <article className={`card ticket ${overdue ? 'is-overdue' : ''}`}>
      <header className="ticket-head">
        <span className="order-number">#{ticket.order.id}</span>
        {showStation && <span className="badge badge-neutral">{ticket.station.name}</span>}
        <span className="ticket-time">
          {!isPending ? (
            <span className="muted small">Confirmed {timeAgo(ticket.confirmedAt ?? ticket.createdAt, now)}</span>
          ) : overdue ? (
            <span className="countdown countdown-late">
              <Icon name="alert" size={15} />
              Late by {formatDuration(-remaining)}
            </span>
          ) : (
            <span className={`countdown ${remaining < 60_000 ? 'countdown-warn' : ''}`}>
              <Icon name="clock" size={15} />
              {formatDuration(remaining)}
            </span>
          )}
        </span>
      </header>

      <ul className="ticket-items">
        {ticket.items.map((item) => (
          <li key={item.productId}>
            <span className="qty">{item.quantity}×</span>
            {item.name}
          </li>
        ))}
      </ul>

      {ticket.order.notes && <p className="order-notes">Note: {ticket.order.notes}</p>}

      <div className="ticket-meta muted small">
        <span>{ticket.order.customerName}</span>
        {ticket.otherStations.length > 0 && (
          <span>
            Also:{' '}
            {ticket.otherStations.map((s, i) => (
              <span key={s.id}>
                {i > 0 && ', '}
                {s.name} ({TICKET_STATUS_LABELS[s.status].toLowerCase()})
              </span>
            ))}
          </span>
        )}
      </div>

      <div className="order-actions">{children}</div>
    </article>
  );
}
