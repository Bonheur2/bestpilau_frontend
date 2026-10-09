'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api, apiFieldErrors } from '@/lib/api';
import { useAppSettings } from '@/lib/hooks';
import type { AppSettings } from '@/lib/types';
import { Alert, Field, Loader } from '@/components/ui';
import { Icon } from '@/components/Icon';

export function BusinessTab() {
  const { settings, loaded, reload } = useAppSettings();
  const [minutes, setMinutes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (loaded) setMinutes(String(settings.confirmWindowMinutes));
  }, [loaded, settings.confirmWindowMinutes]);

  if (!loaded) return <Loader />;

  const value = Number(minutes);
  const dirty = minutes.trim() !== '' && value !== settings.confirmWindowMinutes;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!Number.isInteger(value) || value < 1 || value > 60) {
      return setErrors({ confirmWindowMinutes: 'Enter whole minutes between 1 and 60' });
    }
    setErrors({});
    setSaving(true);
    try {
      await api<{ settings: AppSettings }>('/settings', { method: 'PATCH', body: { confirmWindowMinutes: value } });
      setSaved(true);
      await reload();
    } catch (err) {
      setErrors(apiFieldErrors(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-section business-section">
      <div className="settings-intro">
        <h2>Kitchen confirmation time</h2>
        <p>
          How long each station has to confirm a new order. After that the order is marked late, Customer Care is alerted,
          and the kitchen hears an urgent beep.
        </p>
      </div>
      <form className="card settings-card" onSubmit={onSubmit} noValidate>
        <div className="settings-body">
          <Alert>{errors.form}</Alert>
          <Field
            label="Minutes to confirm"
            htmlFor="confirm-minutes"
            error={errors.confirmWindowMinutes}
            hint="Applies to new orders and to orders Customer Care rechecks. Orders already waiting keep their current deadline."
          >
            <div className="input-suffix">
              <input
                id="confirm-minutes"
                type="number"
                inputMode="numeric"
                min={1}
                max={60}
                step={1}
                value={minutes}
                onChange={(e) => {
                  setSaved(false);
                  setMinutes(e.target.value);
                }}
              />
              <span>minutes</span>
            </div>
          </Field>
        </div>
        <div className="settings-footer">
          {saved && !dirty && (
            <span className="settings-saved">
              <Icon name="check" size={15} /> Saved. Every screen now uses {settings.confirmWindowMinutes} minutes.
            </span>
          )}
          <button className="btn btn-dark" disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </section>
  );
}
