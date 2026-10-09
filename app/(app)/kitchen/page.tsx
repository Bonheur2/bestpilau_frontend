'use client';

import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { useSessionUser } from '@/lib/auth';
import { isAllOrId, useAction, useApi, useAppSettings, useNow, useQueryState } from '@/lib/hooks';
import type { Station, Ticket } from '@/lib/types';
import { Icon } from '@/components/Icon';
import { TicketCard } from '@/components/TicketCard';
import { Alert, Empty, Guard, Loader, PageHeader } from '@/components/ui';

export default function KitchenPage() {
  return (
    <Guard permissions={['kitchen.view']}>
      <Suspense fallback={<Loader />}>
        <Kitchen />
      </Suspense>
    </Guard>
  );
}

type View = 'all' | 'new' | 'cooking' | 'late';
const VIEWS: readonly View[] = ['all', 'new', 'cooking', 'late'];

// A rush can mean 100+ tickets. Show the most urgent first and reveal the rest on request,
// so the screen stays fast and readable.
const PAGE_SIZE = 24;
const CHIPS_COLLAPSED = 10;

const deadlineOf = (t: Ticket) => new Date(t.order.confirmDeadline).getTime();
const cookingSinceOf = (t: Ticket) => new Date(t.confirmedAt ?? t.createdAt).getTime();

function Kitchen() {
  const { user, can } = useSessionUser();
  const canPrepare = can('kitchen.prepare');
  const { confirmWindowMinutes } = useAppSettings().settings;
  const now = useNow(1000);

  // Cooks are fixed to their station; the head chef can switch between stations.
  const fixedStation = user.stationId;
  const [stationParam, setStationParam] = useQueryState<string>('station', isAllOrId, 'all');
  const selected: number | 'all' = stationParam === 'all' ? 'all' : Number(stationParam);
  const setSelected = (value: number | 'all') => setStationParam(String(value));
  const stationId = fixedStation ?? (selected === 'all' ? null : selected);

  const [view, setView] = useQueryState<View>('view', VIEWS, 'all');
  const [search, setSearch] = useState('');
  const [dish, setDish] = useState<string | null>(null);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [allChips, setAllChips] = useState(false);

  const stations = useApi<{ stations: Station[] }>('/stations', { enabled: !fixedStation, live: ['tickets'] });
  const { data, error, loading, reload } = useApi<{ tickets: Ticket[] }>(
    `/tickets?status=PENDING,CONFIRMED${stationId ? `&stationId=${stationId}` : ''}`,
    { interval: 5_000, live: ['tickets'] },
  );
  const { busy, error: actionError, setError, run } = useAction();

  const tickets = useMemo(() => data?.tickets ?? [], [data]);
  const everyPending = useMemo(() => tickets.filter((t) => t.status === 'PENDING'), [tickets]);

  // Total of each dish still to prepare, across every open ticket (not affected by filters)
  const toMake = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of tickets) for (const i of t.items) totals.set(i.name, (totals.get(i.name) ?? 0) + i.quantity);
    return [...totals.entries()]
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));
  }, [tickets]);

  const query = search.trim().toLowerCase();
  const matches = (t: Ticket) =>
    (!query ||
      (t.order.orderNumber ?? '').toLowerCase().includes(query) ||
      t.order.customerName.toLowerCase().includes(query)) &&
    (!dish || t.items.some((i) => i.name === dish));

  // Most urgent first: oldest deadline for new tickets, longest-cooking first for the rest
  const pending = useMemo(
    () => everyPending.filter(matches).sort((a, b) => deadlineOf(a) - deadlineOf(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [everyPending, query, dish],
  );
  const cooking = useMemo(
    () =>
      tickets
        .filter((t) => t.status === 'CONFIRMED' && matches(t))
        .sort((a, b) => cookingSinceOf(a) - cookingSinceOf(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tickets, query, dish],
  );
  const late = pending.filter((t) => deadlineOf(t) <= now);

  // Show waiting tickets in the browser tab so the kitchen notices them from another window.
  useEffect(() => {
    document.title = everyPending.length ? `(${everyPending.length}) Kitchen · Best Pilau` : 'Kitchen · Best Pilau';
    return () => {
      document.title = 'Best Pilau';
    };
  }, [everyPending.length]);

  const act = (ticket: Ticket, action: 'confirm' | 'ready') =>
    run(`${action}:${ticket.id}`, async () => {
      await api(`/tickets/${ticket.id}/${action}`, { method: 'POST' });
      await reload();
    });

  const activeStations = (stations.data?.stations ?? []).filter((s) => s.isActive);
  const showStationOnCards = !stationId;
  const filtering = Boolean(query || dish);

  const sections: { key: string; title: string; list: Ticket[] }[] =
    view === 'new'
      ? [{ key: 'new', title: 'Needs confirming', list: pending }]
      : view === 'cooking'
        ? [{ key: 'cooking', title: 'Cooking', list: cooking }]
        : view === 'late'
          ? [{ key: 'late', title: 'Late', list: late }]
          : [
              { key: 'new', title: 'Needs confirming', list: pending },
              { key: 'cooking', title: 'Cooking', list: cooking },
            ];

  const tabs: { key: View; label: string; count: number; danger?: boolean }[] = [
    { key: 'all', label: 'All', count: pending.length + cooking.length },
    { key: 'new', label: 'New', count: pending.length },
    { key: 'cooking', label: 'Cooking', count: cooking.length },
    { key: 'late', label: 'Late', count: late.length, danger: true },
  ];

  const renderCard = (ticket: Ticket): ReactNode => (
    <TicketCard key={ticket.id} ticket={ticket} now={now} showStation={showStationOnCards}>
      {!canPrepare ? (
        <span className="muted small">View only</span>
      ) : ticket.status === 'PENDING' ? (
        <button
          className="btn btn-primary btn-block"
          disabled={busy === `confirm:${ticket.id}`}
          onClick={() => act(ticket, 'confirm')}
        >
          <Icon name="check" /> Confirm
        </button>
      ) : (
        <button
          className="btn btn-success btn-block"
          disabled={busy === `ready:${ticket.id}`}
          onClick={() => act(ticket, 'ready')}
        >
          <Icon name="check" /> Mark ready
        </button>
      )}
    </TicketCard>
  );

  const chips = allChips ? toMake : toMake.slice(0, CHIPS_COLLAPSED);

  return (
    <>
      <PageHeader
        title={fixedStation ? `Kitchen · ${user.stationName}` : 'Kitchen'}
        subtitle={`Confirm new tickets within ${confirmWindowMinutes} minute${confirmWindowMinutes === 1 ? '' : 's'}`}
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

      <Alert onClose={() => setError(null)}>{actionError}</Alert>
      {error && <Alert>{error.message}</Alert>}

      {loading ? (
        <Loader />
      ) : tickets.length === 0 ? (
        <Empty title="No open tickets">New orders appear here the moment they are placed.</Empty>
      ) : (
        <>
          <section className="card kitchen-items" aria-label="Items to make">
            <header className="kitchen-items-head">
              <h2>To make</h2>
              <span className="muted small">
                {toMake.reduce((n, i) => n + i.qty, 0)} items across {tickets.length} ticket{tickets.length === 1 ? '' : 's'}. Tap a
                dish to see only its tickets.
              </span>
            </header>
            <div className="item-chips">
              {chips.map((c) => (
                <button
                  key={c.name}
                  className={`item-chip ${dish === c.name ? 'active' : ''}`}
                  aria-pressed={dish === c.name}
                  onClick={() => setDish(dish === c.name ? null : c.name)}
                >
                  <span className="item-chip-qty">{c.qty}×</span> {c.name}
                </button>
              ))}
              {toMake.length > CHIPS_COLLAPSED && (
                <button className="item-chip item-chip-more" onClick={() => setAllChips((v) => !v)}>
                  {allChips ? 'Show fewer' : `+${toMake.length - CHIPS_COLLAPSED} more`}
                </button>
              )}
            </div>
          </section>

          <div className="kitchen-bar">
            <div className="tabs" role="tablist" aria-label="Show">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={view === t.key}
                  className={`tab ${t.danger ? 'tab-danger' : ''} ${view === t.key ? 'active' : ''}`}
                  onClick={() => setView(t.key)}
                >
                  {t.label}
                  {(t.count > 0 || t.key === 'all') && <span className="count">{t.count}</span>}
                </button>
              ))}
            </div>
            <div className="menu-search kitchen-search">
              <Icon name="search" size={16} />
              <input
                type="search"
                placeholder="Find order, e.g. 0042"
                aria-label="Find an order by number or customer"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {filtering && (
            <p className="kitchen-filter-note muted small">
              Showing tickets
              {dish ? (
                <>
                  {' '}
                  with <strong>{dish}</strong>
                </>
              ) : null}
              {query ? <> matching “{search.trim()}”</> : null}.{' '}
              <button
                className="link-btn"
                onClick={() => {
                  setSearch('');
                  setDish(null);
                }}
              >
                Clear filters
              </button>
            </p>
          )}

          {sections.every((s) => s.list.length === 0) ? (
            <Empty title={filtering ? 'No tickets match' : 'Nothing here right now'} />
          ) : (
            sections.map((section) => {
              if (section.list.length === 0 && view === 'all') return null;
              const limit = limits[section.key] ?? PAGE_SIZE;
              const hidden = section.list.length - limit;
              return (
                <section key={section.key} className="kitchen-section" aria-label={section.title}>
                  <header className="kitchen-section-head">
                    <h2>{section.title}</h2>
                    <span className="count">{section.list.length}</span>
                  </header>
                  {section.list.length === 0 ? (
                    <p className="panel-empty">Nothing here</p>
                  ) : (
                    <div className="kt-grid">{section.list.slice(0, limit).map(renderCard)}</div>
                  )}
                  {hidden > 0 && (
                    <div className="kitchen-more">
                      <button
                        className="btn btn-ghost"
                        onClick={() => setLimits((l) => ({ ...l, [section.key]: limit + PAGE_SIZE }))}
                      >
                        Show {Math.min(hidden, PAGE_SIZE)} more
                        <span className="muted small">({hidden} not shown)</span>
                      </button>
                    </div>
                  )}
                </section>
              );
            })
          )}
        </>
      )}
    </>
  );
}
