'use client';

import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/hooks';
import type { Station } from '@/lib/types';
import { Alert, Loader } from '@/components/ui';

export function StationsTab() {
  const { data, error, loading, reload } = useApi<{ stations: Station[] }>('/stations');
  const { busy, error: actionError, setError, run } = useAction();
  const [name, setName] = useState('');

  const update = (s: Station, body: Partial<Pick<Station, 'name' | 'isActive'>> | { isDefault: true }) =>
    run(`station:${s.id}`, async () => {
      await api(`/stations/${s.id}`, { method: 'PATCH', body });
      await reload();
    });

  const rename = (s: Station) => {
    const next = window.prompt('Station name', s.name)?.trim();
    if (next && next !== s.name) update(s, { name: next });
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) return setError('Station name must be at least 2 characters');
    run('station:new', async () => {
      await api('/stations', { method: 'POST', body: { name: trimmed } });
      setName('');
      await reload();
    });
  };

  return (
    <div className="admin-grid">
      <section className="card">
        <h2>Stations</h2>
        <Alert onClose={() => setError(null)}>{actionError}</Alert>
        {error && <Alert>{error.message}</Alert>}
        {loading ? (
          <Loader />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Station</th>
                  <th>Categories</th>
                  <th>Products</th>
                  <th>Staff</th>
                  <th>Open tickets</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data?.stations.map((s) => (
                  <tr key={s.id} className={s.isActive ? '' : 'inactive-row'}>
                    <td>
                      <strong>{s.name}</strong>
                      {s.isDefault && <span className="badge badge-neutral" style={{ marginLeft: 8 }}>Default</span>}
                      {!s.isActive && <span className="badge badge-neutral" style={{ marginLeft: 8 }}>Inactive</span>}
                    </td>
                    <td>{s.categoryCount}</td>
                    <td>{s.productCount}</td>
                    <td>{s.staffCount}</td>
                    <td>{s.openTickets}</td>
                    <td>
                      <div className="actions">
                        <button className="btn btn-ghost btn-sm" disabled={busy === `station:${s.id}`} onClick={() => rename(s)}>
                          Rename
                        </button>
                        {!s.isDefault && s.isActive && (
                          <button className="btn btn-ghost btn-sm" disabled={busy === `station:${s.id}`} onClick={() => update(s, { isDefault: true })}>
                            Make default
                          </button>
                        )}
                        {!s.isDefault && (
                          <button
                            className={`btn btn-sm ${s.isActive ? 'btn-danger' : 'btn-ghost'}`}
                            disabled={busy === `station:${s.id}`}
                            onClick={() => update(s, { isActive: !s.isActive })}
                          >
                            {s.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small" style={{ margin: '12px 0 0' }}>
          Items go to their product&apos;s station, otherwise their category&apos;s station, otherwise the default station.
        </p>
      </section>

      <section className="card">
        <h2>New station</h2>
        <form className="inline-form" onSubmit={add}>
          <input aria-label="Station name" placeholder="e.g. Grill" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-dark" disabled={busy === 'station:new'}>
            Add
          </button>
        </form>
      </section>
    </div>
  );
}
