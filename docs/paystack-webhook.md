# Paystack Webhook, Firestore Deploy & Make.com

## Environment

Set in `.env.local` (local) and Vercel (production):

| Variable | Purpose |
| --- | --- |
| `PAYSTACK_SECRET_KEY` | Server-only Paystack secret (`sk_test_…` / `sk_live_…`) |
| `PAYSTACK_WEBHOOK_SECRET` | Optional; defaults to `PAYSTACK_SECRET_KEY` for HMAC |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Client public key |
| `MAKE_WEBHOOK_URL` | Make.com scenario hook |

Never commit secrets. Rotate any key that was pasted into chat.

## Webhook endpoints

**Firebase Cloud Function — Initialize (redirect checkout):**

`POST https://us-central1-shop-day84j.cloudfunctions.net/paystackInitialize`

Used by `POST /api/payments/paystack/initialize` when Firebase Admin is not configured locally (falls back automatically).

**Firebase Cloud Function — Webhook (preferred if Paystack points here directly):**

`POST https://us-central1-shop-day84j.cloudfunctions.net/paystackWebhook`

- Project: `shop-day84j`
- Region: `us-central1`
- Runtime: Node.js 20 (Firebase Functions v2)
- Secret: `PAYSTACK_SECRET_KEY` (Secret Manager)
- Param: `MAKE_WEBHOOK_URL` (`functions/.env` at deploy — see `functions/.env.example`)

**Next.js / Vercel (also supported — proxies to Cloud Function when Admin SDK is not on Vercel):**

`POST /api/payments/paystack/webhook`

When `FIREBASE_SERVICE_ACCOUNT` and `PAYSTACK_SECRET_KEY` are **not** set on Vercel, this route forwards the raw body and `x-paystack-signature` to the Cloud Function above (same pattern as initialize). Point Paystack at **either** URL — not both.

Flow:

1. Log incoming request  
2. Verify `x-paystack-signature` (HMAC SHA-512)  
3. Parse event  
4. On `charge.success`: **verify with Paystack API** (`/transaction/verify/:reference`)  
5. Confirm reference, amount (kobo), currency (`NGN`), customer email, status  
6. Atomic Firestore finalize (orders + payments + stock + timeline) with `processedEventIds` idempotency  
7. POST order JSON to Make.com (failures logged only; Paystack still gets `200`)  
8. Structured JSON logs for every stage  

Supported events: `charge.success`, `charge.failed`, `transfer.success` (ack), `refund.processed` (status update).

## Firebase deploy

```bash
firebase use shop-day84j
firebase deploy --only functions:paystackWebhook
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
# Optional storage:
firebase deploy --only storage
```

Console: Firebase → Build → Functions → `paystackWebhook` (us-central1).

Indexes build asynchronously — check Firebase Console → Firestore → Indexes until all are **Enabled**.

## Testing checklist

### Successful payment
1. Place order with Paystack (test card `4084084084084081`)  
2. Complete checkout  
3. Confirm order `paymentStatus=paid`, payment doc `status=paid`, stock decremented  
4. Confirm Make.com received payload  
5. Server logs show `webhook.verify` → `webhook.firestore` → `webhook.make` → `webhook.success`

### Failed payment
1. Use a declining test card / abandon payment  
2. Or send `charge.failed` via Paystack dashboard webhook test  
3. Order stays unpaid / `failed`; stock unchanged  

### Duplicate webhook
1. Replay the same `charge.success` event twice  
2. Second run returns `alreadyProcessed: true`  
3. Stock decremented only once; Make.com not double-sent (`makeNotifyStatus=sent`)

### Invalid signature
1. POST raw body with wrong `x-paystack-signature`  
2. Expect `401` and `webhook.signature` error log  

### Firestore failure
1. Temporarily break Admin credentials / delete order mid-flight  
2. Expect `500` so Paystack retries  
3. Log `webhook.firestore` failure  

### Make.com failure
1. Set `MAKE_WEBHOOK_URL` to an invalid URL  
2. Complete a real/test payment  
3. Payment still succeeds; order has `makeNotifyStatus=failed`  
4. Fix URL and re-run notify later (`force` path / retry job)  

## Paystack Dashboard

Webhook URL (production):

`https://<your-domain>/api/payments/paystack/webhook`

Enable events: `charge.success`, `charge.failed`, `refund.processed` (and `transfer.success` when needed).
