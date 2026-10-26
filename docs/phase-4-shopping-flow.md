# Phase 4 — Customer Shopping Flow

End-to-end guest shopping on ShopBeta: browse → wishlist/cart → checkout → Firestore order → track.

## Shopping flow

Home / category / PDP (live catalogue) → Add to cart / wishlist → Cart → Checkout → `placeOrder` transaction → Order success → Track order.

## Wishlist

- Zustand store with localStorage (`shopbeta.wishlist.v1`)
- Toggle / add / remove / move to cart
- Live header & mobile badge counts
- Empty state on `/wishlist`
- Architecture ready for later Firestore sync via `wishlists.service`

## Cart

- Zustand store with localStorage (`shopbeta.cart.v1`)
- Add / remove / qty / clear / stock checks / variants
- Subtotal, tax (7.5%), delivery options, stub coupon `BETA10`
- Live badges; cart cleared only after successful order create

## Checkout

- Customer + shipping form validation
- Delivery method + fee calculation
- Payment method markers only (no gateway)
- Empty cart guard

## Orders

- `placeOrder()` uses a Firestore transaction: validate stock → write order → decrement stock / bump `salesCount`
- Guest `userId`: `guest_{uuid}`
- Cart cleared after success; last order cached for success page

## Track order

- Load by `orderNumber` (or doc id fallback)
- Status timeline, items, address, payment status
- Graceful missing/invalid handling

## State

| Store | Persistence |
|---|---|
| Cart | localStorage |
| Wishlist | localStorage |
| Checkout | in-memory + last order cache |

Hydrated once in `AppProviders`.

## Security

Updated recommended `firestore.rules` (not deployed): guest order create/read, stock-decrement product updates.

## Remaining before production

1. Deploy Firestore rules (and any indexes)
2. Authentication + cart/wishlist sync
3. Payment gateway
4. Signed-in order history
5. Coupon validation against `coupons` collection
6. Notifications wiring
7. Admin Dashboard
