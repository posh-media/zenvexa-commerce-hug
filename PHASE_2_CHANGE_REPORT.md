# Zenvexa Phase 2 — Implementation and Verification Report

## Status and boundaries

Latest remote execution and storefront evidence is recorded in sections 11–12 below. ADC authentication and remote Firestore access now work, the reviewed additive plan was applied, and direct remote read-back verifies the intended catalogue. The earlier credential, artifact-review, catalogue-read and homepage-hero blockers described in this historical report are resolved.

Phase 2 has substantial local implementation and the requested remote catalogue population and public storefront reads are working. Authenticated admin and secure order submission remain **blocked by absent Functions, App Check configuration and trusted staff provisioning**. Work remains on `feat/firebase-backend`, preserving the existing history and prior uncommitted changes. Firestore rules were deployed only after explicit approval; no Functions, Storage rules, indexes, commits, pushes, production orders, customer records, billing settings, or real-money payment settings were changed.

| Area | Evidence/status |
|---|---|
| Local catalogue migration | Implemented; source and planning regression tests pass |
| Catalogue source | 50 existing Zenvexa products, five categories; original IDs/SKUs preserved |
| Products/categories written remotely | **50 / 5**, plus six delivery-zone records |
| Current remote product/category counts | **50 / 5**, verified by direct Admin SDK read-back |
| Remote backup/export | Application-level affected-collection JSON reviewed; zero pre-existing records |
| Firebase CLI access | Intended `zenvexa-c8d84` web app can now be listed |
| Firebase deployment | Reviewed Firestore rules deployed after explicit approval; Functions, Storage rules and indexes remain undeployed |
| Admin/storefront source | Firebase-backed public storefront verified locally; admin and order submission await Functions/App Check/staff gates |
| Product imagery | All 50 references audited; one manufacturer-reference asset reviewed, 49 unresolved |
| Automated checks | 44 frontend tests, eight backend unit tests, 11 Firestore/Storage emulator tests and four remote migration tests pass |
| TypeScript / production build | Pass |
| Production readiness | Not established |

## 1. Repository and reference inspection

The preceding `FIREBASE_BACKEND_CHANGE_REPORT.md`, current Firebase foundation, storefront adapter, checkout, rules, and admin work were reviewed. The local ShopBeta checkout points to `https://github.com/tikustar/ShopBeta-Main.git`, on `main`, clean, one commit ahead of its local `origin/main`, at `18fd07b` (`fix: preserve payment api keys when saving settings`). This is a different reference revision from the previous report's `38a41431`.

ShopBeta's admin routes, role/navigation definitions and supporting services provide the functional reference. Its navigation includes dashboard, products, categories, brands, orders, customers, coupons, banners, ads/expenses, notifications, analytics, settings and audit. The earlier public-settings/payment-key finding must not be treated as unchanged without considering the newer local settings commit. No ShopBeta credentials, customer records or products were imported.

### Comparison and disposition

| Reference workflow | Zenvexa implementation/disposition | Remaining limits |
|---|---|---|
| Dashboard and analytics | Server aggregates for catalogue/stock, order statuses, recent orders, date selection and revenue | No advanced analytics/export suite; remote indexes and browser acceptance outstanding |
| Products | Add/edit supported product fields; SKU, descriptions, pricing, stock, category, specifications, merchandising, ordered images and active state; bounded server queries | Search uses token/prefix matching; sorting and some filtering operate on the visible page, not a full-text search engine |
| Categories | Canonical five categories; editable description, image and featured metadata | Renaming/deleting canonical identities intentionally rejected |
| Orders | Paginated listing, status/date filters, visible-page search, order details/history and permitted server transitions | Full cross-database order search/payment-method query UX is not implemented |
| Customers | Actual profile records and permitted order counts | Read-only; no invented customer history, Auth directory import or full CRM/profile editor |
| Coupons | Existing HUG10 and NAIJA5K rules explained in Promotions | Read-only; no arbitrary new promotion builder |
| Settings | Validated contact configuration through an authorized server operation | Not a full site-settings system; storefront consumption of every contact setting is not established |
| Audit | Restricted paginated server audit view | Not a full audit export/reporting system |
| Brands | Existing supplier/product information retained | Separate brand-management collection/UI not added |
| Banners, ads/expenses, notifications | Not copied as empty or misleading menu items | Campaign, expense and messaging modules deferred |
| Additional Zenvexa inventory section | Reasoned stock adjustments, expected-stock check and audit events | Remote workflows not exercised |
| Additional Zenvexa payments section | Restricted projection of real payment-attempt records | No arbitrary electronic-payment verification, refund button or gateway reconciliation UI |
| Staff | Restricted staff listing and explanatory limitations | Read-only; trusted initial staff provisioning and role-edit workflow remain operational follow-ups |
| Nigerian delivery | Authorized zone/fee configuration with canonical state/ETA validation | Remote configuration and browser acceptance outstanding |

Zenvexa remains a centrally managed single store. No vendors, onboarding, commissions, seller storefronts or payouts were added. Useful information architecture was adapted rather than copying ShopBeta authorization or payment trust boundaries.

## 2. Firebase access blocker and required action

A fresh `firebase.cmd apps:list --project zenvexa-c8d84` succeeds and lists the expected Zenvexa web app. CLI project access is no longer the original blocker.

The explicitly selected **read-only** Admin SDK migration dry-run fails with:

> Could not load the default credentials.

An initial run also reached Vitest's default five-second timeout; retrying with `--testTimeout=60000` exposed the actual credential error. No apply was attempted. CLI login and Admin SDK Application Default Credentials are different authentication contexts.

Minimum next step: configure Application Default Credentials locally with an authorized identity, for example `gcloud auth application-default login` once Google Cloud CLI is available. The identity needs Firestore catalogue read/write permissions, typically `roles/datastore.user` or an appropriately scoped custom role. Additional deployment permissions, APIs, billing prerequisites, and App Check setup must be checked separately; listing an app does not establish them. Do not paste tokens, service-account keys or credential-file contents into chat.

After credentials work: rerun the dry-run, inspect actual counts and proposed field changes, review the local backup and conflict list, approve the exact current plan hash, and only then apply and read back all 50 IDs and five categories. Do not switch projects or reuse ShopBeta credentials.

## 3. Catalogue and migration safeguards

`functions/catalogue.ts` extends the existing emulator-only seed with a separate guarded remote migration planner. It requires the explicit `zenvexa-c8d84` target and refuses emulator configuration for the remote path.

The source retains all 50 products and their stable IDs/SKUs, descriptions, specifications, category, prices, stock, supplier/badge values and seed rating counts. Added metadata includes slug, category ID, NGN currency, image gallery/provenance, review provenance, active/featured state, search tokens and seed version. Ratings are labelled seed/demo values, not genuine customer reviews. No demo orders are included.

Safeguards include duplicate ID/SKU checks, required-field validation, bounded existing-collection inspection, create/repair/preserve planning, dry-run JSON and backup output in ignored `catalogue-migration/`, a source/database hash, a transaction-time recheck, deterministic IDs and post-write seed-ID verification. Existing legitimate prices, stock, images and inactive state are preserved. Invalid existing stock is quarantined at zero/inactive rather than replenished. An invalid comparison price is repaired to the actual price rather than inventing a discount. Existing unrelated records are not deleted.

The backup is an application-level catalogue JSON snapshot, not a full managed Firestore export or tested disaster-recovery restore. No remote snapshot was obtained because authentication failed first. `catalogue-manifest.json` is a local source manifest, **not proof of remote data**.

## 4. Images and brand assets

All 50 product references were audited, with results in `catalogue-image-audit.json` and a visual contact sheet. Reachable third-party images were not automatically accepted as matching product photographs. Examples of mismatches included Starlink pointing to Apple computers, a generator pointing to an electrician, and Milo pointing to coffee.

- One EcoFlow DELTA 2 manufacturer-reference image was checked and converted to `public/catalog/eco.webp`.
- Manufacturer source details and dimensions are recorded in `catalogue-image-sources.json`.
- Regional stock/model correspondence and publication rights still require approval before production use.
- The other **49 products remain unresolved** and use the neutral `public/catalog/missing.svg` indicator in the migration source. Original references remain available for review.
- No product asset was uploaded to remote Storage.
- Shared product-image handling is used instead of substituting the homepage hero or logo for missing products.

The actual root files `Zenvexa logo.jpeg` (1080×806) and `Zenvexa Social Share Image.jpeg` (1080×602) were verified. Originals remain unchanged. `scripts/prepare-brand.mjs` generates `public/brand/logo.png`, `favicon.png` and `social-share.jpg`, preserving the logo's proportions. Shared brand placements and root icons use the derivatives. The social graphic contains baked-in marketing claims that still need business review; image availability does not verify those claims.

## 5. Storefront source and backend authority

Firebase mode is the default unless explicit demo mode is selected. The adapter subscribes to active `products` records, distinguishes server/cache source, and clears the catalogue on read failure rather than presenting mock products as successfully loaded Firestore data. Nigerian categories, search/filtering, naira formatting and cart reconciliation remain integrated. Delivery configuration is read separately and failure disables reliable checkout rather than silently trusting local fees.

Product details use `/products/$productId` and a public server-side Firestore read. Sitemap entries come from validated active remote records rather than enumerating local mocks. Product absence is distinct from a backend failure.

Checkout continues sending IDs/quantities and delivery selections to trusted operations. Prices, discounts, inventory and payment state remain server-authoritative. Admin catalogue writes are backend operations and storefront subscriptions are designed to receive them without redeployment.

**Proof boundary:** source wiring, component tests and emulator commerce behavior exist. A real remote 50-product storefront, live admin edit propagation, and full authenticated browser checkout have **not** been verified. No such claim is made here.

## 6. Collections and access model

| Collection/path | Principal fields/purpose |
|---|---|
| `products/{id}` | Stable ID/SKU, slug, title/descriptions, category/categoryId, price/oldPrice, NGN, stock, active/featured, image/images/provenance, specs, seed reviews/provenance, version/search tokens and timestamps |
| `productKeys/{key}` | Server uniqueness reservations associating SKU/slug keys with product IDs |
| `categories/{id}` | Deterministic canonical name, description, image, featured and timestamps; no All Merchandise category |
| `deliveryZones/{id}` | State, zones, fee, established ETA, active and timestamps |
| `storeSettings/contact` | Validated contact email, phone, WhatsApp and update timestamp; no payment secrets |
| `profiles/{uid}` and `/addresses/{id}` | Owner-scoped allowlisted profile/address information |
| `staff/{uid}` | Active flag and admin/inventory/orders role; no client role assignment |
| `orders/{id}` and `/events/{id}` | Owner, item snapshots, server totals, delivery/contact, payment/fulfilment states, provenance, reservation/lifecycle and history |
| `paymentAttempts/{reference}` | Server-owned order/reference, amount in kobo, NGN, verification state and timestamps; admin views use an allowlist |
| `inventoryEvents/{id}` | Product, delta, adjustment reason, actor and timestamp |
| `auditLogs/{id}` | Administrative action, actor/resource/reason and timestamp |
| `requestLimits/{uid}`, `operationLimits/{uid}` | Trusted transactional abuse counters |

Privileged callables require authenticated, verified, nonanonymous staff and an active server-read role record. Inventory staff cannot read payment administration. Orders staff have order/customer access, not unrestricted payment or settings access. Authoritative client writes remain denied. Storage uploads remain restricted by staff role, image type and size. App Check is required outside emulator mode. Admin views do not expose provider secrets or raw sensitive provider payloads.

Revenue is summed only from non-test server-checkout orders with verified paid status or explicitly recorded POD collection. Unpaid, test and unknown-provenance records are excluded. The selected period uses order creation date; this is not a complete accounting ledger.

## 7. SEO and branding

Framework-supported route heads provide titles/descriptions, canonical URLs, Open Graph, Twitter cards and robots directives. The configured canonical origin is `https://www.zenvexacommerce.com`, overridable through `VITE_PUBLIC_SITE_URL`; domain/DNS/hosting ownership and remote publication were not established by local checks.

Organization and WebSite JSON-LD are included; product routes emit Product/Offer data without fabricated customer aggregate ratings. JSON-LD escapes HTML delimiters. Admin/private metadata is noindex. Robots excludes internal/admin/payment-callback patterns. Sitemap uses active Firestore product IDs and returns 503 on catalogue enumeration failure rather than publishing fictional product URLs. Metadata uses absolute public social URLs, never filesystem paths.

These are local implementation and HTTP/unit checks, not proof that social crawlers or Google have fetched the deployed application, nor a guarantee of rich results.

## 8. Verification results

Commands use pinned Bun 1.3.11 via `npm.cmd exec --yes --package=bun@1.3.11 -- bun` when Bun is not on PATH. PowerShell `.ps1` policy was not weakened.

| Check | Actual result |
|---|---|
| Frontend Vitest | 19 passed, two opt-in tests skipped |
| Backend core Node tests | Eight passed |
| Firestore/Storage emulator suite | 11 passed; script and emulator command exited 0 |
| TypeScript `tsc --noEmit` | Passed after correcting a migration-test source type |
| Production build | Passed; existing chunk-size, tsconfig-path and Nitro warnings remain |
| Focused lint on phase-two backend/admin/SEO files | Passed |
| Local HTTP SSR/asset checks | Storefront metadata/JSON-LD and admin noindex passed; logo, favicon, social image, EcoFlow asset, missing-image SVG and robots returned 200 |
| Remote migration dry-run | Blocked by missing Application Default Credentials; no writes |
| Full repository lint | Earlier baseline has extensive formatting/CRLF violations; no claim of repository-wide lint passing |
| Functions HTTP/Auth suite | Previous phase recorded a pass; not rerun in this final phase-two check |
| Complete browser/admin/remote E2E | Not completed |

Emulator coverage includes customer isolation, direct-write denial, forged staff claims, safe Storage authorization, concurrent idempotency/no oversell, stock reasons and stale edits, POD/fulfilment separation, synthetic payment replay/refunds, admin pagination/permissions/payment redaction, revenue provenance and delivery settings reaching checkout. The CLI emits a known rules-runtime NullPointerException during shutdown even on the final exit-0 run. A leftover Firestore process from an earlier run was identified by project/rules command line before stopping it. No production process was targeted.

## 9. Files and handoff

Principal phase-two additions: `functions/catalogue.ts`, `functions/src/admin-service.js`, `src/components/zenvexa/admin-workspace.tsx`, `product-image.tsx`, `src/lib/seo.ts`, `public-catalogue.ts`, `public-catalogue.server.ts`, product/sitemap routes, catalogue migration/SEO tests, image/brand scripts and audit/manifest assets. Existing Functions services, rules/indexes, Firebase adapter, storefront/store context/checkout/admin, routes, public robots, package/lock files and project guidance are part of the accumulated working tree. `src/routeTree.gen.ts` is build-generated. The previous report describes the original foundation; this report supplements it rather than replacing its historical results.

The root source JPEGs are retained. Ignored credential files were not read or modified during this continuation; `functions/.secret.local`, dependency/build output and migration backup files are excluded from Git. No files were staged.

### Recommended next steps

1. Configure authorized ADC locally and rerun the read-only remote plan with adequate timeout. Review counts, backup, conflicts and field changes before approving/applying its hash.
2. Review deployment packaging, target service configuration, billing/IAM and App Check prerequisites before minimum necessary deployment. Keep Paystack disabled.
3. Seed and read back the 50 stable product IDs and five categories; verify existing legitimate edits remain preserved.
4. Provision an explicitly authorized verified staff test identity through trusted administration, then perform browser acceptance for each implemented admin section and storefront propagation/checkout.
5. Obtain approved exact images for 49 unresolved products and approve EcoFlow rights/variant plus social-image claims.
6. Complete deferred staff-role management, richer search/reporting and payment reconciliation/reservation recovery before a production release decision.

## 10. Remote resume evidence — 2026-10-24

### Authentication and target

- Google Cloud CLI 590.0.1 verified. Its global CLI account/project configuration is unset; no global defaults were changed.
- ADC token acquisition and the ADC identity `akinbaniayomidecollins@gmail.com` were verified without displaying credentials. Firebase CLI reports the same identity.
- The explicit target is `zenvexa-c8d84`, with no emulator environment configured for remote checks. The real default database is Firestore Native in `nam5`.
- Actual Admin SDK reads succeeded. A read-only IAM permission test returned `datastore.entities.get`, `list`, `create`, `update`, `datastore.databases.get`, and `serviceusage.services.use` as granted. Create/update permissions have not been exercised by a production write.
- The App Check inspection initially failed because ADC lacked a quota project. After verifying `serviceusage.services.use`, the authorized quota project `zenvexa-c8d84` was added to ADC. No IAM policy, billing-plan, API-enable or deployment changes were performed.

### Current remote data and approved additive plan

The actual remote read at `2026-10-24T19:20:10.831Z` returned:

| Collection | Before | Latest verified count | Planned changes |
|---|---:|---:|---|
| `products` | 0 | 0 | Create 50 stable-ID products |
| `categories` | 0 | 0 | Create five canonical categories |
| `deliveryZones` | 0 | 0 | Create six existing delivery configurations |
| `storeSettings` | 0 | 0 | None |

Database collection metadata also lists an unrelated uppercase `Users` collection. An aggregate-only read confirmed one document; its contents were not inspected. It is outside the migration and will remain untouched. The database must not be described as entirely empty merely because its catalogue collections are empty.

The fresh existing migration dry-run passed all four selected tests and proposed 61 creates, zero repairs, zero preserved target records, and no conflicts. No orders, profiles, payments, staff records or settings are included. Product fields include original IDs/SKUs, descriptions, specifications, category references, NGN prices, stock, active state, gallery and review/image provenance. Source photograph status remains one reviewed manufacturer reference and 49 unresolved products using the branded placeholder.

Approved plan hash:

```text
20246cb72934a62e5682205b95801fa735907d333820a66814743a8582c77d55
```

The user explicitly approved this exact plan, conditional on artifact review and transaction-time revalidation. Approval does not authorize a changed hash, overwrites, deployments or production order creation.

Generated backup: `C:\dev\Zenvexa\catalogue-migration\backup-2026-10-24T18-27-47-531Z.json`.

This is an application-level JSON export of the three affected collections, not a managed Firestore backup, and excludes unrelated `Users` data. Its existence was observed, but its contents have **not** been reviewed: the IDE reader denies both it and `catalogue-migration/plan.json` because they are ignored. A directory read-scope grant and the user's access confirmation did not remove that guard. The user subsequently confirmed review copies, but attempts to open `catalogue-plan-review.json` and `catalogue-backup-review.json` in the repository root reported that neither file exists. No shell-based bypass was used.

**Historical blocker, now superseded by section 11:** migration was unapplied at that point because neither the original artifacts nor the promised root review copies were readable/present. The next continuation regenerated review artifacts outside ignored paths using the same migration code, then applied the unchanged approved plan.

### Deployed security and browser evidence

- The deployed Firestore ruleset is `89b4e0ea-c4ef-4fc3-a57d-885157647255`; its only document rule denies all reads and writes. This differs from the repository's active-catalogue/owner/staff rule set.
- Deployed Storage ruleset `81fcd87c-1596-41a9-98ee-e8d76093c4ea` also denies all reads and writes. The configured bucket exists in `US-EAST1`.
- The deployed composite-index list is empty. Firebase CLI reports no deployed Functions.
- With the correct quota project supplied, App Check inspection returns HTTP 403 because `firebaseappcheck.googleapis.com` has not been used in this project or is disabled. Provider registration and enforcement configuration could not be verified. The API was not enabled automatically.
- A public active-product REST query returned HTTP 403. Admin SDK access does not imply public client access.
- A real Edge browser check used explicit Firebase mode with emulators disabled. It observed two remote Firestore requests targeting `zenvexa-c8d84`, zero product cards, and the delivery/backend unavailable message. Local mock products were not displayed.
- The unauthenticated admin view displayed its staff-access gate; no staff mutations were attempted. `/products/eco` returned HTTP 500 while the public Firestore loader was denied. This is a blocked product-detail check, not successful product loading.
- All-category browsing, successful product details, authoritative remote cart reconciliation and staff catalogue views remain blocked/unverified. No production order, reservation, payment or notification was created.

Minimum deployment proposal, requiring separate approval: publish the reviewed repository Firestore rules to permit active-product/category/delivery reads while retaining privileged-write denial. Storage rules are needed only for the later authorized upload workflow. Reviewed Functions deployment, reproducible packaging, billing/API prerequisites, App Check registration and trusted staff provisioning are separate gates before checkout/admin operations. Do not deploy any of these automatically.

### Fresh validation

| Check | Result |
|---|---|
| Frontend suite | 43 passed; two opt-in tests skipped |
| Backend core/Functions-service unit tests | Eight passed |
| Firestore/Storage emulator suite | 11 passed; command exited 0, with the known shutdown-time rules-runtime warning |
| Remote read-only migration dry-run | Four tests passed; 61 proposed creates; no writes |
| TypeScript | Passed |
| Focused migration lint | Passed |
| Functions entry-point syntax check | Passed |
| Production build | Passed, with existing chunk/plugin/Nitro warnings |
| Real-project browser check | Denied-read/error/no-mock-fallback behavior and unauthenticated admin gate verified; successful remote catalogue browsing not verified |
| Functions HTTP/Auth emulator transport suite | Not rerun in this resume |

Local verification services were stopped. No application source, rules or indexes were changed in that resume; this report supplements the earlier results. No commit, push or deployment occurred.

## 11. Remote catalogue migration execution — 2026-10-25

### Authentication and artifact review

Google Cloud SDK 590.0.1 was invoked from its installed user path because this shell had not inherited its updated PATH. ADC token acquisition succeeded without displaying a token. The Firebase CLI target and migration guard both remained `zenvexa-c8d84`; no emulator environment was configured. The shell's global `gcloud auth` account and configured project remained unset, so no global defaults were substituted for the explicit project.

To unblock review without bypassing the IDE file guard, `functions/catalogue.ts` now honors `ZENVEXA_MIGRATION_ARTIFACT_DIR`; the fresh dry-run wrote review copies to unignored `migration-review/`. The hash calculation, explicit project guard, emulator refusal, persisted-plan check and transaction-time remote recheck were unchanged.

Reviewed artifacts:

- `migration-review/plan.json` — hash `20246cb72934a62e5682205b95801fa735907d333820a66814743a8582c77d55`, exactly matching the approved plan; 61 creates, zero repairs, zero preserves and `issues: []`.
- `migration-review/backup-2026-10-25T17-36-27-667Z.json` — readable application-level JSON export for `products`, `categories` and `deliveryZones`; `records: []`, proving there were no affected records to preserve. This is not a managed Firestore backup and does not include unrelated collections.

### Apply and remote read-back

The approved apply ran with `ZENVEXA_CATALOGUE_MODE=apply`, `ZENVEXA_REMOTE_SEED_PROJECT=zenvexa-c8d84` and the exact approved hash. Before writing, the migration re-read the three live collections and recalculated the same hash inside the transaction. It completed only because the live state still matched the reviewed dry-run. The command's post-write check reported `verifiedProductCount: 50`, `verifiedSeedProductIds: 50` and `changedDocuments: 61`.

An independent Admin SDK read then compared every remote document against every planned field and checked required timestamps and catalogue invariants. `migration-review/verification.json` records the machine-readable result. At `2026-10-25T17:38:07.061Z`, actual remote aggregate counts were:

| Collection | Count after migration | Evidence |
|---|---:|---|
| `products` | 50 | All planned IDs/SKUs/fields matched |
| `categories` | 5 | All canonical names present |
| `deliveryZones` | 6 | All active with valid state/fee/zone fields |
| `storeSettings` | 0 | No settings imported |
| `orders` | 0 | No orders created |
| `profiles` | 0 | No customer profiles created |
| `staff` | 0 | No staff records created |
| `paymentAttempts` | 0 | No payments created |
| `Users` | 1 | Unrelated pre-existing count preserved; contents not read |

Integrity checks found **50 unique product IDs, 50 unique SKUs, five canonical categories and six active delivery zones**. Every product has a positive safe-integer NGN price, nonnegative safe-integer stock, `active: true`, a valid existing `categoryId`, a non-empty image reference and an explicit `imageStatus` of `verified` or `missing`. All 61 planned field values matched; failures: none. One EcoFlow image remains the only reviewed product asset; the other 49 records retain the branded placeholder while their original references remain available in `originalImage`.

### Remaining deployment blocker

Remote catalogue data now exists, but the deployed client-facing Firestore and Storage rulesets still deny all reads/writes, and no Functions are deployed. Public browsing therefore remains blocked until a separate, explicit rules deployment is approved.

Minimum deployment for catalogue visibility: deploy **Firestore rules only** from the reviewed repository ruleset using `firebase deploy --only firestore:rules`. That file permits public reads only for active `products`, `categories` and `deliveryZones`; it also contains the already reviewed owner/staff read model for future sign-in/order/admin use while retaining the catch-all client-write denial. No Functions, Storage rules, indexes, App Check or IAM changes are required merely to test public catalogue reads. Checkout/admin callables still require separate Functions deployment and packaging review; image upload requires Storage rules; App Check requires API/provider/enforcement setup; and staff access requires trusted verified-account provisioning. Composite indexes are required later for the defined product search/order queries but are not a prerequisite for basic active-catalogue browsing.

Payments remain disabled, no deployment occurred, and no commit/push/merge was made at that point.

## 12. Storefront restoration and approved Firestore rules deployment — 2026-10-25

### Root causes

- **Catalogue:** the data existed remotely, but the deployed client-facing Firestore rules still denied every read. A direct public Firestore REST query returned HTTP 403/`PERMISSION_DENIED`. The browser adapter was correctly querying `products` with `active == true`, `categories`, and `deliveryZones`; this was a deployed authorization failure, not a collection-path or document-shape failure.
- **Hero/banner:** `src/assets/commerce-hero.jpg` existed and loaded with HTTP 200, but `Shop` early-returned whenever Firebase mode had an empty catalogue. That prevented the entire hero markup from rendering. The banner failure was a rendering-order defect triggered by the catalogue outage, not a missing image asset.

### Storefront fixes

- `firebase-commerce.tsx` now reports safe Firestore error codes for catalogue/category, delivery and order failures separately enough to distinguish the permission boundary without exposing credentials.
- The adapter now subscribes to remote `categories` and preserves the canonical category order instead of relying only on the local constant.
- `store-context.tsx` exposes the remote category list, delivery errors and catalogue errors.
- `storefront.tsx` renders the hero independently of catalogue state and only renders the deal card when a real loaded product exists. The previous `products[0]` fallback could not be reached while Firebase mode was empty, but removing it eliminates the hidden mock-product path.
- Loading, permission-denied, genuinely empty catalogue and filtered-empty states now have separate messages.
- Regression coverage verifies the hero remains visible during a denied remote read while no mock deal card or mock product appears.

### Approved deployment and public read verification

The user explicitly approved **Firestore rules only**. `firebase deploy --only firestore:rules --project zenvexa-c8d84` compiled and released `firestore.rules`; no Functions, Storage rules, indexes, App Check, IAM, billing or payment configuration changed. A subsequent unauthenticated public Firestore REST active-product query returned HTTP 200 with product IDs, replacing the prior 403.

### Real-browser verification

An Edge browser check against `http://127.0.0.1:8080`, Firebase mode and remote `zenvexa-c8d84` verified:

| Flow | Result |
|---|---|
| Hero/banner | Visible; `commerce-hero.jpg` loaded |
| Deal card | Visible and backed by the remote featured EcoFlow product |
| Catalogue | **50 product cards** rendered; UI reports “50 active products confirmed by Firestore” |
| Categories | All Merchandise plus the five Firestore-backed canonical categories rendered |
| Search | `EcoFlow` returned one product |
| Category filters | Each of the five canonical categories returned 10 products |
| Product detail | `/products/eco` loaded title, SKU `ZVX-ECO-001`, price/stock and `/catalog/eco.webp` |
| Missing-image detail | `/products/sam` loaded the correct product and `/catalog/missing.svg` with the missing-photography notice |
| Cart | Add, persisted refresh count and bag subtotal/delivery/grand total verified |
| Checkout totals | Two EcoFlow units: ₦1,970,000 merchandise; `HUG10` discount ₦197,000; Lagos fee ₦1,500; total ₦1,774,500 |
| Delivery states | Six remote states/options rendered |
| Admin gate | Unauthenticated `/admin` shows the restored branded staff sign-in card; no browser role bypass |
| Console | No errors/warnings in the successful browser pass |

A transient rules-propagation/offline delay appeared during an earlier browser attempt after deployment, then resolved. The successful pass was used for the reported results.

### Checkout/admin boundary

The displayed order button was not submitted. Order creation still requires a signed-in or guest session and `createOrder`; protected callable calls intentionally fail before network access until App Check is configured, and no Functions are deployed. A post-check Admin SDK aggregate query still returned zero `orders`, `paymentAttempts`, `inventoryEvents`, `auditLogs`, `staff` and `profiles`; unrelated `Users` remains one unread document. Staff catalogue/admin verification still requires deployed Functions plus a trusted, verified staff identity.

### Validation after restoration

| Check | Result |
|---|---|
| Full frontend suite | 44 passed; two opt-in tests skipped |
| Backend core tests | Eight passed |
| Firestore/Storage emulator suite | 11 passed; known shutdown-time rules-runtime NPE warning remains |
| TypeScript | Passed |
| Focused lint | Passed with pre-existing fast-refresh warnings only |
| Production build | Passed with existing chunk/plugin/Nitro warnings |
| Remote public REST query | HTTP 200 after approved rules deployment |
| Real Firebase browser storefront | Passed for public catalogue/detail/cart/checkout calculations |

Remaining approval-gated work: Functions deployment for secure order/admin operations, App Check setup/enforcement, Storage rules for uploads, Firestore composite indexes for defined search/order queries, trusted staff provisioning, and live-domain/deployment review. Live payments remain disabled.

## Phase 3 — secure orders, staff login and deployment preparation

### Admin sign-in restoration

The previous UI was a centered branded access card. Firebase mode had replaced it with the generic account panel and a plain staff-access message. `AdminGate` now uses the original card in Firebase mode with email/password fields, a show/hide control, busy state, validation and safe Firebase Auth error mapping. A successful login still does not grant access; the existing verified, nonanonymous account plus active `staff/{uid}` role check remains authoritative. Signed-in nonstaff users see a staff-role denial and can sign out.

The hook also distinguishes Firebase Auth restoration and staff-record loading so a legitimate session is not mistaken for unauthenticated access during refresh/direct navigation.

Browser verification against `/admin` confirmed:

- the restored `.admin-denied-card` is rendered;
- email and password inputs and the password toggle are present;
- an invalid credential attempt displays “Incorrect email or password.”;
- no demo login button or mock-auth fallback exists;
- no browser console errors occurred.

Automated regression coverage checks the restored fields, safe invalid-credential handling and denial of an authenticated nonstaff account.

### Initial admin provisioning

A trusted Admin SDK script was added at `scripts/provision-initial-admin.mjs`. It:

- pins the project to `zenvexa-c8d84`;
- checks Firebase Authentication before creating a user;
- refuses to change an existing account unless `ZENVEXA_ALLOW_EXISTING_ADMIN=true` is explicitly supplied;
- reads the initial password only from `ZENVEXA_INITIAL_ADMIN_PASSWORD`, never a CLI argument or source file;
- marks only a newly created development account verified;
- creates `staff/{uid}` with `{ role: "admin", active: true }` only when no staff record exists;
- preserves and reports existing staff records;
- removes the just-created Auth user if staff-document creation fails.

At audit time `test@admin.com` returned `auth/user-not-found`; no Auth user or staff record was created because the password must not be placed in a command transcript, source file, test, log or commit. The account can be provisioned by running the script locally after setting the password in a secure shell prompt/environment variable. No client-side role grant or hardcoded email bypass exists.

### Functions packaging and dry-run

The first Functions dry-run found two packaging blockers:

1. `PAYSTACK_SECRET_KEY` was declared even though payments are disabled, requiring Secret Manager unnecessarily.
2. Payment/environment parameters were requested during noninteractive deployment even though the disabled payment path never uses them.

`functions/src/index.js` now declares the Paystack secret and payment parameters only when `PAYSTACK_MODE=test` is present at packaging/runtime. In the default disabled build, payment endpoints remain exported but fail closed with `failed-precondition` before requesting credentials or contacting Paystack. This keeps the payment-disabled deployment free of secret-manager requirements.

The final dry-run succeeded for the `zenvexa` Functions codebase on Node.js 22 in `europe-west1`. Scope is 11 callable functions (`createOrder`, six admin/configuration functions, two inventory/order staff functions, and two payment functions that fail closed while disabled) plus the `paystackWebhook` HTTPS function. All callables share the 60-second/five-instance limits and App Check enforcement outside emulators.

During dry-run API checks, the Firebase CLI enabled Cloud Build, Artifact Registry, Firebase Extensions, Cloud Run, Eventarc and Pub/Sub and generated service identities. No Functions revision was deployed. Secret Manager and App Check remain disabled. Billing status could not be verified because the authorized identity received `PERMISSION_DENIED` from the Cloud Billing API; the project owner should confirm Blaze/pay-as-you-go billing before approving deployment.

### Functions verification

The combined emulator suite was run after the packaging change:

- 12 tests passed.
- Covered unauthenticated callable denial, malformed checkout rejection, idempotent order creation, concurrent stock reservation/oversell prevention, stale admin inventory updates, staff section permissions, POD collection controls, payment disabled behavior and webhook disabled response.
- The known shutdown-time Java rules-runtime `NullPointerException` still appears after successful test completion.

### App Check plan

Protected callables already require App Check outside emulators, and the browser refuses to send protected calls without `VITE_FIREBASE_APP_CHECK_SITE_KEY`. Before deployment, register the web app for App Check using **reCAPTCHA Enterprise** and configure the site key for local `localhost`/`127.0.0.1` plus the intended deployed domains. Set that public site key in local/deployment environment configuration as `VITE_FIREBASE_APP_CHECK_SITE_KEY`; do not commit a secret-bearing `.env` file. Enable Firestore/Storage App Check enforcement only after observing valid callable traffic; immediate broad enforcement could lock out legitimate clients.

### Exact remaining approvals/actions

1. Confirm Blaze/pay-as-you-go billing and review the API/service-identity changes already triggered by the dry-run.
2. Approve `firebase deploy --only functions --project zenvexa-c8d84` for the exact 11 callable + one HTTPS scope above. No Paystack secret or live payment configuration is included.
3. Complete App Check API/provider registration, configure the reCAPTCHA Enterprise site key, then approve a browser/App Check verification pass.
4. Provision `test@admin.com` through the reviewed script using a secure local environment prompt; verify its UID-linked `staff/{uid}` record by Admin SDK.
5. Approve `firebase deploy --only firestore:indexes --project zenvexa-c8d84` if server order/search queries need the defined indexes.
6. Storage rules, App Check enforcement for Firestore/Storage, hosting/domain deployment and payment test mode remain separate approvals.

No production order, staff record, customer record, payment attempt or IAM policy change was made in this phase. Paystack remains disabled.

### Functions deployment attempt

The user approved the exact Functions-only deployment. `firebase deploy --only functions --project zenvexa-c8d84` packaged 28 KB successfully but did **not** create a Functions revision. Google Cloud rejected the upload because the project has no App Engine application and the Cloud Functions service identity is unavailable:

```text
Could not authenticate 'service-606880758097@gcf-admin-robot.iam.gserviceaccount.com':
Not found; Gaia id not found
```

A read-only App Engine API check returned `404 NOT_FOUND` for `apps/zenvexa-c8d84`; `firebase functions:list` confirms no deployed Functions. Required user action: create the App Engine application for `zenvexa-c8d84`, choosing `europe-west1` to match the Functions region. App Engine region cannot be changed later. After it exists and service identities propagate, rerun the same approved Functions-only deployment.

### Commit and push

Commit `d9f5fac` (`feat: add secure Firebase storefront and admin foundation`) contains the Firebase storefront, restored staff login, backend Functions source/tests, rules/index configuration, reviewed provisioning script and reports. It was pushed successfully to `origin/feat/firebase-backend`. Generated migration-review/catalogue-audit artifacts remain untracked; ignored `.env`/secret files were not staged or committed.
