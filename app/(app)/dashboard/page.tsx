'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useSessionUser } from '@/lib/auth';
import { useApi, useNow } from '@/lib/hooks';
import { formatDuration, formatElapsed, formatMoney, formatSeconds, formatTime } from '@/lib/format';
import { DRIVER_STATUS_LABELS, TICKET_STATUS_LABELS } from '@/lib/constants';
import type { Driver, Order, OrderStats, Ticket } from '@/lib/types';
import { Icon } from '@/components/Icon';
import { OrderNumber, orderLabel } from '@/components/OrderNumber';
import { Alert, PageHeader, StatusBadge } from '@/components/ui';

type OrdersResponse = { orders: Order[] };

function Kpi({ label, value, alert }: { label: string; value: ReactNode; alert?: boolean }) {
  return (
    <div className={`kpi ${alert ? 'kpi-alert' : ''}`}>
      <div className="kpi-label">
        {alert && <Icon name="alert" size={14} />}
        {label}
      </div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card panel">
      <header className="panel-head">
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

const itemSummary = (order: Order) => order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ');

// Compact one-line order with a live confirmation countdown.
function OrderRow({ order, now }: { order: Order; now: number }) {
  const remaining = new Date(order.confirmDeadline).getTime() - now;
  return (
    <li className="order-row">
      <span className="order-row-id">
        <OrderNumber number={order.orderNumber} id={order.id} />
      </span>
      <span className="order-row-main">
        <strong>{order.customerName}</strong>
        <span className="muted small">{itemSummary(order)}</span>
      </span>
      {order.status !== 'PENDING' ? (
        <StatusBadge status={order.status} />
      ) : remaining > 0 ? (
        <span className="order-row-time">{formatDuration(remaining)}</span>
      ) : (
        <span className="badge badge-overdue">Late {formatElapsed(-remaining)}</span>
      )}
    </li>
  );
}

function OrderList({ path, empty }: { path: string; empty: string }) {
  const { data, error } = useApi<OrdersResponse>(path, { interval: 10_000, live: ['orders'] });
  const now = useNow(1000);
  if (error) return <Alert>{error.message}</Alert>;
  if (!data) return null;
  if (!data.orders.length) return <p className="panel-empty">{empty}</p>;
  return (
    <ul className="rows">
      {data.orders.map((o) => (
        <OrderRow key={o.id} order={o} now={now} />
      ))}
    </ul>
  );
}

// The kitchen's own work queue (scoped to the cook's station by the API).
function TicketList({ status, empty }: { status: 'PENDING' | 'CONFIRMED'; empty: string }) {
  const { data, error } = useApi<{ tickets: Ticket[] }>(`/tickets?status=${status}`, { interval: 10_000, live: ['tickets'] });
  const now = useNow(1000);
  if (error) return <Alert>{error.message}</Alert>;
  if (!data) return null;
  if (!data.tickets.length) return <p className="panel-empty">{empty}</p>;
  return (
    <ul className="rows">
      {data.tickets.slice(0, 6).map((t) => {
        const remaining = new Date(t.order.confirmDeadline).getTime() - now;
        return (
          <li key={t.id} className="order-row">
            <span className="order-row-id">
              <OrderNumber number={t.order.orderNumber} id={t.order.id} />
            </span>
            <span className="order-row-main">
              <strong>
                {t.station.name} · {t.order.customerName}
              </strong>
              <span className="muted small">{t.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</span>
            </span>
            {t.status !== 'PENDING' ? (
              <span className="muted small">{TICKET_STATUS_LABELS[t.status]}</span>
            ) : remaining > 0 ? (
              <span className="order-row-time">{formatDuration(remaining)}</span>
            ) : (
              <span className="badge badge-overdue">Late {formatElapsed(-remaining)}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function DriverList() {
  const { data, error } = useApi<{ drivers: Driver[] }>('/drivers', { interval: 15_000, live: ['orders'] });
  if (error) return <Alert>{error.message}</Alert>;
  if (!data) return null;
  if (!data.drivers.length) return <p className="panel-empty">No drivers registered</p>;
  return (
    <ul className="rows">
      {data.drivers.map((d) => (
        <li key={d.id} className="driver-row">
          <span className={`dot dot-${d.availabilityStatus.toLowerCase()}`} />
          <strong>{d.name}</strong>
          <span className="muted small">
            {DRIVER_STATUS_LABELS[d.availabilityStatus]}
            {d.activeOrders > 0 && ` · ${d.activeOrders} order${d.activeOrders > 1 ? 's' : ''}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

function RecentOrders() {
  const { data, error } = useApi<OrdersResponse>('/orders?limit=8', { interval: 15_000, live: ['orders'] });
  if (error) return <Alert>{error.message}</Alert>;
  if (!data) return null;
  if (!data.orders.length) return <p className="panel-empty">No orders yet</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Location</th>
            <th>Driver</th>
            <th>Total</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.orders.map((o) => (
            <tr key={o.id}>
              <td>
                <OrderNumber number={o.orderNumber} id={o.id} />
                <div className="muted small">{formatTime(o.createdAt)}</div>
              </td>
              <td>{o.customerName}</td>
              <td className="cell-truncate">{o.location}</td>
              <td>{o.driver?.name ?? <span className="muted">—</span>}</td>
              <td>{formatMoney(o.totalAmount)}</td>
              <td>
                <StatusBadge status={o.status} overdue={o.isOverdue} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pipeline({ stats, linkable }: { stats: OrderStats; linkable: boolean }) {
  const stages = [
    { key: 'pending', label: 'Waiting for kitchen', value: stats.counts.PENDING, late: stats.overdue },
    { key: 'confirmed', label: 'Cooking', value: stats.counts.CONFIRMED, late: 0 },
    { key: 'completed', label: 'Ready for pickup', value: stats.counts.COMPLETED, late: 0 },
  ];
  return (
    <div className="pipeline">
      {stages.map((s) => {
        const body = (
          <>
            <span className="stage-label">{s.label}</span>
            <span className="stage-value">{s.value}</span>
            {s.late > 0 && <span className="badge badge-overdue">{s.late} late</span>}
          </>
        );
        return linkable ? (
          <Link key={s.key} href={`/orders?filter=${s.key}`} className="stage">
            {body}
          </Link>
        ) : (
          <div key={s.key} className="stage">
            {body}
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const { user, can } = useSessionUser();
  const isCare = can('orders.view');
  const isKitchen = can('kitchen.view');
  const isDriver = can('deliveries.deliver') && !isCare && !isKitchen;
  const hasStats = isCare || isKitchen || can('deliveries.view') || can('deliveries.deliver');
  const seesDrivers = can('orders.manage') || can('deliveries.view');

  const { data: stats, error } = useApi<OrderStats>('/orders/stats', { interval: 10_000, enabled: hasStats, live: ['orders', 'tickets'] });
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={date}
        actions={
          can('orders.create') && (
            <Link href="/orders/new" className="btn btn-primary">
              <Icon name="plus" /> New order
            </Link>
          )
        }
      />

      {error && <Alert>{error.message}</Alert>}

      {stats && (
        <div className="kpis">
          {isDriver ? (
            <>
              <Kpi label="Active deliveries" value={stats.counts.PENDING + stats.counts.CONFIRMED + stats.counts.COMPLETED} />
              <Kpi label="Delivered today" value={stats.today.delivered} />
            </>
          ) : (
            <>
              <Kpi label="Orders today" value={stats.today.orders} />
              {isCare && <Kpi label="Sales today" value={formatMoney(stats.today.revenue)} />}
              <Kpi label="Delivered today" value={stats.today.delivered} />
              <Kpi label="Avg. time to confirm" value={formatSeconds(stats.today.avgConfirmSeconds)} />
              <Kpi label="Overdue now" value={stats.overdue} alert={stats.overdue > 0} />
            </>
          )}
        </div>
      )}

      {stats && !isDriver && <Pipeline stats={stats} linkable={isCare} />}

      <div className="panels">
        {isCare && (
          <Panel
            title="Waiting for confirmation"
            action={
              <Link href="/orders?filter=pending" className="panel-link">
                View all
              </Link>
            }
          >
            <OrderList path="/orders?status=PENDING&sort=oldest&limit=6" empty="Nothing waiting" />
          </Panel>
        )}
        {isCare && seesDrivers && (
          <Panel title="Drivers">
            <DriverList />
          </Panel>
        )}

        {isKitchen && !isCare && (
          <>
            <Panel
              title={user.stationName ? `New tickets · ${user.stationName}` : 'New tickets'}
              action={
                <Link href="/kitchen" className="panel-link">
                  Open kitchen
                </Link>
              }
            >
              <TicketList status="PENDING" empty="No new tickets" />
            </Panel>
            <Panel title="Cooking">
              <TicketList status="CONFIRMED" empty="Nothing cooking" />
            </Panel>
          </>
        )}

        {isDriver && (
          <Panel
            title="My deliveries"
            action={
              <Link href="/driver" className="panel-link">
                Open
              </Link>
            }
          >
            <OrderList path="/orders?mine=true&status=PENDING,CONFIRMED,COMPLETED&sort=oldest" empty="No active deliveries" />
          </Panel>
        )}
      </div>

      {isCare && (
        <Panel
          title="Recent orders"
          action={
            <Link href="/orders?filter=all" className="panel-link">
              View all
            </Link>
          }
        >
          <RecentOrders />
        </Panel>
      )}
    </>
  );
}
