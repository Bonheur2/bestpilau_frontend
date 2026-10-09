'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { STATUS_LABELS } from '@/lib/constants';
import type { OrderStatus, Permission } from '@/lib/types';
import { Icon } from './Icon';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Loader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loader" role="status">
      <span className="spinner" />
      {label}
    </div>
  );
}

export function FullScreenLoader({ label }: { label?: string }) {
  return (
    <div className="fullscreen-center">
      <Loader label={label} />
    </div>
  );
}

interface AlertProps {
  kind?: 'error' | 'success' | 'warn';
  children?: ReactNode;
  onClose?: () => void;
}

export function Alert({ kind = 'error', children, onClose }: AlertProps) {
  if (!children) return null;
  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon name={kind === 'success' ? 'check' : 'alert'} />
      <span>{children}</span>
      {onClose && (
        <button className="alert-close" onClick={onClose} aria-label="Dismiss">
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

export function StatusBadge({ status, overdue }: { status: OrderStatus; overdue?: boolean }) {
  if (overdue) return <span className="badge badge-overdue">Overdue</span>;
  return <span className={`badge badge-${status.toLowerCase()}`}>{STATUS_LABELS[status]}</span>;
}

// Renders children only when the user's role has one of `permissions`.
export function Guard({ permissions, children }: { permissions: Permission[]; children: ReactNode }) {
  const { can } = useAuth();
  if (!permissions.some(can)) {
    return (
      <Empty title="No access">
        Your role does not have access to this page. Ask an admin to add it to your role under Settings → Roles.
      </Empty>
    );
  }
  return children;
}

interface FieldProps {
  label?: string;
  error?: string;
  hint?: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

export function Field({ label, error, hint, htmlFor, className = '', children }: FieldProps) {
  return (
    <div className={`field ${error ? 'has-error' : ''} ${className}`}>
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? <span className="field-error">{error}</span> : hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}
