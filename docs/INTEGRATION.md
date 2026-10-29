> Historical storefront migration notes. For the newer store-specific configuration release, follow [STORE-SCOPING.md](STORE-SCOPING.md); it supersedes the earlier shared-settings and storefront-only deployment assumptions.

# Integration notes

## Accepted scope

- Replace the app in the existing Zenvexa repository.
- Use ShopBeta's system and share all backend data/settings with ShopBeta.
- Apply Zenvexa's storefront and admin design.

Source snapshots: ShopBeta `38a4143`, original Zenvexa `400dff1`. Work is isolated on `feat/shopbeta-system-zenvexa-design`; original Zenvexa remains in Git history. Source changes have not been pushed or deployed.

## What carries over

Authentication, RBAC, products, categories, brands, carts, wishlists, addresses, checkout, coupons, tax/delivery calculations, orders, tracking, refunds, notifications, customer management, banners, ads, analytics, audit, admin settings and all existing gateway API routes. Existing order identifiers and browser storage keys are intentionally preserved. Existing shared Cloud Functions are retained in source, not redeployed.

Zenvexa's simulated catalog, hardcoded coupons, fake bank/USSD details, local order success and passcode admin gate have been removed. Branding is local; do not rename the shared `settings/app` store name to accomplish frontend branding.

## Visual adaptation

Original emerald/amber tokens, hero photography, DM Sans/Manrope typography, card proportions, compact controls, Hug Bag, quick view, catalog filters and dark green portal header have been ported to Next.js. Shared controls also apply these tokens to checkout, account, tracking and admin screens. All ShopBeta admin sections remain available through permission-based tabs; this extends the original smaller Zenvexa admin design.

The header links to the real address/account flow rather than displaying Zenvexa's mock location and fees. Checkout uses ShopBeta delivery rules. Promotions and payment availability must come from ShopBeta's actual configuration; no demo payment options or discounts are advertised as available.

## Configuration still needed

The workspace has no live Firebase configuration, server identity or gateway credentials. Configure them privately through deployment settings. Set both `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_SITE_URL` to Zenvexa's actual origin and verify Firebase authorized domains. ShopBeta checkout already passes `window.location.origin` to some gateway flows; other flows use server app URL configuration. Paystack Cloud Functions retain an existing ShopBeta fallback URL, so validate every enabled provider's return behavior.

Shared settings also include store/contact information and notification integrations. Those may still produce ShopBeta-branded emails or support details by design until a deliberate cross-brand configuration is agreed. Accounts use the same Firebase Auth project, but signing in on one domain does not automatically sign in on the other.

## Existing issue requiring resolution before live payment use

`firestore.rules` permits public reads of `/settings/{settingsId}`. `src/services/settings.service.ts` and `src/types/settings.ts` support optional `paymentSecrets` in `settings/app`. If populated in the live project, those secrets are readable under the checked-in rules. No live document was accessed, and no secret exposure is asserted without that check. Squad and Monnify already use private payment settings; older provider secret fields require the same private/server-only treatment. A code comment saying “server-side only” does not restrict Firestore reads.

Because this task preserves the shared system, no shared rules or credential-storage migration has been applied. Resolve and validate this in the shared backend before launch.

## Validation

- Existing ShopBeta baseline: Squad 18/18 and Monnify 22/22 tests pass.
- Migrated Zenvexa: the same 40 payment tests pass; these use mocked services, not live gateways.
- Final build and browser results are recorded in `VALIDATION.md`.

Authenticated admin CRUD, real catalog browsing, every enabled gateway, callback/webhook idempotency in the deployed environment, emails, refunds and cross-store effects require a configured staging/deployment environment. Do not mistake successful local mock tests for completed live checkout verification.
