# Squad by GTBank payments

Squad is an additional hosted checkout option. Paystack, KoraPay and COD continue
to use their existing services and routes. Squad is hidden by default.

## API references

- [Initialize](https://docs.squadco.com/Payments/Initiate-payment)
- [Verify](https://docs.squadco.com/Payments/verify-transaction)
- [Payment notifications](https://docs.squadco.com/webhook-direct-url/webhook-and-direct-url)
- [Signature validation](https://docs.squadco.com/webhook-direct-url/signature-validation)
- [Original initialize documentation](https://squadinc.gitbook.io/squad-api-documentation/payments/initiate-payment)

Hosted checkout uses `POST /transaction/initiate` with a server-only Bearer secret,
an amount in kobo, NGN, `initiate_type: inline`, a unique `transaction_ref`,
and a callback URL. The customer follows `data.checkout_url`.
The callback carries `provider=squad`, the order number and our stored reference.
Verification calls `GET /transaction/verify/:reference` and checks the returned
reference, amount, currency, customer email (when present), and successful status
before using the existing atomic order/stock finalizer.

Checkout payment notifications use `Event: charge_successful`, `TransactionRef`
and `Body`, with HMAC SHA-512 in `x-squad-encrypted-body`. This integration does
not implement Squad's separate virtual-account webhook formats.

## Setup

1. Configure Firebase Admin credentials on the Next.js server using the existing
   `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_SERVICE_ACCOUNT_PATH`, or
   `GOOGLE_APPLICATION_CREDENTIALS` setup. Squad routes require Admin SDK access;
   they do not use Paystack's Firebase Functions fallback.
2. Deploy `firestore.rules` before saving Squad keys from admin. The new
   `privatePaymentSettings/squad` document allows writes from `admin` and
   `super_admin` only, denies all client reads, and is read by the Admin SDK.
   Existing providers' settings and secret handling are unchanged.
3. Set `NEXT_PUBLIC_APP_URL` to the HTTPS production origin. Squad constructs its
   callback from this trusted server configuration, not a submitted callback URL.
4. In **Admin → Store settings → Payments**, enter the Squad sandbox secret key
   and/or live secret key. Blank inputs retain saved values; successful saves
   clear the inputs. Secret values are never loaded back into the admin form or
   included in public settings or audit records.
5. Choose **Use Squad sandbox** for testing; clear it for live payments. Enable
   **Squad by GTBank enabled** to make it visible at checkout.
6. In the matching Squad dashboard's API & Webhook settings, set the webhook URL
   to `https://<your-domain>/api/payments/squad/webhook`.

Optional environment fallbacks: `SQUAD_TEST_SECRET_KEY`, `SQUAD_LIVE_SECRET_KEY`,
`SQUAD_SANDBOX` (defaults to `true`), `NEXT_PUBLIC_SQUAD_ENABLED` (defaults to
disabled). Saved admin values take precedence. A public key is not required for
this server-initialized hosted checkout.

Sandbox API: `https://sandbox-api-d.squadco.com`.
Live API: `https://api-d.squadco.com`.
Each attempt stores its environment so a subsequent admin mode switch does not
change verification of existing attempts. Hiding Squad blocks new initialization
but verification and signed notifications still settle outstanding payments.
Retain both keys while payments from both environments are outstanding.

## Validation

Run `npm run test:squad`, `npm run lint`, and `npx tsc --noEmit`.
The automated tests mock Squad and Firestore; they do not contact payment APIs.

Before live activation, complete a sandbox checkout and verify order/payment
status, stock, callback, and Make.com notification. Replay its signed webhook and
confirm stock is decremented once. Check incorrect signatures, incorrect amounts,
pending/failed transactions, retry, and hiding Squad during an outstanding payment.
Confirm Paystack, KoraPay and COD still follow their existing paths.

Stock remains unreserved until payment finalization, matching existing online
payments. Squad retries are supported on Squad orders; switching an existing
provider's order to Squad is outside this change.
