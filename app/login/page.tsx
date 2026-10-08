'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/api';
import { loginSchema, zodFieldErrors } from '@/lib/schemas';
import { Logo } from '@/components/Logo';
import { Alert, Field } from '@/components/ui';

export default function LoginPage() {
  const { user, loading, login, notice } = useAuth();
  const router = useRouter();
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [user, loading, router]);

  const set = (key: 'email' | 'password') => (e: ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) return setErrors(zodFieldErrors(parsed.error));

    setErrors({});
    setSubmitting(true);
    try {
      await login(parsed.data.email, parsed.data.password);
      router.replace('/dashboard');
    } catch (err) {
      setErrors({ form: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login">
      <form className="login-form" onSubmit={onSubmit} noValidate>
        <div className="login-logo">
          <Logo size={128} />
        </div>
        <h1>Sign in</h1>

        {!errors.form && notice && <Alert kind="warn">{notice}</Alert>}
        <Alert>{errors.form}</Alert>

        <Field label="Email" htmlFor="email" error={errors.email}>
          <input id="email" type="email" autoComplete="username" value={values.email} onChange={set('email')} autoFocus />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password}>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={values.password}
            onChange={set('password')}
          />
        </Field>

        <button className="btn btn-dark btn-block" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
