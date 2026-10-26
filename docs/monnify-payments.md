# Monnify payments

Monnify adds hosted NGN checkout alongside Squad, Paystack, KoraPay and COD. It is
hidden by default and appended to the existing automatic provider preference.
Existing providers' API services, credential handling and the shared atomic
order/stock finalizer remain unchanged.

## API contract

- [Hosted Checkout API](https://developers.monnify.com/docs/collections/one-time-payments/checkout-api)
- [Verify transactions](https://developers.monnify.com/docs/collections/manage-payments/verify-transactions)
- [Webhook event types and signature](https://developers.monnify.com/docs/webhooks/event-types)

The server authenticates with Basic `apiKey:secretKey` at `/api/v1/auth/login`,
then uses the resulting Bearer token to initialize
`/api/v1/merchant/transactions/init-transaction`. Amounts are in **naira**, not
kobo. NGN, contract code, customer and a unique merchant payment reference are
provided. The customer follows the validated HTTPS `checkoutUrl` on Monnify's
domain; no secret or access token reaches the browser. Each server operation
obtains its own token; tokens are not persisted in settings or payment records.

Verification queries `/api/v2/merchant/transactions/query?paymentReference=...`.
Only `PAID` with the exact expected amount, NGN, matching merchant/transaction
references and matching customer email (when supplied) can finalize an order.
Both current order total and recorded attempt amount are checked. API response
variants `currency`/`currencyCode` and `customer`/`customerDTO` are supported.
Callback status and webhook amounts are never trusted as proof of payment.

Collection notifications use `SUCCESSFUL_TRANSACTION` and `eventData`.
Production requires HMAC SHA-512 over the **raw request body**, using that
attempt's environment secret and the `monnify-signature` header. Monnify documents
that sandbox notifications omit this header. Unsigned notifications can only
query an already-recorded Monnify **sandbox** attempt; an authoritative sandbox
API response still must pass every payment check. Invalid supplied signatures
are rejected in either environment. Non-collection/unknown references are ignored.
Failed processing returns a retryable non-200 response; duplicate success uses
the existing atomic finalizer so stock is decremented once.

## Enable from admin

1. Configure the existing Firebase Admin server credentials and set
   `NEXT_PUBLIC_APP_URL` to your HTTPS application origin.
2. Deploy the updated `firestore.rules` before saving credentials. Admin and
   super-admin may write `privatePaymentSettings/monnify`; all client reads are
   denied. The server reads through the Admin SDK. Credentials are excluded from
   public settings and audit payloads.
3. In **Admin → Store settings → Payments → Monnify**, enter the sandbox API key,
   secret key and contract code from the matching Monnify dashboard. Blank fields
   retain saved values. The form never loads saved credentials and clears new
   values after a successful save.
4. Select **Use Monnify sandbox**, enable **Monnify enabled**, and save.
5. Set the matching Monnify dashboard's Transaction Completion webhook URL to
   `https://<your-domain>/api/payments/monnify/webhook`.
6. Test checkout, callback, webhook, failed/pending payment and retry. Confirm
   duplicate notifications do not decrement stock again, and hiding Monnify still
   permits existing attempts to settle. Smoke-test existing providers.
7. For production, save the live API key, secret and contract code, configure the
   live webhook, and clear **Use Monnify sandbox**. Configure merchant-paid fees
   in Monnify so `amountPaid` remains exactly the order total. Keep credentials
   for both environments while attempts are outstanding.

Server fallback variables: `MONNIFY_TEST_API_KEY`, `MONNIFY_TEST_SECRET_KEY`,
`MONNIFY_TEST_CONTRACT_CODE`, their `MONNIFY_LIVE_*` equivalents,
`MONNIFY_SANDBOX` (defaults true), and `NEXT_PUBLIC_MONNIFY_ENABLED` (defaults
false). Saved admin values take precedence. Sandbox API is
`https://sandbox.monnify.com`; live API is `https://api.monnify.com`.

## Scope and validation

Monnify retries create fresh references and preserve the attempt environment,
even after admin changes modes. Existing-provider orders do not switch to
Monnify during retry; Monnify orders retry through Monnify. Stock remains
unreserved until successful payment, matching the current online flow.
Partial/overpaid transactions remain unfulfilled for manual review. Refunds,
reserved accounts, recurring payments and disbursements are outside this change.

Run `npm run test:monnify`, `npm run test:squad`, `npm run lint`,
`npx tsc --noEmit`, and `npm run build`. Automated payment tests use mocked
network/Firestore boundaries with the real order finalizer. Live merchant
credentials were not used; complete the sandbox smoke test before activation.
Existing Firebase/environment build warnings and deferred payment findings
are recorded in [deferred-payment-findings.md](deferred-payment-findings.md).
