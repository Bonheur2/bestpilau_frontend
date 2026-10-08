'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { api, apiFieldErrors } from '@/lib/api';
import { useSessionUser } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { initials } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/constants';
import { passwordSchema, profileSchema, zodFieldErrors } from '@/lib/schemas';
import type { Profile } from '@/lib/types';
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
          <span>
            {ROLE_LABELS[profile.role]}
            {profile.role === 'KITCHEN' && ` · ${profile.stationName ?? 'All stations'}`}
          </span>
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
    ['Role', ROLE_LABELS[profile.role]],
    ...(profile.role === 'KITCHEN'
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
  const { setSession } = useSessionUser();
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
      const { token, user } = await api<{ token: string; user: Profile }>('/auth/me/password', {
        method: 'POST',
        body: { currentPassword: values.currentPassword, newPassword: values.newPassword },
      });
      // Other devices are signed out; this one continues with a fresh token.
      setSession(user, token);
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
