// Shapes returned by the Best Pilau API (backend/src/routes).

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'DELIVERED';
export type TicketStatus = 'PENDING' | 'CONFIRMED' | 'READY';
export type DriverStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';
// Every action is guarded by one of these (backend/src/constants.js PERMISSION_GROUPS)
export type Permission =
  | 'orders.view'
  | 'orders.create'
  | 'orders.manage'
  | 'kitchen.view'
  | 'kitchen.confirm'
  | 'kitchen.ready'
  | 'deliveries.view'
  | 'deliveries.deliver'
  | 'menu.view'
  | 'menu.create'
  | 'menu.update'
  | 'menu.delete'
  | 'users.view'
  | 'users.create'
  | 'users.update'
  | 'roles.view'
  | 'roles.manage'
  | 'settings.manage';

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  roleId: number;
  roleName: string;
  /** The Admin role: every permission, always */
  isSuperAdmin: boolean;
  permissions: Permission[];
  /** Set when the role makes them a driver */
  driverId: number | null;
  /** Set when the role makes them kitchen staff and they work at one station */
  stationId: number | null;
  stationName: string | null;
}

export interface Profile extends SessionUser {
  phone: string | null;
  createdAt: string;
  passwordChangedAt: string | null;
  sessionsRevokedAt: string | null;
}

export interface StationRef {
  id: number;
  name: string;
}

export interface Station extends StationRef {
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  /** Items assigned to this station directly (overriding their category) */
  productCount: number;
  /** Items this station actually prepares, directly or through their category */
  itemCount: number;
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
    orderNumber: string;
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
  /** e.g. ORD-1009-0042 */
  orderNumber: string;
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
  role: { id: number; name: string; isSuperAdmin: boolean };
  isActive: boolean;
  createdAt: string;
  station: StationRef | null;
  driver: { id: number; phone: string | null; availabilityStatus: DriverStatus } | null;
}

export interface RoleInfo {
  id: number;
  name: string;
  description: string | null;
  isSuperAdmin: boolean;
  userCount: number;
  permissions: Permission[];
}

export interface PermissionGroup {
  key: string;
  label: string;
  permissions: { key: Permission; label: string; description: string; implies?: Permission[] }[];
}

export interface RolesResponse {
  roles: RoleInfo[];
  groups: PermissionGroup[];
}

// ---- Business settings (GET /settings) ----
export interface AppSettings {
  /** Minutes the kitchen has to confirm a new order */
  confirmWindowMinutes: number;
}

// ---- Presence (GET /presence) ----
export type SoundState = 'on' | 'muted' | 'locked';

export interface PresenceUser {
  id: number;
  name: string;
  roleId: number;
  roleName: string;
  isSuperAdmin: boolean;
  permissions: Permission[];
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
    orderNumber: string;
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
    orderNumber: string;
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
    orderNumber: string;
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

// ---- Sessions (GET /auth/me/sessions) ----
export type SessionEndReason =
  | 'logout'
  | 'password_changed'
  | 'signed_out'
  | 'signed_out_by_admin'
  | 'token_reuse'
  | 'device_mismatch'
  | 'deactivated'
  | 'replaced'
  | 'expired';

export interface SessionEntry {
  id: number;
  deviceName: string;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  status: boolean;
  endedAt: string | null;
  endReason: SessionEndReason | null;
  endedFromDevice: string | null;
  endedFromIp: string | null;
  current: boolean;
  /** Signed in from a browser that holds a device key, so a copied token cannot be used */
  protectedByDeviceKey: boolean;
}
