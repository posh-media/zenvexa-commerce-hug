import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/constants/collections";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { appendTimelineAdmin } from "@/lib/server/order-timeline";
import {
  computeCodCommitmentFee,
  isCodStateAllowed,
  COD_FEE_PURPOSE,
} from "@/lib/cod";
import {
  getAppUrl,
  getCodAllowedStates,
  isCodEnabled,
  isKorapayConfigured,
  isKorapayEnabled,
  isPaystackConfigured,
  isPaystackEnabled,
  toKobo,
} from "@/lib/server/env";
import { initializePaystackTransaction } from "@/lib/server/paystack";
import { initializeKorapayTransaction } from "@/lib/server/korapay";
import { getSquadConfiguration } from "@/lib/server/squad-settings";
import { initializeSquadTransaction } from "@/lib/server/squad";
import { getMonnifyConfiguration } from "@/lib/server/monnify-settings";
import { initializeMonnifyTransaction } from "@/lib/server/monnify";
import { stripUndefined } from "@/utils/firestore";
import type { Order } from "@/types/order";

export type CodFeeGateway = "paystack" | "korapay" | "squad" | "monnify";

function feeReferenceForOrder(order: Order, gateway: CodFeeGateway) {
  // Squad and Monnify webhooks gate on provider-shaped references
  // (`SQ`/`MN` + 32 hex), so those gateways must keep the existing format.
  if (gateway === "squad") return `SQ${randomUUID().replaceAll("-", "")}`;
  if (gateway === "monnify") return `MN${randomUUID().replaceAll("-", "")}`;
  const base = (order.orderNumber || order.id).replace(/[^a-zA-Z0-9]/g, "");
  return `SBFEE_${gateway.toUpperCase()}_${base}_${randomUUID().replaceAll("-", "")}`.slice(0, 100);
}

/**
 * Initialize an online payment for the COD commitment fee (25% of the order
 * total). The gateway, amount and reference are all derived server-side from
 * the stored order document — nothing is trusted from the client.
 */
export async function initializeCodCommitmentFee(input: {
  orderId: string;
  gateway: CodFeeGateway;
}) {
  if (!(await isCodEnabled())) {
    return { ok: false as const, reason: "Cash on delivery is disabled." };
  }

  const db = getAdminDb();
  const orderRef = db.collection(COLLECTIONS.orders).doc(input.orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    return { ok: false as const, reason: "Order not found." };
  }

  const order = { id: orderSnap.id, ...orderSnap.data() } as Order;

  if (String(order.paymentMethod ?? "") !== "cash-on-delivery") {
    return {
      ok: false as const,
      reason: "This order is not a cash-on-delivery order.",
    };
  }
  if (order.commitmentFeeStatus === "paid" || order.paymentStatus === "paid") {
    return {
      ok: false as const,
      reason: "The commitment fee for this order is already paid.",
    };
  }

  // Server-side allowed-state enforcement — the checkout UI check is not
  // sufficient on its own.
  const allowedStates = await getCodAllowedStates();
  if (!isCodStateAllowed(allowedStates, order.shippingAddress?.state)) {
    const list = allowedStates.length ? allowedStates.join(", ") : "none configured";
    return {
      ok: false as const,
      reason: `Payment on delivery is only allowed in the following areas: ${list}. A 25% commitment fee is required.`,
    };
  }

  const email = order.customer?.email?.trim();
  if (!email) {
    return { ok: false as const, reason: "Order is missing a customer email." };
  }

  const total = Number(order.total ?? order.totals?.total ?? 0);
  const fee = computeCodCommitmentFee(total);
  if (fee < 1) {
    return { ok: false as const, reason: "Order total is invalid." };
  }

  const gateway = input.gateway;

  // Validate the gateway up front — do not leave a dangling "processing"
  // payment attempt on the order when the provider is disabled/unconfigured.
  let squadConfig: Awaited<ReturnType<typeof getSquadConfiguration>> | undefined;
  let monnifyConfig:
    | Awaited<ReturnType<typeof getMonnifyConfiguration>>
    | undefined;
  if (gateway === "paystack") {
    if (!(await isPaystackEnabled()) || !(await isPaystackConfigured())) {
      return { ok: false as const, reason: "Paystack is not configured or is currently disabled." };
    }
  } else if (gateway === "korapay") {
    if (!(await isKorapayEnabled()) || !(await isKorapayConfigured())) {
      return { ok: false as const, reason: "KoraPay is not configured or is currently disabled." };
    }
  } else if (gateway === "squad") {
    squadConfig = await getSquadConfiguration();
    if (!squadConfig.enabled || !squadConfig.secretKey) {
      return { ok: false as const, reason: "Squad is not configured or is currently disabled." };
    }
  } else {
    monnifyConfig = await getMonnifyConfiguration();
    if (!monnifyConfig.enabled || !monnifyConfig.secretKey || !monnifyConfig.apiKey || !monnifyConfig.contractCode) {
      return { ok: false as const, reason: "Monnify is not configured or is currently disabled." };
    }
  }

  const reference = feeReferenceForOrder(order, gateway);
  const callback = new URL("/payments/callback", getAppUrl());
  callback.searchParams.set("order", order.orderNumber || order.id);
  callback.searchParams.set("provider", gateway);
  callback.searchParams.set("reference", reference);
  const callbackUrl = callback.toString();

  const paymentRef = db.collection(COLLECTIONS.payments).doc();
  await paymentRef.set(
    stripUndefined({
      orderId: order.id,
      orderNumber: order.orderNumber ?? "",
      userId: order.userId,
      gateway,
      purpose: COD_FEE_PURPOSE,
      reference,
      amount: fee,
      amountKobo: toKobo(fee),
      currency: "NGN",
      status: "processing",
      customerEmail: email,
      metadata: stripUndefined({
        sandbox: squadConfig?.sandbox ?? monnifyConfig?.sandbox,
      }),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }),
  );

  await orderRef.update(
    stripUndefined({
      paymentGateway: gateway,
      commitmentFeeStatus: "processing",
      codCommitmentFee: fee,
      codAmountPaid: 0,
      codBalance: total,
      paymentReference: reference,
      paymentId: paymentRef.id,
      timeline: appendTimelineAdmin(
        order.timeline,
        "payment_processing",
        "25% commitment fee payment started.",
      ),
      updatedAt: FieldValue.serverTimestamp(),
    }),
  );

  let initialized:
    | { authorizationUrl?: string; reference?: string; transactionReference?: string }
    | undefined;
  try {
    if (gateway === "paystack") {
      const res = await initializePaystackTransaction({
        email,
        amountNaira: fee,
        reference,
        callbackUrl,
        metadata: { orderId: order.id, orderNumber: order.orderNumber, userId: order.userId, purpose: COD_FEE_PURPOSE },
      });
      initialized = { authorizationUrl: res.authorization_url, reference: res.reference };
    } else if (gateway === "korapay") {
      const res = await initializeKorapayTransaction({
        email,
        amountNaira: fee,
        reference,
        redirectUrl: callbackUrl,
        metadata: { orderId: order.id, orderNumber: order.orderNumber, userId: order.userId, purpose: COD_FEE_PURPOSE, customerName: order.customer?.name },
      });
      initialized = { authorizationUrl: res.checkout_url, reference: res.reference };
    } else if (gateway === "squad") {
      const res = await initializeSquadTransaction(squadConfig!, {
        email,
        customerName: order.customer?.name,
        amount: fee,
        reference,
        callbackUrl,
        metadata: { orderId: order.id, orderNumber: order.orderNumber, purpose: COD_FEE_PURPOSE },
      });
      initialized = res;
    } else {
      const res = await initializeMonnifyTransaction(monnifyConfig!, {
        email,
        customerName: order.customer?.name,
        amount: fee,
        reference,
        callbackUrl,
        metadata: { orderId: order.id, orderNumber: order.orderNumber, purpose: COD_FEE_PURPOSE },
      });
      initialized = res;
      await paymentRef.update({
        transactionReference: res.transactionReference,
      });
    }
  } catch (error) {
    await paymentRef.update({
      initializationFailed: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
    throw error;
  }

  if (!initialized?.authorizationUrl) {
    return {
      ok: false as const,
      reason: "The payment gateway did not return a checkout URL.",
    };
  }

  return {
    ok: true as const,
    authorizationUrl: initialized.authorizationUrl,
    reference,
    orderId: order.id,
    orderNumber: order.orderNumber,
    paymentId: paymentRef.id,
    commitmentFee: fee,
  };
}
