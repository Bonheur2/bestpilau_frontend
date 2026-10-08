'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useApi } from '@/lib/hooks';
import { formatDateTime, formatDay, formatMoney, formatSeconds, formatTime } from '@/lib/format';
import { TICKET_STATUS_LABELS } from '@/lib/constants';
import type { DeliveriesHistory, HistoryResponse, HistoryView, KitchenHistory, OrdersHistory } from '@/lib/types';
import { Alert, Guard, Loader, PageHeader, StatusBadge } from '@/components/ui';

type RangeKey = 'today' | 'yesterday' | 'week' | 'month';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'Last 7 days' },
  { key: 'month', label: 'Last 30 days' },
];

const VIEW_LABELS: Record<HistoryView, string> = {
  orders: 'Orders',
  kitchen: 'Kitchen',
  deliveries: 'Deliveries',
};

// Local-calendar boundaries for each range: [from, to)
function rangeBounds(key: RangeKey) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const shift = (days: number) => {
    const d = new Date(start);
    d.setDate(d.getDate() + days);
    return d;
  };
  switch (key) {
    case 'today':
      return { from: start, to: shift(1) };
    case 'yesterday':
      return { from: shift(-1), to: start };
    case 'week':
      return { from: shift(-6), to: shift(1) };
    case 'month':
      return { from: shift(-29), to: shift(1) };
  }
}

export default function HistoryPage() {
  return (
    <Guard modules={['orders', 'kitchen', 'delivery']}>
      <History />
    </Guard>
  );
}

function History() {
  const [range, setRange] = useState<RangeKey>('today');
  const [view, setView] = useState<HistoryView | null>(null);

  const path = useMemo(() => {
    const { from, to } = rangeBounds(range);
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
      tz: String(new Date().getTimezoneOffset()),
      ...(view && { view }),
    });
    return `/history?${params}`;
  }, [range, view]);

  const { data, error, loading } = useApi<HistoryResponse>(path, {
    interval: range === 'today' ? 30_000 : undefined,
    live: range === 'today' ? ['orders', 'tickets'] : undefined,
  });
  const multiDay = range === 'week' || range === 'month';

  return (
    <>
      <PageHeader title="History" />

      <div className="history-filters">
        <div className="tabs" role="tablist" aria-label="Period">
          {RANGES.map((r) => (
            <button
              key={r.key}
              role="tab"
              aria-selected={range === r.key}
              className={`tab ${range === r.key ? 'active' : ''}`}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
        {data && data.views.length > 1 && (
          <div className="segmented" role="tablist" aria-label="View">
            {data.views.map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={data.view === v}
                className={data.view === v ? 'active' : ''}
                onClick={() => setView(v)}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <Alert>{error.message}</Alert>}
      {loading || !data ? (
        <Loader />
      ) : data.view === 'orders' ? (
        <OrdersSection data={data} multiDay={multiDay} />
      ) : data.view === 'kitchen' ? (
        <KitchenSection data={data} multiDay={multiDay} />
      ) : (
        <DeliveriesSection data={data} multiDay={multiDay} />
      )}
    </>
  );
}

// ---- Shared pieces ----

function Kpi({ label, value, alert }: { label: string; value: ReactNode; alert?: boolean }) {
  return (
    <div className={`kpi ${alert ? 'kpi-alert' : ''}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card panel history-section">
      <header className="panel-head">
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

// Count with a thin bar scaled to the busiest row, so busy days stand out at a glance.
function BarCell({ value, max }: { value: number; max: number }) {
  return (
    <td className="bar-cell">
      <span className="bar-value">{value}</span>
      <span className="bar-track" aria-hidden="true">
        <span className="bar-fill" style={{ width: max ? `${(value / max) * 100}%` : 0 }} />
      </span>
    </td>
  );
}

function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: boolean }) {
  if (empty) return <p className="panel-empty">Nothing in this period</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const newestFirst = <T extends { date: string }>(days: T[]) => [...days].reverse();

// ---- Orders (Customer Care / Admin) ----

function OrdersSection({ data, multiDay }: { data: OrdersHistory; multiDay: boolean }) {
  const { totals, days, entries } = data;
  const max = Math.max(...days.map((d) => d.orders));
  return (
    <>
      <div className="kpis">
        <Kpi label="Orders" value={totals.orders} />
        <Kpi label="Sales" value={formatMoney(totals.sales)} />
        <Kpi label="Delivered" value={totals.delivered} />
        <Kpi label="Avg. time to confirm" value={formatSeconds(totals.avgConfirmSeconds)} />
        <Kpi label="Confirmed late" value={totals.late} alert={totals.late > 0} />
      </div>

      {multiDay && (
        <Section title="By day">
          <Table head={['Day', 'Orders', 'Sales', 'Delivered', 'Late', 'Avg. confirm']}>
            {newestFirst(days).map((d) => (
              <tr key={d.date}>
                <td>{formatDay(d.date)}</td>
                <BarCell value={d.orders} max={max} />
                <td>{formatMoney(d.sales)}</td>
                <td>{d.delivered}</td>
                <td className={d.late ? 'text-error' : ''}>{d.late}</td>
                <td>{formatSeconds(d.avgConfirmSeconds)}</td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      <Section title={`Orders (${entries.length})`}>
        <Table head={['Order', 'Time', 'Customer', 'Location', 'Driver', 'Total', 'Confirmed in', 'Status']} empty={!entries.length}>
          {entries.map((o) => (
            <tr key={o.id}>
              <td>
                <strong>#{o.id}</strong>
              </td>
              <td>{multiDay ? formatDateTime(o.createdAt) : formatTime(o.createdAt)}</td>
              <td>{o.customerName}</td>
              <td className="cell-truncate">{o.location}</td>
              <td>{o.driverName ?? <span className="muted">—</span>}</td>
              <td>{formatMoney(o.totalAmount)}</td>
              <td className={o.isDelayed ? 'text-error' : ''}>{formatSeconds(o.confirmSeconds)}</td>
              <td>
                <StatusBadge status={o.status} />
              </td>
            </tr>
          ))}
        </Table>
      </Section>
    </>
  );
}

// ---- Kitchen ----

function KitchenSection({ data, multiDay }: { data: KitchenHistory; multiDay: boolean }) {
  const { totals, days, breakdown = [], entries } = data;
  const max = Math.max(...days.map((d) => d.tickets));
  return (
    <>
      <div className="kpis">
        <Kpi label="Tickets" value={totals.tickets} />
        <Kpi label="Ready" value={totals.ready} />
        <Kpi label="Avg. time to confirm" value={formatSeconds(totals.avgConfirmSeconds)} />
        <Kpi label="Avg. prep time" value={formatSeconds(totals.avgPrepSeconds)} />
        <Kpi label="Confirmed late" value={totals.late} alert={totals.late > 0} />
      </div>

      {breakdown.length > 1 && (
        <Section title="By station">
          <Table head={['Station', 'Tickets', 'Ready', 'Late', 'Avg. confirm', 'Avg. prep']}>
            {breakdown.map((s) => (
              <tr key={s.name}>
                <td>
                  <strong>{s.name}</strong>
                </td>
                <td>{s.tickets}</td>
                <td>{s.ready}</td>
                <td className={s.late ? 'text-error' : ''}>{s.late}</td>
                <td>{formatSeconds(s.avgConfirmSeconds)}</td>
                <td>{formatSeconds(s.avgPrepSeconds)}</td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      {multiDay && (
        <Section title="By day">
          <Table head={['Day', 'Tickets', 'Ready', 'Late', 'Avg. confirm', 'Avg. prep']}>
            {newestFirst(days).map((d) => (
              <tr key={d.date}>
                <td>{formatDay(d.date)}</td>
                <BarCell value={d.tickets} max={max} />
                <td>{d.ready}</td>
                <td className={d.late ? 'text-error' : ''}>{d.late}</td>
                <td>{formatSeconds(d.avgConfirmSeconds)}</td>
                <td>{formatSeconds(d.avgPrepSeconds)}</td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      <Section title={`Tickets (${entries.length})`}>
        <Table head={['Order', 'Time', 'Station', 'Items', 'Confirmed in', 'Prep time', 'Status']} empty={!entries.length}>
          {entries.map((t) => (
            <tr key={t.id}>
              <td>
                <strong>#{t.orderId}</strong>
                <div className="muted small">{t.customerName}</div>
              </td>
              <td>{multiDay ? formatDateTime(t.createdAt) : formatTime(t.createdAt)}</td>
              <td>{t.stationName}</td>
              <td className="cell-wrap">{t.items}</td>
              <td className={t.late ? 'text-error' : ''}>{formatSeconds(t.confirmSeconds)}</td>
              <td>{formatSeconds(t.prepSeconds)}</td>
              <td>{TICKET_STATUS_LABELS[t.status]}</td>
            </tr>
          ))}
        </Table>
      </Section>
    </>
  );
}

// ---- Deliveries ----

function DeliveriesSection({ data, multiDay }: { data: DeliveriesHistory; multiDay: boolean }) {
  const { totals, days, breakdown = [], entries } = data;
  const max = Math.max(...days.map((d) => d.deliveries));
  return (
    <>
      <div className="kpis">
        <Kpi label="Deliveries" value={totals.deliveries} />
        <Kpi label="Order value" value={formatMoney(totals.value)} />
        <Kpi label="Avg. ready → delivered" value={formatSeconds(totals.avgDeliverySeconds)} />
      </div>

      {breakdown.length > 0 && (
        <Section title="By driver">
          <Table head={['Driver', 'Deliveries', 'Order value', 'Avg. ready → delivered']}>
            {breakdown.map((d) => (
              <tr key={d.name}>
                <td>
                  <strong>{d.name}</strong>
                </td>
                <td>{d.deliveries}</td>
                <td>{formatMoney(d.value)}</td>
                <td>{formatSeconds(d.avgDeliverySeconds)}</td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      {multiDay && (
        <Section title="By day">
          <Table head={['Day', 'Deliveries', 'Order value', 'Avg. ready → delivered']}>
            {newestFirst(days).map((d) => (
              <tr key={d.date}>
                <td>{formatDay(d.date)}</td>
                <BarCell value={d.deliveries} max={max} />
                <td>{formatMoney(d.value)}</td>
                <td>{formatSeconds(d.avgDeliverySeconds)}</td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      <Section title={`Deliveries (${entries.length})`}>
        <Table head={['Order', 'Delivered', 'Customer', 'Location', 'Driver', 'Value', 'Ready → delivered']} empty={!entries.length}>
          {entries.map((o) => (
            <tr key={o.id}>
              <td>
                <strong>#{o.id}</strong>
              </td>
              <td>{multiDay ? formatDateTime(o.deliveredAt) : formatTime(o.deliveredAt)}</td>
              <td>{o.customerName}</td>
              <td className="cell-truncate">{o.location}</td>
              <td>{o.driverName}</td>
              <td>{formatMoney(o.totalAmount)}</td>
              <td>{formatSeconds(o.deliverySeconds)}</td>
            </tr>
          ))}
        </Table>
      </Section>
    </>
  );
}
