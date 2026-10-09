'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { roleLabel, useSessionUser } from '@/lib/auth';
import { initials } from '@/lib/format';
import { Icon } from './Icon';

export function UserMenu() {
  const { user, logout } = useSessionUser();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const role = roleLabel(user);

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        className="user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="avatar" aria-hidden="true">
          {initials(user.name)}
        </span>
        <span className="user-menu-who">
          <strong>{user.name}</strong>
          <span>{role}</span>
        </span>
        <Icon name="chevron" size={16} />
      </button>

      {open && (
        <div className="user-menu-panel" role="menu">
          <div className="user-menu-header">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <Link href="/profile" role="menuitem" className="user-menu-item" onClick={() => setOpen(false)}>
            <Icon name="user" size={16} />
            My profile
          </Link>
          <button
            role="menuitem"
            className="user-menu-item"
            onClick={() => {
              // The app layout sends signed-out users to /login
              logout();
            }}
          >
            <Icon name="logout" size={16} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
