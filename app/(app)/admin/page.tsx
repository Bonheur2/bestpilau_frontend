'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import type { Module } from '@/lib/types';
import { Guard, PageHeader } from '@/components/ui';
import { UsersTab } from '@/components/admin/UsersTab';
import { PermissionsTab } from '@/components/admin/PermissionsTab';
import { MenuTab } from '@/components/admin/MenuTab';
import { StationsTab } from '@/components/admin/StationsTab';
import { LiveStaffTab } from '@/components/admin/LiveStaffTab';

type TabKey = 'users' | 'live' | 'permissions' | 'menu' | 'stations';

const TABS: { key: TabKey; module: Module; label: string }[] = [
  { key: 'users', module: 'users', label: 'Users & roles' },
  { key: 'live', module: 'users', label: 'Live staff' },
  { key: 'permissions', module: 'permissions', label: 'Permissions' },
  { key: 'menu', module: 'menu', label: 'Menu' },
  { key: 'stations', module: 'menu', label: 'Stations' },
];

export default function AdminPage() {
  return (
    <Guard modules={['users', 'permissions', 'menu']}>
      <Admin />
    </Guard>
  );
}

function Admin() {
  const { can } = useAuth();
  const tabs = TABS.filter((t) => can(t.module));
  const [active, setActive] = useState<TabKey>(tabs[0].key);

  return (
    <>
      <PageHeader title="Admin" />
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
      {active === 'permissions' && <PermissionsTab />}
      {active === 'menu' && <MenuTab />}
      {active === 'stations' && <StationsTab />}
      {active === 'live' && <LiveStaffTab />}
    </>
  );
}
