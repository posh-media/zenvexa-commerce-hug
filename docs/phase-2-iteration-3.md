# ShopBeta — Phase 2, Iteration 3: Catalog Polish, Performance & Production Readiness

Branch: `phase-2-iteration-3` (continues Iteration 2 work).

## 1. Catalog audit

| Page | Firestore services | Cleanup |
| --- | --- | --- |
| Home | `getHomeCatalogSections`, categories/brands | Deduped rails; removed multi-fetch duplication |
| Products | `getActiveProducts` + catalog services | Listing metadata; shared ProductBrowser |
| Categories | `getCategoryBySlug`, `getProductsByCategory` | JSON-LD + analytics beacon |
| Product details | `getProductBySlug`, related / also-like | SEO, recently viewed, deduped recs |
| Search | `searchProducts` | Dynamic metadata + search analytics |
| Deals | flash + discounted services | Fake pagination removed; recently viewed |
| Brands | `getBrands` / featured products | Listing metadata |
| 404 | `getPopularProducts`, `getCategories` | Removed mock `byTag` / mock categories |
| Header | CatalogNavProvider | Removed unused `@/lib/data` categories import |

Non-catalog pages (cart/checkout/orders/wishlist) still use `lib/data` mocks — intentionally deferred to Phase 3.

## 2. Performance

- Home sections now come from **one cached catalogue read** via `getHomeCatalogSections`, with rails excluding already-shown ids.
- Category/brand queries try indexed `where` + `limit`, then fall back to the cached catalogue when indexes are undeployed.
- Product static params limited to 48 slugs at build time.
- Pagination restores via URL (`page`) and scrolls to top without refetching the catalogue payload.
- React `cache()` still collapses duplicate service calls in a single request.

## 3. Firestore indexes

`firestore.indexes.json` expanded with:

- `active + reviewCount`
- `active + discount`
- Existing active/category/brand/flag/createdAt/rating composites retained

**Still requires:** `firebase deploy --only firestore:indexes` (and rules) with project IAM.

## 4. Pagination

ProductBrowser: next/prev, page restoration from URL, empty filtered pages, smooth scroll on page change, no catalogue reload between pages.

## 5. Images

- Lazy loading (non-priority)
- Blur placeholders
- Responsive `sizes`
- Fallback glyph when URL fails
- Remote patterns for DummyJSON / Amazon / Storage hosts

## 6–8. Recommendations & recent

- Related / you-may-also-like exclude overlapping ids; prefer category → brand → tags.
- Home featured/trending/flash/best/recent/offers deduped across rails.
- **Recently viewed**: `localStorage`, max 12, duplicate prevention, rails on home/product/deals.
- **Recently added**: `createdAt` sort (indexed when available).

## 9. SEO

- `metadataBase`, canonicals, Open Graph, Twitter cards
- Product + category JSON-LD
- BreadcrumbList JSON-LD
- Dynamic titles/descriptions on listing/search/product/category

## 10–12. A11y / mobile / errors

- Search suggestions `listbox` + `aria-expanded` / `aria-controls`
- Offline banner via `OfflineBanner`
- Catalog empty/error/loading states retained
- Invalid slug → `notFound()` with Firestore-backed suggestions
- Mobile filter drawer + responsive grids unchanged visually

## 13. Analytics preparation

`src/lib/analytics.ts` + `useCatalogAnalytics` with events:

`product_viewed`, `product_clicked`, `search_performed`, `category_viewed`, `brand_viewed`, `filter_applied`, `sort_changed`, `recommendation_clicked`

Default sink buffers + logs in development; `setCatalogAnalyticsSink` for future vendors.

## 14–15. Code quality / validation

- Shared SEO/analytics/recent utilities
- Product reads still flow through converters
- Typecheck target: clean `tsc --noEmit`

## Production readiness

**Ready for Phase 3 development** once ops items below are cleared:

1. `.env.local` web Firebase config + `NEXT_PUBLIC_SITE_URL`
2. Admin credentials to apply migrate/seed meta + deploy rules/indexes
3. Optional: connect analytics sink

No cart/auth/checkout work was introduced.
