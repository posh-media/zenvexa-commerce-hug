# Phase 7 — Payments & Order Processing

Secure Paystack payment architecture for ShopBeta: pending orders, backend verification, webhook preparation, COD confirmation, and inventory protection.

## Flow

```
Checkout
  → createPendingOrder (Firestore, no stock decrement)
  → Paystack: POST /api/payments/paystack/initialize → redirect
     or COD: POST /api/payments/cod/confirm
  → Paystack callback → POST /api/payments/paystack/verify
  → Admin SDK transaction: mark paid, decrement stock, payment record, timeline
  → Clear cart → /order-success
```

## API routes

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/payments/paystack/initialize` | Create Paystack transaction + payment doc |
| POST | `/api/payments/paystack/verify` | Verify with Paystack servers + finalize |
| POST | `/api/payments/paystack/webhook` | Signature-validated webhook (idempotent) |
| POST | `/api/payments/cod/confirm` | Reserve stock for cash on delivery |

Secrets never leave the server. Frontend only receives `authorizationUrl`.

## Environment

See `.env.example`:

- `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_WEBHOOK_SECRET` (optional)
- `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_COD_ENABLED`
- `NEXT_PUBLIC_FLUTTERWAVE_ENABLED`
- `FIREBASE_SERVICE_ACCOUNT` (JSON) for Admin SDK on Vercel

## Collections

- `orders` — pending → paid/processing; `timeline[]`; `inventoryReserved`
- `payments` — gateway, reference, amount, status, gatewayResponse, processedEventIds

## Pages

- `/payments/callback` — verify after Paystack redirect
- `/payments/failed` — failed / verification errors
- `/payments/cancelled` — user cancelled
- `/payments/retry` — retry Paystack for a pending order

## Flutterwave

Prepared in `src/lib/server/flutterwave.ts` and checkout radio (coming soon). Not fully implemented.

## Security notes

- Verification only via server routes + Paystack API
- Webhook HMAC (`x-paystack-signature`)
- Amount + currency checks before stock decrement
- Idempotent finalize (paid + inventoryReserved / event ids)
- Firestore rules: payments read by owner; writes via Admin SDK

## Deploy checklist

1. Paste updated `firestore.rules` (includes `payments`)
2. Set Paystack + Firebase Admin env vars on Vercel
3. Paystack Dashboard → Webhook URL: `https://<domain>/api/payments/paystack/webhook`
4. Enable Card / bank channels on Paystack
5. Smoke-test initialize → pay → verify → stock decrement
