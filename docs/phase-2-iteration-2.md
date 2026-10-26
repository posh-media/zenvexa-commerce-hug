# ShopBeta — Phase 2, Iteration 2: Product Experience & Catalog Completion

Continues from Phase 2.1 (`devin/1785946510-firestore-catalog` / PR #3).  
Branch: `phase-2-iteration-2`.

## Infrastructure

| Item | Status |
| --- | --- |
| Continue from PR #3 (not recreated) | Done — branched from catalog tip |
| Catalog pages read Firestore only | Done |
| Legacy migration script (`barcode` + apply mode) | Done (script ready) |
| Legacy migration **applied** to `note100` / `pro001` | Blocked — needs service-account credentials |
| Reusable seed script (`scripts/seed-catalog.mjs`) | Done |
| Categories collection seed | Script ready (`--meta-only` / full seed) |
| Brands collection seed + `brandId` backfill | Script ready |
| App category/brand services | Done — Firestore first, derive from products if collections unavailable |
| `firestore.indexes.json` catalog composites | Done |
| `firestore.rules` public read for categories/brands | Done in repo — **not deployed** (needs Firebase IAM) |

### Commands

```bash
npm run migrate:products -- --credentials=key.json --apply --default-stock=25
npm run seed:catalog -- --credentials=key.json --apply
npm run seed:catalog -- --credentials=key.json --apply --meta-only
firebase deploy --only firestore:rules,firestore:indexes
```

## Product Details

Dynamic slug routing, legacy id/slug fallback, image gallery + thumbnails, specs, variants/colours, reviews + rating summary, related products, you-may-also-like, sponsored/official badges, stock, SKU, loading skeleton, `notFound` for invalid slugs, catalog error rails where applicable.

## Categories

Firestore-backed category list/nav (header/footer/home), dynamic `/category/[slug]`, banner with product count, category browser chips, listing with filters.

## Search

Firestore `searchProducts`, `/search?q=`, debounced SearchBar, suggestions from live catalogue, result count, empty/error states, URL-driven navigation.

## Filters & Sorting

Combined client filters (category, brand, price, rating, stock, sponsored, official store, featured, flash sale) with URL sync (no full reload). Sorting: newest, price asc/desc, rating, reviews, discount, featured, relevant. Pagination preserves filter/search state.

## Media

`ProductMedia` / `ProductGallery` use real image URLs with glyph fallback, switching, and loading-friendly Next Image remote patterns.

## Performance

- React `cache` on product + category/brand catalogue reads
- Single catalogue fetch per page, filter/sort/paginate in memory
- Indexed query config prepared for post-deploy optimisation
- Layout loads nav categories/brands once for shared chrome

## Remaining for Phase 2 Iteration 3

1. Provide Firebase Admin credentials and **apply** migrate + seed meta (categories/brands) + deploy rules/indexes.
2. Switch flag filters from in-memory to indexed Firestore queries after indexes are live.
3. Wire search input live-results dropdown to `searchCatalogHints` (optional polish).
4. Client recently-viewed (currently “you may also like”).
5. Enable Storage and migrate remaining base64 (`pro001`) images.
6. Merge `phase-2-iteration-2` → `main` / close PR #3 lineage.
