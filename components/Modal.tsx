'use client';

import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { Icon } from './Icon';

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  /** When set, the body is a form and the footer's primary button submits it. */
  onSubmit?: (e: FormEvent) => void;
  footer: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md';
}

// Native <dialog>: focus is trapped, Esc closes it, and the page behind is inert.
export function Modal({ open, title, description, onClose, onSubmit, footer, children, size = 'md' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal() focuses the first button (the ✕); start in the first field instead
      dialog.querySelector<HTMLElement>('.modal-body input, .modal-body select, .modal-body textarea')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const body = (
    <>
      <header className="modal-head">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          <Icon name="x" size={18} />
        </button>
      </header>
      <div className="modal-body">{children}</div>
      <footer className="modal-foot">{footer}</footer>
    </>
  );

  return (
    <dialog
      ref={ref}
      className={`modal modal-${size}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // Clicking the dimmed backdrop (the dialog element itself) closes it
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open &&
        (onSubmit ? (
          <form onSubmit={onSubmit} noValidate>
            {body}
          </form>
        ) : (
          <div>{body}</div>
        ))}
    </dialog>
  );
}

/** On/off switch backed by a checkbox, so it works with keyboards and screen readers. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className={`switch ${disabled ? 'is-disabled' : ''}`}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
    </label>
  );
}
