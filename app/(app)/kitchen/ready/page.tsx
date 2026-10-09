'use client';

import { Guard } from '@/components/ui';
import { KitchenQueue } from '@/components/KitchenQueue';

export default function ReadyPage() {
  return (
    <Guard permissions={['kitchen.ready']}>
      <KitchenQueue mode="ready" />
    </Guard>
  );
}
