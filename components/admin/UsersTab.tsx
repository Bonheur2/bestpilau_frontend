'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { api, apiFieldErrors } from '@/lib/api';
import { useSessionUser } from '@/lib/auth';
import { useAction, useApi } from '@/lib/hooks';
import { DRIVER_STATUS_LABELS, ROLE_LABELS, ROLES } from '@/lib/constants';
import { userFormSchema, zodFieldErrors } from '@/lib/schemas';
import type { Role, StaffUser, Station } from '@/lib/types';
import { Alert, Field, Loader } from '@/components/ui';

type UserForm = { name: string; email: string; password: string; role: Role; phone: string; stationId: string };
const EMPTY: UserForm = { name: '', email: '', password: '', role: 'CUSTOMER_CARE', phone: '', stationId: '' };

export function UsersTab() {
  const { user: me } = useSessionUser();
  const { data, error, loading, reload } = useApi<{ users: StaffUser[] }>('/users');
  const stations = useApi<{ stations: Station[] }>('/stations');
  const stationList = (stations.data?.stations ?? []).filter((s) => s.isActive);
  const { busy, error: actionError, setError, run } = useAction();
  const [form, setForm] = useState<UserForm>(EMPTY);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const setField = (key: keyof UserForm) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function create(e: FormEvent) {
    e.preventDefault();
    const parsed = userFormSchema.safeParse(form);
    if (!parsed.success) return setFormErrors(zodFieldErrors(parsed.error));

    const { phone, ...rest } = parsed.data;
    setSaving(true);
    setFormErrors({});
    try {
      await api('/users', {
        method: 'POST',
        body: {
          ...rest,
          ...(rest.role === 'DRIVER' && phone && { phone }),
          ...(rest.role === 'KITCHEN' && form.stationId && { stationId: Number(form.stationId) }),
        },
      });
      setNotice(`Account created for ${rest.name}.`);
      setForm(EMPTY);
      await reload();
    } catch (err) {
      setFormErrors(apiFieldErrors(err));
    } finally {
      setSaving(false);
    }
  }

  const update = (user: StaffUser, body: Partial<{ role: Role; isActive: boolean; password: string; stationId: number | null }>) =>
    run(`user:${user.id}`, async () => {
      await api(`/users/${user.id}`, { method: 'PATCH', body });
      await reload();
    });

  const resetPassword = (user: StaffUser) => {
    const password = window.prompt(`New password for ${user.name} (at least 8 characters):`);
    if (!password) return;
    if (password.length < 8) return setError('Password must be at least 8 characters');
    update(user, { password })?.then(() => setNotice(`Password updated for ${user.name}.`));
  };

  return (
    <div className="admin-grid">
      <section className="card">
        <h2>Users</h2>
        <Alert kind="success" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
        <Alert onClose={() => setError(null)}>{actionError}</Alert>
        {error && <Alert>{error.message}</Alert>}
        {loading ? (
          <Loader />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data?.users.map((u) => {
                  const isMe = u.id === me.id;
                  return (
                    <tr key={u.id} className={u.isActive ? '' : 'inactive-row'}>
                      <td>
                        <strong>{u.name}</strong>
                        {isMe && <span className="muted small"> (you)</span>}
                        <div className="muted small">{u.email}</div>
                      </td>
                      <td>
                        <select
                          aria-label={`Role for ${u.name}`}
                          value={u.role}
                          disabled={isMe || busy === `user:${u.id}`}
                          onChange={(e) => update(u, { role: e.target.value as Role })}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                        {u.role === 'KITCHEN' && (
                          <select
                            className="select-sm"
                            style={{ display: 'block', marginTop: 6 }}
                            aria-label={`Station for ${u.name}`}
                            value={u.station?.id ?? ''}
                            disabled={busy === `user:${u.id}`}
                            onChange={(e) => update(u, { stationId: e.target.value ? Number(e.target.value) : null })}
                          >
                            <option value="">All stations (head chef)</option>
                            {stationList.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>
                        {u.isActive ? (
                          <span className="badge badge-confirmed">Active</span>
                        ) : (
                          <span className="badge badge-neutral">Inactive</span>
                        )}
                        {u.role === 'DRIVER' && u.driver && (
                          <div className="muted small">{DRIVER_STATUS_LABELS[u.driver.availabilityStatus]}</div>
                        )}
                      </td>
                      <td>
                        <div className="actions">
                          <button className="btn btn-ghost btn-sm" onClick={() => resetPassword(u)} disabled={busy === `user:${u.id}`}>
                            Reset password
                          </button>
                          {!isMe && (
                            <button
                              className={`btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-ghost'}`}
                              disabled={busy === `user:${u.id}`}
                              onClick={() => update(u, { isActive: !u.isActive })}
                            >
                              {u.isActive ? 'Deactivate' : 'Reactivate'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>New user</h2>
        <form className="stack" onSubmit={create} noValidate>
          <Alert>{formErrors.form}</Alert>
          <Field label="Full name" htmlFor="u-name" error={formErrors.name}>
            <input id="u-name" value={form.name} onChange={setField('name')} />
          </Field>
          <Field label="Email" htmlFor="u-email" error={formErrors.email}>
            <input id="u-email" type="email" value={form.email} onChange={setField('email')} autoComplete="off" />
          </Field>
          <Field label="Password" htmlFor="u-password" error={formErrors.password}>
            <input id="u-password" type="password" value={form.password} onChange={setField('password')} autoComplete="new-password" />
          </Field>
          <Field label="Role" htmlFor="u-role" error={formErrors.role}>
            <select id="u-role" value={form.role} onChange={setField('role')}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>
          {form.role === 'KITCHEN' && (
            <Field label="Station" htmlFor="u-station">
              <select id="u-station" value={form.stationId} onChange={setField('stationId')}>
                <option value="">All stations (head chef)</option>
                {stationList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {form.role === 'DRIVER' && (
            <Field label="Driver phone (optional)" htmlFor="u-phone" error={formErrors.phone}>
              <input id="u-phone" type="tel" value={form.phone} onChange={setField('phone')} />
            </Field>
          )}
          <button className="btn btn-dark" disabled={saving}>
            {saving ? 'Creating…' : 'Create account'}
          </button>
        </form>
      </section>
    </div>
  );
}
