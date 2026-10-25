# Zenvexa Commerce Hug — Firebase Backend Change Report

## 1. Scope and repository state

This report summarizes the latest Firebase backend foundation and incremental frontend integration work. It distinguishes local implementation from emulator verification, remote deployment, and production readiness.

- Repository: https://github.com/posh-media/zenvexa-commerce-hug
- Local directory: `C:\dev\Zenvexa`
- Working branch: `feat/firebase-backend`
- Starting baseline: `400dff17689b8539329a50910af2885c6e07a2a2`
- Firebase project configured in source: `zenvexa-c8d84`
- Existing Git history preserved; implementation changes remain uncommitted.
- No commits, pushes, pull requests, remote deployment, production migration, billing changes, or payment activation were performed.

The existing TanStack Start framework, storefront styling, five product categories, Nigerian currency, delivery rules, promo codes, and centrally managed single-store model were preserved. No vendor onboarding, vendor storefronts, commissions, or seller payouts were introduced.

This report uses the implementation and validation results recorded during the preceding development task, plus a fresh Git status/diff inspection when preparing this file. Test suites were not rerun solely to generate this report.

## 2. ShopBeta reference review

ShopBeta was inspected at commit `38a41431bec345f2b131a61c5fd8dca8650d61dc`.

### Patterns adapted

- Separation of browser-facing code from trusted commerce/payment services.
- Payment reference persistence before provider initialization.
- Server-side verification and raw-body webhook authentication.
- Transactional order/payment processing and idempotency.

### Patterns rejected

The reviewed source still contained unsafe patterns that were not copied:

- Publicly readable settings with payment-secret fields.
- Guest-pattern access to order documents.
- Overly permissive stock-decrement rules.
- Order creation accepting client-submitted totals.

No ShopBeta secrets, payment credentials, customer records, or marketplace entities were imported. The tagged ShopBeta conversation was not accessible through available tools; source code was the implementation evidence.

## 3. Firebase architecture implemented locally

| Service | Implementation | Remote status |
|---|---|---|
| Authentication | Email/password sign-in, anonymous guest sessions, verification-email workflow | Providers and authorized domains not verified in the real project |
| Firestore | Authoritative catalogue, delivery, orders, payment attempts, staff roles, profiles/addresses, inventory and audit records | Rules/indexes not deployed |
| Cloud Functions | Node 22 callable operations and Paystack webhook in `europe-west1` | Not deployed |
| Storage | Staff-restricted product image uploads and public product image reads | Bucket configuration and rules not deployed/verified |
| App Check | Client initialization and callable enforcement outside emulators | Registration and console enforcement remain outstanding |
| Analytics | Not initialized; not required by the backend | Not activated |

The Firebase web configuration is public client configuration, not an authorization mechanism. No privileged credentials were added to frontend code.

## 4. Authentication and authorization

Firebase mode uses Firebase identity and server-read staff records instead of the legacy demo passcode/localStorage flag.

- Customers can read only their permitted account, address, and order records.
- Staff roles are `admin`, `inventory`, and `orders`.
- Staff mutations require a verified, nonanonymous account and an active server-side staff record.
- Clients cannot promote themselves to staff.
- Direct client writes to authoritative product, inventory, order, and payment state are denied.
- Unknown collection paths are denied by default.
- Storage limits product uploads to verified inventory/admin staff, permitted image types, and bounded file sizes.

The old demo implementation remains isolated for migration. It is not production authorization.

Principal files: `firestore.rules`, `storage.rules`, `functions/src/index.js`, `functions/src/commerce-service.js`, and `src/lib/firebase-client.ts`.

## 5. Firestore data model

| Collection/path | Purpose and trust boundary |
|---|---|
| `products/{id}` | Product display data, prices, available stock and active state; privileged mutations through Functions |
| `categories/{id}` | Public category configuration; excludes the aggregate All Merchandise filter |
| `deliveryZones/{id}` | Public supported delivery zones, fees and ETAs |
| `profiles/{uid}` | Owner-restricted, allowlisted profile fields; no staff-role fields |
| `profiles/{uid}/addresses/{id}` | Owner-restricted saved-address contract |
| `staff/{uid}` | Trusted staff assignment; no client writes |
| `orders/{id}` | Owner-associated server totals, item snapshots, contact/delivery details, lifecycle and reservation state |
| `orders/{id}/events/{event}` | Server-generated lifecycle history; no direct client access in this foundation |
| `paymentAttempts/{reference}` | Server-only expected amount, currency, reference, identity association and provider state |
| `inventoryEvents/{id}` | Server-generated reservation, release and staff-adjustment history |
| `auditLogs/{id}` | Server-generated administration audit records |
| `requestLimits/{uid}` / `operationLimits/{uid}` | Transactional per-identity abuse counters |

Payment secrets are not stored in public configuration, payment documents, or audit payloads.

## 6. Order and inventory operations

Implemented server operations:

1. Authenticate the caller and validate the request shape.
2. Accept product IDs and positive integer quantities, not authoritative browser prices.
3. Read current product availability/pricing and supported delivery configuration.
4. Calculate merchandise totals, delivery fees and discounts on the server.
5. Save recipient name, phone, street address, landmark, state and delivery zone.
6. Generate the order identity and timestamps on trusted infrastructure.
7. Reserve stock, write the order and record inventory/lifecycle events in a transaction.
8. Reuse the same order for an identical identity-scoped idempotency key; reject reuse with changed details.
9. Require server-enforced staff permissions for product and fulfilment mutations.
10. Reject stale inventory edits that would overwrite a concurrent reservation.

Existing delivery fees and zones are preserved: Lagos ₦1,500; Abuja ₦2,500; Rivers ₦2,800; Oyo ₦2,000; Kano ₦3,200; Enugu ₦2,700. Original 1–2 business-day ETA rules remain.

Promo rules remain explicit: `HUG10` discounts merchandise by 10%, rounded to whole naira; `NAIJA5K` discounts ₦5,000 only when merchandise subtotal is strictly above ₦50,000. Delivery is not discounted.

### Lifecycle separation

- Electronic order: `pending_payment` → trusted payment verification → `processing` → staff `dispatched` → `delivered`.
- Failed, abandoned or pending provider results do not confirm payment.
- POD order: `processing` with `uncollected` payment state; delivery does not imply electronic payment.
- Admin collection records a separate `collected` state and receipt for delivered POD orders.
- Eligible cancellation releases reserved stock once.
- Full verified refunds become `refunded`; physical inventory is not automatically restocked.

## 7. Payment implementation

Callable Functions: `createOrder`, `saveProduct`, `updateOrderStatus`, `collectPod`, `initializePayment`, and `verifyPayment`.

HTTP Function: `paystackWebhook`.

### Paystack controls

- Payments default to disabled.
- Only test-mode credentials are accepted by this foundation; live keys are rejected.
- Secrets use Firebase Functions secret parameters, not browser variables or public Firestore documents.
- The server initializes the stored order amount in kobo and NGN using a persisted reference.
- Verification checks reference, expected amount, currency, owner/order metadata and customer email.
- Webhook authenticity uses raw-body SHA512 HMAC verification followed by independent provider lookup.
- Duplicate verification/webhook processing cannot deduct stock twice or regress paid/refunded state.
- Full processed-refund events are independently checked against provider refund data.
- Redirects and frontend success messages never establish payment proof.

Bank transfer and USSD are designed as Paystack hosted channels, not manual screenshot/reference confirmation. Demo transfer account numbers and USSD codes are hidden in Firebase mode.

Anonymous guests are currently limited to POD. Electronic checkout requires a verified-email account because guest-to-account linking is not implemented.

No Paystack test or live API requests were made during development. Settlement tests inject synthetic verified results into internal server services; there is no public fake-payment success endpoint.

## 8. Frontend integration and migration safeguards

Firebase mode now subscribes to authoritative catalogue and permitted order data, reconciles cart snapshots, submits checkout to Functions, and uses server operations for administration. It does not silently fall back to demo catalogue/orders after a backend error.

The supplied styling and existing shopping views were retained. The account controls and payment/order actions use existing components. Payment redirects open order history without fabricating paid state.

Demo mode remains available. Browser storage can retain a non-authoritative cart and legacy demo data, but it does not determine backend prices, stock, payments or staff permissions.

### Seed strategy

The emulator-only seed:

- Preserves stable catalogue IDs and existing image references.
- Creates missing records only: 50 products, five categories and six delivery configurations.
- Does not overwrite existing stock or catalogue edits.
- Does not import demo orders.
- Requires explicit loopback emulator configuration.

No remote seed/migration was performed. Real migration requires separate approval, backup, dry-run, validation and rollback planning. Known legacy image-path problems remain preserved rather than being silently changed in this backend task.

## 9. File inventory

### Added

- `.env.example`
- `.firebaserc`
- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`
- `functions/.env.example`
- `functions/package.json`
- `functions/seed.ts`
- `functions/src/core.js`
- `functions/src/commerce-service.js`
- `functions/src/index.js`
- `functions/test/core.test.js`
- `functions/test/emulator.test.js`
- `functions/test/http.test.js`
- `src/lib/firebase-client.ts`
- `src/components/zenvexa/firebase-commerce.tsx`
- `src/components/zenvexa/firebase-order-actions.tsx`
- `src/test/firebase-integration.test.tsx`
- `src/test/firebase-seed.test.ts`
- This standalone report: `FIREBASE_BACKEND_CHANGE_REPORT.md`

### Updated

- `.gitignore`: local environment/secret and generated-file exclusions.
- `package.json`, `bun.lock`: Firebase dependency and Functions workspace/test setup; existing lock entries were preserved, with additive dependency entries.
- `AGENTS.md`, `README.md`: mode separation, setup, verification, migration and approval boundaries.
- `src/components/zenvexa/store-context.tsx`: backend-mode state and catalogue/cart reconciliation.
- `src/components/zenvexa/storefront.tsx`: no demo catalogue fallback in Firebase mode; consistent featured-product identity.
- `src/components/zenvexa/views.tsx`: trusted checkout, safe retry key, server-payment actions and separation of demo content.
- `src/components/zenvexa/admin.tsx`: Firebase staff gate, server mutations, restricted image uploads and POD collection action.
- `src/routes/index.tsx`: account controls integration.
- `src/test/commerce.test.ts`: existing fixture typing and formatting.

Touched application modules were formatted to the existing formatter configuration, which accounts for much of the expanded line count. No repository-wide formatting cleanup was undertaken.

`src/routeTree.gen.ts` is flagged locally after build regeneration, but its content diff was empty during inspection.

### Other local additions outside this implementation

Fresh Git inspection also found untracked `Zenvexa logo.jpeg` and `Zenvexa Social Share Image.jpeg`. Their contents and origin were not reviewed for this report; they were not modified, integrated or staged by the backend task.

## 10. Validation results

These are actual results from the preceding implementation session, not tests rerun while writing this report.

| Check | Result |
|---|---|
| Frozen-lockfile Bun installation | Passed |
| Frontend Vitest suite | 13 passed; one opt-in seed test skipped |
| Backend unit suite | 8 passed |
| Firestore/Storage emulator suite | 7 passed |
| Functions HTTP/Auth emulator suite | 1 passed |
| Separately enabled emulator seed check | 1 passed |
| TypeScript no-emit check | Passed |
| Demo-mode build | Passed |
| Firebase-mode build | Passed |
| Lint scoped to changed source/tests | Passed; three Fast Refresh warnings |
| Repository-wide lint | Failed on extensive existing formatting/CRLF violations |
| Git whitespace/diff check | Passed |

Coverage includes owner isolation, forbidden role/price/stock/payment writes, staff authorization, malformed inputs, promo/delivery calculations, concurrent last-item purchases, idempotency, stale stock edits, payment mismatches and replay, refunds, POD transitions, browser-role forgery and untrusted payment redirects.

Actual Paystack sandbox contracts, live App Check and a complete interactive browser checkout E2E were not verified. Builds emitted nonblocking chunk-size and existing build-plugin warnings.

### Tooling recovery

Bun 1.3.11 was launched through a pinned `npm exec` launcher without a global Bun installation. Bun remained the dependency manager.

Firebase CLI could import the Functions SDK but could not initially discover its Windows executable launcher. A hoisted frozen Bun install plus `npm rebuild firebase-functions --ignore-scripts --package-lock=false` regenerated executable shims and resolved discovery. No npm lockfile was created.

The emulator CLI also encountered a shutdown error and left a local Java process. Only processes belonging to this checkout's emulator run were stopped; test commands were rerun successfully against local emulators. Local services were stopped after validation.

## 11. Access blockers and approval boundaries

- The configured project did not appear in the authenticated CLI account's accessible project list.
- `firebase apps:list --project zenvexa-c8d84 --json` failed with “Failed to list Firebase apps.”
- Real project permissions, billing, Auth providers, database location, bucket configuration and enabled APIs remain unverified.
- No Paystack secret was supplied or provisioned.
- App Check registration and console enforcement remain pending.
- Cloud deployment requires review of a source-scoped locked Functions artifact; local workspace/emulator success does not establish Cloud Build reproducibility.

An authorized project account or a project-owner IAM grant is required before remote setup can proceed. Credentials must be handled locally or through approved secret-management tools, not pasted into chat.

Remote service configuration, staff bootstrap, secret provisioning, deployment, production migration, billing changes and payment-provider activation require explicit approval. The current source rejects live Paystack keys; live support requires a separately reviewed change.

## 12. Remaining functional and operational limitations

- No automatic reservation expiry/recovery. Attempted payments retain stock until reconciliation to avoid late payment against released inventory.
- No complete attempt-recovery administration workflow.
- Partial refunds, paid-order cancellation, returns and physical restocking require follow-up work.
- Guest account linking and profile/address-management UI are not implemented.
- Legacy image references remain unresolved.
- Monitoring, backup/restore, rollback rehearsal and production abuse controls remain release requirements.
- Real provider availability for bank-transfer/USSD channels remains subject to merchant configuration and contract validation.
- Full browser-flow and production security validation remain outstanding.

## 13. Readiness summary

| State | Status |
|---|---|
| Local backend foundation and frontend adapter | Implemented |
| Core security rules/services and callable transport | Emulator-tested |
| Remote Firebase rules, indexes, Storage and Functions | Not deployed |
| Credentialed Paystack sandbox integration | Not exercised |
| Real-money transactions | Disabled; not authorized |
| Production readiness | Not established |

For detailed setup commands, environment requirements, collection contracts, endpoints, permissions, test-mode setup and migration/rollback guidance, see `README.md`.
