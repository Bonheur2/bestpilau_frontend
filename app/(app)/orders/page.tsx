'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAction, useApi, usePageState } from '@/lib/hooks';
import { useSessionUser } from '@/lib/auth';
import { DRIVER_STATUS_LABELS } from '@/lib/constants';
import { Icon } from '@/components/Icon';
import { OrderCard } from '@/components/OrderCard';
import { Alert, Empty, Guard, Loader, PageHeader, Pagination } from '@/components/ui';
import type { Driver, Order } from '@/lib/types';

const PAGE_SIZE = 20;

// Midnight on this device (the shop's day), as an ISO time
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

// Only today's orders that are not delivered yet. Delivered orders leave this page by themselves; they are
// in History, along with earlier days.
const FILTERS = [
  { key: 'active', label: 'Active', query: 'status=PENDING,CONFIRMED,COMPLETED' },
  { key: 'overdue', label: 'Overdue', query: 'overdue=true', danger: true },
  { key: 'pending', label: 'Pending', query: 'status=PENDING' },
  { key: 'confirmed', label: 'Confirmed', query: 'status=CONFIRMED' },
  { key: 'completed', label: 'Ready', query: 'status=COMPLETED' },
];

export default function OrdersPage() {
  return (
    <Guard permissions={['orders.view']}>
      <Suspense fallback={<Loader />}>
        <Orders />
      </Suspense>
    </Guard>
  );
}

interface DriverSelectProps {
  order: Order;
  drivers: Driver[];
  disabled: boolean;
  onAssign: (driverId: string) => void;
}

function DriverSelect({ order, drivers, disabled, onAssign }: DriverSelectProps) {
  const options = drivers.filter((d) => d.availabilityStatus === 'AVAILABLE' || d.id === order.driver?.id);
  return (
    <select
      aria-label={`Assign driver to order ${order.id}`}
      value={order.driver?.id ?? ''}
      disabled={disabled}
      onChange={(e) => e.target.value && onAssign(e.target.value)}
    >
      <option value="">{options.length ? 'Assign a driver…' : 'No drivers available'}</option>
      {options.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
          {d.id === order.driver?.id ? ' (assigned)' : ''}
        </option>
      ))}
    </select>
  );
}

function Orders() {
  const params = useSearchParams();
  const router = useRouter();
  const filter = FILTERS.find((f) => f.key === params.get('filter')) ?? FILTERS[0]; // opens on Active

  // Search by order number (0042 or ORD-1009-0042), customer name or phone
  const [search, setSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const [page, setPage] = usePageState(`${filter.key}|${searchTerm}`);
  const queryString = [
    filter.query,
    `since=${encodeURIComponent(startOfToday())}`,
    searchTerm && `q=${encodeURIComponent(searchTerm)}`,
    `limit=${PAGE_SIZE}`,
    `page=${page}`,
  ]
    .filter(Boolean)
    .join('&');
  const { data, error, loading, reload } = useApi<{ orders: Order[]; total: number }>(`/orders?${queryString}`, {
    interval: 10_000,
    live: ['orders'],
  });
  const overdue = useApi<{ orders: Order[]; total: number }>(`/orders?overdue=true&since=${encodeURIComponent(startOfToday())}`, { interval: 10_000, live: ['orders'] });
  const { can } = useSessionUser();
  // Viewers see orders; only managers recheck them and assign drivers
  const canManage = can('orders.manage');
  const drivers = useApi<{ drivers: Driver[] }>('/drivers', { interval: 15_000, live: ['orders'], enabled: canManage });
  const { busy, error: actionError, setError, run } = useAction();

  const driverList = drivers.data?.drivers ?? [];
  const overdueCount = overdue.data?.total ?? 0;

  const refreshAll = () => Promise.all([reload(), overdue.reload(), drivers.reload()]);

  const recheck = (order: Order) =>
    run(`recheck:${order.id}`, async () => {
      await api(`/orders/${order.id}/recheck`, { method: 'POST' });
      await refreshAll();
    });

  const assign = (order: Order, driverId: string) =>
    run(`assign:${order.id}`, async () => {
      await api(`/orders/${order.id}/assign-driver`, { method: 'POST', body: { driverId: Number(driverId) } });
      await refreshAll();
    });

  return (
    <>
      <PageHeader
        title="Orders"
        actions={
          can('orders.create') && (
            <Link href="/orders/new" className="btn btn-primary">
              <Icon name="plus" /> New order
            </Link>
          )
        }
      />

      {overdueCount > 0 && filter.key !== 'overdue' && (
        <Alert kind="error">
          {overdueCount} order{overdueCount > 1 ? 's' : ''} not confirmed in time.{' '}
          <Link href="/orders?filter=overdue">View</Link>
        </Alert>
      )}
      <Alert onClose={() => setError(null)}>{actionError}</Alert>
      {error && <Alert>{error.message}</Alert>}

      {canManage && (
      <div className="driver-strip" aria-label="Driver availability">
        <span className="muted small">Drivers:</span>
        {driverList.length === 0 && <span className="muted small">none registered</span>}
        {driverList.map((d) => (
          <span key={d.id} className="driver-chip">
            <span className={`dot dot-${d.availabilityStatus.toLowerCase()}`} />
            {d.name} · {DRIVER_STATUS_LABELS[d.availabilityStatus]}
          </span>
        ))}
      </div>
      )}

      <div className="kitchen-bar">
      <div className="tabs" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={f.key === filter.key}
            className={`tab ${f.danger ? 'tab-danger' : ''} ${f.key === filter.key ? 'active' : ''}`}
            onClick={() => router.replace(`/orders?filter=${f.key}`)}
          >
            {f.label}
            {f.key === 'overdue' && overdueCount > 0 && <span className="count">{overdueCount}</span>}
          </button>
        ))}
      </div>
      <div className="menu-search kitchen-search">
        <Icon name="search" size={16} />
        <input
          type="search"
          placeholder="Find order, e.g. 0042"
          aria-label="Find an order by number, customer name or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      </div>

      {loading ? (
        <Loader />
      ) : data?.orders.length ? (
        <>
        <div className="order-grid">
          {data.orders.map((order) => (
            <OrderCard key={order.id} order={order} showTimeline>
              {canManage && order.status === 'PENDING' && (
                <button
                  className={`btn btn-sm ${order.isOverdue ? 'btn-danger' : 'btn-ghost'}`}
                  disabled={busy === `recheck:${order.id}`}
                  onClick={() => recheck(order)}
                >
                  <Icon name="refresh" size={15} /> Recheck
                </button>
              )}
              {canManage && order.status !== 'DELIVERED' && (
                <DriverSelect
                  order={order}
                  drivers={driverList}
                  disabled={busy === `assign:${order.id}`}
                  onAssign={(driverId) => assign(order, driverId)}
                />
              )}
            </OrderCard>
          ))}
        </div>
        <Pagination page={page} total={data.total} size={PAGE_SIZE} onPage={setPage} />
        </>
      ) : (
        <Empty title={searchTerm ? 'No orders match your search' : 'No open orders today'}>
          Delivered orders are in <Link href="/history">History</Link>.
        </Empty>
      )}
    </>
  );
}
