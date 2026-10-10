'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Icon } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { SidebarNav } from '@/components/SidebarNav';
import { Alert, FullScreenLoader } from '@/components/ui';
import { UserMenu } from '@/components/UserMenu';
import { LiveAlerts, LiveControls } from '@/components/LiveAlerts';
import { RealtimeProvider } from '@/lib/realtime';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading, error, refresh } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // The sidebar is a slide-in drawer on phones
  const [navOpen, setNavOpen] = useState(false);

  // Close after navigating, and on Escape; keep the page behind from scrolling while open
  useEffect(() => setNavOpen(false), [pathname]);
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.classList.add('nav-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('nav-open');
    };
  }, [navOpen]);

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

  return (
    <RealtimeProvider>
    <LiveAlerts />
    <div className="shell">
      {navOpen && <div className="nav-backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />}
      <aside id="main-nav" className={`sidebar ${navOpen ? 'open' : ''}`}>
        <button type="button" className="nav-close" onClick={() => setNavOpen(false)} aria-label="Close menu">
          <Icon name="x" size={20} />
        </button>
        <Link href="/dashboard" className="sidebar-logo">
          <Logo size={104} />
        </Link>
        <SidebarNav />
      </aside>
      <div className="content">
        <header className="topbar">
          <div className="topbar-brand">
            <button
              type="button"
              className="nav-toggle"
              onClick={() => setNavOpen(true)}
              aria-label="Open menu"
              aria-expanded={navOpen}
              aria-controls="main-nav"
            >
              <Icon name="menu" size={22} />
            </button>
            <Link href="/dashboard" aria-label="Best Pilau home">
              <Logo size={44} />
            </Link>
          </div>
          <LiveControls />
          <UserMenu />
        </header>
        <main className="main">{children}</main>
      </div>
    </div>
    </RealtimeProvider>
  );
}
