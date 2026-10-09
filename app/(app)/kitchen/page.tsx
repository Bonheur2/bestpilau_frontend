'use client';

import { Guard } from '@/components/ui';
import { KitchenQueue } from '@/components/KitchenQueue';

// Read-only overview for roles that can see the kitchen but have no work queue of their own
export default function KitchenPage() {
  return (
    <Guard permissions={['kitchen.view']}>
      <KitchenQueue mode="board" />
    </Guard>
  );
}
