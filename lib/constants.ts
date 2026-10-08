import type { DriverStatus, OrderStatus, Role, TicketStatus } from './types';

export const ROLES: Role[] = ['ADMIN', 'CUSTOMER_CARE', 'KITCHEN', 'DRIVER'];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  CUSTOMER_CARE: 'Customer Care',
  KITCHEN: 'Kitchen',
  DRIVER: 'Driver',
};

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

export const CONFIRM_MINUTES = Number(process.env.NEXT_PUBLIC_CONFIRM_WINDOW_MINUTES ?? 5);
