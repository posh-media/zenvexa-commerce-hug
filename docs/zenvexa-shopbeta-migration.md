# Zenvexa product migration to ShopBeta Firebase

## Scope

This migration copies Zenvexa catalogue data from `zenvexa-c8d84` into ShopBeta's `shop-day84j` project. It intentionally excludes Zenvexa users, orders, staff records, payment settings and other non-catalogue data.

## Source backup

Run the export before changing the app connection:

```powershell
npm run export:zenvexa
```

The current verified backup is:

```text
migration-review/zenvexa-firebase-backup-2026-10-27T12-07-31-263Z/
```

It contains:

- `manifest.json`
- `products.json` — 50 records
- `categories.json` — 5 records
- `brands.json` — 0 records

The manifest records the source project, export timestamp, field union and SHA-256 checksum for each collection. The backup directory is intentionally not committed.

## Required private configuration

Destination writes require a ShopBeta service account through one of:

- `FIREBASE_SERVICE_ACCOUNT`
- `FIREBASE_SERVICE_ACCOUNT_PATH`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `--credentials=<path>`

For local credential files, `secrets/` and `*.service-account.json` are ignored by Git.

The app requires these public Firebase variables in local and deployment environments:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Set `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_APP_URL` per environment. Production should use `https://zenvexacommerce.com`. Do not commit credential values.

## Dry run

```powershell
node scripts/migrate-zenvexa-products.mjs `
  --backup=migration-review/zenvexa-firebase-backup-2026-10-27T12-07-31-263Z `
  --project=shop-day84j
```

Dry runs read the destination catalogue and write a report under `migration-review/`. They do not write Firestore.

A credential-free preflight can inspect the public catalogue and produce the same collision/reference report without a service account:

```powershell
node scripts/migrate-zenvexa-products.mjs `
  --backup=migration-review/zenvexa-firebase-backup-2026-10-27T12-07-31-263Z `
  --project=shop-day84j `
  --public-dry-run
```

It requires the six `NEXT_PUBLIC_FIREBASE_*` variables for the destination project and cannot be combined with `--apply` or `--rollback`.

## Import

After reviewing the dry-run report:

```powershell
node scripts/migrate-zenvexa-products.mjs `
  --backup=migration-review/zenvexa-firebase-backup-2026-10-27T12-07-31-263Z `
  --project=shop-day84j `
  --apply
```

Destination IDs are deterministic (`zvx-<source-id>`). Imported records carry `zenvexaMigration.sourceProjectId`, `sourceDocumentId` and `batchId`. Existing ShopBeta products are skipped when an ID, slug or SKU conflict is detected.

## Rollback

Preview rollback for one migration batch:

```powershell
node scripts/migrate-zenvexa-products.mjs --rollback --project=shop-day84j
```

Apply the same batch-scoped rollback:

```powershell
node scripts/migrate-zenvexa-products.mjs --rollback --project=shop-day84j --apply
```

Rollback deletes only documents carrying the matching `zenvexaMigration.sourceProjectId` and `batchId` marker. It does not target ordinary ShopBeta products.
