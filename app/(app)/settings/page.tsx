'use client';

import { Suspense } from 'react';
import { useQueryState } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import type { Module } from '@/lib/types';
import { Guard, Loader, PageHeader } from '@/components/ui';
import { UsersTab } from '@/components/admin/UsersTab';
import { LiveStaffTab } from '@/components/admin/LiveStaffTab';
import { PermissionsTab } from '@/components/admin/PermissionsTab';

type TabKey = 'users' | 'live' | 'permissions';

const TABS: { key: TabKey; module: Module; label: string }[] = [
  { key: 'users', module: 'users', label: 'Users & roles' },
  { key: 'live', module: 'users', label: 'Live staff' },
  { key: 'permissions', module: 'permissions', label: 'Permissions' },
];

export default function SettingsPage() {
  return (
    <Guard modules={['users', 'permissions']}>
      <Suspense fallback={<Loader />}>
        <Settings />
      </Suspense>
    </Guard>
  );
}

function Settings() {
  const { can } = useAuth();
  const tabs = TABS.filter((t) => can(t.module));
  const [active, setActive] = useQueryState<TabKey>('tab', tabs.map((t) => t.key), tabs[0].key);

  return (
    <>
      <PageHeader title="Settings" subtitle="Staff accounts, who is online, and what each role can access" />
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={active === t.key}
            className={`tab ${active === t.key ? 'active' : ''}`}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {active === 'users' && <UsersTab />}
      {active === 'live' && <LiveStaffTab />}
      {active === 'permissions' && <PermissionsTab />}
    </>
  );
}
