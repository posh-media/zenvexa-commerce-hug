# Phase 5 — User Features & Customer Account Experience

Authentication, profile, addresses, wishlist sync, order history, notifications, search history, and deals — without Admin UI or payment gateway work.

## Authentication

| Provider | Status |
|---|---|
| Email & password sign up / sign in | Implemented |
| Google sign-in popup | Implemented |
| Password reset email | Implemented |
| Email verification send on signup | Prepared (non-blocking if console disabled) |
| Sign out | Implemented |
| Session persistence | `browserLocalPersistence` |

- Routes: `/login`, `/signup`, `/forgot-password`
- Firestore `users/{uid}` created/merged via `ensureUserProfile`
- Protected pages via `RequireAuth`: profile, addresses, orders, notifications
- Guests can still browse catalogue, cart, wishlist, checkout

## Profile

- Live Firestore profile + Auth photo/name
- Edit: name, phone, DOB, gender, photo upload (Storage)
- Shows member since, status, default address, recent orders, wishlist count
- Sign out wired

## Addresses

- `/addresses` CRUD + set default (only one default)
- Fields: recipient, phone, country, state, city, line, landmark, postal, default

## Wishlist

| Mode | Behaviour |
|---|---|
| Guest | localStorage only |
| Authenticated | merge on login + debounced Firestore push |

Badge stays live from Zustand.

## Order history

- `/orders` lists `listOrdersByUser`
- View details → track order
- Reorder adds available items to cart

## Notifications

- Firestore list, mark read / mark all / delete
- Header unread badge
- Empty state

## Search

- Recent searches (local)
- Popular / matching suggestions (debounced)
- Authenticated: `users.searchHistory` sync

## Deals

Firestore-backed sections: flash, featured, trending, best sellers, sponsored, discounted, recently added + recently viewed rail.

## Firestore & security

Collections used: `users`, `addresses`, `wishlists`, `orders`, `notifications` (+ Storage avatars).

Recommended `firestore.rules` updated for Auth owners + guest checkout compatibility. **Not deployed** — deploy when ready.

## Remaining before public launch

1. Deploy Firestore rules (+ Storage rules for avatars)
2. Enable Email/Password + Google in Firebase console; configure authorized domains
3. Payment gateway
4. Cart cloud sync (wishlist already syncs)
5. Admin Dashboard
6. Stronger email-change flow (`verifyBeforeUpdateEmail`)
7. Production monitoring / analytics review
