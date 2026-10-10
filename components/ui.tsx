'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { STATUS_LABELS } from '@/lib/constants';
import type { OrderStatus, Permission } from '@/lib/types';
import { Icon } from './Icon';

interface PaginationProps {
  page: number;
  pages?: number;
  total: number;
  size: number;
  onPage: (page: number) => void;
}

// Page numbers to show: first, last, and a window around the current page
function pageWindow(page: number, pages: number): (number | 'gap')[] {
  const wanted = new Set([1, pages, page - 1, page, page + 1]);
  const list = [...wanted].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  list.forEach((n, i) => {
    if (i > 0 && n - list[i - 1] > 1) out.push('gap');
    out.push(n);
  });
  return out;
}

export function Pagination({ page, pages: pageCount, total, size, onPage }: PaginationProps) {
  const pages = pageCount ?? Math.max(1, Math.ceil(total / size));
  if (total <= size) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(page * size, total);
  return (
    <nav className="pagination" aria-label="Pages">
      <span className="muted small pagination-info">
        {from}–{to} of {total}
      </span>
      <div className="pagination-pages">
        <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        {pageWindow(page, pages).map((n, i) =>
          n === 'gap' ? (
            <span key={`gap${i}`} className="pagination-gap" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              className={`pagination-page ${n === page ? 'active' : ''}`}
              aria-current={n === page ? 'page' : undefined}
              aria-label={`Page ${n}`}
              onClick={() => onPage(n)}
            >
              {n}
            </button>
          ),
        )}
        <button type="button" className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </nav>
  );
}

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
