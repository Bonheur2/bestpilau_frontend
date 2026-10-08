// Shapes returned by the Best Pilau API (backend/src/routes).

export type Role = 'ADMIN' | 'CUSTOMER_CARE' | 'KITCHEN' | 'DRIVER';
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'DELIVERED';
export type TicketStatus = 'PENDING' | 'CONFIRMED' | 'READY';
export type DriverStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';
export type Module = 'orders' | 'kitchen' | 'delivery' | 'menu' | 'users' | 'permissions';

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  driverId: number | null;
  stationId: number | null;
  stationName: string | null;
  modules: Module[];
}

export interface Profile extends SessionUser {
  phone: string | null;
  createdAt: string;
  passwordChangedAt: string | null;
}

export interface StationRef {
  id: number;
  name: string;
}

export interface Station extends StationRef {
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  productCount: number;
  categoryCount: number;
  staffCount: number;
  openTickets: number;
}

export interface OrderItem {
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  stationId: number;
  stationName: string;
}

export interface OrderTicket {
  id: number;
  stationId: number;
  stationName: string;
  status: TicketStatus;
  confirmedAt: string | null;
  readyAt: string | null;
}

// A station's share of an order, as the kitchen sees it (GET /tickets).
export interface Ticket {
  id: number;
  orderId: number;
  stationId: number;
  status: TicketStatus;
  createdAt: string;
  confirmedAt: string | null;
  readyAt: string | null;
  isOverdue: boolean;
  station: StationRef;
  order: {
    id: number;
    customerName: string;
    location: string;
    notes: string | null;
    status: OrderStatus;
    createdAt: string;
    confirmDeadline: string;
    recheckCount: number;
  };
  items: { productId: number; name: string; quantity: number }[];
  otherStations: { id: number; name: string; status: TicketStatus }[];
}

export interface OrderDriver {
  id: number;
  name: string;
  phone: string | null;
  availabilityStatus: DriverStatus;
}

export interface Order {
  id: number;
  customerName: string;
  customerPhone: string | null;
  location: string;
  notes: string | null;
  status: OrderStatus;
  totalAmount: number;
  driverId: number | null;
  createdById: number;
  confirmDeadline: string;
  isDelayed: boolean;
  isOverdue: boolean;
  recheckCount: number;
  lastRecheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  completedAt: string | null;
  assignedAt: string | null;
  acceptedAt: string | null;
  deliveredAt: string | null;
  driver: OrderDriver | null;
  createdBy: { id: number; name: string };
  items: OrderItem[];
  tickets: OrderTicket[];
}

export interface OrderStats {
  counts: Record<OrderStatus, number>;
  overdue: number;
  today: { orders: number; revenue: number; delivered: number; avgConfirmSeconds: number | null };
}

export interface Driver {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  availabilityStatus: DriverStatus;
  activeOrders: number;
}

export interface Category {
  id: number;
  name: string;
  stationId: number | null;
  station: StationRef | null;
  createdAt: string;
  productCount: number;
}

export interface Product {
  id: number;
  name: string;
  categoryId: number;
  price: number;
  isAvailable: boolean;
  stationId: number | null;
  createdAt: string;
  station: StationRef | null;
  category: { id: number; name: string; station: StationRef | null };
}

export interface StaffUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  station: StationRef | null;
  driver: { id: number; phone: string | null; availabilityStatus: DriverStatus } | null;
}

export interface PermissionMatrix {
  roles: Role[];
  modules: { key: Module; label: string; description: string }[];
  matrix: Record<Role, Module[]>;
}

// ---- Presence (GET /presence) ----
export type SoundState = 'on' | 'muted' | 'locked';

export interface PresenceUser {
  id: number;
  name: string;
  role: Role;
  stationId: number | null;
  stationName: string | null;
  driverId: number | null;
  devices: { device: string; connectedAt: string; sound: SoundState | null }[];
}

// ---- History (GET /history) ----
export type HistoryView = 'orders' | 'kitchen' | 'deliveries';

export interface OrdersSummary {
  orders: number;
  sales: number;
  delivered: number;
  late: number;
  avgConfirmSeconds: number | null;
}

export interface KitchenSummary {
  tickets: number;
  ready: number;
  late: number;
  avgConfirmSeconds: number | null;
  avgPrepSeconds: number | null;
}

export interface DeliveriesSummary {
  deliveries: number;
  value: number;
  avgDeliverySeconds: number | null;
}

interface HistoryBase<S, E> {
  views: HistoryView[];
  totals: S;
  days: (S & { date: string })[];
  breakdown?: (S & { name: string })[];
  entries: E[];
}

export type OrdersHistory = HistoryBase<
  OrdersSummary,
  {
    id: number;
    createdAt: string;
    customerName: string;
    location: string;
    totalAmount: number;
    status: OrderStatus;
    driverName: string | null;
    isDelayed: boolean;
    confirmSeconds: number | null;
    deliveredAt: string | null;
  }
> & { view: 'orders' };

export type KitchenHistory = HistoryBase<
  KitchenSummary,
  {
    id: number;
    orderId: number;
    createdAt: string;
    stationName: string;
    customerName: string;
    items: string;
    status: TicketStatus;
    late: boolean;
    confirmSeconds: number | null;
    prepSeconds: number | null;
  }
> & { view: 'kitchen' };

export type DeliveriesHistory = HistoryBase<
  DeliveriesSummary,
  {
    id: number;
    customerName: string;
    location: string;
    totalAmount: number;
    driverName: string;
    completedAt: string | null;
    deliveredAt: string;
    deliverySeconds: number | null;
  }
> & { view: 'deliveries' };

export type HistoryResponse = OrdersHistory | KitchenHistory | DeliveriesHistory;
