'use client';

import { Suspense, useEffect } from 'react';
import { api } from '@/lib/api';
import { useSessionUser } from '@/lib/auth';
import { isAllOrId, useAction, useApi, useQueryState } from '@/lib/hooks';
import { CONFIRM_MINUTES } from '@/lib/constants';
import type { Station, Ticket } from '@/lib/types';
import { Icon } from '@/components/Icon';
import { TicketCard } from '@/components/TicketCard';
import { Alert, Empty, Guard, Loader, PageHeader } from '@/components/ui';

export default function KitchenPage() {
  return (
    <Guard modules={['kitchen']}>
      <Suspense fallback={<Loader />}>
        <Kitchen />
      </Suspense>
    </Guard>
  );
}

function Kitchen() {
  const { user } = useSessionUser();
  // Cooks are fixed to their station; the head chef can switch between stations.
  const fixedStation = user.stationId;
  const [stationParam, setStationParam] = useQueryState<string>('station', isAllOrId, 'all');
  const selected: number | 'all' = stationParam === 'all' ? 'all' : Number(stationParam);
  const setSelected = (value: number | 'all') => setStationParam(String(value));
  const stationId = fixedStation ?? (selected === 'all' ? null : selected);

  const stations = useApi<{ stations: Station[] }>('/stations', { enabled: !fixedStation, live: ['tickets'] });
  const { data, error, loading, reload } = useApi<{ tickets: Ticket[] }>(
    `/tickets?status=PENDING,CONFIRMED${stationId ? `&stationId=${stationId}` : ''}`,
    { interval: 5_000, live: ['tickets'] },
  );
  const { busy, error: actionError, setError, run } = useAction();

  const tickets = data?.tickets ?? [];
  const pending = tickets.filter((t) => t.status === 'PENDING');
  const cooking = tickets.filter((t) => t.status === 'CONFIRMED');
  const late = pending.filter((t) => new Date(t.order.confirmDeadline).getTime() < Date.now()).length;

  // Show waiting tickets in the browser tab so the kitchen notices them from another window.
  useEffect(() => {
    document.title = pending.length ? `(${pending.length}) Kitchen · Best Pilau` : 'Kitchen · Best Pilau';
    return () => {
      document.title = 'Best Pilau';
    };
  }, [pending.length]);

  const act = (ticket: Ticket, action: 'confirm' | 'ready') =>
    run(`${action}:${ticket.id}`, async () => {
      await api(`/tickets/${ticket.id}/${action}`, { method: 'POST' });
      await reload();
    });

  const activeStations = (stations.data?.stations ?? []).filter((s) => s.isActive);
  const showStationOnCards = !stationId;

  return (
    <>
      <PageHeader
        title={fixedStation ? `Kitchen · ${user.stationName}` : 'Kitchen'}
        subtitle={`Confirm new tickets within ${CONFIRM_MINUTES} minutes`}
      />

      {!fixedStation && activeStations.length > 0 && (
        <div className="tabs" role="tablist" aria-label="Station">
          <button
            role="tab"
            aria-selected={selected === 'all'}
            className={`tab ${selected === 'all' ? 'active' : ''}`}
            onClick={() => setSelected('all')}
          >
            All stations
          </button>
          {activeStations.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={selected === s.id}
              className={`tab ${selected === s.id ? 'active' : ''}`}
              onClick={() => setSelected(s.id)}
            >
              {s.name}
              {s.openTickets > 0 && <span className="count">{s.openTickets}</span>}
            </button>
          ))}
        </div>
      )}

      {late > 0 && (
        <Alert kind="error">
          {late} ticket{late > 1 ? 's' : ''} not confirmed within {CONFIRM_MINUTES} minutes.
        </Alert>
      )}
      <Alert onClose={() => setError(null)}>{actionError}</Alert>
      {error && <Alert>{error.message}</Alert>}

      {loading ? (
        <Loader />
      ) : (
        <div className="board">
          <section className="board-col" aria-label="New tickets">
            <div className="board-col-head">
              <h2>New</h2>
              <span className="count">{pending.length}</span>
            </div>
            {pending.length === 0 && <Empty title="No new tickets" />}
            {pending.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} showStation={showStationOnCards}>
                <button
                  className="btn btn-primary btn-block"
                  disabled={busy === `confirm:${ticket.id}`}
                  onClick={() => act(ticket, 'confirm')}
                >
                  <Icon name="check" /> Confirm
                </button>
              </TicketCard>
            ))}
          </section>

          <section className="board-col" aria-label="Cooking">
            <div className="board-col-head">
              <h2>Cooking</h2>
              <span className="count">{cooking.length}</span>
            </div>
            {cooking.length === 0 && <Empty title="Nothing cooking" />}
            {cooking.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} showStation={showStationOnCards}>
                <button
                  className="btn btn-success btn-block"
                  disabled={busy === `ready:${ticket.id}`}
                  onClick={() => act(ticket, 'ready')}
                >
                  <Icon name="check" /> Mark ready
                </button>
              </TicketCard>
            ))}
          </section>
        </div>
      )}
    </>
  );
}
