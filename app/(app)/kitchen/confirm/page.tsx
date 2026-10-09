'use client';

import { Guard } from '@/components/ui';
import { KitchenQueue } from '@/components/KitchenQueue';

export default function ConfirmPage() {
  return (
    <Guard permissions={['kitchen.confirm']}>
      <KitchenQueue mode="confirm" />
    </Guard>
  );
}
