> Historical storefront migration notes. For the newer store-specific configuration release, follow [STORE-SCOPING.md](STORE-SCOPING.md); it supersedes the earlier shared-settings and storefront-only deployment assumptions.

# Vercel deployment: zenvexacommerce.com

The existing Zenvexa Vercel project should deploy the `posh-media/zenvexa-commerce-hug` repository after the migration branch is reviewed and merged. `vercel.json` explicitly selects Next.js, `npm ci`, `npm run build` and `.next`; remove any conflicting Vite/TanStack overrides in the project settings.

1. Configure the same Firebase public configuration and required server/payment environment bindings used by ShopBeta, privately in Vercel. Do not copy credential values into Git or chat.
2. For the production environment set `NEXT_PUBLIC_APP_URL=https://zenvexacommerce.com` and `NEXT_PUBLIC_SITE_URL=https://zenvexacommerce.com`. For previews use a trusted, explicitly configured preview origin if testing providers whose callbacks use server URL configuration.
3. Add `zenvexacommerce.com` to Firebase Authentication's authorized domains. Add `www.zenvexacommerce.com` only if it will be used. Keep ShopBeta's existing authorized domains.
4. Add the domain in the existing Zenvexa Vercel project's Domains settings and follow Vercel's account-specific DNS instructions. Choose a canonical redirect for `www` if needed.
5. Keep the existing shared Firebase functions and payment webhooks. Do not replace their destinations simply because a second storefront is being launched. Validate the return URL for each enabled gateway in sandbox, including Paystack's existing function fallback.
6. Confirm real catalog loading, sign-in, permissions, shared stock/order visibility, shipping/taxes/coupons, every enabled payment method, cancellation/retry, verification and refunds. Validate order emails and links, which may use shared ShopBeta settings.
7. Resolve the inherited public-settings/payment-secrets storage issue documented in `INTEGRATION.md` before live payment use.

No deployment, domain changes or production database writes were made in this workspace. Vercel/Firebase access and environment bindings are not configured here.

Also review the inherited `/api/debug/korapay-test` endpoint before launch; see the build observations in `VALIDATION.md`. Keep diagnostics from initiating real payment requests in production or during a configured build.
