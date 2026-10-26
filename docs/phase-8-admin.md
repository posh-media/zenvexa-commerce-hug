# Phase 8 — Admin Dashboard & Store Management

Admin UI lives under `/admin` inside the ShopBeta Next.js app (no separate project).

## Access

Admin access is controlled by Firestore `users/{uid}.role` (Firebase Auth + RBAC).  
See **[admin-access.md](./admin-access.md)** for full documentation.

### First Super Admin (no manual Firestore edit)

```bash
npm run admin:bootstrap -- --email=you@example.com --password=ChooseAStrongPassword
```

Then sign in at `/login` and open `/admin`. Set `ADMIN_BOOTSTRAP_DISABLED=true` afterwards.

### Later staff

Use **Admin → Customers → Staff role**, or:

```bash
npm run admin:set-role -- --email=ops@example.com --role=order_manager
```

Staff roles: `super_admin`, `admin`, `inventory_manager`, `order_manager`, `customer_support`, `marketing_manager`, `staff`.

## Modules

| Route | Purpose |
|---|---|
| `/admin` | Dashboard stats |
| `/admin/products` | Product CRUD, bulk, media |
| `/admin/categories` | Category CRUD |
| `/admin/brands` | Brand CRUD + logos |
| `/admin/orders` | Status, payment status, tracking, timeline |
| `/admin/customers` | Profiles, suspend/reactivate, addresses |
| `/admin/coupons` | Coupon CRUD |
| `/admin/banners` | Banner CRUD |
| `/admin/notifications` | Individual + broadcast |
| `/admin/analytics` | Sales / products / customers |
| `/admin/settings` | Store settings (no secret keys) |
| `/admin/audit` | Audit log |

## Security

Paste updated `firestore.rules` (RBAC helpers + `banners` + `auditLogs`).

## Storage

Admin uploads go to `admin/{folder}/…` via `media.service.ts` (JPEG/PNG/WebP/GIF, max 5MB). Ensure Storage rules allow authenticated staff uploads.
