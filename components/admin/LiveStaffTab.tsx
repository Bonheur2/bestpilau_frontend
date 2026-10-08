'use client';

import { useApi, useNow } from '@/lib/hooks';
import { useLiveStatus } from '@/lib/realtime';
import { ROLE_LABELS } from '@/lib/constants';
import { timeAgo } from '@/lib/format';
import type { PresenceUser, Role, SoundState, StaffUser, Station } from '@/lib/types';
import { Alert, Loader } from '@/components/ui';
import { Icon } from '@/components/Icon';

// Roles whose screens play alerts; for anyone else sound doesn't matter.
const ALERT_ROLES: Role[] = ['KITCHEN', 'CUSTOMER_CARE', 'DRIVER'];

const SOUND_LABEL: Record<SoundState, string> = {
  on: 'Sound on',
  muted: 'Muted',
  locked: 'Not enabled',
};

function SoundBadge({ state }: { state: SoundState | null }) {
  if (!state) return <span className="badge badge-neutral">Checking…</span>;
  return (
    <span className={`sound-badge sound-${state}`}>
      <Icon name={state === 'on' ? 'volume' : 'volumeOff'} size={14} />
      {SOUND_LABEL[state]}
    </span>
  );
}

const hearsAlerts = (u: PresenceUser) => u.devices.some((d) => d.sound === 'on');

// idle: nothing is routed to this station and it has no open tickets, so silence there is fine
type Coverage = { name: string; online: number; hearing: number; idle: boolean };

// Is anyone who would receive this station's tickets online with sound on?
function stationCoverage(stations: Station[], online: PresenceUser[]): Coverage[] {
  const kitchen = online.filter((u) => u.role === 'KITCHEN' || u.role === 'ADMIN');
  return stations
    .filter((s) => s.isActive)
    .map((s) => {
      // Cooks at this station, plus head chefs (kitchen users with no station) who see every station
      const covering = kitchen.filter((u) => u.stationId === s.id || (u.role === 'KITCHEN' && !u.stationId));
      const idle = s.productCount + s.categoryCount === 0 && s.openTickets === 0;
      return { name: s.name, online: covering.length, hearing: covering.filter(hearsAlerts).length, idle };
    });
}

export function LiveStaffTab() {
  const live = useLiveStatus();
  const presence = useApi<{ users: PresenceUser[] }>('/presence', { interval: 30_000, live: ['presence'] });
  const staff = useApi<{ users: StaffUser[] }>('/users');
  const stations = useApi<{ stations: Station[] }>('/stations');
  const now = useNow(30_000);

  const error = presence.error ?? staff.error ?? stations.error;
  if (error) return <Alert>{error.message}</Alert>;
  if (!presence.data || !staff.data || !stations.data) return <Loader />;

  const online = presence.data.users;
  const onlineById = new Map(online.map((u) => [u.id, u]));
  const coverage = stationCoverage(stations.data.stations, online);
  const careOnline = online.filter((u) => u.role === 'CUSTOMER_CARE');
  const driversOnline = online.filter((u) => u.role === 'DRIVER');

  // Every active staff member who should hear alerts; online first, then by name
  const rows = staff.data.users
    .filter((u) => u.isActive && ALERT_ROLES.includes(u.role))
    .sort((a, b) => Number(onlineById.has(b.id)) - Number(onlineById.has(a.id)) || a.name.localeCompare(b.name));

  const problems = [
    ...coverage
      .filter((c) => c.hearing === 0 && !c.idle)
      .map((c) =>
        c.online === 0
          ? `${c.name}: no kitchen screen is open, so new tickets won't be noticed.`
          : `${c.name}: open but no device has sound on, so new tickets are silent.`,
      ),
    ...(careOnline.length > 0 && !careOnline.some(hearsAlerts)
      ? ['Customer Care: online but sound is off, so overdue orders are silent.']
      : []),
  ];

  return (
    <div className="stack">
      {live !== 'live' && (
        <Alert kind="warn">This screen isn&apos;t connected, so the list may be out of date. Reconnecting…</Alert>
      )}

      <section className="card panel">
        <header className="panel-head">
          <h2>Alert coverage</h2>
          <span className="muted small">Updates live</span>
        </header>
        <div className="coverage-grid">
          {coverage.map((c) => (
            <div key={c.name} className={`coverage ${c.hearing ? 'coverage-ok' : c.idle ? '' : 'coverage-bad'}`}>
              <span className="coverage-name">{c.name}</span>
              <span className="coverage-state">
                <Icon name={c.hearing ? 'volume' : 'volumeOff'} size={15} />
                {c.hearing
                  ? `${c.hearing} device${c.hearing > 1 ? 's' : ''} with sound`
                  : c.idle
                    ? 'No items routed here'
                    : c.online
                    ? 'Open, but silent'
                    : 'Nobody online'}
              </span>
            </div>
          ))}
          <div className={`coverage ${careOnline.some(hearsAlerts) ? 'coverage-ok' : careOnline.length ? 'coverage-bad' : ''}`}>
            <span className="coverage-name">Customer Care</span>
            <span className="coverage-state">
              {careOnline.length ? `${careOnline.length} online` : 'Nobody online'}
            </span>
          </div>
          <div className="coverage">
            <span className="coverage-name">Drivers</span>
            <span className="coverage-state">{driversOnline.length} online</span>
          </div>
        </div>
        {problems.length > 0 && (
          <div className="coverage-problems">
            {problems.map((p) => (
              <Alert key={p}>{p}</Alert>
            ))}
          </div>
        )}
      </section>

      <section className="card panel">
        <header className="panel-head">
          <h2>Staff</h2>
          <span className="muted small">
            {online.filter((u) => ALERT_ROLES.includes(u.role)).length} of {rows.length} online
          </span>
        </header>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Device</th>
                <th>Sound</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const p = onlineById.get(u.id);
                const role = `${ROLE_LABELS[u.role]}${u.role === 'KITCHEN' ? ` · ${u.station?.name ?? 'All stations'}` : ''}`;
                if (!p) {
                  return (
                    <tr key={u.id} className="inactive-row">
                      <td>
                        <strong>{u.name}</strong>
                      </td>
                      <td>{role}</td>
                      <td>
                        <span className="driver-status">
                          <span className="dot dot-offline" /> Offline
                        </span>
                      </td>
                      <td>—</td>
                      <td>—</td>
                    </tr>
                  );
                }
                return p.devices.map((d, i) => (
                  <tr key={`${u.id}-${i}`}>
                    <td>{i === 0 && <strong>{u.name}</strong>}</td>
                    <td>{i === 0 && role}</td>
                    <td>
                      <span className="driver-status">
                        <span className="dot dot-available" /> Online {timeAgo(d.connectedAt, now).replace('just now', 'now')}
                      </span>
                    </td>
                    <td className="muted">{d.device}</td>
                    <td>
                      <SoundBadge state={d.sound} />
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      </section>
      <p className="muted small">
        &ldquo;Not enabled&rdquo; means nobody has tapped that screen yet, so the browser is still blocking sound. Ask them to
        tap <strong>Turn on sound</strong> in the header.
      </p>
    </div>
  );
}
