import type { UserRole } from "@/constants/app";

/** Roles that may access `/admin` (customers excluded). */
export const ADMIN_ROLES = [
  "super_admin",
  "admin",
  "inventory_manager",
  "order_manager",
  "customer_support",
  "marketing_manager",
  /** Legacy staff role — limited access. */
  "staff",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export type AdminPermission =
  | "dashboard:view"
  | "products:read"
  | "products:write"
  | "categories:write"
  | "brands:write"
  | "orders:read"
  | "orders:write"
  | "customers:read"
  | "customers:write"
  | "coupons:write"
  | "banners:write"
  | "notifications:write"
  | "analytics:view"
  | "settings:write"
  | "audit:read"
  | "media:upload";

const ALL: AdminPermission[] = [
  "dashboard:view",
  "products:read",
  "products:write",
  "categories:write",
  "brands:write",
  "orders:read",
  "orders:write",
  "customers:read",
  "customers:write",
  "coupons:write",
  "banners:write",
  "notifications:write",
  "analytics:view",
  "settings:write",
  "audit:read",
  "media:upload",
];

const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  super_admin: ALL,
  admin: [...ALL],
  inventory_manager: [
    "dashboard:view",
    "products:read",
    "products:write",
    "categories:write",
    "brands:write",
    "orders:read",
    "analytics:view",
    "media:upload",
  ],
  order_manager: [
    "dashboard:view",
    "products:read",
    "orders:read",
    "orders:write",
    "customers:read",
    "analytics:view",
  ],
  customer_support: [
    "dashboard:view",
    "products:read",
    "orders:read",
    "orders:write",
    "customers:read",
    "customers:write",
    "notifications:write",
  ],
  marketing_manager: [
    "dashboard:view",
    "products:read",
    "coupons:write",
    "banners:write",
    "notifications:write",
    "analytics:view",
    "media:upload",
  ],
  staff: [
    "dashboard:view",
    "products:read",
    "orders:read",
    "customers:read",
  ],
};

export function isAdminRole(role?: string | null): role is AdminRole {
  return Boolean(role && (ADMIN_ROLES as readonly string[]).includes(role));
}

export function permissionsForRole(role?: string | null): AdminPermission[] {
  if (!isAdminRole(role)) return [];
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(
  role: string | null | undefined,
  permission: AdminPermission,
) {
  return permissionsForRole(role).includes(permission);
}

export function canAccessAdmin(role?: UserRole | string | null) {
  return isAdminRole(role);
}

export const ADMIN_NAV: Array<{
  href: string;
  label: string;
  permission: AdminPermission;
}> = [
  { href: "/admin", label: "Dashboard", permission: "dashboard:view" },
  { href: "/admin/products", label: "Products", permission: "products:read" },
  { href: "/admin/categories", label: "Categories", permission: "categories:write" },
  { href: "/admin/brands", label: "Brands", permission: "brands:write" },
  { href: "/admin/orders", label: "Orders", permission: "orders:read" },
  { href: "/admin/customers", label: "Customers", permission: "customers:read" },
  { href: "/admin/coupons", label: "Coupons", permission: "coupons:write" },
  { href: "/admin/banners", label: "Banners", permission: "banners:write" },
  { href: "/admin/ads", label: "Ads & Expenses", permission: "dashboard:view" },
  {
    href: "/admin/notifications",
    label: "Notifications",
    permission: "notifications:write",
  },
  { href: "/admin/analytics", label: "Analytics", permission: "analytics:view" },
  {
    href: "/admin/integrations",
    label: "Payment & Integrations",
    permission: "settings:write",
  },
  { href: "/admin/settings", label: "Settings", permission: "settings:write" },
  { href: "/admin/audit", label: "Audit log", permission: "audit:read" },
];
