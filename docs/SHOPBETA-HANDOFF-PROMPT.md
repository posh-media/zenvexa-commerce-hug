# Ready-to-paste prompt for the ShopBeta Devin workspace

```text
Adapt ShopBeta to the implemented Zenvexa store-scoping contract. Implement and test the adapter on a dedicated branch/PR; do not merely propose an architecture.

Repositories:
- ShopBeta: https://github.com/tikustar/ShopBeta-Main
- Zenvexa reference: https://github.com/posh-media/zenvexa-commerce-hug
- Reference branch: feat/store-scoped-commerce
- Implementation commit: def519860dd55cbe1859297243e354838932faf7
- The implementation is based on Zenvexa product-migration commit 859ef0d and preserves ShopBeta changes through f51af93, including Bachs and the integrations screen.

Fetch the latest relevant branches and read repository instructions. Read Zenvexa docs/STORE-SCOPING.md and docs/STORE-SCOPING-VALIDATION.md from the reference branch first. Inspect commit def5198 for the actual implementation patch. Do not merge the entire Zenvexa app/history into ShopBeta or replace ShopBeta's UI, branding, catalog, Firebase project or Vercel project. Port/adapt the shared contract and resolve newer ShopBeta changes deliberately.

IDENTITY AND PUBLIC SETTINGS

Stable IDs are shopbeta and zenvexa. Display names are not identifiers.

Set ShopBeta's deployment variables:
STORE_ID=shopbeta
NEXT_PUBLIC_STORE_ID=shopbeta
NEXT_PUBLIC_SHOPBETA_SETTINGS_CUTOVER=false initially
NEXT_PUBLIC_APP_URL=<actual canonical ShopBeta origin>
NEXT_PUBLIC_SITE_URL=<same origin>
SHOPBETA_APP_URL=<same origin>
ZENVEXA_APP_URL=https://www.zenvexacommerce.com

Do not copy Zenvexa's deployment credentials or reset any keys. Keep the existing shared Firebase backend/Auth. Anonymous guest order protection requires Anonymous sign-in enabled on this shared Auth project; authorize the correct domains.

Target public settings paths are settings/ShopBeta and settings/Zenvexa. settings.storeId is permanent. The ONE configured display name is storeInformation.name, required after trimming; orders snapshot it as storeName. There must not be a second settings.storeName that can disagree. New public settings writes must not contain paymentSecrets or private webhook URLs.

The reference repository's default store is Zenvexa, so explicitly configure BOTH ShopBeta identity variables. Unknown or mismatched values fail closed. Preserve ShopBeta's branding independently from the permanent ID.

ROLLING COMPATIBILITY / SOURCE OF TRUTH

Until NEXT_PUBLIC_SHOPBETA_SETTINGS_CUTOVER=true, adapted ShopBeta MUST continue reading/writing settings/app and legacy current credentials at privatePaymentSettings/{provider}. This is implemented by settingsDocumentId/providerDocumentSegments/legacyCredentialsAllowed in the shared helpers. The initially seeded settings/ShopBeta and scoped ShopBeta credential documents are snapshots, not a second editable authority.

After coordinated final refresh and flag rollout, switch new ShopBeta operations to settings/ShopBeta and privatePaymentSettings/shopbeta/providers/{provider}. Never delete settings/app or the legacy credential documents as part of the adapter. Old unversioned attempts still need them.

Keep the cutover flag consistent in BOTH Vercel deployments, including the Zenvexa deployment that may process a cross-store webhook. Do not flip it independently in this workspace before the migration/cutover sequence is complete.

SECRETS AND PAYMENT ATTEMPTS

Final provider path:
privatePaymentSettings/{storeId}/providers/{provider}

Private immutable attempt credential versions:
privatePaymentSettings/{storeId}/providers/{provider}/versions/{uuid}

Private Make/email URLs:
privateStoreSettings/{storeId}
Fields: makeWebhookUrl, transactionalEmailWebhookUrl

Support Paystack, KoraPay, Squad, Monnify and Bachs. Preserve Bachs routes, admin controls, sandbox/live fields, existing payment references and tests. Flutterwave remains prepared/incomplete; do not silently enable or claim it is fully supported.

Port the server AsyncLocalStorage context, request guard, credential snapshots and provider loaders. New attempts record storeId, storeName and credentialVersion plus existing gateway/reference/amount/currency and sandbox metadata. Use the saved account/version for verification after rotation; never borrow the receiving deployment's environment keys for another store. Missing recorded credential versions fail closed.

A legacy unversioned ShopBeta attempt can read its old private credentials even after cutover. New attempts after cutover must not silently fall back to legacy keys. Keep version history until pending attempts are reconciled. Private browser reads remain denied; blank admin fields preserve credentials. Secrets/webhook URLs must be redacted from public responses and audits.

ORDER CREATION, AUTHORIZATION AND NUMBERING

Port POST /api/orders and the client authenticatedFetch helper. New orders are stamped server-side using the controlled deployment and required configured name, never a checkout-supplied storeId/name. The server verifies Firebase ID tokens, substitutes the authenticated UID, reads authoritative product prices/stock and validates store coupons, tax/delivery totals.

Guest checkout uses one shared in-flight Firebase anonymous sign-in for concurrent requests. Keep anonymous users as guests in the UI. Preserve ordinary account/cart/wishlist behavior.

New public order numbers use the configured-name prefix plus a timestamp and UUID. Shop Beta -> SB, ShopBeta -> SB, Zenvexa -> ZEN; punctuation/Unicode/digits/short names follow the reference helper and its tests. Existing document IDs, numbers, provider references and historical names never change.

Port direct API guards: resolve the persisted order/payment, require the correct deployment store, then owner or existing staff permission. Staff-only email sends require orders:write and must use authoritative paid-order data. Existing globally authorized staff roles remain shared; this contract does not introduce per-store staff memberships. Do not treat a UI filter as authorization.

WEBHOOKS, SHARED FUNCTIONS AND STOCK

Use the persisted payment reference/order relationship to select store, account version and sandbox mode. Never select credentials or forwarding origins from unverified metadata.

Shared function bridge: functions/src/store-routing.js. Legacy unversioned ShopBeta events use existing handlers; attributed Zenvexa/versioned ShopBeta events forward raw bytes and original signature headers to the trusted store's Next.js /api/payments/{provider}/webhook route. It includes Monnify/Bachs routing. Configure SHOPBETA_WEBHOOK_ORIGIN and ZENVEXA_WEBHOOK_ORIGIN on the shared functions, checking the actual ShopBeta canonical domain.

Shared function changes must be deployed ONCE for the shared Firebase project, not independently overwritten by both repositories. Coordinate the exact function bundle with Zenvexa; preserve legacy handlers and environment bindings. Legacy function initializers/finalizers reject foreign orders.

Preserve raw signature checks, provider API amount/currency/customer/reference validation, sandbox rules, retries/refunds and idempotent stock finalization. Port the Bachs amount/session checks and awaited Paystack/KoraPay signature helpers. Group duplicate product lines/variants for shared inventory deductions and finish COD reads before writes.

OPERATIONS AND LEGACY RECORDS

Port store-scoped services for customer/admin orders, direct reads, counts/cursors/exports, revenue/refunds/best sellers, customers/spend, ads/expenses, coupons, banners, notifications, audit and analytics.

Missing/null/empty/whitespace legacy attribution resolves to ShopBeta. Recognizable name-only records can be normalized; unknown nonempty attribution fails closed and is reported. Fixed IDs continue matching after display-name changes.

Filter BEFORE pagination/counting. The reference uses an explicit indexed storeId query for Zenvexa and a deliberate legacy-compatible ShopBeta scan that filters the complete matching set before slicing/counting. Do not replace this with an equality query that drops missing fields, or filter after a global limited page. Retire compatibility scans only after old writers stop and remaining attribution is explicitly backfilled.

Visits use store-prefixed document keys in both pageVisitTotals and pageVisitDays. Legacy mixed counters cannot be split accurately; reference policy assigns unlabelled counters to ShopBeta. Shared catalog/stock/view metrics must be labeled shared. Customer spend/recency is based on attributable orders; account role/status changes affect both stores. Notification broadcasts target this store's customer activity.

Products, stock, categories, brands, Firebase Auth/accounts, reviews and existing cart/wishlist behavior remain shared. Do not duplicate or partition these collections automatically.

MIGRATION / CUTOVER

Use the reference scripts/migrate-store-data.mjs and store-migration-plan.mjs; do not rerun product imports or invent another incompatible migration.

Default mode creates a checksummed private backup/plan without writes. Exclusive legacy cutoff is 2026-10-28T00:00:00Z. Never overwrite explicitly attributed Zenvexa orders or renumber old orders. Unknown names/invalid dates are private issues for review.

Apply uses conditional per-record transactions, source/target snapshot checks and atomic Admin-only storeMigrationReceipts/{planChecksum}/entries/{pathHash} receipts. Reruns skip applied values. Rollback may undo only mutations owned by that plan; it must preserve concurrent payment/lifecycle changes and refuse changed configuration documents. Keep backups outside Git/public directories and copy them to durable private storage.

Follow docs/STORE-SCOPING.md exactly:
1. Additive rules/indexes, private dry run/backups, reviewed migration.
2. Zenvexa routes ready with provider toggles off until its own keys and shared routing are configured.
3. Shared function compatibility bridge deployed once; sandbox acceptance.
4. Adapted ShopBeta deployed with cutover=false; legacy settings/current credential authority preserved during overlap.
5. Freeze ShopBeta configuration/credential edits, create a NEW plan with --refresh-shopbeta and apply after reviewing source/target differences. This explicit final-refresh mode updates ShopBeta's named settings/scoped credentials from current legacy sources; normal reruns never overwrite existing named docs. Reconcile existing private integration URLs separately.
6. Set cutover=true consistently in both Vercel deployments and redeploy before unfreezing configuration edits.
7. Retain legacy paths and version history for old readers/attempts. Resolve any historical secrets still stored in public settings after all dependent code has private reads; do not blindly delete keys that old payments need.

Do not deploy restrictive rules that break old ShopBeta writers, run live charges, reset the catalog or expose credentials. Public tracking is a store-filtered status whitelist; private customer details require proper access.

TESTS AND DELIVERABLES

Port the relevant new tests/helpers and run build, lint, type checks, provider tests, store boundary/credential rotation tests, Firestore rules emulator tests and migration dry-run/apply/rerun/concurrency/rollback tests. Use demo-store-scope only for emulators; never production credentials.

Deliver a ShopBeta PR, exact environment changes by NAME only, compatibility/cutover checklist, tests and remaining deployed verification. Keep keys and filled env files out of commits/messages. Verify independent settings saves and store stats while shared stock remains correct. Do not mark live payment/database migration checks complete based solely on mocks/emulators.
```
