'use client';

import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/hooks';
import { DRIVER_STATUS_LABELS } from '@/lib/constants';
import { Icon } from '@/components/Icon';
import { OrderCard } from '@/components/OrderCard';
import { Alert, Empty, Guard, Loader, PageHeader } from '@/components/ui';
import { DeliveriesOverview } from '@/components/DeliveriesOverview';
import { useSessionUser } from '@/lib/auth';
import type { Driver as DriverProfile, Order } from '@/lib/types';

type DeliveryAction = 'accept' | 'deliver';

export default function DriverPage() {
  return (
    <Guard permissions={['deliveries.view', 'deliveries.deliver']}>
      <DeliveriesScreen />
    </Guard>
  );
}

// Drivers get their own deliveries; supervisors (no driver profile) get the overview of all drivers.
function DeliveriesScreen() {
  const { user, can } = useSessionUser();
  if (user.driverId) return <Driver />;
  if (can('deliveries.view')) return <DeliveriesOverview />;
  return (
    <>
      <PageHeader title="Deliveries" />
      <Alert>Your account has no driver profile. Ask an admin to give your role the Deliver orders permission.</Alert>
    </>
  );
}

interface DeliveryButtonProps {
  order: Order;
  busy: string | null;
  onAction: (order: Order, action: DeliveryAction) => void;
}

function DeliveryButton({ order, busy, onAction }: DeliveryButtonProps) {
  if (!order.acceptedAt) {
    return (
      <button className="btn btn-dark btn-block" disabled={busy === `accept:${order.id}`} onClick={() => onAction(order, 'accept')}>
        <Icon name="check" /> Accept delivery
      </button>
    );
  }
  if (order.status === 'COMPLETED') {
    return (
      <button className="btn btn-success btn-block" disabled={busy === `deliver:${order.id}`} onClick={() => onAction(order, 'deliver')}>
        <Icon name="truck" /> Mark as delivered
      </button>
    );
  }
  return (
    <span className="muted small">
      <Icon name="clock" size={15} /> Waiting for{' '}
      {order.tickets
        .filter((t) => t.status !== 'READY')
        .map((t) => t.stationName)
        .join(', ') || 'kitchen'}
    </span>
  );
}

function Driver() {
  const me = useApi<{ driver: DriverProfile }>('/drivers/me', { interval: 15_000, live: ['orders'] });
  const hasProfile = Boolean(me.data?.driver);
  const active = useApi<{ orders: Order[] }>('/orders?mine=true&status=PENDING,CONFIRMED,COMPLETED&sort=oldest', {
    interval: 8_000,
    enabled: hasProfile,
    live: ['orders'],
  });
  const history = useApi<{ orders: Order[] }>('/orders?mine=true&status=DELIVERED&limit=10', { enabled: hasProfile, live: ['orders'] });
  const { busy, error: actionError, setError, run } = useAction();

  if (me.loading) return <Loader />;
  if (me.error || !me.data) {
    return (
      <>
        <PageHeader title="Deliveries" />
        <Alert>{me.error?.message ?? 'Could not load your driver profile'}</Alert>
      </>
    );
  }

  const driver = me.data.driver;
  const activeOrders = active.data?.orders ?? [];

  const refresh = () => Promise.all([me.reload(), active.reload(), history.reload()]);

  const act = (order: Order, action: DeliveryAction) =>
    run(`${action}:${order.id}`, async () => {
      await api(`/orders/${order.id}/${action}`, { method: 'POST' });
      await refresh();
    });

  const setAvailability = (status: 'AVAILABLE' | 'OFFLINE') =>
    run('availability', async () => {
      await api('/drivers/me/availability', { method: 'PATCH', body: { status } });
      await me.reload();
    });

  return (
    <>
      <PageHeader title="My deliveries" />

      <div className="card availability">
        <div className="availability-status">
          <span className={`dot dot-${driver.availabilityStatus.toLowerCase()}`} />
          {DRIVER_STATUS_LABELS[driver.availabilityStatus]}
        </div>
        {driver.availabilityStatus === 'BUSY' ? (
          <span className="muted small">Available again after your last delivery</span>
        ) : driver.availabilityStatus === 'AVAILABLE' ? (
          <button className="btn btn-ghost" disabled={busy === 'availability'} onClick={() => setAvailability('OFFLINE')}>
            Go offline
          </button>
        ) : (
          <button className="btn btn-primary" disabled={busy === 'availability'} onClick={() => setAvailability('AVAILABLE')}>
            Go available
          </button>
        )}
      </div>

      <Alert onClose={() => setError(null)}>{actionError}</Alert>
      {active.error && <Alert>{active.error.message}</Alert>}

      <h2 className="section-title">Active ({activeOrders.length})</h2>
      {active.loading ? (
        <Loader />
      ) : activeOrders.length ? (
        <div className="order-grid">
          {activeOrders.map((order) => (
            <OrderCard key={order.id} order={order} showTimeline>
              <div className="driver-actions">
                {order.customerPhone ? (
                  <a className="btn btn-ghost call-btn" href={`tel:${order.customerPhone.replace(/[\s-]/g, '')}`}>
                    <Icon name="phone" /> Call customer · {order.customerPhone}
                  </a>
                ) : (
                  <span className="muted small">No phone number on this order. Ask Customer Care.</span>
                )}
                <DeliveryButton order={order} busy={busy} onAction={act} />
              </div>
            </OrderCard>
          ))}
        </div>
      ) : (
        <Empty title="No active deliveries" />
      )}

      {history.data && history.data.orders.length > 0 && (
        <>
          <h2 className="section-title" style={{ marginTop: 32 }}>
            Recently delivered
          </h2>
          <div className="order-grid">
            {history.data.orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
