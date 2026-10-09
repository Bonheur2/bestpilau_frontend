'use client';

import { useState, type FormEvent } from 'react';
import { api, apiFieldErrors, errorMessage } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import type { Station } from '@/lib/types';
import { Alert, Field, Loader } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Modal, Switch } from '@/components/Modal';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function StationsTab() {
  const { data, error, loading, reload } = useApi<{ stations: Station[] }>('/stations', { live: ['tickets'] });
  const [editing, setEditing] = useState<Station | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Station | null>(null);

  if (loading) return <Loader />;
  if (error || !data) return <Alert>{error?.message ?? 'Could not load stations'}</Alert>;

  const stations = data.stations;
  const defaultStation = stations.find((s) => s.isDefault);

  return (
    <>
      <section className="card stations-card">
        <header className="menu-items-head">
          <div>
            <h2>Stations</h2>
            <p className="muted small">
              Items go to their own station if set, otherwise their category&apos;s, otherwise the default
              {defaultStation ? ` (${defaultStation.name})` : ''}.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            <Icon name="plus" size={16} /> New station
          </button>
        </header>

        <div className="table-wrap">
          <table className="table menu-table">
            <thead>
              <tr>
                <th>Station</th>
                <th>Categories</th>
                <th>Items</th>
                <th>Staff</th>
                <th>Open tickets</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {stations.map((s) => (
                <tr key={s.id} className={s.isActive ? '' : 'is-unavailable'}>
                  <td>
                    <span className="station-name">
                      <strong>{s.name}</strong>
                      {s.isDefault && <span className="badge badge-neutral">Default</span>}
                      {!s.isActive && <span className="badge badge-neutral">Inactive</span>}
                    </span>
                  </td>
                  <td>{s.categoryCount}</td>
                  <td>{s.itemCount}</td>
                  <td>{s.staffCount}</td>
                  <td>{s.openTickets > 0 ? <strong>{s.openTickets}</strong> : 0}</td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn" onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`} title="Edit">
                        <Icon name="pencil" size={15} />
                      </button>
                      <button
                        className="icon-btn icon-btn-danger"
                        onClick={() => setDeleting(s)}
                        aria-label={`Delete ${s.name}`}
                        title={s.isDefault ? 'The default station cannot be deleted' : 'Delete'}
                        disabled={s.isDefault}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <StationDialog
          station={editing === 'new' ? null : editing}
          currentDefault={defaultStation}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      )}

      {deleting && (
        <DeleteStationDialog
          station={deleting}
          defaultName={defaultStation?.name}
          onClose={() => setDeleting(null)}
          onDeleted={async () => {
            setDeleting(null);
            await reload();
          }}
        />
      )}
    </>
  );
}

// ---- Add / edit ----

function StationDialog({
  station,
  currentDefault,
  onClose,
  onSaved,
}: {
  station: Station | null;
  currentDefault?: Station;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(station?.name ?? '');
  const [isActive, setIsActive] = useState(station?.isActive ?? true);
  const [isDefault, setIsDefault] = useState(station?.isDefault ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const wasDefault = station?.isDefault ?? false;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) return setErrors({ name: 'Name must be at least 2 characters' });
    setErrors({});
    setSaving(true);
    try {
      if (!station) {
        await api('/stations', { method: 'POST', body: { name: trimmed } });
      } else {
        // Only send what changed; the API rejects an empty update
        const body = {
          ...(trimmed !== station.name && { name: trimmed }),
          ...(isActive !== station.isActive && { isActive }),
          ...(isDefault && !wasDefault && { isDefault: true }),
        };
        if (Object.keys(body).length) await api(`/stations/${station.id}`, { method: 'PATCH', body });
      }
      onSaved();
    } catch (err) {
      setErrors(apiFieldErrors(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      size="sm"
      title={station ? 'Edit station' : 'New station'}
      description={station ? undefined : 'A place in the kitchen that prepares part of each order, e.g. Grill or Juice bar.'}
      onClose={onClose}
      onSubmit={onSubmit}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-dark" disabled={saving}>
            {saving ? 'Saving…' : station ? 'Save changes' : 'Create station'}
          </button>
        </>
      }
    >
      <div className="stack">
        <Alert>{errors.form}</Alert>
        <Field label="Name" htmlFor="st-name" error={errors.name}>
          <input id="st-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grill" />
        </Field>

        {station && (
          <>
            <div className="switch-row">
              <div>
                <strong>Active</strong>
                <p className="muted small">
                  {wasDefault
                    ? 'The default station is always active.'
                    : station.openTickets > 0
                      ? `Finish its ${plural(station.openTickets, 'open ticket')} before deactivating.`
                      : 'Inactive stations get no new tickets; their items go to the default station.'}
                </p>
              </div>
              <Switch
                checked={isActive}
                label="Active"
                disabled={wasDefault || (station.isActive && station.openTickets > 0)}
                onChange={(on) => {
                  setIsActive(on);
                  if (!on) setIsDefault(false);
                }}
              />
            </div>
            <div className="switch-row">
              <div>
                <strong>Default station</strong>
                <p className="muted small">
                  {wasDefault
                    ? 'To change the default, open another station and make it the default.'
                    : `Items with no station anywhere go here${currentDefault ? ` instead of ${currentDefault.name}` : ''}.`}
                </p>
              </div>
              <Switch
                checked={isDefault}
                label="Default station"
                disabled={wasDefault || !isActive}
                onChange={setIsDefault}
              />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ---- Delete ----

function DeleteStationDialog({
  station,
  defaultName,
  onClose,
  onDeleted,
}: {
  station: Station;
  defaultName?: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Known blockers are shown up front; order history is only known to the server
  const blocker = station.staffCount
    ? `${plural(station.staffCount, 'staff member')} ${station.staffCount === 1 ? 'is' : 'are'} assigned here. Move them to another station first in Settings → Users & roles.`
    : null;
  const moving = [
    station.categoryCount ? plural(station.categoryCount, 'category', 'categories') : null,
    station.productCount ? plural(station.productCount, 'item') : null,
  ].filter(Boolean);

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      await api(`/stations/${station.id}`, { method: 'DELETE' });
      onDeleted();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      open
      size="sm"
      title={`Delete ${station.name}?`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-danger-solid" disabled={deleting || Boolean(blocker)} onClick={remove}>
            {deleting ? 'Deleting…' : 'Delete station'}
          </button>
        </>
      }
    >
      <div className="stack">
        {blocker ? (
          <Alert kind="warn">{blocker}</Alert>
        ) : (
          <p className="muted small" style={{ margin: 0 }}>
            {moving.length
              ? `Its ${moving.join(' and ')} will move to ${defaultName ?? 'the default station'}.`
              : 'Nothing is assigned to this station.'}{' '}
            Stations that already have orders can&apos;t be deleted; deactivate them instead.
          </p>
        )}
        <Alert>{error}</Alert>
      </div>
    </Modal>
  );
}
