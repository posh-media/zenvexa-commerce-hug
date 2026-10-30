Implementation reference: [`def5198`](https://github.com/posh-media/zenvexa-commerce-hug/commit/def519860dd55cbe1859297243e354838932faf7).

# Store-specific configuration and operations

This replaces the earlier all-settings-shared contract. Products, inventory and Firebase Auth remain shared. Store identity is permanent; a display name is not a tenant key.

## Identity and schema

| Item                             | ShopBeta                                               | Zenvexa                                               |
| -------------------------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| Stable `storeId`                 | `shopbeta`                                             | `zenvexa`                                             |
| Target public settings           | `settings/ShopBeta`                                    | `settings/Zenvexa`                                    |
| Required configured display name | `storeInformation.name`                                | `storeInformation.name`                               |
| Current provider credentials     | `privatePaymentSettings/shopbeta/providers/{provider}` | `privatePaymentSettings/zenvexa/providers/{provider}` |
| Private integration URLs         | `privateStoreSettings/shopbeta`                        | `privateStoreSettings/zenvexa`                        |

Names are trimmed and must contain a usable letter or digit. Public settings store `storeId`; there is no competing root settings `storeName`. On **orders**, `storeName` is the historical snapshot of `storeInformation.name`. Changing a store name affects future orders only. Document IDs, existing order numbers, gateway references and ownership are never renamed.

New orders are created by `POST /api/orders`, with a verified Firebase ID token. The server supplies store identity and authenticated UID, reads shared catalog prices, validates store coupons, tax and delivery charges, and creates a pending order without decrementing inventory. Anonymous guests obtain a Firebase anonymous identity; enable Anonymous sign-in in the shared Auth project before rolling out this checkout. Anonymous accounts remain guests in the UI. New attributable orders cannot be forged by direct client Firestore writes.

Order numbers use a name-derived prefix and a timestamp plus UUID suffix. Examples: `Shop Beta` → `SB`, `ShopBeta` → `SB`, `Zenvexa` → `ZEN`, `APIStore` → `AS`, `X` → `X`. Punctuation separates words; numeric initials are allowed; Unicode letters are supported. Prefixes never determine identity or permissions.

## Environment variables

Set both identity variables consistently, and redeploy after changing public variables.

| Variable                                       | Zenvexa                           | ShopBeta                         |
| ---------------------------------------------- | --------------------------------- | -------------------------------- |
| `STORE_ID`                                     | `zenvexa`                         | `shopbeta`                       |
| `NEXT_PUBLIC_STORE_ID`                         | `zenvexa`                         | `shopbeta`                       |
| `NEXT_PUBLIC_SHOPBETA_SETTINGS_CUTOVER`        | `false` during transition         | `false` during transition        |
| `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` | `https://www.zenvexacommerce.com` | actual canonical ShopBeta origin |
| `ZENVEXA_APP_URL`                              | `https://www.zenvexacommerce.com` | same                             |
| `SHOPBETA_APP_URL`                             | actual canonical ShopBeta origin  | same                             |

The identity defaults to Zenvexa in this repository; unknown IDs and disagreement fail closed. The companion ShopBeta deployment **must explicitly set both variables**. The ShopBeta cutover flag must be consistent in both deployments because shared webhook handlers may process either store. Callback URLs must match the trusted store origin; a checkout-provided external URL is rejected.

The Firebase project, Auth project, Admin SDK identity and shared catalog configuration remain those of ShopBeta. Existing provider environment names remain supported, but only within their receiving deployment's own store context. They are not fallback credentials for another store's webhook. `NEXT_PUBLIC_*` web configuration is public; service-account JSON and payment keys remain server-only. No values are committed in this change.

Cloud Functions additionally accept `SHOPBETA_WEBHOOK_ORIGIN` and `ZENVEXA_WEBHOOK_ORIGIN`. They must be explicit trusted HTTPS origins. Defaults are `https://www.shopbetaa.store` and `https://www.zenvexacommerce.com`; verify the actual ShopBeta domain before deployment. The bridge never reads its destination from an event or customer-supplied metadata.

## Transitional authority and credential precedence

Until `NEXT_PUBLIC_SHOPBETA_SETTINGS_CUTOVER=true`:

- ShopBeta reads/writes **`settings/app`**, not the initially seeded ShopBeta copy.
- ShopBeta current credential reads/writes use legacy **`privatePaymentSettings/{provider}`** when present. This keeps old and adapted ShopBeta clients on one authority while both versions coexist.
- Zenvexa reads/writes only its named document and private scoped paths. It never falls back to `settings/app` or a legacy ShopBeta provider document.
- Initially seeded ShopBeta target documents are snapshots, not a second editable authority. Normal migration reruns never overwrite them.

After coordinated final refresh and cutover, ShopBeta reads/writes its named/scoped documents. The old `app` document and legacy private credentials are retained for older attempts and readers; they are not automatically deleted. Versioned pending attempts always use their recorded version, independently of the cutover flag.

Secret precedence for a new attempt is the active store's current credential document, then that deployment's own environment fallback. Before cutover, ShopBeta's legacy credential source takes precedence over its seed copy. After cutover there is no automatic legacy-key fallback for new ShopBeta attempts. An old, unversioned ShopBeta payment is explicitly marked as a legacy attempt for reconciliation and can still use its legacy keys.

Each new attempt records `storeId`, `storeName`, `credentialVersion`, gateway, reference, amount/currency, and the provider's existing sandbox metadata where applicable. Credential snapshots are created under `privatePaymentSettings/{storeId}/providers/{provider}/versions/{uuid}` using Admin SDK only. They contain private credential values; clients receive only the version identifier. Blank admin fields preserve saved credentials. Snapshots remain available after normal key rotation, but cannot make a remotely revoked provider key usable again.

Private integration documents hold `makeWebhookUrl` and `transactionalEmailWebhookUrl`. Store public readers strip legacy secret fields and URLs; new settings saves put URLs in private documents and delete sensitive fields from the public document. Legacy `settings/app` data may still contain historical secrets/URLs until an operator explicitly cleans it after the companion app is adapted. This PR does not claim to have inspected or sanitized the live database. Never add new secrets to public settings, and do not leave legacy public credentials unresolved at launch.

## Requests, webhooks and inventory

Customer/admin payment requests resolve the persisted order/payment, verify store membership against the deployment, and check a verified owner or existing staff permission. Staff-only email actions require `orders:write`. The Make.com resend endpoint now fetches the authoritative persisted paid order rather than trusting a supplied invoice object.

A shared webhook uses its reference to look up a persisted payment and order. Unverified event metadata never selects a store, account or forwarding destination. The selected private account version validates the raw provider signature and the provider verification response before existing transactional finalization. Paystack/KoraPay signature helpers correctly await secrets. Squad/Monnify/Bachs retain recorded sandbox handling. Bachs additionally validates authoritative amount, currency, checkout ID and customer email when supplied.

New Next.js webhook paths cover Paystack, KoraPay, Squad, Monnify and Bachs under `/api/payments/{provider}/webhook`. Flutterwave remains prepared but not a complete checkout integration; leave it disabled unless independently completed and tested.

The shared Firebase functions include a compatibility bridge: new Zenvexa and versioned ShopBeta attempts are forwarded byte-for-byte, with original signature headers, to the persisted store's trusted Next.js deployment. Legacy unversioned ShopBeta events retain the original handlers. Legacy function initializers refuse non-ShopBeta orders, and legacy finalizers reject foreign orders. Do not deploy only one function file without the shared bridge and its dependencies.

Finalization checks store identity inside the transaction. Shared inventory is reduced once, including multiple lines/variants of the same product; COD completes reads before writes. Failure events cannot overwrite successful/newer attempts. Do not delete recorded credential versions while attempts may still reconcile.

For old unauthenticated ShopBeta guest attempts, reference verification remains possible without granting general new-order initialization access. Public tracking returns a store-filtered status whitelist rather than full customer/address records. Historical guest Firestore read compatibility and global staff roles remain during the rolling deployment. This is logical storefront separation, **not a new per-store staff membership system**: existing globally authorized staff still have their existing shared Firebase permissions. Dedicated staff tenancy would require a separate membership/claims policy.

## Scope matrix

| Data                                                                         | Scope                                                                                  |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Products, categories, brands, stock, product media/reviews                   | Shared catalog                                                                         |
| Firebase Auth, user profiles, roles/status, addresses                        | Shared account identity                                                                |
| Carts and wishlists                                                          | Existing behavior preserved                                                            |
| Orders, payment attempts, order history/tracking, receipts and notifications | Origin store                                                                           |
| Revenue/refunds/order counts and best sellers                                | Derived from store-filtered orders                                                     |
| Customer spend/recency                                                       | Activity in this store; account role/status changes remain global                      |
| Ads/expenses, coupons, banners, audit records                                | New records attributed; unlabelled legacy records treated as ShopBeta                  |
| Visits                                                                       | `pageVisitTotals/{storeId}__{encodedPath}` and `pageVisitDays/{storeId}__{YYYY-MM-DD}` |

Products/stock/most-viewed product metrics are labeled shared where shown. Notification broadcasts target customers with attributable orders in the active store. Legacy mixed analytics cannot be accurately split after the fact; legacy unlabelled counters are assigned to ShopBeta by policy, not represented as a recovered historical split.

`storeDocuments` pushes Zenvexa's `storeId` predicate into Firestore. ShopBeta deliberately scans matching legacy records, filters attribution **before** pagination/counting, and uses the same filtered set for totals and page cursors. Missing fields are not included by a normal Firestore equality query. This compatibility scan can become expensive; retire it only after old writers stop and a separately reviewed full attribution backfill covers remaining records. The requested cutoff migration alone does not tag newer old-writer orders.

## Migration and private backup

Requires trusted Admin SDK credentials supplied privately. These commands do not read a committed `.env` automatically. Confirm `--project` matches the actual shared Firebase project. Never use production credentials for emulator tests.

```sh
npm run migrate:stores -- --project PROJECT_ID --file store-migration-private/plan.json
# Privately inspect counts, issues, source/target diffs and backup completeness.
npm run migrate:stores -- --project PROJECT_ID --file store-migration-private/plan.json --apply
```

Default mode performs no writes. The JSON file contains a checksummed plan **and sensitive original snapshots**, including configuration secrets and customer/order data. It is created with mode 0600, parent directories 0700, refuses file overwrite, and is Git-ignored. Copy it to durable private operator-controlled storage and verify it before applying. Console output contains counts and the backup path, not credentials or customer contents.

Orders are read in document-ID pages of 250. Blank/null/missing attribution before **2026-10-28T00:00:00Z**, exclusive UTC, receives `storeId=shopbeta`, `storeName=ShopBeta`. Explicit stable attribution is preserved. Recognizable name-only legacy records gain their permanent ID without changing their known origin. Unknown/conflicting name-only values and missing/invalid dates are listed in private `issues` and left unchanged. Unlabelled newer orders are not backfilled but still resolve to ShopBeta at read time. Do not guess origin from an SB prefix: older Zenvexa tests may also have used SB. Resolve known ambiguous historical records from actual provenance before applying the plan.

The migration seeds sanitized ShopBeta public settings, a minimal disabled-payments Zenvexa configuration, and ShopBeta private credentials/integration URLs. **It does not copy ShopBeta credentials/contact/tax settings into Zenvexa**, overwrite existing store-specific documents on normal reruns, or move products/users/orders into new collections. Existing product-migration scripts remain untouched.

Application uses per-document Firestore transactions with snapshot update-time checks. Config copies also check their source snapshots. Concurrent changes become conflicts, not overwrites. Each successful mutation atomically writes an Admin-only receipt under `storeMigrationReceipts/{planChecksum}/entries/{pathHash}`; reruns skip already applied values. Exit code 2 reports conflicts/failures for operator resolution.

Rollback uses the same private plan and only receipts actually written by that plan:

```sh
npm run migrate:stores -- --project PROJECT_ID --file store-migration-private/plan.json --rollback
```

Order rollback restores only attribution fields and preserves subsequent payment/lifecycle updates. Created configuration documents are deleted only when their contents are unchanged; replacements are restored only when still equal to their applied contents. Independent/reassigned records conflict instead of being overwritten. Roll back configuration with relevant writers paused. Do not blindly roll application code back to unscoped Zenvexa: that would reconnect it to ShopBeta's settings.

## Expand / migrate / cut over

1. Prepare backups and configuration in private storage. Verify the current Zenvexa and ShopBeta code/branches. Keep products/inventory/Auth shared. Enable anonymous Auth and authorize the production/preview domains. Set the identity and origin variables above, keep the cutover flag false, and supply the same shared Firebase project identity in both deployments.
2. Test the release in a preview/emulator. Apply the additive Firestore rules/indexes from this branch only through the coordinated backend release; wait for indexes to finish building. New attributable orders use Admin SDK, while old ShopBeta writes without store fields remain compatible. Do not deploy an unrelated seed, product reset or second backend.
3. Generate/review the live dry-run plan, privately back it up, apply it and reconcile conflicts. Existing named documents are preserved. Keep Zenvexa's new payment toggles disabled until its credentials and shared webhook routing are ready.
4. Release Zenvexa with the new endpoints and explicit identity. Deploy the **shared function bundle** with the trusted webhook origins after the destination routes are reachable. Legacy ShopBeta handlers remain available. Configure Zenvexa's own store name, fees/contact details, private keys/integration URLs and sandbox selection. Then validate enabled providers in sandbox before enabling production checkout.
5. Adapt and deploy ShopBeta using the companion prompt, initially with the cutover flag **false**. Its settings and current credentials continue using the legacy authority during overlap. Preserve Bachs and newer integrations. Validate old pending attempts plus new versioned attempts.
6. Briefly freeze ShopBeta configuration/credential edits (not ordinary order reads/payments). Generate a **new** explicitly requested final-refresh plan:

   ```sh
   npm run migrate:stores -- --project PROJECT_ID --file store-migration-private/cutover.json --refresh-shopbeta
   npm run migrate:stores -- --project PROJECT_ID --file store-migration-private/cutover.json --apply
   ```

   This opt-in mode refreshes existing `settings/ShopBeta` and scoped ShopBeta provider documents from their latest legacy sources, with backups and conditional writes. Review intentional target differences before applying. It does not overwrite existing private integration documents or Zenvexa settings. Reconcile private integration URLs separately if legacy integrations were edited after the initial seed.

7. Set `NEXT_PUBLIC_SHOPBETA_SETTINGS_CUTOVER=true` consistently in **both** deployments and redeploy them; keep configuration edits frozen until both are serving the new flag. Verify effective paths, names, credentials and callbacks, then unfreeze. Retain `settings/app`, legacy provider documents and credential versions while any old reader or pending attempt still needs them. Explicitly clean historical public secret fields after all dependent code has private reads configured; do not delete legacy credentials prematurely.
8. Perform deployed acceptance checks: real catalog reads; independent settings saves; own-store lists/direct lookups/counts; sandbox verification/retries/refunds; cross-store webhook routing; emails and Make payloads; shared stock once; analytics keys. Mock/emulator success does not prove a live gateway account, domain or key is correctly configured.

No live database migration, rules/function deployment, domain update or live charge is performed by opening the implementation PR.

## Checkout/admin/category follow-up

Checkout already initializes Paystack, KoraPay, Squad, Monnify, Bachs and COD commitment fees through server endpoints. This follow-up ports ShopBeta's per-attempt Bachs idempotency keys and initialization-context display-name fallback for legacy orders; retries no longer reuse a previous Bachs checkout's account/session identity. The confirmation page now reloads the authoritative order instead of displaying cached browser payment state, distinguishes pending/paid/failed/refunded/COD balances, and supports manual Bachs/COD verification. Authenticated order-number resolution now runs through GET /api/orders, validates owner/staff and store before returning the document ID, and avoids client queries that Firestore owner rules cannot authorize. The stale checkout description has been replaced; provider visibility remains configuration-driven and no providers are enabled by this release. Flutterwave remains unsupported for checkout and must stay disabled.

Make payment confirmations now atomically claim `orders/{id}.makeNotifyStatus=sending` before dispatch across both Next.js and legacy shared Functions. Existing payload fields, including persisted `storeId` and `storeName`, are retained. Additive `eventId` and the `Idempotency-Key` header contain `{storeId}:{FirestoreOrderId}:payment-confirmed`. Configure the Make scenario to atomically deduplicate this event ID before sending email, and route branding by `storeId` (use `storeName` only for display). This is required to handle an HTTP response lost after Make accepted a request; HTTP alone cannot guarantee exactly-once delivery. A process crash can leave `sending` for manual reconciliation. Check Make's event history before clearing that state or explicitly resending. Private endpoint configuration is not copied across stores.

The admin UI, trusted order APIs and Firestore role helpers deny suspended/deleted/inactive staff. Owners cannot change their own role, UID, status or activation state. Legacy profiles without explicit status/active fields retain existing defaults. Google sign-in only authenticates: a profile created by normal sign-up is a customer, not staff. Existing role-specific permissions remain in force.

`users/{uid}` remains canonical: rules, orders, addresses, carts/wishlists and notifications depend on UIDs. Email is a searchable/display field, not an authorization identity. No user-ID migration is performed. The shared `super_admin` role grants administrative access across both storefronts; there is no store-membership boundary.

Secure provisioning command: `node scripts/setup-zenvexa-super-admin.mjs --project=shop-day84j --credentials=<private-service-account-file>`. It creates only the requested absent account, uses an undisclosed random password, and refuses to elevate an unexpected existing account. Reruns on the matching active super-admin make no writes and do not reset the password. Use `/forgot-password` with `superadmin@zenvexa.com` to receive Firebase's setup/reset email; no reset URL is logged. After signing in, `/profile` provides a password-change form that reauthenticates with the current password or Google popup. Email inbox ownership and delivery must be verified by the operator.

The homepage merchandise browser defaults to category sections using catalog IDs, with unique normalized name/slug fallback. Unknown/ambiguous categories go to Other; product IDs are displayed once, using their primary category. Sections retain the filtered/sorted image-prioritized sequence. The All merchandise toggle restores a unified grid; `/products` retains its existing independent listing and pagination. No catalog documents are rewritten.

Vercel must separately build/deploy this release with matching `STORE_ID`/`NEXT_PUBLIC_STORE_ID`, shared Firebase web/Admin configuration and trusted store URLs. Keep ShopBeta cutover false until coordinated deployment. Sandbox gateway acceptance, email delivery and browser password-change acceptance require operator configuration; mocked tests are not proof of live gateway behavior.
