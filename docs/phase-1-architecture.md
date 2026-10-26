# ShopBeta — Phase 1: Foundation & Project Architecture

Scope: architecture only. No UI, layout, or styling changes; no auth/cart/checkout logic;
no Firestore writes or data migration.

## 1. Project architecture

New folders under `src/`:

| Folder        | Purpose                                                                 |
| ------------- | ----------------------------------------------------------------------- |
| `firebase/`   | App/Firestore/Auth/Storage singletons, typed collection refs, converters |
| `services/`   | Data-access layer (`products.service`, `storage.service`)                |
| `types/`      | Domain models for existing + planned collections                         |
| `schemas/`    | Zod schemas used to validate untrusted Firestore documents               |
| `stores/`     | Zustand stores (structure only)                                          |
| `hooks/`      | Generic client hooks (`useDebouncedValue`, `useMounted`)                  |
| `utils/`      | Currency, date, string, Firestore and validation helpers                  |
| `constants/`  | Collection paths, currency/pagination/tag constants                      |
| `providers/`  | `AppProviders` — single client-provider composition point                 |

`src/lib/` is kept (existing `data.ts` static catalog powers the current UI) and
`src/lib/utils.ts` now re-exports the canonical helpers from `src/utils/` so every
existing import keeps working.

Dependencies installed: `firebase@12.16.0`, `zustand@5.0.14`, `zod@4.4.3`.

Files added: see the PR diff; the only modified existing files are
`src/app/layout.tsx` (wrapped children in `AppProviders`, no visual change) and
`src/lib/utils.ts` (re-exports).

## 2. Firebase

- Config moved to env vars (`.env.local`, template in `.env.example`);
  nothing is hardcoded in source.
- `getFirebaseApp()` / `getDb()` / `getFirebaseAuth()` / `getFirebaseStorage()` are
  memoized singletons — Firebase is never initialized ad hoc in a component.
- Connection verified against project `shop-day84j`: Firestore read OK, Auth instance OK.
  The configured Storage bucket does not exist yet — see section 3.

## 3. Firestore inspection (read-only)

Authoritative inventory, taken with the Admin SDK (service-account credentials, reads only).

| Collection | Documents | Subcollections | Notes                                    |
| ---------- | --------- | -------------- | ---------------------------------------- |
| `products` | 2         | none           | `note100` (real data), `pro001` (test)   |
| `users`    | 1         | none           | id = Auth uid `MhXMTC3AiLZ4Z3Enb8SiF2GtNiy1` |

These are the only root collections; no others exist.

`users` document schema (snake_case, mirrors the Auth record):

| Field          | Type      | Present |
| -------------- | --------- | ------- |
| `uid`          | string    | 1/1     |
| `email`        | string    | 1/1     |
| `display_name` | string    | 1/1     |
| `created_time` | timestamp | 1/1     |

No `role`, `phone`, `addresses` or `active` fields — the app has no admin/customer
distinction stored anywhere yet.

Relationships: `users/{uid}` keys off the Auth uid. Nothing else references anything —
`products.category` is free text, and there are no `categoryId`/`brandId`/`userId`
foreign keys in the data today.

**Firebase Auth**: 1 user (`tikustarflow@gmail.com`, email/password provider, created
2026-05-14). Anonymous sign-in is disabled.

**Cloud Storage**: not provisioned. `shop-day84j.firebasestorage.app`,
`shop-day84j.appspot.com` and `shop-day84j` all report *bucket does not exist*, so the
configured `storageBucket` resolves to nothing and any upload will fail until Storage is
enabled in the console.

**Firestore indexes**: none (no composite indexes, no field overrides).

### Deployed security rules (as of ruleset `2565be85`, 2026-05-12)

```
match /products/{document} {
  allow create: if true;   // <-- anyone with the web API key can insert products
  allow read:   if true;
  allow write:  if false;
  allow delete: if false;
}
match /{document=**} {
  allow read, write: if request.time < timestamp.date(2026, 6, 11);  // expired
}
```

Two problems: `products` accepts unauthenticated **creates**, and the catch-all was a
wide-open 30-day rule that has now expired — which is why every other collection returns
`PERMISSION_DENIED` to clients, including the app's own `users` document.
`firestore.rules` and `firestore.indexes.json` in the repo root are proposed replacements
and are **not deployed**.

## 4. Products collection analysis

Inferred from both live documents (`note100` is real Umidigi data, `pro001` is test data):

| Field           | Type                     | Present | Notes                                              |
| --------------- | ------------------------ | ------- | -------------------------------------------------- |
| `productName`   | string                   | 2/2     | Display name                                       |
| `description`   | string                   | 2/2     | Long marketing copy                                |
| `specification` | string                   | 2/2     | Newline-separated `Label: value` blob, not a map    |
| `price`         | number                   | 2/2     | Minor-unit-free integer (e.g. `127500`)             |
| `discount`      | number                   | 2/2     | Percentage (50, 25)                                |
| `rating`        | number                   | 2/2     | 0–5                                                |
| `imgs`          | array\<string>           | 2/2     | Remote URL on `note100`, base64 data URI on `pro001` |
| `variation`     | array\<string>           | 2/2     | Free-text colour options                            |
| `category`      | string                   | 2/2     | Free-text (`gadgets`), no id/reference              |
| `sponsored`     | boolean                  | 2/2     |                                                    |
| `officialStore` | boolean                  | 1/2     | `pro001` only                                       |
| `officalStore`  | boolean                  | 1/2     | **Misspelling** on `note100`                        |
| `reviews`       | array\<map>              | 1/2     | `{reviewBy, rating, comment, nice, date: timestamp}` |

Document ids are hand-written (`note100`, `pro001`), not auto-ids, and there is no
`slug` field — the current `/product/[slug]` route cannot resolve Firestore products
until slugs exist.

### Missing recommended fields

`slug`, `sku`, `barcode`, `categoryId`, `brandId`, `thumbnail`, `images` (normalized),
`stock`, `reviewCount`, `specifications` (structured), `variants` (structured),
`tags`, `featured`, `trending`, `flashSale`, `bestSeller`, `active`,
`createdAt`, `updatedAt`.

### Suggested migration strategy (Phase 2, additive only)

1. **Additive backfill script** (admin SDK, dry-run first): write only new fields, never
   delete or rewrite existing ones.
   - `slug` = `slugify(productName)`, uniqueness-suffixed; keep doc ids unchanged.
   - `images` = `imgs`; `thumbnail` = `imgs[0]`; move base64 images into Storage and
     replace with download URLs.
   - `specifications` = `parseSpecificationBlock(specification)` (already implemented in
     `src/utils/firestore.ts`), keeping the original string.
   - `variants` = `variation.map(...)`; `reviewCount` = `reviews.length`.
   - `createdAt`/`updatedAt` seeded from document `createTime`/`updateTime`.
   - `stock`, `sku`, `active: true`, `featured/trending/flashSale/bestSeller: false`.
2. **Normalize the `officalStore` typo** by writing the correct `officialStore` and
   leaving the legacy field in place; the converter already reads both.
3. **Reference data**: create `categories` and `brands`, derive `categoryId`/`brandId`
   from the free-text `category`, keep `category` for backwards compatibility.
4. **Extract reviews** to a top-level `reviews` collection once volume grows; keep the
   embedded array as the read path until then.
5. **Rules + indexes**: lock down writes to admins, keep `products` publicly readable,
   add composite indexes for `active + categoryId + price` and `active + createdAt`.

## 5. Generated assets

- **Types**: `Product`, `ProductDocument`, `EmbeddedProductReview`,
  `ProductSpecification`, `ProductVariantOption`, `Category*`, `Brand*`, `User*`,
  `Address`, `Order*`, `OrderItem`, `OrderTotals`, `Cart*`, `Wishlist*`, `Review*`,
  `Notification*`, plus `WithId`/`Timestamps`/`FirestoreDate` helpers.
- **Converters**: `productConverter` (legacy field names → normalized `Product`, both
  directions) and `createConverter<T>()` for the planned collections, wired into typed
  refs in `src/firebase/collections.ts`.
- **Schemas**: tolerant Zod schemas (`.loose()`, all-optional) so legacy documents never
  fail to parse.
- **Stores**: `useUserStore`, `useCartStore`, `useWishlistStore`, `useCheckoutStore`,
  `useSearchStore`, `useNotificationsStore` — state + setters + `reset()` only.
- **Utils**: `formatPrice`, `discountPercent`, `priceBeforeDiscount`, `applyDiscount`,
  `formatDate`, `formatDateTime`, `formatRelativeTime`, `toDate`, `toTimestamp`,
  `stripUndefined`, `parseSpecificationBlock`, `slugify`, `truncate`, `initials`,
  `isEmail`, `isPhone`, `isNonEmpty`, `parseOrUndefined`, `fieldErrors`.

## 6. Recommendations before Phase 2

1. **Fix the security rules** — `allow create: if true` on `/products` lets anyone with the
   public web API key insert documents, and the expired catch-all blocks the app from
   reading its own `users/{uid}` document. Deploy `firestore.rules`.
2. **Enable Cloud Storage** — the configured bucket does not exist, so uploads and
   `getDownloadURL` will fail.
3. Rotate the `firebase-adminsdk-fbsvc@shop-day84j` service-account key that was shared for
   this inspection.
4. Seed real product data — 2 documents (one of them test data) is not enough to validate
   listing, filtering or pagination.
5. Decide the currency/price unit. UI formats as USD via `Intl`, but `127500` looks like
   NGN minor-or-major units; the pricing model should be explicit before checkout work.
6. Replace base64 images in Firestore with Storage URLs before the catalog grows — data
   URIs bloat documents and defeat image optimization.
7. Add `slug` before wiring `/product/[slug]` to Firestore.
8. Add `role` to `users` (the proposed rules rely on it) and reconcile the snake_case
   `display_name`/`created_time` fields with the camelCase convention used elsewhere.
9. Add a test setup (Vitest + React Testing Library) — the repo currently has none.
10. Consider TanStack Query for server-state caching, keeping Zustand for client state.
