import type { ReactNode } from 'react';
import { formatDuration, formatElapsed, formatTime } from '@/lib/format';
import { TICKET_STATUS_LABELS } from '@/lib/constants';
import type { Ticket } from '@/lib/types';
import { Icon } from './Icon';
import { OrderNumber } from './OrderNumber';

interface TicketCardProps {
  ticket: Ticket;
  /** Current time in ms, shared by every card so the page ticks once per second, not once per card */
  now: number;
  showStation: boolean;
  children: ReactNode;
}

// Compact kitchen ticket. Built to be read from a distance and to fit many on one screen:
// big order counter, one timer, the items, one button.
export function TicketCard({ ticket, now, showStation, children }: TicketCardProps) {
  const isNew = ticket.status === 'PENDING';
  const remaining = new Date(ticket.order.confirmDeadline).getTime() - now;
  const late = isNew && remaining <= 0;
  const cookingFor = ticket.confirmedAt ? now - new Date(ticket.confirmedAt).getTime() : 0;

  let timerClass = 'kt-timer';
  let timer: ReactNode;
  if (late) {
    timerClass += ' kt-timer-late';
    timer = (
      <>
        <Icon name="alert" size={14} /> Late {formatElapsed(-remaining)}
      </>
    );
  } else if (isNew) {
    if (remaining < 60_000) timerClass += ' kt-timer-warn';
    timer = (
      <>
        <Icon name="clock" size={14} /> {formatDuration(remaining)}
      </>
    );
  } else {
    timerClass += ' kt-timer-cooking';
    timer = (
      <>
        <Icon name="flame" size={14} /> {formatElapsed(cookingFor)}
      </>
    );
  }

  return (
    <article className={`kt ${late ? 'kt-late' : ''}`}>
      <header className="kt-head">
        <OrderNumber number={ticket.order.orderNumber} id={ticket.order.id} stacked />
        <span
          className={timerClass}
          title={late ? 'Past the confirmation deadline' : isNew ? 'Time left to confirm' : 'Time since cooking started'}
        >
          {timer}
        </span>
      </header>

      <div className="kt-meta">
        {showStation && <span className="badge badge-neutral">{ticket.station.name}</span>}
        <span className="kt-customer" title={ticket.order.customerName}>
          {ticket.order.customerName}
        </span>
        <time className="kt-placed" dateTime={ticket.order.createdAt} title="Time the order was placed">
          {formatTime(ticket.order.createdAt)}
        </time>
      </div>

      <ul className="kt-items">
        {ticket.items.map((item) => (
          <li key={item.productId}>
            <span className="kt-qty">{item.quantity}×</span>
            {item.name}
          </li>
        ))}
      </ul>

      {ticket.order.notes && <p className="order-notes">Note: {ticket.order.notes}</p>}

      {ticket.otherStations.length > 0 && (
        <ul className="station-progress kt-also" aria-label="Other stations on this order">
          {ticket.otherStations.map((s) => (
            <li key={s.id} className={`station-chip station-${s.status.toLowerCase()}`}>
              {s.name} · {TICKET_STATUS_LABELS[s.status].toLowerCase()}
            </li>
          ))}
        </ul>
      )}

      <div className="kt-actions">{children}</div>
    </article>
  );
}
