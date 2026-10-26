# Validation record

Local checks on 2026-10-26, without production credentials.

## Passed

- ShopBeta baseline: Squad 18/18 tests and Monnify 22/22 tests.
- Migrated app: Squad 18/18 tests and Monnify 22/22 tests. These validate mocked provider contracts, signatures, verification, idempotency, attempts and private settings; they do not contact live gateways.
- TypeScript check and ESLint after the visual component changes (no warnings/errors).
- Chromium, 1440px desktop and 390px mobile: no horizontal overflow.
- Hug Bag opens; Escape closes it; persisted two-item cart renders its correct subtotal.
- Unauthenticated admin navigation redirects to login. Demo passcode login is absent.
- Temporary local fixture route: eight product cards render, quick view opens, empty search returns the correct state, reset restores eight products, adding to the existing cart store updates the header count and exposes checkout in the bag. Fixture route was removed afterward; no fixture was written to Firebase.
- Browser smoke checks reported zero page errors after adding the missing-configuration auth guard.
- Core comparison with ShopBeta: 112 source/rules files checked across services, Firebase, stores, schemas, APIs, server logic, RBAC and functions. Only the catalog converter differs, in two fallback descriptions replacing ShopBeta with Zenvexa. The provider startup guard is a separate presentation/setup change outside those core folders.
- Git diff whitespace check.

## Limitations

No live Firebase environment or server/payment credentials are configured in this workspace. Real catalog loading, authenticated admin mutations, cross-site data sharing, live provider flows, emails, refunds and deployment/domain setup have not been exercised. The storefront correctly reports catalog unavailability instead of inventing products or orders.

An initial build exposed a Tailwind 3/4 stylesheet integration error; the ported CSS was merged into the Tailwind 3 global stylesheet to resolve it. Final production build status is recorded below.

## Final production build

`npm run build` completed successfully, including compilation, lint, type validation and generation of all 45 static pages. Expected missing-Firebase logs occurred during prerendering. The inherited payment-settings path also logged a relative-URL fetch warning in server rendering. This result establishes that the application builds; the warnings and missing configuration mean live payment behavior remains unverified.

The inherited `/api/debug/korapay-test` route was evaluated during prerender collection and its initialization attempt failed at the missing configuration check. No credentials were available and no successful gateway transaction occurred. This diagnostic endpoint should be disabled or protected in the shared system before production use; it was retained for system parity, not newly introduced by this migration.

The desktop/mobile Hug Bag and unauthenticated admin smoke checks were repeated against `next start` after the production build. All passed, with no browser page errors or horizontal overflow. The product fixture route is absent from the production route list.
