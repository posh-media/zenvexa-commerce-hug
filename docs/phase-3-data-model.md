# Phase 3 — Data Model Finalization & Backend Readiness

ShopBeta’s Firestore backend is finalized for catalog continuity and future commerce features. This document describes collections, relationships, schemas, services, validation, security recommendations, and migration tooling. No Admin UI, auth flows, cart UI, checkout, or payments were implemented in this phase.

---

## 1. Firestore Audit

### Collections reviewed (live)

| Collection | Status | Notes |
|---|---|---|
| `products` | Live | ~196 docs (DummyJSON + legacy). Schema finalized additively. |
| `categories` | Live / optional | Firestore-first with derive-from-products fallback. |
| `brands` | Live / optional | Same pattern as categories. |

### Schema improvements (additive only)

- Products: `currency`, `stockStatus`, SEO fields, `searchKeywords`, engagement counters (`viewCount`, `salesCount`, `wishlistCount`).
- Categories / brands: `seoTitle`, `seoDescription`; preserve existing copy on seed; refresh `productCount`.
- Legacy fields retained: `specification`, `variation`, `imgs`, `officalStore`, `keywords`, snake_case user fields.

### Collections prepared (not required to exist yet)

`users`, `addresses`, `carts`, `wishlists`, `orders`, `reviews`, `notifications`, `coupons`, `settings`

---

## 2. Product Model

### Final app-level fields

`id`, `productName` / `name`, `slug`, `sku`, `barcode`, `description`, `specifications`, `specification` (legacy), `category`, `categoryId`, `brand`, `brandId`, `thumbnail`, `images`, `variants`, `variations` / `variation` (legacy), `price`, `discount`, `currency`, `stock`, `stockStatus`, `rating`, `reviewCount`, `reviews`, `tags`, `sponsored`, `officialStore`, `featured`, `trending`, `flashSale`, `bestSeller`, `active`, `seoTitle`, `seoDescription`, `seoKeywords`, `searchKeywords`, `viewCount`, `salesCount`, `wishlistCount`, `createdAt`, `updatedAt`

### Defaults on read (converter)

| Field | Default |
|---|---|
| `currency` | `NGN` |
| `stockStatus` | derived from `stock` |
| `active` | `true` |
| SEO / search | derived from name / description / keywords |
| counters | `0` |

### Compatibility

- Reads/writes continue through `productConverter` / `toProduct` / `toProductDocument`.
- UI still adapts via `src/lib/product-view.ts`.
- Never delete legacy fields from Firestore.

---

## 3. Category Model

`id`, `name`, `slug`, `description`, `image`, `featured`, `active`, `productCount`, `seoTitle`, `seoDescription`, `createdAt`, `updatedAt`

Optional: `icon`, `parentId`, `subcategories`

Normalized by `categoryConverter` / `toCategory`.

---

## 4. Brand Model

`id`, `name`, `slug`, `description`, `logo` (+ optional `logoUrl`), `featured`, `active`, `productCount`, `seoTitle`, `seoDescription`, `createdAt`, `updatedAt`

Normalized by `brandConverter` / `toBrand`.

---

## 5. Future Collections

Each collection has: TypeScript types, Zod schema, Firestore converter, collection helpers, CRUD-ready service.

| Collection | Doc keying | Primary fields |
|---|---|---|
| `users` | Auth uid | profile, contact, `role`, `status`, timestamps |
| `addresses` | auto-id | `userId`, recipient, phone, geo fields, `default` |
| `carts` | userId | `userId`, `products[]`, `subtotal` |
| `wishlists` | userId | `userId`, `productIds[]` |
| `orders` | auto-id | `orderNumber`, `customer`, `products`, totals, payment/order status, shipping, tracking, notes |
| `reviews` | auto-id | `productId`, `userId`, rating, title, body, images, verified, helpful |
| `notifications` | auto-id | `userId`, title, message, type, read |
| `coupons` | auto-id | code, discount type/value, window, usage, active |
| `settings` | `app` singleton | currencies, delivery, countries, store, contact, social |

### Service architecture

```
src/types/*          → interfaces
src/schemas/*        → Zod
src/firebase/converters/* → FirestoreDataConverter
src/firebase/collections.ts → typed collection/doc refs
src/services/*       → get / list / set (no business logic)
src/constants/app.ts → enums / status constants
src/constants/collections.ts → collection path names
```

Services are intentionally thin so cart, checkout, payments, and Admin can plug in later without schema churn.

---

## 6. Relationships

```
products.categoryId  → categories/{id}
products.brandId     → brands/{id}
addresses.userId     → users/{uid}
carts/{uid}          → users/{uid}  (doc id = uid)
wishlists/{uid}      → users/{uid}
wishlists.productIds → products/{id}
carts.products[].productId → products/{id}
orders.userId        → users/{uid}
orders.products[].productId → products/{id}
reviews.productId    → products/{id}
reviews.userId       → users/{uid}
notifications.userId → users/{uid}
```

Convention: store **string IDs** (not DocumentReference) for portability and Admin SDK simplicity. Embedded snapshots (e.g. order line `name` / `unitPrice`, `shippingAddress`) freeze checkout-time data.

---

## 7. Validation

| Schema | File |
|---|---|
| Product | `src/schemas/product.schema.ts` |
| Category / Brand | `src/schemas/catalog.schema.ts` |
| User (+ embedded address) | `src/schemas/user.schema.ts` |
| Address (standalone) | `src/schemas/address.schema.ts` |
| Order | `src/schemas/order.schema.ts` |
| Cart / Wishlist / Review / Notification | `src/schemas/commerce.schema.ts` |
| Coupon | `src/schemas/coupon.schema.ts` |
| Settings | `src/schemas/settings.schema.ts` |

Product and catalog schemas are **tolerant** (`.loose()`, optional fields) so legacy documents never fail conversion.

---

## 8. Constants

Centralized in `src/constants/app.ts`:

- `STOCK_STATUS`, `stockStatusFromCount`
- `PRODUCT_TAGS`, `PRODUCT_FLAGS`
- `USER_ROLES`, `USER_STATUS`
- `ORDER_STATUS`, `PAYMENT_STATUS`, `PAYMENT_METHODS`
- `NOTIFICATION_TYPES`
- `COUPON_DISCOUNT_TYPES`
- `CURRENCY`

Collection paths: `src/constants/collections.ts` (`APP_SETTINGS_DOC_ID = "app"`).

---

## 9. Security (recommended, not deployed)

See `firestore.rules` in the repo root.

Summary:

| Collection | Read | Write |
|---|---|---|
| products / categories / brands | public | admin |
| settings / coupons | public | admin |
| users | owner / admin | owner (no role escalate) / admin |
| addresses | owner / admin | owner / admin |
| carts / wishlists | owner | owner |
| orders | owner / admin | create: owner; update/delete: admin |
| reviews | public | create/update: owner; admin |
| notifications | owner / admin | create/delete: admin; owner may mark `read` |

Deploy only when Auth + `users.role` are ready:  
`firebase deploy --only firestore:rules`

---

## 10. Seed & Migration

| Script | Purpose |
|---|---|
| `scripts/migrate-products.mjs` | Additive product field backfill (dry-run default; `--apply` to write) |
| `scripts/seed-catalog.mjs` | DummyJSON products + category/brand meta (preserves legacy docs & engagement counters) |

Both are idempotent: missing fields only; existing values preserved where possible.

Requires Admin credentials (`--credentials`, `GOOGLE_APPLICATION_CREDENTIALS`, or `FIREBASE_SERVICE_ACCOUNT`). Without credentials, scripts cannot touch live Firestore.

```bash
npm run migrate:products
npm run migrate:products -- --apply
npm run seed:catalog
npm run seed:catalog -- --apply --meta-only
```

---

## 11. Phase readiness

| Capability | Backend ready? | Notes |
|---|---|---|
| Cart | Yes (schema/service) | No UI / sync logic yet |
| Wishlist | Yes | No UI / sync logic yet |
| Checkout | Schema ready | No placement / totals logic |
| Orders | Yes | No create-order workflow |
| Payments | Status enums ready | No gateway integration |
| Authentication | User model ready | No Auth implementation this phase |
| Future Admin Dashboard | Yes | Catalog + commerce models + admin role constant |

**Verdict:** Backend data model is production-ready for upcoming customer features and a future Admin Dashboard without major schema redesign. Remaining work is feature implementation (Auth, cart sync, checkout, payments, Admin UI) and deploying rules/indexes with project-owner credentials.
