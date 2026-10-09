'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSessionUser } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import type { Permission } from '@/lib/types';
import { Icon, type IconName } from './Icon';

type Badge = 'pending' | 'cooking';

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Shown when the role has any of these */
  permissions?: Permission[];
  /** Hidden when the role has any of these (e.g. the read-only board once there are work queues) */
  hideIfAny?: Permission[];
  /** Live count of open kitchen tickets */
  badge?: Badge;
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { href: '/orders/new', label: 'New order', icon: 'plus', permissions: ['orders.create'] },
  { href: '/orders', label: 'Orders', icon: 'list', permissions: ['orders.view'] },
  { href: '/kitchen/confirm', label: 'Confirm', icon: 'inbox', permissions: ['kitchen.confirm'], badge: 'pending' },
  { href: '/kitchen/ready', label: 'Mark ready', icon: 'flame', permissions: ['kitchen.ready'], badge: 'cooking' },
  // Everything in one view, for roles that can see the kitchen but have no work queue of their own
  { href: '/kitchen', label: 'Kitchen', icon: 'flame', permissions: ['kitchen.view'], hideIfAny: ['kitchen.confirm', 'kitchen.ready'] },
  { href: '/driver', label: 'Deliveries', icon: 'truck', permissions: ['deliveries.view', 'deliveries.deliver'] },
  {
    href: '/history',
    label: 'History',
    icon: 'clock',
    permissions: ['orders.view', 'kitchen.view', 'deliveries.view', 'deliveries.deliver'],
  },
  { href: '/menu', label: 'Menu', icon: 'book', permissions: ['menu.view'] },
  { href: '/settings', label: 'Settings', icon: 'settings', permissions: ['users.view', 'roles.view', 'settings.manage'] },
];

interface Counts {
  pending: number;
  cooking: number;
  late: number;
}

export function SidebarNav() {
  const { user } = useSessionUser();
  const pathname = usePathname();
  const has = (p: Permission) => user.permissions.includes(p);

  const items = NAV.filter(
    (item) => (!item.permissions || item.permissions.some(has)) && !(item.hideIfAny ?? []).some(has),
  );

  // Only kitchen staff need the open-ticket counts
  const { data: counts } = useApi<Counts>('/tickets/counts', {
    enabled: has('kitchen.view'),
    interval: 15_000,
    live: ['tickets'],
  });

  return (
    <nav className="nav" aria-label="Main">
      {items.map((item) => {
        const active = pathname === item.href;
        const count = item.badge && counts ? counts[item.badge] : 0;
        const late = item.badge === 'pending' && counts ? counts.late : 0;
        return (
          <Link key={item.href} href={item.href} className={`nav-link ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
            <Icon name={item.icon} />
            <span className="nav-label">{item.label}</span>
            {count > 0 && (
              <span
                className={`nav-badge ${late > 0 ? 'nav-badge-alert' : ''}`}
                title={late > 0 ? `${count} waiting, ${late} late` : `${count} waiting`}
              >
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
