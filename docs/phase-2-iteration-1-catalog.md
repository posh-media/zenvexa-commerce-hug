# ShopBeta — Phase 2, Iteration 1: Product Foundation & Firestore Integration

Firestore is now the source of truth for the product catalogue. No UI component,
layout, animation or responsive rule was changed: the pages fetch from Firestore
and map the documents onto the view model the existing components already expect.

## 1. Files modified / added

### Added

| File                                          | Purpose                                                             |
| --------------------------------------------- | ------------------------------------------------------------------- |
| `src/lib/product-view.ts`                     | Firestore `Product` → existing UI view model (`@/lib/data` `Product`) |
| `src/components/commerce/catalog-state.tsx`   | `CatalogRail` / `CatalogEmpty` / `CatalogError` states               |
| `src/app/loading.tsx`                         | Home skeleton while the catalogue loads                             |
| `src/app/products/loading.tsx`                | Listing skeleton                                                    |
| `scripts/migrate-products.mjs`                | Additive, idempotent, dry-run-by-default migration                  |
| `docs/phase-2-iteration-1-catalog.md`         | This report                                                         |

### Modified

| File                                       | Change                                                              |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `src/services/products.service.ts`         | Full product query surface (see §5)                                 |
| `src/firebase/converters/product.ts`       | Reads `variants` / `barcode`; `variation` ↔ `variants` normalization |
| `src/types/product.ts`                     | `Product` gains `barcode` and structured `variants`                 |
| `src/constants/app.ts`, `src/utils/currency.ts` | Naira (`NGN` / `en-NG`), whole-Naira formatting                 |
| `src/app/page.tsx`                         | Hero + 6 sections from Firestore                                    |
| `src/app/products/page.tsx`                | Listing from Firestore, real product count                          |
| `src/app/product/[slug]/page.tsx`          | Product, embedded reviews, rating breakdown, related from Firestore |
| `src/app/category/[slug]/page.tsx`         | Category products from Firestore                                    |
| `src/app/deals/page.tsx`                   | Flash sale + discounted products from Firestore                     |
| `src/app/search/page.tsx`                  | Results from Firestore, honours `?q=`                               |
| `package.json`                             | `firebase-admin` dev dependency, `npm run migrate:products`          |

## 2. Mock data removed

Product data no longer comes from `src/lib/data.ts` on any catalogue page:
`products`, `productsBySlug`, `byTag`, `byCategory`, `resolve`,
`recentlyViewedSlugs`, `reviews` and `ratingBreakdown` are no longer imported by
`/`, `/products`, `/product/[slug]`, `/category/[slug]`, `/deals` or `/search`.

Still mock, deliberately — there is no Firestore collection behind them yet, or
the owning feature is out of scope for this iteration:

- `categories`, `brands`, `priceBounds` — used by the header, footer, filter
  panel, category banners and `/brands`. Firestore has no `categories` or
  `brands` collection (see Phase 1 inventory).
- `recentSearches`, `popularSearches` — search suggestions.
- `cart`, `wishlist`, `orders`, `profile`, `checkout`, `notifications`,
  `not-found` product suggestions and the `/components` gallery.

`src/lib/data.ts` is retained: its `Product` / `Review` types are the UI view
model contract that `src/lib/product-view.ts` targets.

## 3. Schema normalization

Every legacy field is still read; nothing is renamed or removed.

| Legacy field    | Normalized as                                            |
| --------------- | -------------------------------------------------------- |
| `productName`   | `name`                                                   |
| `imgs`          | `images` (`images` wins when present), `thumbnail = images[0]` |
| `specification` | `specifications: [{ label, value }]` (text block parsed) |
| `variation`     | `variations: string[]` **and** `variants: [{ label, value }]` |
| `discount`      | `oldPrice` derived from `price` + `discount`             |
| `reviews`       | `reviewCount` when the field is absent                    |
| `officalStore`  | `officialStore` (`officialStore ?? officalStore`)         |

New fields the model supports, all optional on the document and defaulted in the
converter: `slug`, `sku`, `barcode`, `categoryId`, `brandId`, `thumbnail`,
`images`, `stock`, `reviewCount`, `specifications`, `variants`, `tags`,
`featured`, `trending`, `flashSale`, `bestSeller`, `active`, `createdAt`,
`updatedAt`. Unmigrated documents behave as `active: true` with a slug derived
from the product name, so the storefront works before the migration runs.

## 4. Migration script

`npm run migrate:products -- --credentials=<service-account.json>`

- **Dry run by default**; `--apply` is required to write.
- **Idempotent**: it builds a patch of *absent* fields only and skips documents
  with nothing to add. Existing values and legacy fields are never touched, and
  nothing is ever deleted.
- Options: `--default-stock=N` (default `0`), `--collection=<name>`.
- Credentials from `--credentials`, `GOOGLE_APPLICATION_CREDENTIALS` or
  `FIREBASE_SERVICE_ACCOUNT`.

What it appends: unique `slug` from `productName` (collision-suffixed and
checked against slugs already stored), `sku`, `images` from `imgs`, `thumbnail`
from the first image, `stock`, `reviewCount` from the embedded reviews,
`specifications` parsed from `specification`, `variants` from `variation`,
`categoryId` slugified from `category`, `officialStore` mirroring
`officalStore`, `tags: []`, `featured/trending/flashSale/bestSeller: false`,
`active: true`, `createdAt`/`updatedAt`.

Not written, because a value cannot be inferred without inventing data:
`barcode`, `brandId`. `stock` defaults to `0` (i.e. out of stock) unless you
pass `--default-stock`.

Dry run against `shop-day84j` today reports both documents would be updated:

```
+ note100: adding slug, sku, images, thumbnail, stock, reviewCount, specifications,
           variants, categoryId, officialStore, tags, featured, trending, flashSale,
           bestSeller, active, createdAt, updatedAt
+ pro001:  adding slug, sku, images, thumbnail, stock, reviewCount, variants,
           categoryId, tags, featured, trending, flashSale, bestSeller, active,
           createdAt, updatedAt
```

It has **not** been applied. Note the deployed rules block client writes to
`/products`, so run it with the service account (and rotate that key after).

## 5. Product service

`src/services/products.service.ts`, all returning normalized `Product` objects:

`getActiveProducts` (alias `listProducts`), `getFeaturedProducts`,
`getTrendingProducts`, `getFlashSaleProducts`, `getBestSellers`,
`getSponsoredProducts`, `getDiscountedProducts`, `getLatestProducts`,
`getProductById`, `getProductBySlug`, `getProductsByCategory`,
`getRelatedProducts`, `searchProducts`.

Implementation notes:

- The collection read is wrapped in React `cache`, so a page with six sections
  performs one Firestore read per render pass.
- Flag filters are applied in memory: legacy documents have no `active` or flag
  fields, so a Firestore `where` clause would exclude them. Once the migration
  has run and the catalogue grows, these should move to indexed queries using
  `firestore.indexes.json`.
- `getProductBySlug` resolves a stored `slug`, then the document id, then the
  converter-derived slug — so URLs work before and after the migration.

## 6. Pages connected

| Page                | Source                                                              |
| ------------------- | ------------------------------------------------------------------- |
| `/`                 | hero (featured → first product), flash sale, featured, trending, latest, best sellers, discounted offers |
| `/products`         | `getActiveProducts`, count from the real result                      |
| `/product/[slug]`   | `getProductBySlug`, embedded reviews, computed rating breakdown, `getRelatedProducts` |
| `/category/[slug]`  | `getProductsByCategory` (free-text `category` match, catalogue fallback) |
| `/deals`            | `getFlashSaleProducts`, `getDiscountedProducts`                       |
| `/search`           | `searchProducts` on `?q=`                                             |

Catalogue pages revalidate every 60s; `/product/[slug]` prerenders the slugs that
exist at build time and renders anything else on demand. Loading skeletons cover
`/` and `/products`; every section falls back to an empty state, and a Firestore
failure renders an error state instead of throwing.

## 7. Currency

`CURRENCY` is now `NGN` / `en-NG` and `formatPrice` renders whole Naira
(`127500` → `₦127,500`), matching the assumption that stored prices are whole
Naira. Two leftovers are static marketing copy, not product data, and were left
alone rather than inventing prices: the "$39/year" ShopBeta Plus line on `/` and
the mock `priceBounds` (49–2900) shown in the filter panel.

## 8. Remaining work for Iteration 2

1. **Run the migration** (`--apply`) and decide the real `stock` values; then
   switch the service's in-memory flag filters to indexed Firestore queries.
2. **Seed the catalogue** — Firestore holds 2 products (one of them a test
   document whose image is an inline base64 data URI), so the storefront is
   nearly empty. Also move that image into Cloud Storage once Storage is enabled.
3. **`categories` and `brands` collections**, then wire the header, footer,
   filter panel, `/brands` and category banners off the mock lists; populate
   `categoryId` / `brandId` and add the reference documents.
4. **Real product imagery** — `ProductMedia` still renders a glyph placeholder;
   `images`/`thumbnail` are read but not displayed by the approved UI.
5. **Search & filters**: the search input does not submit `?q=` yet (it is a UI
   component, untouched here), sorting/pagination/filters are presentational,
   and `priceBounds` should come from the catalogue.
6. **Reviews** as a top-level collection with real breakdown counts, plus
   client-side recently-viewed (currently mirrors related products).
7. **Deploy `firestore.rules`** — product writes are currently open to anyone
   with the web API key, and the catch-all rule has expired.
8. `firebase-admin` (dev-only, migration script) pulls transitive advisories via
   `@google-cloud/storage`; it is not in the app bundle.
