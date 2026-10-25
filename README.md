# Zenvexa Commerce Hug

## Firebase foundation (local, not deployed)

The frontend remains TanStack Start. Firebase Auth, Firestore, Storage and Node 22 second-generation Cloud Functions provide an opt-in backend. The only configured real project is `zenvexa-c8d84`. Nothing in this repository deploys automatically. Analytics is not initialized.

### Local setup and verification

Use Bun 1.3.11 or newer, Node 22, Java 21 and Firebase CLI. If Bun is not on PATH, `npm exec --yes --package=bun@1.3.11 -- bun <arguments>` launches pinned Bun without substituting npm as the dependency manager. Use the root workspace lockfile:

```text
bun install --frozen-lockfile --linker hoisted
bun run lint
bun run test
bun run build
bun run test:backend
firebase emulators:exec --project zenvexa-c8d84 --only firestore,storage "bun run test:emulator"
firebase emulators:exec --project zenvexa-c8d84 --only auth,firestore,functions "bun run --cwd functions test:http"
```

Use the hoisted installation flag for Firebase CLI SDK discovery on Windows; the isolated Bun workspace layout failed Functions SDK discovery in the inspected CLI. This changes local dependency layout only, not package versions or security policies. If Firebase CLI still reports a missing Functions SDK launcher on Windows, run `npm rebuild firebase-functions --ignore-scripts --package-lock=false` once after the Bun installation. This regenerates executable shims only; it does not replace Bun dependency resolution or create an npm lockfile. This additional step was needed and verified locally. On this Windows/Java setup, `emulators:exec` may report a shutdown error after tests complete and leave a local Java process: inspect results separately and stop only the emulator process started for this checkout.

Backend tests use synthetic records and require loopback emulator hosts. The emulator suite clears only emulator data. Never run it against a remote database. To use the browser, copy `.env.example` to ignored `.env.local`, select `VITE_BACKEND_MODE=firebase`, keep `VITE_FIREBASE_EMULATORS=true`, then run:

```text
firebase emulators:start --project zenvexa-c8d84 --only auth,firestore,functions,storage
bun run dev
```

Emulators bind to loopback; they do not create another Firebase project. An emulator CLI warning about the real project does not authorize remote calls. Payment calls remain disabled. Use only sample identities/addresses. The Auth emulator UI is disabled; use the application account form. Email verification links are emitted by the Auth emulator, not sent to real recipients. Guest checkout uses anonymous Firebase Auth: guest history is private to that UID, not publicly readable or portable after losing the session. Account linking of a guest to email is not yet implemented; finish/retain the guest session before switching accounts.

To seed while the Firestore emulator is running, in PowerShell:

```powershell
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
$env:ZENVEXA_SEED='emulator'
bun run test src/test/firebase-seed.test.ts
Remove-Item Env:ZENVEXA_SEED
```

The seed is create-only with stable catalogue IDs: 50 products, five categories and six delivery configurations. It does not overwrite existing stock, alter localStorage or import any demo orders. Image references are preserved, including known unavailable legacy asset paths; repair them in a separate approved catalogue task. Local seed is repeatable, but importing into the real project requires a separately reviewed migration, backup, dry-run and approval. The legacy frontend remains available with `VITE_BACKEND_MODE=demo`; never use its passcode/localStorage role for operations.

### Trust boundaries and collections

- `products/{id}`: existing display fields, integer whole-naira price, available `stock`, `active`; public active-only reads. Staff mutations use `saveProduct`, not direct SDK writes. `expectedStock` prevents an edit from overwriting a concurrent reservation. Existing UI deletion archives records.
- `categories/{id}` and `deliveryZones/{hash(state)}`: public nonsecret configuration. Delivery retains Lagos 1500, Abuja 2500, Rivers 2800, Oyo 2000, Kano 3200, Enugu 2700; original zones and 1–2 business-day ETA. No nationwide promise is enforced by the backend.
- `profiles/{uid}` and `profiles/{uid}/addresses/{id}`: owner-only, allowlisted profile/address fields. A profile cannot contain staff roles. Address/profile UI is not yet added; rules define the permitted contract.
- `staff/{uid}`: `{active: true, role: 'admin' | 'inventory' | 'orders'}`. No client can write roles. Real staff bootstrap/revocation requires a trusted project administrator using Admin SDK/console after approval. Staff must use verified, nonanonymous Auth accounts for callable mutations. Do not bootstrap a real role from a public signup action. Refresh/re-sign-in after email verification. Emulator roles can be inserted through a local Admin SDK session pointed explicitly at the emulator; there is no public role-grant endpoint.
- `orders/{sha256(uid,key)}`: owner UID, immutable server quote and item snapshots, recipient/phone/address/landmark/state/zone, promo, payment method/status, fulfilment status, reservation state, timestamps and reservation review deadline. Owner and authorized order staff read; all writes server-only. No order-number-only public tracking endpoint exists.
- `orders/{id}/events/{event}`: immutable server-generated lifecycle events; no direct client reads/writes in this initial foundation.
- `paymentAttempts/{reference}`: server-only reference, expected kobo amount, owner/order association, email, status, provider checkout URL. Secrets are never stored in Firestore or audit payloads.
- `inventoryEvents` and `auditLogs`: append-only server operations, least-privilege staff reads. Refunds do not automatically restock physical goods.
- `requestLimits` and `operationLimits`: server-only transactional abuse counters; order limit 20/hour/UID and callable limit 60/minute/UID. App Check and provider-level abuse controls remain necessary against identity rotation.

Rules default-deny unknown collections and all privileged client writes. Storage permits public product images and verified inventory/admin uploads of JPEG/PNG/WebP below 2 MB; the current UI keeps its tighter 700 KB limit. Other file paths, SVG and client deletion are denied. Orphan upload cleanup is not implemented. Public product documents contain no customer/secret fields.

### Functions and lifecycle

Callable endpoints in `europe-west1`: `createOrder`, `saveProduct`, `updateOrderStatus`, `collectPod`, `initializePayment`, `verifyPayment`. HTTP POST endpoint: `paystackWebhook`. Firebase callable protocol validates Auth; App Check is enforced outside the Functions emulator. Server staff records, not a browser flag or client claim, authorize mutations. No endpoint accepts client totals, discounts or a paid status.

`createOrder` accepts `{key, items:[{productId,quantity}], delivery:{recipient,phone,address,landmark,state,zone}, paymentMethod, promo}`. Only `card`, `transfer`, `ussd`, `pod` and explicitly defined promo codes are accepted. Transactions read authoritative products/delivery and atomically reserve inventory, write the order and an audit trail. Quantities are positive integers, unique product lines, maximum 30 lines/100 units per line. Prices are positive integer whole-naira values, matching existing storefront precision. `HUG10` rounds 10% of merchandise to whole naira; `NAIJA5K` requires subtotal strictly greater than 50000. Delivery is not discounted. Idempotency keys are per identity; reusing a key with changed details fails. Browser draft keys survive same-tab retries but are not cross-device identifiers.

Electronic orders: `pending_payment` -> verified `paid` plus `processing` -> staff `dispatched` -> `delivered`. Failed/abandoned/pending provider results never confirm payment; a later verified success may settle the same reference. `reversed` requires reconciliation. Full verified refunds become `refunded`; partial refunds are rejected for manual reconciliation. POD: `processing` with `uncollected` -> dispatched -> delivered, then admin-only `collectPod` with a receipt records `collected`, never electronic `paid`. Cancellation is allowed only before payment/dispatch and without a payment attempt; it releases reserved stock once. Paid orders require refunds/reconciliation rather than cancellation.

Reservation deadlines currently prevent starting payment after 30 minutes, but do not automatically release stock. Staff must cancel unpaid orders with no attempt; attempted payments deliberately hold stock until provider reconciliation. Scheduled expiry, attempt recovery tooling, partial refunds, returns/restocking and paid-order cancellation remain follow-up work. This conservative policy avoids accepting a late payment against released inventory but is not a complete production reservation system.

### Paystack test activation and live boundary

`PAYSTACK_MODE` defaults to `disabled`. Only `test` is accepted; the code rejects live keys. No local fake verification endpoint can mark orders paid. Unit/emulator tests inject synthetic gateway results into the server service and never contact Paystack.

After explicit permission to use test provider requests, set the nonsecret `PAYSTACK_MODE=test` and a valid `STOREFRONT_URL` for Functions, and provision `PAYSTACK_SECRET_KEY` using Firebase Functions Secret Manager. For local emulators use ignored `functions/.secret.local`; never commit this file. Do not put secrets in any `VITE_` variable. No real secret is supplied by the repository. Remote secret provisioning and deployment require approval.

Guests are limited to Pay on Delivery; electronic order creation requires a verified-email account so an anonymous guest cannot reserve an unusable electronic order before account linking exists. A verified-email customer initializes their owned order. The server persists one reference before the network call and sends the exact stored kobo amount, NGN, owner/order metadata and trusted callback origin. Card, bank transfer and USSD use hosted Paystack channels (`card`, `bank_transfer`, `ussd`), subject to the merchant account supporting them. Demo account numbers and USSD codes are hidden in Firebase mode. Manual screenshots/references never confirm payment. The redirect only returns to order history; the user chooses server verification. The backend checks reference, amount, NGN, metadata and customer email. Webhooks verify the raw-body SHA512 HMAC and independently query Paystack; refunds are independently fetched from the refund API. Duplicate delivery/verification cannot reserve inventory twice or regress a paid/refunded order. Unknown provider events are acknowledged without changing orders. Network timeouts retain the original attempt for verification; retry never invents a second reference. Payment attempts that fail initialization may require manual reconciliation before another attempt is introduced.

Before live activation: review these limitations, implement reservation recovery/refunds and operational monitoring, run sandbox contract tests, configure verified production domains/HTTPS, webhook endpoint, distributed abuse controls, secret IAM, alerts, backups/restore and a deployment rollback plan. Live support intentionally requires a reviewed code/configuration change and explicit authorization; changing a frontend flag cannot enable live payments.

### Project access, App Check, deployment and rollback

The provided web API key is public client configuration, not authorization. Outside emulators set `VITE_FIREBASE_EMULATORS=false` and provide `VITE_FIREBASE_APP_CHECK_SITE_KEY` from a reCAPTCHA Enterprise App Check registration for the web app. Callable enforcement is already coded; Firestore/Storage App Check enforcement must be enabled in the console only after observing valid traffic. Auth providers (Email/Password and Anonymous), authorized domains, Firestore database location and Storage bucket must be deliberately configured in `zenvexa-c8d84`. These console actions were not performed.

The current CLI account did not list access to `zenvexa-c8d84`. A project owner must grant appropriate project visibility and least-privilege deployment/service-account/Secret Manager permissions or sign in locally to the correct authorized account. Do not share keys in chat. Cloud Functions/Cloud Build/Artifact Registry, Secret Manager and Storage generally require Blaze billing and enabled APIs; billing and quotas are not verified. The selected Functions region must be reviewed against the eventual database location before deployment.

For least-privilege IAM review, distinguish project discovery (`firebase.projects.get` / project read), rules deployment (`roles/firebaserules.admin`), index management (`roles/datastore.indexAdmin`), Functions deployment (`roles/cloudfunctions.developer` plus `iam.serviceAccounts.actAs` on the selected runtime/build accounts), and the specific Cloud Build/Artifact Registry permissions required by the approved deployment pipeline. Grant runtime Secret Manager access only to the specific payment secret, and separate secret provisioning from runtime reads. The exact combination depends on organization policies and has not been tested against this inaccessible project; do not grant broad Owner access as a shortcut.

Before deployment, resolve Functions artifact reproducibility: local development uses the root Bun workspace lockfile, while `functions/` is the deployment source. A reviewed release step must package a source-scoped locked dependency artifact compatible with the selected Cloud Functions build process; do not silently introduce an npm lockfile or assume remote builders reproduce the local workspace. The local emulator does not validate Cloud Build packaging.

No `firebase deploy`, remote seed, secret creation, billing change or production payment request is part of this setup. After approval, deployment commands must target `--project zenvexa-c8d84` explicitly and include reviewed Firestore rules/indexes, Storage rules and Functions. Preserve an export/backup and exact previous rules/function revision first. Reverting the client to demo mode is not a data rollback: never copy localStorage demo orders into Firestore or erase real orders. Restore server revisions compatibly; do not reset live inventory from seed. Local emulator data is disposable and separate from production.

ShopBeta reference reviewed: commit `38a41431bec345f2b131a61c5fd8dca8650d61dc`. Reused service separation, server verification/raw-body signatures, reference persistence and idempotent payment finalization. Rejected publicly readable payment secrets, guest-pattern order access, unauthenticated stock decrements, client totals and public role grants. No ShopBeta credentials, records or marketplace model were imported. The tagged conversation was not accessible through available tools; source is the implementation evidence.

Local verification snapshot: 13 frontend tests passed (the opt-in seed test is skipped in the ordinary run); eight backend unit tests, seven Firestore/Storage emulator tests, one callable HTTP/Auth emulator test and the separately enabled seed test passed. TypeScript no-emit checks and both demo/Firebase-mode builds passed. Scoped lint passed with three Fast Refresh warnings. Repository-wide lint failed on existing formatting/CRLF violations; unrelated files were not reformatted. No Paystack sandbox contract call, live App Check verification, Cloud Build packaging or remote deployment was tested. Firebase CLI `apps:list --project zenvexa-c8d84 --json` failed to list apps, so project access and billing remain unverified. Local services were stopped after validation.

The historical frontend specification below is retained for context; Firebase mode supersedes its demo-only persistence/admin assumptions. This is a local foundation, not a production-readiness claim.

---

Build the complete frontend UI, design system, interactive navigation, and rich mock data for a modern Nigerian multi-category general merchandise e-commerce web application called "Zenvexa" (Full Brand Name: "Zenvexa Commerce Hug" — Tagline: "Everything Naija Needs, Delivered with a Warm Hug").
For this first phase, focus 100% on a high-converting, ultra-polished, mobile-first React + Tailwind CSS + Lucide Icons + shadcn/ui storefront and multi-view experience powered by rich client-side state and realistic Nigerian mock data. Do NOT connect Supabase yet (we will wire the backend, database, and payment/order logic in Prompt 2).
1. Brand Identity & Aesthetic Direction
￼ Brand Vibe: Warm, trustworthy, energetic, distinctly Nigerian, and premium ("Commerce Hug"). Avoid generic templates; make it feel like a modern blend of Jumia, Konga, and Chowdeck/Paystack aesthetics.
￼ Color Palette:
￼ Primary: Deep Emerald & Lush Teal (⁠emerald-950⁠, ⁠emerald-800⁠, ⁠emerald-700⁠, ⁠teal-900⁠) representing growth, Naira, and Nigerian pride.
￼ Accent / CTA Highlights: Warm Amber Gold (⁠amber-400⁠, ⁠amber-500⁠, ⁠amber-300⁠) for "Awoof Deals", badges, and primary action highlights.
￼ Surfaces: Clean off-white (⁠slate-50⁠) backgrounds with crisp ⁠white⁠ cards, subtle ⁠slate-200⁠ borders, and glassmorphic overlays (⁠backdrop-blur-md⁠).
￼ Currency Formatting: Strictly format all prices in Nigerian Naira (⁠₦⁠) using ⁠en-NG⁠ locale (e.g., ⁠₦985,000⁠).
2. Global Navigation & Layout Architecture
Create a seamless multi-view layout switchable via top navigation tabs (without page reloads):
1. Top Promotional Announcement Bar (⁠emerald-950⁠):
￼ Left: ⁠"AWOOF HUG"⁠ pill badge + promo announcement: "Use code HUG10 for 10% OFF or NAIJA5K for ₦5,000 OFF orders above ₦50k!"
￼ Right: WhatsApp & Call Desk (⁠0700-ZENVEXA⁠) + ⁠"100% Buyer Protection"⁠ badge.
2. Main Sticky Header:
￼ Brand Logo: Rounded gradient emerald icon with a shopping bag + ⁠"ZENVEXA"⁠ bold typography + ⁠"NG"⁠ pill badge + subtitle ⁠"Commerce Hug • Everything Naija Needs"⁠.
￼ Interactive Nigerian Delivery Location Selector Pill: Dropdown to pick State (⁠Lagos⁠, ⁠Abuja (FCT)⁠, ⁠Rivers⁠, ⁠Oyo⁠, ⁠Kano⁠, ⁠Enugu⁠) and nested LGA / Delivery Zone (e.g., Lagos -> ⁠Ikeja⁠, ⁠Lekki Phase 1⁠, ⁠Victoria Island⁠, ⁠Surulere⁠, ⁠Yaba⁠, ⁠Ajah⁠; Abuja -> ⁠Wuse II⁠, ⁠Maitama⁠, ⁠Garki⁠, ⁠Gwarinpa⁠; Rivers -> ⁠Port Harcourt GRA⁠, ⁠Trans-Amadi⁠, etc.). Each state displays its base delivery fee (⁠₦1,500⁠ to ⁠₦3,200⁠) and ETA (⁠1 - 2 Business Days⁠).
￼ Global Search Bar: Instant search input with clear button and placeholder "Search phones, inverters, 50kg rice, Adire, blenders..."
￼ View Switcher Buttons:
￼ ⁠Storefront⁠ (Main Shop)
￼ ⁠Track Orders⁠ (with order count badge)
￼ ⁠Seller Hub⁠ (Merchant dashboard preview)
￼ ⁠Hug Bag⁠ (Slide-over Cart Drawer trigger with live item counter badge in ⁠amber-400⁠)
3. Horizontal Scrollable Category Pill Strip:
￼ ⁠All Merchandise 🛍️⁠
￼ ⁠Phones & Gadgets 📱⁠
￼ ⁠Home & Power ⚡⁠
￼ ⁠Naija Fashion & Style 👗⁠
￼ ⁠Supermarket & Pantry 🌾⁠
￼ ⁠Beauty & Personal Care ✨⁠
3. Rich Nigerian Mock Product Catalog (Include all 12 items with Unsplash images, specs, vendor names, SKU, stock count, ratings, and old/new Naira prices)
1. EcoFlow Delta 2 Portable Power Station (1024Wh) — ⁠Home & Power⁠, ⁠₦985,000⁠ (was ⁠₦1,120,000⁠), Badge: ⁠"Awoof Deal"⁠, Vendor: ⁠Zenvexa Official Power Hub⁠, Specs: ⁠1800W AC Output⁠, ⁠LiFePO4 3000+ Cycles⁠, ⁠Solar Input Ready⁠, ⁠5-Year Local Warranty⁠. Description references beating NEPA/PHCN outages effortlessly.
2. Samsung Galaxy A55 5G (256GB ROM / 8GB RAM) — ⁠Phones & Gadgets⁠, ⁠₦545,000⁠ (was ⁠₦590,000⁠), Badge: ⁠"Best Seller"⁠, Vendor: ⁠SlotTech Verified Partner⁠, Specs: ⁠Dual SIM 5G (MTN/Airtel Ready)⁠, ⁠50MP OIS Camera⁠.
3. Royal Stallion Classic Parboiled Rice (50kg Bag) — ⁠Supermarket & Pantry⁠, ⁠₦78,500⁠ (was ⁠₦85,000⁠), Badge: ⁠"Household Essential"⁠, Vendor: ⁠Zenvexa Agro Direct⁠, Specs: ⁠50kg Full Measure⁠, ⁠100% Stone-Free⁠, ⁠Ideal for Party Jollof⁠.
4. Binatone 18" Rechargeable Standing Fan with Remote — ⁠Home & Power⁠, ⁠₦94,000⁠ (was ⁠₦110,000⁠), Badge: ⁠"Hot Season Pick"⁠, Vendor: ⁠Binatone Nigeria Official⁠, Specs: ⁠Up to 9 Hours Backup⁠, ⁠LED Night Light⁠, ⁠USB Charging Port⁠.
5. Handcrafted Aso-Oke & Adire Luxe Two-Piece Set — ⁠Naija Fashion & Style⁠, ⁠₦42,000⁠ (was ⁠₦52,000⁠), Badge: ⁠"Made in Naija"⁠, Vendor: ⁠Lagos Loom Couture⁠, Specs: ⁠100% Breathable Cotton-Silk⁠, ⁠Authentic Abeokuta Indigo⁠.
6. Oraimo FreePods 4 Active Noise Cancelling Earbuds — ⁠Phones & Gadgets⁠, ⁠₦36,500⁠ (was ⁠₦44,000⁠), Badge: ⁠"Top Rated"⁠, Vendor: ⁠Oraimo Flagship Store⁠, Specs: ⁠35.5 Hours Battery⁠, ⁠HavyBass™ Afrobeats Tuning⁠.
7. Buchymix 2200W Commercial Heavy-Duty Blender — ⁠Home & Power⁠, ⁠₦88,000⁠ (was ⁠₦105,000⁠), Badge: ⁠"Kitchen King"⁠, Vendor: ⁠HomeChef Nigeria⁠, Specs: ⁠Crushes dry beans for Akara/Moi-Moi & tiger nuts⁠.
8. Shea Moisture Raw Shea & Oud Body Glow Bundle — ⁠Beauty & Personal Care⁠, ⁠₦28,500⁠ (was ⁠₦34,000⁠), Badge: ⁠"Authentic Import"⁠, Vendor: ⁠Nectar Beauty Lounge⁠.
9. HP Pavilion 15 (Core i7 13th Gen, 16GB RAM, 512GB SSD) — ⁠Phones & Gadgets⁠, ⁠₦890,000⁠ (was ⁠₦970,000⁠), Badge: ⁠"Tech Pro"⁠, Vendor: ⁠Computer Village Verified⁠.
10. Devon King’s Pure Vegetable Cooking Oil (5 Litres Keg) — ⁠Supermarket & Pantry⁠, ⁠₦19,500⁠ (was ⁠₦22,000⁠), Badge: ⁠"Pantry Saver"⁠, Vendor: ⁠Zenvexa Agro Direct⁠, Specs: ⁠NAFDAC Certified⁠, ⁠5L Factory Sealed⁠.
11. Executive Senator Kaftan Set with Monogram Embroidery — ⁠Naija Fashion & Style⁠, ⁠₦65,000⁠ (was ⁠₦78,000⁠), Badge: ⁠"Bespoke Finish"⁠, Vendor: ⁠Abuja Royal Threads⁠.
12. Lattafa Khamrah Eau De Parfum (100ml Original) — ⁠Beauty & Personal Care⁠, ⁠₦46,000⁠ (was ⁠₦55,000⁠), Badge: ⁠"Viral Fragrance"⁠, Vendor: ⁠Nectar Beauty Lounge⁠.
4. Key Views & UI Components to Build
1. Storefront View (⁠shop⁠):
￼ Split Hero Banner: Left side with headline "Shop Smarter, Feel the Warmest Hug in Nigerian Retail" and CTA buttons (⁠Explore Awoof Deals⁠, ⁠Shop Power & Inverters⁠). Right side with a glassmorphic ⁠"Deal of the Day"⁠ countdown card featuring the EcoFlow Power Station and a quick-add button.
￼ 4 Trust Pillar Cards: ⁠Lagos & Abuja Express⁠ (dynamically showing the currently selected Zone & State), ⁠Flexible Naija Payments⁠ (Paystack, Transfer, USSD, POD), ⁠Zenvexa Hug Warranty⁠, and ⁠Direct Wholesale Prices⁠.
￼ Interactive Filter & Sort Bar: Item count indicator, ⁠"Awoof Discounts Only"⁠ toggle checkbox, interactive Naira Max Budget range slider (⁠₦20,000⁠ to ⁠₦1,000,000⁠), and Sort dropdown (⁠Featured Hug Picks⁠, ⁠Price: Low to High⁠, ⁠Price: High to Low⁠, ⁠Highest Customer Rating⁠).
￼ Product Card Grid (4 columns desktop, 2 tablet, 1 mobile): Each card shows product image with hover zoom, category/discount percentage badge (⁠-14% OFF⁠), Wishlist Heart toggle button, Quick-View Eye button, Vendor name, Star rating + review count, 2-line title & description, formatted Naira price + strikethrough old price, stock left counter, ⁠"Ships to {selectedState}"⁠ tag, and ⁠"Add to Hug Bag"⁠ button.
2. Product Quick-View Modal:
￼ Opens when clicking the Eye icon or product title. Displays large image, vendor badge, full description, bulleted list of ⁠Key Highlights / Specs⁠ with green checkmarks, and an ⁠"Add to Hug Bag"⁠ CTA.
3. Slide-Over Cart Drawer (⁠Hug Bag⁠):
￼ Displays added items, thumbnail, unit price, ⁠+ / -⁠ quantity steppers, trash delete button, Merchandise Subtotal, Estimated Delivery Fee to selected State, Grand Total in Naira, and ⁠"Proceed to Nigerian Checkout"⁠ button.
4. Nigerian Checkout View (⁠checkout⁠):
￼ Left Column:
￼ 1. Nigerian Delivery Address Card: Recipient Name, Active Phone/WhatsApp Number, State & LGA/Zone selects, Street Address & Closest Landmark input.
￼ 2. Payment Method Selector Grid (4 interactive cards):
￼ ⁠Paystack Checkout⁠ (Verve, Mastercard, Visa, OPay)
￼ ⁠Instant Bank Transfer⁠ (Reveals a dark slate card showing a dedicated Paystack Titan Trust Virtual Account Number ⁠9940281746⁠ with a one-click Copy button and countdown timer)
￼ ⁠Bank USSD Code⁠ (Reveals an amber box showing ⁠*737*000*88412#⁠ GTBank & ⁠*919*000*88412#⁠ UBA strings)
￼ ⁠Pay on Delivery⁠ (POS or Transfer to Dispatch Rider at doorstep)
￼ Right Column: Order Summary card with scrollable item list, Promo Code input box (⁠HUG10⁠ or ⁠NAIJA5K⁠), Subtotal, Promo Discount line, Logistics fee for the chosen State/Zone, and Total Due.
5. Live Order Tracking View (⁠orders⁠):
￼ Pre-populate with a realistic active Nigerian order (⁠ZVX-ORD-8842⁠) showing status ⁠"In Transit"⁠, payment method, total paid, destination zone, and a 4-step visual progress timeline (1. Order Confirmed -> 2. Packed at Zenvexa Lagos Fulfillment Hub -> 3. Out with Dispatch Rider (Musa - 0802-XXX-9910) -> 4. Delivered with a Hug).
6. Seller Hub View (⁠vendor⁠):
￼ Left: Clean merchant form to publish a new product (Title, Category, Selling Price in ₦, Merchant Name, Warehouse Stock, Description).
￼ Right: Live Inventory Table showing all active SKUs, categories, Naira prices, and stock levels.
7. Footer:
￼ 4-column emerald-950 footer highlighting Zenvexa Commerce Hug brand story, Top Categories, Fulfillment Hubs (Lagos, Abuja, PH, Ibadan, Enugu, Kano), and Payment Partners.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ef4589d7-a257-4581-b718-89790f1486c7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
