import { getAdminDb } from "@/lib/server/firebase-admin";
import { requireOrderActor } from "@/lib/server/request-auth";
import {
  deploymentEnv,
  privateProviderRef,
  providerSecrets,
  withStoreContext,
} from "@/lib/server/store-context";
import {
  deploymentStoreId,
  hasStoreAttribution,
  recordStoreId,
  requireStoreName,
} from "@/lib/store";
import { getAppSettings } from "@/services/settings.service";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

const providerFields: Record<string, Record<string, string>> = {
  paystack: { secretKey: "PAYSTACK_SECRET_KEY" },
  korapay: { secretKey: "KORAPAY_SECRET_KEY" },
  flutterwave: { secretKey: "FLUTTERWAVE_SECRET_KEY" },
  squad: {
    sandboxSecretKey: "SQUAD_TEST_SECRET_KEY",
    liveSecretKey: "SQUAD_LIVE_SECRET_KEY",
  },
  monnify: {
    sandboxApiKey: "MONNIFY_TEST_API_KEY",
    sandboxSecretKey: "MONNIFY_TEST_SECRET_KEY",
    sandboxContractCode: "MONNIFY_TEST_CONTRACT_CODE",
    liveApiKey: "MONNIFY_LIVE_API_KEY",
    liveSecretKey: "MONNIFY_LIVE_SECRET_KEY",
    liveContractCode: "MONNIFY_LIVE_CONTRACT_CODE",
  },
  bachs: {
    sandboxApiKey: "BACHS_SANDBOX_API_KEY",
    liveApiKey: "BACHS_LIVE_API_KEY",
    sandboxWebhookSecret: "BACHS_SANDBOX_WEBHOOK_SECRET",
    liveWebhookSecret: "BACHS_LIVE_WEBHOOK_SECRET",
  },
};
/** Immutable, private credential versions retain old account keys across admin rotation. */
export async function captureProviderVersion(provider: string) {
  if (!providerFields[provider]) throw new Error("Unknown provider.");
  const data = { ...(await providerSecrets(provider)) };
  for (const [field, env] of Object.entries(providerFields[provider]!)) {
    if (!data[field] && deploymentEnv(env)) data[field] = deploymentEnv(env);
  }
  if (
    !Object.keys(providerFields[provider]!).some(
      (field) => typeof data[field] === "string" && data[field],
    )
  )
    throw new Error("Provider credentials are not configured.");
  const version = randomUUID();
  await privateProviderRef(provider)
    .collection("versions")
    .doc(version)
    .create({ ...data, createdAt: FieldValue.serverTimestamp() });
  return version;
}

type RouteOptions = {
  webhook?: string;
  initialize?: boolean;
  staffOnly?: boolean;
};
export async function withStoreRequest(
  request: Request,
  action: () => Promise<Response>,
  options: RouteOptions = {},
) {
  try {
    const url = new URL(request.url);
    const body: Record<string, unknown> & {
      data?: { reference?: unknown };
      Body?: { transaction_ref?: unknown };
      eventData?: { paymentReference?: unknown };
    } =
      request.method === "GET"
        ? {}
        : await request
            .clone()
            .json()
            .catch(() => ({}));
    const reference =
      body.reference ||
      body.data?.reference ||
      body.TransactionRef ||
      body.Body?.transaction_ref ||
      body.eventData?.paymentReference ||
      body.transaction_reference ||
      url.searchParams.get("reference");
    const db = getAdminDb();
    let payment: FirebaseFirestore.DocumentData | undefined;
    if (typeof reference === "string" && reference.length <= 200) {
      const snapshot = await db
        .collection("payments")
        .where("reference", "==", reference)
        .limit(2)
        .get();
      if (snapshot.docs.length > 1)
        throw new Error("Ambiguous payment reference.");
      payment = snapshot.docs[0]?.data();
    }
    // Payload metadata is never an authority for choosing a store or signing key.
    const orderId = payment?.orderId || body.orderId;
    if (typeof orderId !== "string" || !orderId || orderId.includes("/"))
      return NextResponse.json(
        { ok: false, reason: "Order or payment not found." },
        { status: 404 },
      );
    const orderSnapshot = await db.collection("orders").doc(orderId).get();
    if (!orderSnapshot.exists)
      return NextResponse.json(
        { ok: false, reason: "Order not found." },
        { status: 404 },
      );
    const order = orderSnapshot.data()!;
    const storeId = recordStoreId(order);
    if (
      !storeId ||
      (payment &&
        hasStoreAttribution(payment) &&
        recordStoreId(payment) !== storeId)
    )
      return NextResponse.json(
        { ok: false, reason: "Invalid store attribution." },
        { status: 409 },
      );
    if (options.webhook) {
      if (!payment || payment.gateway !== options.webhook)
        return NextResponse.json(
          { ok: false, reason: "Payment not found." },
          { status: 404 },
        );
    } else {
      if (storeId !== deploymentStoreId())
        return NextResponse.json(
          { ok: false, reason: "Order not found." },
          { status: 404 },
        );
      const legacyGuestSettlement =
        !options.initialize &&
        !options.staffOnly &&
        payment &&
        !payment.storeId &&
        !payment.credentialVersion &&
        storeId === "shopbeta" &&
        /^guest_/.test(order.userId || "") &&
        typeof reference === "string";
      if (!legacyGuestSettlement)
        await requireOrderActor(request, order, options.staffOnly);
    }
    return await withStoreContext(
      {
        id: storeId,
        credentialVersion: payment?.credentialVersion,
        sandbox: payment?.metadata?.sandbox,
        legacyAttempt:
          !!payment && !payment.credentialVersion && storeId === "shopbeta",
      },
      async () => {
        if (options.initialize) {
          const storeName = requireStoreName(await getAppSettings(), storeId);
          const provider =
            url.pathname.split("/")[3] === "cod"
              ? body.gateway
              : url.pathname.split("/")[3];
          if (typeof provider === "string" && provider !== "cod") {
            const version = await captureProviderVersion(provider);
            return withStoreContext(
              { id: storeId, storeName, credentialVersion: version },
              action,
            );
          }
        }
        return action();
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed.";
    const safe = [
      "Admin has not configured the store name. Please contact support.",
      "Provider credentials are not configured.",
      "Authentication required.",
      "Access denied.",
    ].includes(message);
    return NextResponse.json(
      {
        ok: false,
        reason: safe ? message : "Store request could not be processed.",
      },
      { status: message === "Authentication required." ? 401 : 403 },
    );
  }
}
