# Phase 9 — Production readiness

ShopBeta is feature-complete. This phase prepared the platform for launch: SEO, performance, security, accessibility, monitoring hooks, and build validation. No new customer or admin features were added.

---

## Production audit

### Reviewed surfaces
- Customer app routes (catalogue, cart, checkout, account, payments)
- Admin dashboard (`/admin/*`) with RBAC
- Firestore services, converters, Zustand stores, hooks
- Payment API routes (Paystack + COD)
- Shared UI / commerce components

### Technical debt removed / reduced
- Private routes now emit `noindex` metadata (cart, checkout, profile, orders, payments, auth, demos, admin)
- Payment APIs sanitize errors and emit monitoring events
- ESLint blockers fixed (`prefer-const`, unused stubs)
- `endOfTodayISO` moved to a server-safe module (`src/lib/datetime.ts`) — importing it from a `"use client"` module broke static prerender
- Dead debug noise already minimal (`console.debug` only in analytics)

---

## SEO

### Metadata
- Helpers in `src/lib/seo.tsx`: listing, product, category, brand, private/noindex
- Keywords, canonical URLs, Open Graph, Twitter cards
- Root layout: `metadataBase`, keywords, robots, OG/Twitter defaults
- Admin layout: `noindex`

### Structured data (JSON-LD)
- Product (+ AggregateRating / Review when present)
- BreadcrumbList
- Organization + WebSite + SearchAction (home)
- CollectionPage / ItemList (categories)

### Open Graph & Twitter
- Dynamic OG/Twitter fields from product, category, brand, and listing builders
- Product pages use catalogue images when available
- Programmatic `@vercel/og` routes were attempted but removed: local Windows builds fail on paths with spaces (`Invalid URL` in `@vercel/og`). Product thumbnail URLs remain the primary OG image source.

### Sitemap
- `src/app/sitemap.ts` — home, products, brands, deals, help, search + live categories, brands, products
- Excludes cart, checkout, profile, admin, auth, payments

### robots.txt
- `src/app/robots.ts` — allows public catalogue; disallows admin, cart, checkout, account, auth, payments, APIs, demo routes; includes sitemap URL

---

## Performance

### Bundle / code splitting
- App Router route-level splitting for admin, checkout, payments, auth
- Product gallery + purchase panel lazy-loaded via `lazy-product-detail.tsx`
- Admin analytics remains its own route chunk

### Images
- `next/image` with AVIF/WebP (`next.config.mjs`)
- Blur placeholders, lazy loading, configurable `sizes` on `ProductMedia`
- Remote patterns for Firebase Storage, DummyJSON, Unsplash, Google avatars

### Caching
- React `cache()` for catalogue reads within a request
- Module TTL cache (`src/lib/cache.ts`) for categories/brands with `invalidateCatalogCaches()`
- Page `revalidate` on home/category/product/deals
- API routes: `Cache-Control: no-store`

### ISR / static
- Category + product `generateStaticParams` with on-demand fallback
- Sitemap forced dynamic so new products appear without redeploy

---

## Firestore

### Indexes
- `firestore.indexes.json` expanded (payments, orders, reviews, notifications, auditLogs, banners, catalogue composites)
- **Still must deploy:** `firebase deploy --only firestore:indexes`

### Query optimization
- Shared catalogue fetch for home rails
- Flag rails reuse one active-product read where possible
- Indexed queries with client-side fallbacks when indexes are missing

### Security rules
- `firestore.rules` — customer ownership for orders/addresses/wishlist/notifications; RBAC for staff; role escalation blocked on user create/update
- `storage.rules` — public read for `admin/**` assets; staff image writes; user avatar path; deny-by-default
- `firebase.json` wires rules + indexes

---

## Security

### Auth
- Client Firebase Auth; admin gate via `RequireAdmin` + Firestore `role`
- Customers cannot self-assign elevated roles (rules)

### API
- Zod validation on payment bodies
- Paystack webhook signature verification
- In-memory rate limiting preparation (`src/lib/server/rate-limit.ts`)
- Sanitized public error messages
- Secrets stay server-side (`PAYSTACK_SECRET_KEY`, Admin SDK) — documented in `.env.example`

### Headers
- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`
- `poweredByHeader: false`

---

## Accessibility

### Completed / preserved
- Skip link to `#main` in root layout
- Toast viewport `aria-live="polite"`
- Form labels on auth/checkout fields
- Product colour selectors use `aria-pressed`
- Decorative icons `aria-hidden`
- Global `error.tsx` with clear recovery actions

### Practical AA notes
- Contrast follows existing ShopBeta tokens (ink / muted / primary)
- Full WCAG audit tooling (axe CI) not wired — recommended post-launch

---

## Code quality

- Monitoring sink: `src/lib/monitoring.ts` (+ `ClientErrorReporter`)
- Rate limit + error sanitization helpers
- Cache invalidation hooks for catalogue
- Env checklist in `.env.example` (dev / preview / production)
- Architecture preserved: Firestore SSOT, services, converters, Zustand

---

## Build status

| Check | Result |
| --- | --- |
| TypeScript (`tsc --noEmit`) | Pass |
| ESLint (via `next build`) | Pass |
| Production build | **Pass** |
| Routes / static assets | Generated (admin, catalogue, APIs, sitemap, robots) |

---

## Launch readiness

### Ready
- Feature-complete customer + admin apps
- Payments (Paystack + COD) with verification/webhook paths
- SEO foundation (metadata, JSON-LD, sitemap, robots)
- Security rules in repo, storage rules added
- Monitoring integration points
- Production build validates

### Remaining blockers (ops — not code features)

1. **Deploy Firestore indexes** from `firestore.indexes.json`
2. **Publish Firestore + Storage rules** in Firebase Console (or `firebase deploy`)
3. **Set production env on Vercel:** `NEXT_PUBLIC_SITE_URL`, Paystack **live** keys, Firebase Admin credentials
4. **Configure Paystack webhook** → `https://<domain>/api/payments/paystack/webhook`
5. **Create the first Super Admin** (no manual Firestore edit):

```bash
npm run admin:bootstrap -- --email=you@example.com --password='...'
```

Then sign in and open `/admin`. See `docs/admin-access.md`. Set `ADMIN_BOOTSTRAP_DISABLED=true` after use.
6. **Authorize domains** in Firebase Auth (production + Vercel previews)
7. **Optional:** add a static `/public/og.png` for default social sharing (dynamic OG generation deferred due to Windows/`@vercel/og` path issue)
8. **Optional:** swap `setMonitoringSink` for Sentry/Datadog; replace in-memory rate limits with Redis/Upstash for multi-instance

**Verdict:** ShopBeta is **code-ready for production deployment** once the operational checklist above is completed.
