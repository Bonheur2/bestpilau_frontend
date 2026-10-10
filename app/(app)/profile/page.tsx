'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { api, apiFieldErrors, errorMessage } from '@/lib/api';
import { isKitchenStaff, roleLabel, useSessionUser } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { initials } from '@/lib/format';
import { passwordSchema, profileSchema, zodFieldErrors } from '@/lib/schemas';
import type { Profile, SessionEndReason, SessionEntry } from '@/lib/types';
import { Icon } from '@/components/Icon';
import { Alert, Field, Loader } from '@/components/ui';

const formatDate = (date: string | null) =>
  date ? new Date(date).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }) : null;

export default function ProfilePage() {
  const { data, error, reload } = useApi<{ user: Profile }>('/auth/me');

  if (error) return <Alert>{error.message}</Alert>;
  if (!data) return <Loader />;
  const profile = data.user;

  return (
    <div className="profile">
      <ProfileHeader profile={profile} />
      <DetailsSection profile={profile} onSaved={reload} />
      <AccountSection profile={profile} />
      <PasswordSection profile={profile} onChanged={reload} />
      <SessionsSection profile={profile} onChanged={reload} />
    </div>
  );
}

function ProfileHeader({ profile }: { profile: Profile }) {
  return (
    <header className="profile-header">
      <span className="avatar avatar-lg" aria-hidden="true">
        {initials(profile.name)}
      </span>
      <div className="profile-header-text">
        <h1>{profile.name}</h1>
        <p>
          <span>{roleLabel(profile)}</span>
          <span className="profile-header-sep" aria-hidden="true">
            ·
          </span>
          <span>{profile.email}</span>
        </p>
      </div>
    </header>
  );
}

// Settings row: title + description on the left, content on the right, optional footer.
function Section({
  title,
  description,
  children,
  footer,
  onSubmit,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  onSubmit?: (e: FormEvent) => void;
}) {
  const body = (
    <>
      <div className="settings-body">{children}</div>
      {footer && <div className="settings-footer">{footer}</div>}
    </>
  );
  return (
    <section className="settings-section">
      <div className="settings-intro">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {onSubmit ? (
        <form className="card settings-card" onSubmit={onSubmit} noValidate>
          {body}
        </form>
      ) : (
        <div className="card settings-card">{body}</div>
      )}
    </section>
  );
}

function DetailsSection({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const { setSession } = useSessionUser();
  const isDriver = profile.driverId !== null;
  const [values, setValues] = useState({ name: profile.name, phone: profile.phone ?? '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValues({ name: profile.name, phone: profile.phone ?? '' });
  }, [profile.name, profile.phone]);

  const set = (key: 'name' | 'phone') => (e: ChangeEvent<HTMLInputElement>) => {
    setSaved(false);
    setValues((v) => ({ ...v, [key]: e.target.value }));
  };

  const dirty = values.name.trim() !== profile.name || (isDriver && values.phone.trim() !== (profile.phone ?? ''));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = profileSchema.safeParse(values);
    if (!parsed.success) return setErrors(zodFieldErrors(parsed.error));

    setErrors({});
    setSaving(true);
    try {
      const { user } = await api<{ user: Profile }>('/auth/me', {
        method: 'PATCH',
        body: { name: parsed.data.name, ...(isDriver && { phone: parsed.data.phone }) },
      });
      setSession(user);
      setSaved(true);
      onSaved();
    } catch (err) {
      setErrors(apiFieldErrors(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      title="Personal information"
      description={isDriver ? 'Your name and the phone number customers and dispatch can reach you on.' : 'The name shown to your colleagues.'}
      onSubmit={onSubmit}
      footer={
        <>
          {saved && (
            <span className="settings-saved">
              <Icon name="check" size={15} /> Saved
            </span>
          )}
          <button className="btn btn-dark" disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <Alert>{errors.form}</Alert>
      <div className="form-grid">
        <Field label="Full name" htmlFor="pf-name" error={errors.name}>
          <input id="pf-name" value={values.name} onChange={set('name')} autoComplete="name" />
        </Field>
        <Field label="Email" htmlFor="pf-email" hint="Contact an admin to change your email.">
          <input id="pf-email" value={profile.email} disabled readOnly />
        </Field>
        {isDriver && (
          <Field label="Phone" htmlFor="pf-phone" error={errors.phone}>
            <input id="pf-phone" type="tel" value={values.phone} onChange={set('phone')} autoComplete="tel" />
          </Field>
        )}
      </div>
    </Section>
  );
}

function AccountSection({ profile }: { profile: Profile }) {
  const rows: [string, string][] = [
    ['Role', profile.roleName],
    ...(isKitchenStaff(profile)
      ? ([['Station', profile.stationName ?? 'All stations (head chef)']] as [string, string][])
      : []),
    ['Member since', formatDate(profile.createdAt) ?? '—'],
  ];
  return (
    <Section title="Account" description="Your role and station decide what you can see and do. Only an admin can change them.">
      <dl className="settings-list">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-input">
      <input id={id} type={visible ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
      >
        <Icon name={visible ? 'eyeOff' : 'eye'} size={17} />
      </button>
    </div>
  );
}

const EMPTY_PASSWORD = { currentPassword: '', newPassword: '', confirmPassword: '' };

function PasswordSection({ profile, onChanged }: { profile: Profile; onChanged: () => void }) {
  const { rotateSession } = useSessionUser();
  const [values, setValues] = useState(EMPTY_PASSWORD);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);

  const set = (key: keyof typeof EMPTY_PASSWORD) => (e: ChangeEvent<HTMLInputElement>) => {
    setChanged(false);
    setValues((v) => ({ ...v, [key]: e.target.value }));
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = passwordSchema.safeParse(values);
    if (!parsed.success) return setErrors(zodFieldErrors(parsed.error));

    setErrors({});
    setSaving(true);
    try {
      // Other devices are signed out; this one continues with a fresh token.
      await rotateSession(() =>
        api<{ token: string; user: Profile }>('/auth/me/password', {
          method: 'POST',
          body: { currentPassword: values.currentPassword, newPassword: values.newPassword },
        }),
      );
      setValues(EMPTY_PASSWORD);
      setChanged(true);
      onChanged();
    } catch (err) {
      setErrors(apiFieldErrors(err));
    } finally {
      setSaving(false);
    }
  }

  const lastChanged = formatDate(profile.passwordChangedAt);
  const filled = values.currentPassword && values.newPassword && values.confirmPassword;

  return (
    <Section
      title="Password"
      description="Changing your password signs you out on all other devices."
      onSubmit={onSubmit}
      footer={
        <>
          <span className="muted small settings-footer-note">
            {lastChanged ? `Last changed ${lastChanged}` : 'Never changed'}
          </span>
          <button className="btn btn-dark" disabled={saving || !filled}>
            {saving ? 'Updating…' : 'Update password'}
          </button>
        </>
      }
    >
      {changed && <Alert kind="success">Password updated. Other devices have been signed out.</Alert>}
      <Alert>{errors.form}</Alert>
      <div className="form-grid">
        <div className="span-2">
          <Field label="Current password" htmlFor="pw-current" error={errors.currentPassword}>
            <PasswordInput id="pw-current" value={values.currentPassword} onChange={set('currentPassword')} autoComplete="current-password" />
          </Field>
        </div>
        <Field label="New password" htmlFor="pw-new" error={errors.newPassword} hint="At least 8 characters.">
          <PasswordInput id="pw-new" value={values.newPassword} onChange={set('newPassword')} autoComplete="new-password" />
        </Field>
        <Field label="Confirm new password" htmlFor="pw-confirm" error={errors.confirmPassword}>
          <PasswordInput id="pw-confirm" value={values.confirmPassword} onChange={set('confirmPassword')} autoComplete="new-password" />
        </Field>
      </div>
    </Section>
  );
}

// Ends every other session (including copies of this device's token); this device continues.
const END_LABELS: Record<SessionEndReason, string> = {
  logout: 'Signed out',
  password_changed: 'Password changed',
  signed_out: 'Signed out from another device',
  signed_out_by_admin: 'Signed out by an administrator',
  token_reuse: 'Login copied to another device',
  device_mismatch: 'Used from a different device',
  deactivated: 'Account deactivated',
  replaced: 'Replaced by newer sign-ins',
  expired: 'Expired',
};

const SUSPICIOUS: SessionEndReason[] = ['token_reuse', 'device_mismatch'];

const formatDateTime = (date: string) =>
  new Date(date).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function SessionsSection({ onChanged }: { profile: Profile; onChanged: () => void }) {
  const { rotateSession } = useSessionUser();
  const { data, error: loadError, reload } = useApi<{ sessions: SessionEntry[] }>('/auth/me/sessions');
  const [busy, setBusy] = useState<number | 'all' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessions = data?.sessions ?? [];
  const active = sessions.filter((entry) => entry.status);
  const ended = sessions.filter((entry) => !entry.status).slice(0, 8);

  async function signOutOthers() {
    setBusy('all');
    setError(null);
    try {
      await rotateSession(() => api<{ token: string; user: Profile }>('/auth/me/sign-out-others', { method: 'POST' }));
      reload();
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function signOut(id: number) {
    setBusy(id);
    setError(null);
    try {
      await api(`/auth/me/sessions/${id}`, { method: 'DELETE' });
      reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section
      title="Sessions"
      description="Where you're signed in. If someone copies your login to another device, that session is ended and you are signed out too."
      footer={
        <>
          <span className="muted small settings-footer-note">
            {active.length} active {active.length === 1 ? 'session' : 'sessions'}
          </span>
          <button type="button" className="btn btn-dark" onClick={signOutOthers} disabled={busy !== null || active.length < 2}>
            <Icon name="logout" size={15} /> {busy === 'all' ? 'Signing out…' : 'Sign out of all other devices'}
          </button>
        </>
      }
    >
      {!data && !loadError && <Loader />}
      <Alert>{loadError?.message ?? error}</Alert>
      {active.length > 0 && (
        <ul className="session-list">
          {active.map((entry) => (
            <li key={entry.id} className="session-item">
              <div className="session-main">
                <strong>
                  {entry.deviceName}
                  {entry.current && <span className="badge session-badge-current">This device</span>}
                </strong>
                <span className="muted small">
                  {entry.ip ?? 'Unknown address'} · signed in {formatDateTime(entry.createdAt)} · last active{' '}
                  {formatDateTime(entry.lastSeenAt)}
                </span>
                <span className="muted small">
                  {entry.protectedByDeviceKey ? 'Locked to this browser' : 'Basic protection (browser has no device key)'}
                </span>
              </div>
              {!entry.current && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => signOut(entry.id)} disabled={busy !== null}>
                  {busy === entry.id ? 'Signing out…' : 'Sign out'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {ended.length > 0 && (
        <>
          <h3 className="session-subtitle">Recent activity</h3>
          <ul className="session-list">
            {ended.map((entry) => {
              const suspicious = entry.endReason !== null && SUSPICIOUS.includes(entry.endReason);
              return (
                <li key={entry.id} className={`session-item session-ended${suspicious ? ' session-alert' : ''}`}>
                  <div className="session-main">
                    <strong>{entry.deviceName}</strong>
                    <span className="small">
                      {entry.endReason ? END_LABELS[entry.endReason] : 'Ended'}
                      {entry.endedAt && ` · ${formatDateTime(entry.endedAt)}`}
                    </span>
                    {suspicious && entry.endedFromDevice && (
                      <span className="small">
                        Attempted from {entry.endedFromDevice}
                        {entry.endedFromIp && ` (${entry.endedFromIp})`}. If this wasn't you, change your password.
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Section>
  );
}
