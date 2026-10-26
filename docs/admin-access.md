# ShopBeta Admin Access, Roles & Documentation

This guide explains how the Admin system works and how to create, promote, and remove administrators **without reading the codebase**.

---

## Architecture summary

| Layer | How it works |
| --- | --- |
| **Authentication** | Firebase Authentication (email/password or Google). Same Auth as the customer storefront. |
| **Authorization** | Firestore document `users/{uid}.role`. **Not** custom claims, **not** an email allowlist. |
| **Admin UI gate** | Client components `RequireAdmin` + `AdminShell` under `/admin`. |
| **Server enforcement** | Firestore Security Rules read `users/{auth.uid}.role` and allow/deny writes. |
| **Navigation** | Sidebar links filtered by role permissions (`src/lib/admin/rbac.ts`). |

There is **no** Next.js middleware protecting `/admin`. The HTML can load, but:

1. Unauthenticated users are redirected to `/login?next=/admin…`
2. Authenticated customers are redirected to `/`
3. Staff without a page permission see “Access denied”

**Source of truth for access:** `users/{uid}.role` in Firestore.

---

## How authentication works

1. User signs up or signs in via `/login` or `/signup`.
2. `ensureUserProfile` creates `users/{uid}` if missing with **`role: "customer"`**.
3. Existing profiles keep their role (sign-in never elevates privileges).
4. Zustand `useUserStore` holds `authUser` + `profile` for the session.
5. Visiting `/admin` runs `RequireAdmin`, which checks `canAccessAdmin(profile.role)`.

---

## How RBAC works

### Roles

| Role | Purpose |
| --- | --- |
| `customer` | Storefront only — **no** `/admin` access |
| `super_admin` | Full access (bootstrap owner) |
| `admin` | Full access (same permissions as super admin in the UI) |
| `inventory_manager` | Catalogue (products, categories, brands), limited orders/analytics |
| `order_manager` | Orders + customer read + analytics |
| `customer_support` | Orders, customers, notifications |
| `marketing_manager` | Coupons, banners, notifications, analytics, media |
| `staff` | Legacy limited read access |

### Permissions (examples)

- `products:write`, `orders:write`, `customers:write`
- `coupons:write`, `banners:write`, `notifications:write`
- `analytics:view`, `settings:write`, `audit:read`, `media:upload`

`super_admin` and `admin` receive every permission. Other roles get a subset. The admin sidebar only shows routes the current role is allowed to open.

### Firestore rule helpers (must match roles)

Rules use the same role strings: `isStaff()`, `isSuperOrAdmin()`, `canManageCatalog()`, etc. Only `super_admin` / `admin` can change another user’s `role`. Users **cannot** self-promote.

---

## Bootstrap — create the first Super Admin

Manual Firestore editing is **no longer required**.

### One secure method: Admin SDK bootstrap script

```bash
# From the ShopBeta-Main project root
# Requires a Firebase service account (same as payments Admin SDK)

npm run admin:bootstrap -- --email=you@example.com --password=ChooseAStrongPassword
```

Optional:

```bash
npm run admin:bootstrap -- --email=you@example.com --password=Secret123! --display-name="Ada Admin" --credentials=./serviceAccount.json
```

### What it does

1. Refuses to run if `ADMIN_BOOTSTRAP_DISABLED=true`
2. Refuses if any `super_admin` / `admin` already exists (or `settings/bootstrap` was written) — unless `--force`
3. Creates a Firebase Auth user (or finds an existing one by email)
4. Sets Firestore `users/{uid}.role = "super_admin"`
5. Writes `settings/bootstrap` marking setup complete

### Credentials

Provide **one** of:

- `GOOGLE_APPLICATION_CREDENTIALS` → path to service account JSON  
- `FIREBASE_SERVICE_ACCOUNT` → raw JSON string  
- `--credentials=./path/to/serviceAccount.json`

Download a service account from Firebase Console → Project settings → Service accounts → Generate new private key.

### After bootstrap

1. Open `/login` and sign in with that email/password  
2. Open `/admin`  
3. Disable bootstrap permanently:

```env
ADMIN_BOOTSTRAP_DISABLED=true
```

Or simply never run `admin:bootstrap` again (it will refuse once an admin exists).

### Example workflow — first Super Admin

```text
1. Obtain a Firebase service account JSON
2. Set GOOGLE_APPLICATION_CREDENTIALS (or pass --credentials=...)
3. npm run admin:bootstrap -- --email=founder@shopbeta.app --password='...'
4. Sign in at /login
5. Visit /admin
6. Set ADMIN_BOOTSTRAP_DISABLED=true in your script environment
```

---

## Adding future admins / staff

### Option A — Admin UI (recommended)

1. Ask the person to **sign up** on the storefront (creates `users/{uid}` as `customer`).
2. Sign in as `super_admin` or `admin`.
3. Open **Admin → Customers**.
4. Select the user → **Staff role** → choose a role → **Save role**.

Only `super_admin` and `admin` see the role editor. Changes are audit-logged.

### Option B — CLI

```bash
npm run admin:set-role -- --email=ops@shopbeta.app --role=order_manager
```

Other examples:

```bash
npm run admin:set-role -- --email=stock@shopbeta.app --role=inventory_manager
npm run admin:set-role -- --email=ads@shopbeta.app --role=marketing_manager
npm run admin:set-role -- --uid=<firebaseUid> --role=admin
```

### Example workflow — add an Inventory Manager

```text
1. Colleague signs up with work email
2. You (Super Admin) open /admin/customers
3. Search their email → set role to Inventory Manager → Save
4. They refresh / sign in again and open /admin
5. They only see Products, Categories, Brands, Orders (read), Analytics
```

---

## Removing admin access

### Admin UI

Customers → select user → set role to **Customer** → Save.

### CLI

```bash
npm run admin:set-role -- --email=ex-staff@shopbeta.app --role=customer
```

They keep their Auth account and can still shop; `/admin` is blocked.

**Note:** You cannot remove your **own** admin role from the Customers screen (safety). Use another Super Admin/Admin, or the CLI.

---

## Creating additional roles

Roles are defined in code + Firestore rules (not as a separate collection):

1. Add the role string to `USER_ROLES` / `ADMIN_ROLES` (`src/constants/app.ts`, `src/lib/admin/rbac.ts`)
2. Map permissions in `ROLE_PERMISSIONS`
3. Mirror the role in `firestore.rules` (and `storage.rules` if staff uploads apply)
4. Redeploy rules
5. Assign with UI or `admin:set-role`

Do **not** invent role strings only in Firestore — the app and rules will ignore unknown roles for admin access.

---

## Firestore collections involved

| Collection | Relevance |
| --- | --- |
| `users` | `role`, profile, status — **authorization source** |
| `settings/bootstrap` | Marks one-time Super Admin bootstrap complete |
| `settings/app` | Store settings (admin editable) |
| `auditLogs` | Role changes and other admin actions |
| `products`, `categories`, `brands`, … | Catalogue managed by staff |
| `orders`, `payments`, `coupons`, `banners`, `notifications` | Operations modules |

Auth users live in **Firebase Authentication**, not in a separate “admins” collection.

---

## Security considerations

1. **Never** grant `super_admin` via client self-signup — rules block self-elevation.
2. Keep the service account JSON **offline / CI secrets only** — it bypasses rules.
3. Set `ADMIN_BOOTSTRAP_DISABLED=true` after first use.
4. Prefer least privilege (`order_manager`, `inventory_manager`, …) over handing out `admin`.
5. Suspend compromised accounts (Customers → Suspend) and demote role to `customer`.
6. Publish current `firestore.rules` / `storage.rules` so RBAC is enforced server-side.
7. Admin UI gating is client-side; **rules** are the real write protection.
8. Future hardening (optional): Firebase custom claims + Next.js middleware for defense in depth.

---

## Quick reference commands

| Task | Command |
| --- | --- |
| First Super Admin | `npm run admin:bootstrap -- --email=… --password=…` |
| Change role | `npm run admin:set-role -- --email=… --role=…` |
| Demote to customer | `npm run admin:set-role -- --email=… --role=customer` |

---

## Related docs

- `docs/phase-8-admin.md` — admin modules overview  
- `docs/phase-9-production.md` — launch checklist  
- `.env.example` — Admin SDK + `ADMIN_BOOTSTRAP_DISABLED`
