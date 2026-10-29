# Store-scoping validation

Implementation: `def519860dd55cbe1859297243e354838932faf7` on `feat/store-scoped-commerce`.

The branch preserves Zenvexa product-migration/image changes through `859ef0d` and incorporates ShopBeta's newer secrets/integrations/Bachs changes through upstream `f51af93` before the store split.

## Passed in this workspace

- Production `npm run build`: compilation, ESLint and TypeScript checks pass.
- 80 direct mocked tests: store/context/auth/creation/query/signature boundaries 17; settings/secret writes 5; Squad 18; Monnify 22; Bachs 9; COD 9.
- Seven Firestore emulator tests using the demo project: required/matching store identity, blank-name rejection, public/private reads, authorized secret writes, immutable order/payment attribution and credential pointers, old ShopBeta writer compatibility, namespaced counter validation.
- Migration integration against a disposable loopback Firestore emulator: private checksummed backup, dry-run no writes, exclusive cutoff, explicit store preservation, unknown dates/names, conditional concurrent-write conflicts, reruns, explicit final ShopBeta refresh, transaction-owned rollback, and tamper rejection. These are fictional fixtures, not live data.
- Production-server Chromium smoke checks: homepage renders, Hug Bag opens, no desktop/mobile horizontal overflow, anonymous admin redirects to login, missing auth on order creation returns 401, diagnostic payment endpoint returns 404, missing store configuration returns 503, and zero page errors.
- Git whitespace checks and syntax checks for the new migration/function modules.

The expected rules PERMISSION_DENIED logs prove forbidden operations were rejected. The migration tamper test intentionally invokes a failing plan-integrity check. Those expected failures do not represent test failures. Emulator Google metadata lookup warnings are unrelated to production configuration.

## Reproduce

```sh
npm ci
npm run test:stores
npm run test:squad
npm run test:monnify
npm run test:bachs
npm run test:cod
npm run test:rules
npm run test:migration
npm run build
```

Rules/migration emulator commands use `firebase.test.json`, the `demo-store-scope` project and loopback port 8089. They require Java 21+ and Firebase CLI (the npm scripts obtain it using npx). `@firebase/rules-unit-testing` is a development dependency. Both helpers and actual server modules are exercised; the legacy provider primitive suites stub only the newly added request middleware, which has its own actual boundary tests.

## Not performed / release gates

This environment has no production Firebase service-account, store-specific provider credentials or Vercel access. No live migration plan, live backup, production write, shared rules/index/function deployment, domain update or payment charge was performed.

Consequently live record counts/conflicts, actual settings contents, authorized domains, each enabled provider's account/callback configuration, refunds/emails and deployed cross-store behavior remain release checks. The build without credentials renders unavailable-catalog states; that is not evidence of successful live catalog or checkout access.

Follow the coordinated rollout in `STORE-SCOPING.md`. Keep Zenvexa providers disabled until its own configuration and the shared webhook bridge are ready. ShopBeta must be adapted using `SHOPBETA-HANDOFF-PROMPT.md`, initially with the cutover flag false, then final-refreshed and switched consistently in both deployments. Do not merge/deploy this as a storefront-only change without the backend/companion steps.

## Fictional dry-run fixture results

The loopback `demo-store-scope` fixture scans seven orders: two are reported ambiguous (unknown store or missing date), two are skipped (explicit stable attribution and the exact cutoff), and three produce attribution patches. Along with missing configuration/private targets, the initial plan proposes eight mutations and contains 15 backup entries, including target-absence snapshots. The concurrency test changes one candidate after planning; apply leaves that record untouched and reports a conflict. Rerun performs no additional mutations for the already applied entries. An explicit final-refresh plan and both rollback paths are then verified. These counts describe only the disposable emulator fixture, not production data.
