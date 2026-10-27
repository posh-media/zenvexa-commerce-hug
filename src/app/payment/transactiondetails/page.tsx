/**
 * Production transaction-details destination for hosted-checkout redirects
 * (e.g. Squad). Reuses the payment callback flow: server-side verification
 * first, Firestore listener fallback, then routes to order success/failure.
 * The redirect alone never marks an order as paid.
 */
export { default } from "@/app/payments/callback/page";
