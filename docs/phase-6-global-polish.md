# Phase 6 — Global Features, Shared Experience & Application Polish

ShopBeta’s catalogue, shopping flow, and account surfaces now share one set of global systems for search, filtering, sorting, pagination, recommendations, notifications, loading/error/empty states, coupons, and countdown timers.

## Architecture hubs

| Concern | Module |
| --- | --- |
| Search + suggestions | `src/lib/search.ts`, `SearchBar`, `search.store` |
| Filter / sort / page | `src/lib/catalog-query.ts`, `ProductBrowser`, `filters.tsx`, `Pagination` |
| Breadcrumbs + SEO | `src/lib/breadcrumbs.ts`, `breadcrumbJsonLd` |
| Recently viewed | `use-recently-viewed`, `RecentlyViewedRail` |
| Recommendations | `recommendations.service.ts` |
| Coupons | `src/lib/coupons.ts` + Firestore `coupons` |
| Toasts | `toast.store` + `ToastViewport` in `AppProviders` |
| Errors | `src/lib/errors.ts`, `CatalogError` / `EmptyState` |
| Countdown | `countdown.tsx` (`endsAt`, expire, a11y) |

## Global search

- Firestore-backed via `searchProducts` / `globalProductSearch`
- Matches name, brand, category, tags, description, `searchKeywords`
- Debounced suggestions (`280ms`) with URL `?q=` on submit
- Shared `SearchBar` used in header and search page

## Search suggestions

- Live product hits + matching categories/brands
- Recent (local + optional profile sync) and popular terms
- Keyboard navigation (↑/↓/Enter/Esc) and empty-state copy

## Filtering & sorting

- One `CatalogFilters` model: category, brand, price, rating, stock, featured, trending, flash sale, best seller, sponsored, official store
- Sort: newest, price asc/desc, rating, reviews, discount, featured, alphabetical, relevant
- URL sync preserves filters, sort, page, and search query

## Pagination

- Shared `Pagination` (prev / next / page numbers)
- `scroll: false` on URL replace to preserve scroll
- Infinite scroll deferred (page numbers are the default listing strategy)

## Breadcrumbs

- Helpers for home, catalog, product, search, account
- JSON-LD on product and search results pages

## Recently viewed

- `localStorage` key `shopbeta.recently-viewed.v1`
- Max 12, deduped by id/slug, auto-updated on PDP view
- Ready for future Firestore sync for authenticated users

## Recommendations

- Same category / brand via existing product services
- Discovery rails: trending, flash, latest, bestsellers
- Stubs: frequently viewed together, personalized ranking

## Flash sale countdown

- Absolute `endsAt` (end of day helper) on home, deals, flash PDPs
- Auto-updates; shows “Offer ended” when expired

## Coupons

- Validate active window, usage limit, minimum purchase
- Fixed + percentage discounts via Firestore (BETA10 local fallback)
- Wired into cart and checkout totals (no payment gateway)

## Toast notifications

- Global success / error / warning / info viewport
- Events: cart, wishlist, coupon, order, profile, address, auth

## Loading / errors / empty

- Shared skeletons, `CatalogEmpty` / `CatalogError`, page `EmptyState`s
- Friendly error classifier in `lib/errors.ts`

## Performance

- Catalogue rails still use React `cache()` single-read pattern
- ProductBrowser URL sync uses `startTransition`
- Selective Zustand selectors on toast/cart/wishlist/search

## Accessibility

- Search combobox ARIA, suggestion listbox, filter drawer dialog
- Pagination labels, toast `role="alert"` for errors, countdown `aria-live`

## Out of scope (unchanged)

- Admin dashboard
- Payment gateway integration
- UI redesign
