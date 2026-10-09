'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Logo } from '@/components/Logo';
import { SidebarNav } from '@/components/SidebarNav';
import { Alert, FullScreenLoader } from '@/components/ui';
import { UserMenu } from '@/components/UserMenu';
import { LiveAlerts, LiveControls } from '@/components/LiveAlerts';
import { RealtimeProvider } from '@/lib/realtime';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading, error, refresh } = useAuth();
  const router = useRouter();

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
      <aside className="sidebar">
        <Link href="/dashboard" className="sidebar-logo">
          <Logo size={104} />
        </Link>
        <SidebarNav />
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
