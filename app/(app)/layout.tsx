'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Logo } from '@/components/Logo';
import { Icon, type IconName } from '@/components/Icon';
import type { Module } from '@/lib/types';
import { Alert, FullScreenLoader } from '@/components/ui';
import { UserMenu } from '@/components/UserMenu';
import { LiveAlerts, LiveControls } from '@/components/LiveAlerts';
import { RealtimeProvider } from '@/lib/realtime';

const NAV: { href: string; label: string; icon: IconName; modules?: Module[] }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { href: '/orders/new', label: 'New order', icon: 'plus', modules: ['orders'] },
  { href: '/orders', label: 'Orders', icon: 'list', modules: ['orders'] },
  { href: '/kitchen', label: 'Kitchen', icon: 'flame', modules: ['kitchen'] },
  { href: '/driver', label: 'Deliveries', icon: 'truck', modules: ['delivery'] },
  { href: '/history', label: 'History', icon: 'clock', modules: ['orders', 'kitchen', 'delivery'] },
  { href: '/admin', label: 'Admin', icon: 'settings', modules: ['users', 'permissions', 'menu'] },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading, error, refresh } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user && !error) router.replace('/login');
  }, [user, loading, error, router]);

  // Have the login page ready so signing out is instant. In production this downloads it;
  // the dev server only compiles a page on first request, so warm it up there too.
  useEffect(() => {
    router.prefetch('/login');
    if (process.env.NODE_ENV === 'development') {
      // Read the body so the request completes instead of holding a connection open
      fetch('/login')
        .then((res) => res.text())
        .catch(() => {});
    }
  }, [router]);

  // Pick up role/permission changes made by an admin.
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, [user, refresh]);

  if (!user && error) {
    return (
      <div className="fullscreen-center">
        <div>
          <Alert>{error.message}</Alert>
          <button className="btn btn-dark" onClick={refresh}>
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (loading) return <FullScreenLoader />;
  if (!user) return <FullScreenLoader label="Signing out…" />;

  const items = NAV.filter((item) => !item.modules || item.modules.some((m) => user.modules.includes(m)));

  return (
    <RealtimeProvider>
    <LiveAlerts />
    <div className="shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="sidebar-logo">
          <Logo size={104} />
        </Link>
        <nav className="nav" aria-label="Main">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${pathname === item.href ? 'active' : ''}`}
              aria-current={pathname === item.href ? 'page' : undefined}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="content">
        <header className="topbar">
          <LiveControls />
          <UserMenu />
        </header>
        <main className="main">{children}</main>
      </div>
    </div>
    </RealtimeProvider>
  );
}
