'use client';

import { useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useSessionUser } from '@/lib/auth';
import { useAction, useApi, useNow } from '@/lib/hooks';
import { formatMoney, formatSeconds, timeAgo } from '@/lib/format';
import { DRIVER_STATUS_LABELS } from '@/lib/constants';
import type { DeliveriesHistory, Driver, Order } from '@/lib/types';
import { Alert, Loader, PageHeader, StatusBadge } from './ui';

// Delivery dispatch view for Admin / Customer Care: every driver and every active delivery.

function todayQuery() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return new URLSearchParams({
    view: 'deliveries',
    from: from.toISOString(),
    to: to.toISOString(),
    tz: String(new Date().getTimezoneOffset()),
  }).toString();
}

function Kpi({ label, value, alert }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <div className={`kpi ${alert ? 'kpi-alert' : ''}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card panel history-section">
      <header className="panel-head">
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function DeliveriesOverview() {
  const { can } = useSessionUser();
  const canAssign = can('orders');
  const now = useNow(30_000);
  const query = useMemo(todayQuery, []);

  const drivers = useApi<{ drivers: Driver[] }>('/drivers', { interval: 15_000, live: ['orders'] });
  const active = useApi<{ orders: Order[] }>('/orders?status=PENDING,CONFIRMED,COMPLETED&sort=oldest&limit=200', {
    interval: 15_000,
    live: ['orders'],
  });
  const today = useApi<DeliveriesHistory>(`/history?${query}`, { interval: 30_000, live: ['orders'] });
  const { busy, error: actionError, setError, run } = useAction();

  const error = drivers.error ?? active.error ?? today.error;
  if (!drivers.data || !active.data || !today.data) {
    return (
      <>
        <PageHeader title="Deliveries" />
        {error ? <Alert>{error.message}</Alert> : <Loader />}
      </>
    );
  }

  const driverList = drivers.data.drivers;
  const orders = active.data.orders;
  const readyNoDriver = orders.filter((o) => o.status === 'COMPLETED' && !o.driver);
  const withDriver = orders.filter((o) => o.driver);
  const awaitingPickup = withDriver.filter((o) => o.status === 'COMPLETED');
  const available = driverList.filter((d) => d.availabilityStatus === 'AVAILABLE');
  const todayByDriver = new Map((today.data.breakdown ?? []).map((b) => [b.name, b]));

  const assign = (order: Order, driverId: string) =>
    run(`assign:${order.id}`, async () => {
      await api(`/orders/${order.id}/assign-driver`, { method: 'POST', body: { driverId: Number(driverId) } });
      await Promise.all([active.reload(), drivers.reload()]);
    });

  return (
    <>
      <PageHeader
        title="Deliveries"
        actions={
          <Link href="/history" className="btn btn-ghost">
            Delivery reports
          </Link>
        }
      />

      <div className="kpis">
        <Kpi label="Ready, no driver" value={readyNoDriver.length} alert={readyNoDriver.length > 0} />
        <Kpi label="Waiting for pickup" value={awaitingPickup.length} />
        <Kpi label="Drivers available" value={`${available.length} / ${driverList.length}`} />
        <Kpi label="Delivered today" value={today.data.totals.deliveries} />
        <Kpi label="Avg. ready → delivered" value={formatSeconds(today.data.totals.avgDeliverySeconds)} />
      </div>

      <Alert onClose={() => setError(null)}>{actionError}</Alert>

      {readyNoDriver.length > 0 && (
        <Panel title={`Ready with no driver (${readyNoDriver.length})`}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Location</th>
                  <th>Ready since</th>
                  <th>{canAssign ? 'Assign driver' : 'Driver'}</th>
                </tr>
              </thead>
              <tbody>
                {readyNoDriver.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <strong>#{o.id}</strong>
                    </td>
                    <td>{o.customerName}</td>
                    <td className="cell-truncate">{o.location}</td>
                    <td className="text-error">{o.completedAt ? timeAgo(o.completedAt, now) : '—'}</td>
                    <td>
                      {canAssign ? (
                        <select
                          className="select-sm"
                          aria-label={`Assign driver to order ${o.id}`}
                          value=""
                          disabled={busy === `assign:${o.id}` || available.length === 0}
                          onChange={(e) => e.target.value && assign(o, e.target.value)}
                        >
                          <option value="">{available.length ? 'Choose driver…' : 'No drivers available'}</option>
                          {available.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel title="Drivers">
        {driverList.length === 0 ? (
          <p className="panel-empty">No drivers registered</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Status</th>
                  <th>Carrying</th>
                  <th>Delivered today</th>
                  <th>Avg. ready → delivered</th>
                </tr>
              </thead>
              <tbody>
                {driverList.map((d) => {
                  const mine = withDriver.filter((o) => o.driver?.id === d.id);
                  const stats = todayByDriver.get(d.name);
                  return (
                    <tr key={d.id}>
                      <td>
                        <strong>{d.name}</strong>
                        {d.phone && <div className="muted small">{d.phone}</div>}
                      </td>
                      <td>
                        <span className="driver-status">
                          <span className={`dot dot-${d.availabilityStatus.toLowerCase()}`} />
                          {DRIVER_STATUS_LABELS[d.availabilityStatus]}
                        </span>
                      </td>
                      <td>{mine.length ? mine.map((o) => `#${o.id}`).join(', ') : <span className="muted">—</span>}</td>
                      <td>{stats?.deliveries ?? 0}</td>
                      <td>{formatSeconds(stats?.avgDeliverySeconds)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={`Assigned orders (${withDriver.length})`}>
        {withDriver.length === 0 ? (
          <p className="panel-empty">No orders assigned to drivers right now</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Location</th>
                  <th>Driver</th>
                  <th>Driver accepted</th>
                  <th>Total</th>
                  <th>Kitchen</th>
                </tr>
              </thead>
              <tbody>
                {withDriver.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <strong>#{o.id}</strong>
                    </td>
                    <td>
                      {o.customerName}
                      {o.customerPhone && <div className="muted small">{o.customerPhone}</div>}
                    </td>
                    <td className="cell-truncate">{o.location}</td>
                    <td>{o.driver?.name}</td>
                    <td>{o.acceptedAt ? 'Yes' : <span className="text-warn">Not yet</span>}</td>
                    <td>{formatMoney(o.totalAmount)}</td>
                    <td>
                      <StatusBadge status={o.status} overdue={o.isOverdue} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title={`Delivered today (${today.data.entries.length})`}
        action={
          <Link href="/history" className="panel-link">
            All reports
          </Link>
        }
      >
        {today.data.entries.length === 0 ? (
          <p className="panel-empty">Nothing delivered yet today</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Delivered</th>
                  <th>Customer</th>
                  <th>Location</th>
                  <th>Driver</th>
                  <th>Value</th>
                  <th>Ready → delivered</th>
                </tr>
              </thead>
              <tbody>
                {today.data.entries.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <strong>#{o.id}</strong>
                    </td>
                    <td>{new Date(o.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{o.customerName}</td>
                    <td className="cell-truncate">{o.location}</td>
                    <td>{o.driverName}</td>
                    <td>{formatMoney(o.totalAmount)}</td>
                    <td>{formatSeconds(o.deliverySeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
