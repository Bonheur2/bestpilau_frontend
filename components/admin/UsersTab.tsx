'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { api, apiFieldErrors, errorMessage } from '@/lib/api';
import { isDriverStaff, isKitchenStaff, useSessionUser } from '@/lib/auth';
import { paginate, useApi, usePageState } from '@/lib/hooks';
import { DRIVER_STATUS_LABELS } from '@/lib/constants';
import { userFormSchema, zodFieldErrors } from '@/lib/schemas';
import type { RoleInfo, RolesResponse, StaffUser, Station } from '@/lib/types';
import { Alert, Field, Loader, Pagination } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Modal, Switch } from '@/components/Modal';

const STAFF_PER_PAGE = 15;

export function UsersTab() {
  const { user: me, can } = useSessionUser();
  const { data, error, loading, reload } = useApi<{ users: StaffUser[] }>('/users');
  const roles = useApi<RolesResponse>('/roles');
  const stations = useApi<{ stations: Station[] }>('/stations');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = usePageState(search.trim().toLowerCase());

  const roleList = useMemo(() => roles.data?.roles ?? [], [roles.data]);
  // Only an Admin can hand out the Admin role
  const assignableRoles = roleList.filter((r) => !r.isSuperAdmin || me.isSuperAdmin);
  const stationList = (stations.data?.stations ?? []).filter((s) => s.isActive);
  const roleById = new Map(roleList.map((r) => [r.id, r]));

  if (loading) return <Loader />;
  if (error || !data) return <Alert>{error?.message ?? 'Could not load staff'}</Alert>;

  const query = search.trim().toLowerCase();
  const users = data.users.filter(
    (u) => !query || u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query) || u.role.name.toLowerCase().includes(query),
  );

  const shown = paginate(users, page, STAFF_PER_PAGE);

  const roleText = (u: StaffUser) => {
    const role = roleById.get(u.role.id);
    if (role && isKitchenStaff(role)) return `${u.role.name} · ${u.station?.name ?? 'All stations'}`;
    return u.role.name;
  };

  return (
    <>
      <Alert kind="success" onClose={() => setNotice(null)}>
        {notice}
      </Alert>

      <section className="card stations-card">
        <header className="menu-items-head">
          <div>
            <h2>Staff</h2>
            <p className="muted small">
              {data.users.filter((u) => u.isActive).length} active · {data.users.length} total
            </p>
          </div>
          {can('users.create') && (
            <button className="btn btn-primary" onClick={() => setAdding(true)} disabled={!roleList.length}>
              <Icon name="plus" size={16} /> Add staff
            </button>
          )}
        </header>

        <div className="menu-search">
          <Icon name="search" size={16} />
          <input
            type="search"
            placeholder="Search by name, email or role"
            aria-label="Search staff"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="table-wrap">
          <table className="table menu-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {shown.items.map((u) => {
                const isMe = u.id === me.id;
                const editable = can('users.update') && (!u.role.isSuperAdmin || me.isSuperAdmin);
                return (
                  <tr key={u.id} className={u.isActive ? '' : 'is-unavailable'}>
                    <td>
                      <strong>{u.name}</strong>
                      {isMe && <span className="muted small"> (you)</span>}
                      <div className="muted small">{u.email}</div>
                    </td>
                    <td>{roleText(u)}</td>
                    <td>
                      <span className={`badge ${u.isActive ? 'badge-completed' : 'badge-neutral'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {u.driver && roleById.get(u.role.id) && isDriverStaff(roleById.get(u.role.id)!) && (
                        <div className="muted small">{DRIVER_STATUS_LABELS[u.driver.availabilityStatus]}</div>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        {editable && (
                          <button className="icon-btn" onClick={() => setEditing(u)} aria-label={`Edit ${u.name}`} title="Edit">
                            <Icon name="pencil" size={15} />
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
        <Pagination page={shown.page} total={shown.total} size={STAFF_PER_PAGE} onPage={setPage} />
      </section>

      {adding && (
        <StaffDialog
          user={null}
          roles={assignableRoles}
          stations={stationList}
          onClose={() => setAdding(false)}
          onSaved={async (message) => {
            setAdding(false);
            setNotice(message);
            await reload();
          }}
        />
      )}
      {editing && (
        <StaffDialog
          user={editing}
          isMe={editing.id === me.id}
          roles={assignableRoles.some((r) => r.id === editing.role.id) ? assignableRoles : [...assignableRoles, roleById.get(editing.role.id)!]}
          stations={stationList}
          onClose={() => setEditing(null)}
          onSaved={async (message) => {
            setEditing(null);
            setNotice(message);
            await reload();
          }}
        />
      )}
    </>
  );
}

// ---- Add / edit a staff member ----

function StaffDialog({
  user,
  isMe = false,
  roles,
  stations,
  onClose,
  onSaved,
}: {
  user: StaffUser | null;
  isMe?: boolean;
  roles: RoleInfo[];
  stations: Station[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
    roleId: String(user?.role.id ?? roles.find((r) => !r.isSuperAdmin)?.id ?? ''),
    phone: user?.driver?.phone ?? '',
    stationId: user?.station ? String(user.station.id) : '',
  });
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signedOut, setSignedOut] = useState(false);

  const set = (key: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const role = roles.find((r) => String(r.id) === values.roleId);
  const kitchen = role ? isKitchenStaff(role) : false;
  const driver = role ? isDriverStaff(role) : false;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const stationId = kitchen && values.stationId ? Number(values.stationId) : null;
    const phone = driver ? values.phone.trim() : '';

    if (!user) {
      const parsed = userFormSchema.safeParse(values);
      if (!parsed.success) return setErrors(zodFieldErrors(parsed.error));
    } else {
      if (values.name.trim().length < 2) return setErrors({ name: 'Name is required' });
      if (values.password && values.password.length < 8) return setErrors({ password: 'At least 8 characters' });
    }
    setErrors({});
    setSaving(true);
    try {
      if (!user) {
        await api('/users', {
          method: 'POST',
          body: {
            name: values.name.trim(),
            email: values.email.trim(),
            password: values.password,
            roleId: Number(values.roleId),
            ...(stationId && { stationId }),
            ...(phone && { phone }),
          },
        });
        onSaved(`Account created for ${values.name.trim()}.`);
      } else {
        await api(`/users/${user.id}`, {
          method: 'PATCH',
          body: {
            name: values.name.trim(),
            ...(!isMe && { roleId: Number(values.roleId), isActive }),
            stationId,
            ...(driver && { phone }),
            ...(values.password && { password: values.password }),
          },
        });
        onSaved(values.password ? `Saved. ${user.name} now uses the new password and was signed out everywhere.` : 'Changes saved.');
      }
    } catch (err) {
      setErrors(apiFieldErrors(err));
    } finally {
      setSaving(false);
    }
  }

  async function signOutEverywhere() {
    if (!user) return;
    setSigningOut(true);
    try {
      await api(`/users/${user.id}/sign-out`, { method: 'POST' });
      setSignedOut(true);
    } catch (err) {
      setErrors({ form: errorMessage(err) });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <Modal
      open
      title={user ? `Edit ${user.name}` : 'Add staff'}
      description={user ? user.email : 'They sign in with this email and password.'}
      onClose={onClose}
      onSubmit={onSubmit}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-dark" disabled={saving}>
            {saving ? 'Saving…' : user ? 'Save changes' : 'Create account'}
          </button>
        </>
      }
    >
      <div className="stack">
        <Alert>{errors.form}</Alert>
        <div className="form-grid">
          <Field label="Full name" htmlFor="st-name" error={errors.name}>
            <input id="st-name" value={values.name} onChange={set('name')} />
          </Field>
          {!user && (
            <Field label="Email" htmlFor="st-email" error={errors.email}>
              <input id="st-email" type="email" value={values.email} onChange={set('email')} autoComplete="off" />
            </Field>
          )}
          <Field
            label="Role"
            htmlFor="st-role"
            error={errors.roleId}
            hint={isMe ? "You can't change your own role." : role?.description ?? undefined}
          >
            <select id="st-role" value={values.roleId} onChange={set('roleId')} disabled={isMe}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          {kitchen && (
            <Field label="Station" htmlFor="st-station" hint="No station = head chef, who sees every station.">
              <select id="st-station" value={values.stationId} onChange={set('stationId')}>
                <option value="">All stations (head chef)</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {driver && (
            <Field label="Driver phone" htmlFor="st-phone" error={errors.phone}>
              <input id="st-phone" type="tel" value={values.phone} onChange={set('phone')} />
            </Field>
          )}
          <Field
            label={user ? 'New password (optional)' : 'Password'}
            htmlFor="st-password"
            error={errors.password}
            hint={user ? 'Leave empty to keep their password. Setting one signs them out everywhere.' : 'At least 8 characters.'}
          >
            <input id="st-password" type="password" value={values.password} onChange={set('password')} autoComplete="new-password" />
          </Field>
        </div>

        {user && !isMe && (
          <div className="switch-row">
            <div>
              <strong>Active</strong>
              <p className="muted small">Inactive staff can&apos;t sign in and are signed out straight away.</p>
            </div>
            <Switch checked={isActive} label="Active" onChange={setIsActive} />
          </div>
        )}

        {user && (
          <div className="danger-zone">
            <span className="muted small">
              {signedOut
                ? 'Signed out of every device. They need to sign in again.'
                : 'Lost phone or shared login? End every session without changing the password.'}
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={signOutEverywhere} disabled={signingOut || signedOut}>
              <Icon name="logout" size={14} /> {signingOut ? 'Signing out…' : 'Sign out of all devices'}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
