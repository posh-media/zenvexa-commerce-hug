# Zenvexa Commerce Hug

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
