'use client';

import { Suspense } from 'react';
import { useQueryState } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import type { Permission } from '@/lib/types';
import { Guard, Loader, PageHeader } from '@/components/ui';
import { UsersTab } from '@/components/admin/UsersTab';
import { LiveStaffTab } from '@/components/admin/LiveStaffTab';
import { RolesTab } from '@/components/admin/RolesTab';
import { BusinessTab } from '@/components/admin/BusinessTab';

type TabKey = 'users' | 'live' | 'roles' | 'business';

const TABS: { key: TabKey; permission: Permission; label: string }[] = [
  { key: 'users', permission: 'users.view', label: 'Staff' },
  { key: 'live', permission: 'users.view', label: 'Live staff' },
  { key: 'roles', permission: 'roles.view', label: 'Roles & permissions' },
  { key: 'business', permission: 'settings.manage', label: 'Business' },
];

export default function SettingsPage() {
  return (
    <Guard permissions={['users.view', 'roles.view', 'settings.manage']}>
      <Suspense fallback={<Loader />}>
        <Settings />
      </Suspense>
    </Guard>
  );
}

function Settings() {
  const { can } = useAuth();
  const tabs = TABS.filter((t) => can(t.permission));
  const [active, setActive] = useQueryState<TabKey>('tab', tabs.map((t) => t.key), tabs[0].key);

  return (
    <>
      <PageHeader title="Settings" subtitle="Staff, roles and how the business runs" />
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
      {active === 'roles' && <RolesTab />}
      {active === 'business' && <BusinessTab />}
    </>
  );
}
