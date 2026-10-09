import type { DriverStatus, OrderStatus, TicketStatus } from './types';

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Ready',
  DELIVERED: 'Delivered',
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  PENDING: 'Waiting',
  CONFIRMED: 'Cooking',
  READY: 'Ready',
};

export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  AVAILABLE: 'Available',
  BUSY: 'On delivery',
  OFFLINE: 'Offline',
};

