<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application rules
- Keep Zenvexa's storefront and other views inside a shared client-state provider; phase-one checkout and merchant updates are intentionally session-only simulations.
- Keep product data, delivery options and pricing calculations in a browser-safe commerce module so all views share one source of truth and pricing rules can be unit-tested.
- Define brand styling in the global semantic token system and use shared shadcn controls for interactions to keep the storefront visually consistent.
- The storefront and /admin each mount StoreProvider; catalog, cart and orders persist in localStorage so both views share state until a backend exists. The admin role gate is a client-only demo, not real security.
- Firebase mode supersedes the demo persistence rules above: `VITE_BACKEND_MODE=firebase` reads authoritative catalogue/orders from Firestore, uses Firebase Auth and server staff documents, and never falls back to local demo orders or role flags. Keep demo mode isolated for migration.
- Firebase Functions live in the root Bun workspace `functions`; use `bun install --frozen-lockfile --linker hoisted`, `bun run test:backend`, and `firebase emulators:exec --project zenvexa-c8d84 --only firestore,storage "bun run test:emulator"`. Emulator tests clear loopback-only test data. Never deploy, remotely seed, change billing or activate gateway requests without approval. Setup and limitations are in README.md.
- In Windows PowerShell, use `npm.cmd` and `firebase.cmd` launchers when script execution policy blocks their `.ps1` counterparts; do not weaken execution policy. Pinned Bun is available through `npm.cmd exec --yes --package=bun@1.3.11 -- bun`.
- Remote catalogue migration uses Admin SDK Application Default Credentials, not Firebase CLI session credentials. Use the explicit opt-in migration test with `--testTimeout=60000` for the read-only dry-run; review its backup, conflicts and hash before any apply. Never print credential files or inspect `functions/.secret.local`.
- Phase-two SEO assertions are in `src/test/seo.test.ts`. Firestore/Storage integration tests include admin pagination, private payment projections, stock-adjustment reasons, checkout delivery configuration and revenue provenance. A successful build or emulator run is not remote deployment evidence.
- Render product images through `ProductImage`; its local `/catalog/missing.svg` fallback must also recover images that failed before hydration and reset for replacement URLs without altering stored product data. Regression coverage is in `src/test/product-image.test.tsx`. Local browser image checks can use the installed Edge channel (`chromium.launch({ channel: "msedge", headless: true })`); the bundled Playwright Chromium executable is not installed. Use an isolated demo session and simulated image failures, not remote catalogue writes.
