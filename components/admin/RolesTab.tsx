'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, apiFieldErrors, errorMessage } from '@/lib/api';
import { useSessionUser } from '@/lib/auth';
import { isAllOrId, useApi, useQueryState } from '@/lib/hooks';
import type { Permission, PermissionGroup, RoleInfo, RolesResponse } from '@/lib/types';
import { Alert, Field, Loader } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Modal } from '@/components/Modal';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// "Create orders" needs "View orders": which permissions does each one bring along?
function impliesMap(groups: PermissionGroup[]) {
  return new Map(groups.flatMap((g) => g.permissions.map((p) => [p.key, p.implies ?? []] as const)));
}

export function RolesTab() {
  const { can } = useSessionUser();
  const canManage = can('roles.manage');
  const { data, error, loading, reload } = useApi<RolesResponse>('/roles');
  const [roleParam, setRoleParam] = useQueryState<string>('role', isAllOrId, 'all');
  const [creating, setCreating] = useState(false);

  if (loading) return <Loader />;
  if (error || !data) return <Alert>{error?.message ?? 'Could not load roles'}</Alert>;

  const selected = data.roles.find((r) => String(r.id) === roleParam) ?? data.roles[0];

  return (
    <>
      <div className="menu-manager">
        <aside className="card menu-categories">
          <header className="menu-categories-head">
            <h2>Roles</h2>
            {canManage && (
              <button className="btn btn-ghost btn-sm" onClick={() => setCreating(true)}>
                <Icon name="plus" size={15} /> New
              </button>
            )}
          </header>
          <nav className="menu-category-list" aria-label="Roles">
            {data.roles.map((r) => (
              <button
                key={r.id}
                className={`menu-category ${selected?.id === r.id ? 'active' : ''}`}
                aria-current={selected?.id === r.id ? 'true' : undefined}
                onClick={() => setRoleParam(String(r.id))}
              >
                <span className="menu-category-name">
                  {r.name}
                  <span className="menu-category-station">
                    {r.isSuperAdmin ? 'Full access' : plural(r.permissions.length, 'permission')}
                  </span>
                </span>
                <span className="menu-category-count" title="Staff with this role">
                  {r.userCount}
                </span>
              </button>
            ))}
          </nav>
        </aside>

        {selected && (
          <RoleEditor
            key={selected.id}
            role={selected}
            groups={data.groups}
            canManage={canManage}
            onSaved={reload}
            onDeleted={async () => {
              setRoleParam('all');
              await reload();
            }}
          />
        )}
      </div>

      {creating && (
        <NewRoleDialog
          roles={data.roles}
          onClose={() => setCreating(false)}
          onCreated={async (id) => {
            setCreating(false);
            await reload();
            setRoleParam(String(id));
          }}
        />
      )}
    </>
  );
}

function RoleEditor({
  role,
  groups,
  canManage,
  onSaved,
  onDeleted,
}: {
  role: RoleInfo;
  groups: PermissionGroup[];
  canManage: boolean;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const implies = useMemo(() => impliesMap(groups), [groups]);
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? '');
  const [granted, setGranted] = useState<Set<Permission>>(new Set(role.permissions));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => setSaved(false), [name, description, granted]);

  const editable = canManage && !role.isSuperAdmin;
  // A permission required by another granted one is shown ticked and locked
  const requiredBy = (key: Permission) =>
    [...granted].filter((g) => implies.get(g)?.includes(key));

  const toggle = (key: Permission, on: boolean) =>
    setGranted((prev) => {
      const next = new Set(prev);
      if (on) {
        next.add(key);
        for (const implied of implies.get(key) ?? []) next.add(implied);
      } else {
        next.delete(key);
      }
      return next;
    });

  const dirty =
    name.trim() !== role.name ||
    (description.trim() || null) !== (role.description ?? null) ||
    granted.size !== role.permissions.length ||
    role.permissions.some((p) => !granted.has(p));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setErrors({ name: 'Name must be at least 2 characters' });
    setErrors({});
    setSaving(true);
    try {
      await api(`/roles/${role.id}`, {
        method: 'PATCH',
        body: { name: name.trim(), description: description.trim(), permissions: [...granted] },
      });
      setSaved(true);
      onSaved();
    } catch (err) {
      setErrors(apiFieldErrors(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await api(`/roles/${role.id}`, { method: 'DELETE' });
      onDeleted();
    } catch (err) {
      setErrors({ form: errorMessage(err) });
      setConfirmDelete(false);
    } finally {
      setSaving(false);
    }
  }

  const labelOf = (key: Permission) => groups.flatMap((g) => g.permissions).find((p) => p.key === key)?.label ?? key;

  return (
    <form className="card menu-items role-editor" onSubmit={save} noValidate>
      <header className="menu-items-head">
        <div className="role-editor-title">
          {editable ? (
            <div className="form-grid">
              <Field label="Role name" htmlFor="role-name" error={errors.name}>
                <input id="role-name" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Description" htmlFor="role-desc">
                <input
                  id="role-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What this role is for"
                />
              </Field>
            </div>
          ) : (
            <>
              <h2>{role.name}</h2>
              <p className="muted small">
                {role.description ?? ''}
                {role.description ? ' · ' : ''}
                {plural(role.userCount, 'staff member')}
              </p>
            </>
          )}
        </div>
      </header>

      <div className="role-body">
        {role.isSuperAdmin ? (
          <Alert kind="warn">
            Admin always has every permission, so it can&apos;t be edited or deleted. Create another role for limited access.
          </Alert>
        ) : !canManage ? (
          <p className="muted small" style={{ margin: '0 0 12px' }}>
            You can view this role. Changing roles needs the Manage roles permission.
          </p>
        ) : null}
        <Alert>{errors.form}</Alert>

        <div className="permission-groups">
          {groups.map((group) => (
            <fieldset key={group.key} className="permission-group">
              <legend>{group.label}</legend>
              {group.permissions.map((p) => {
                const on = role.isSuperAdmin || granted.has(p.key);
                const lockedBy = requiredBy(p.key);
                return (
                  <label key={p.key} className={`permission ${on ? 'is-on' : ''}`}>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={on}
                      disabled={!editable || lockedBy.length > 0}
                      onChange={(e) => toggle(p.key, e.target.checked)}
                    />
                    <span>
                      <strong>{p.label}</strong>
                      <span className="muted small">
                        {p.description}
                        {editable && lockedBy.length > 0 && ` · Needed for ${lockedBy.map(labelOf).join(', ')}`}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ))}
        </div>
      </div>

      {editable && (
        <footer className="settings-footer">
          <span className="settings-footer-note">
            {confirmDelete ? (
              <span className="danger-zone-actions">
                <span>Delete “{role.name}”?</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
                <button type="button" className="btn btn-danger-solid btn-sm" onClick={remove} disabled={saving}>
                  Delete
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={role.userCount > 0}
                title={role.userCount ? `Move its ${plural(role.userCount, 'staff member')} to another role first` : undefined}
                onClick={() => setConfirmDelete(true)}
              >
                <Icon name="trash" size={14} /> Delete role
              </button>
            )}
          </span>
          {saved && !dirty && (
            <span className="settings-saved">
              <Icon name="check" size={15} /> Saved
            </span>
          )}
          <button className="btn btn-dark" disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </footer>
      )}
    </form>
  );
}

function NewRoleDialog({
  roles,
  onClose,
  onCreated,
}: {
  roles: RoleInfo[];
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [copyFrom, setCopyFrom] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setErrors({ name: 'Name must be at least 2 characters' });
    setErrors({});
    setSaving(true);
    try {
      const source = roles.find((r) => String(r.id) === copyFrom && !r.isSuperAdmin);
      const res = await api<{ roleId: number }>('/roles', {
        method: 'POST',
        body: { name: name.trim(), description: description.trim(), permissions: source?.permissions ?? [] },
      });
      onCreated(res.roleId);
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
      title="New role"
      description="Start empty, or copy another role's permissions and adjust them."
      onClose={onClose}
      onSubmit={onSubmit}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-dark" disabled={saving}>
            {saving ? 'Creating…' : 'Create role'}
          </button>
        </>
      }
    >
      <div className="stack">
        <Alert>{errors.form}</Alert>
        <Field label="Name" htmlFor="nr-name" error={errors.name}>
          <input id="nr-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Supervisor" />
        </Field>
        <Field label="Description (optional)" htmlFor="nr-desc">
          <input id="nr-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Start from" htmlFor="nr-copy">
          <select id="nr-copy" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
            <option value="">No permissions</option>
            {roles
              .filter((r) => !r.isSuperAdmin)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  Copy of {r.name}
                </option>
              ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}
