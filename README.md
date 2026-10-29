# Zenvexa Commerce Hug

Zenvexa's storefront and admin design on ShopBeta's Next.js/Firebase application. This replaces the previous TanStack/Lovable demo implementation.

Products, inventory and Firebase authentication are shared. Store configuration, integration credentials, orders and operational records are store-scoped. See [store-scoping contract and rollout](docs/STORE-SCOPING.md), [validation](docs/STORE-SCOPING-VALIDATION.md), and the [ShopBeta handoff prompt](docs/SHOPBETA-HANDOFF-PROMPT.md).

## Local setup

Requires Node.js 20 or newer and npm. Guest checkout additionally requires Firebase Anonymous sign-in. Set matching `STORE_ID` and `NEXT_PUBLIC_STORE_ID` values as documented in the store-scoping rollout.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Supply the same Firebase configuration as ShopBeta through local environment settings or your hosting provider's secret configuration. Server credentials stay on the server. Use Zenvexa's own origin for `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_SITE_URL`; use the existing shared functions URL where applicable. See `.env.example` for the complete inherited configuration contract.

Without Firebase configuration, the app renders catalog failure/empty states. It does not substitute sample products, demo orders, payment accounts or an admin passcode.

```sh
npm run lint
npx tsc --noEmit
npm run test:squad
npm run test:monnify
npm run build
```

## Implementation

- `src/services`, `src/firebase`, `src/stores`, `src/schemas`, `src/app/api`, `src/lib/server`: inherited ShopBeta system. Branding-only fallback copy differs in the catalog converter.
- `src/app/page.tsx`: Zenvexa hero and live product discovery.
- `src/components/layout`: Zenvexa navigation, footer and Hug Bag; cart actions use the existing store.
- `src/components/commerce`: real product views, quick view, listing, checkout and order components.
- `src/components/admin/admin-shell.tsx`: Zenvexa portal layout around all existing permission-filtered admin routes.
- `src/app/globals.css`, `tailwind.config.ts`: Zenvexa emerald/amber semantic design tokens mapped to shared controls.
- `public/zenvexa`, `public/fonts`: original brand imagery and self-hosted DM Sans/Manrope fonts (licenses included).
- `docs/design-reference/zenvexa.css`: preserved original visual stylesheet.

## Deployment

Use a host supporting Next.js server routes, such as Vercel or a properly configured Node deployment. The old Vite/TanStack build configuration no longer applies. Configure Firebase Auth's authorized domains for Zenvexa and verify gateway callback/return URLs against the actual deployed origin.

Deploying a storefront does not require reseeding, migrating or renaming shared collections. Do not run seed/migration scripts or deploy a second copy of the included Firebase functions/rules as part of a storefront deployment. These files are retained for ShopBeta system parity.

Before live payments, check the inherited settings-secret storage issue described in [integration notes](docs/INTEGRATION.md). Live Firebase and gateway access are required for final end-to-end verification.

Production target: **https://zenvexacommerce.com**, hosted in the existing Zenvexa Vercel project. See [Vercel deployment steps](docs/DEPLOYMENT.md) and [validation results](docs/VALIDATION.md).
