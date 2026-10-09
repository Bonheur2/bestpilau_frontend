'use client';

import { Suspense } from 'react';
import { useQueryState } from '@/lib/hooks';
import { Guard, Loader, PageHeader } from '@/components/ui';
import { MenuTab } from '@/components/admin/MenuTab';
import { StationsTab } from '@/components/admin/StationsTab';

type TabKey = 'items' | 'stations';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'items', label: 'Categories & items' },
  { key: 'stations', label: 'Stations' },
];

export default function MenuPage() {
  return (
    <Guard permissions={['menu.view']}>
      <Suspense fallback={<Loader />}>
        <Menu />
      </Suspense>
    </Guard>
  );
}

function Menu() {
  const [active, setActive] = useQueryState<TabKey>('tab', ['items', 'stations'], 'items');

  return (
    <>
      <PageHeader title="Menu" subtitle="What you sell and which kitchen station prepares it" />
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
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
      {active === 'items' && <MenuTab />}
      {active === 'stations' && <StationsTab />}
    </>
  );
}
