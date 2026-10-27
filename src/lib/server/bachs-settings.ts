import { getAdminDb } from "@/lib/server/firebase-admin";

/**
 * Bachs credentials live in the write-only `privatePaymentSettings/bachs`
 * document, with environment-variable fallbacks — same pattern as Squad.
 * Sandbox and live keys/webhook signing secrets are stored separately.
 */
export async function getBachsConfiguration(sandboxOverride?: boolean) {
  const db = getAdminDb();
  const [settings, secrets] = await Promise.all([
    db.collection("settings").doc("app").get(),
    db.collection("privatePaymentSettings").doc("bachs").get(),
  ]);
  const payments = settings.data()?.payments;
  const sandbox =
    sandboxOverride ??
    payments?.bachsSandbox ??
    process.env.BACHS_SANDBOX !== "false";
  const data = secrets.data() ?? {};
  const apiKey: string =
    (sandbox ? data.sandboxApiKey : data.liveApiKey) ||
    (sandbox ? process.env.BACHS_SANDBOX_API_KEY : process.env.BACHS_LIVE_API_KEY) ||
    "";
  const webhookSecret: string =
    (sandbox ? data.sandboxWebhookSecret : data.liveWebhookSecret) ||
    (sandbox
      ? process.env.BACHS_SANDBOX_WEBHOOK_SECRET
      : process.env.BACHS_LIVE_WEBHOOK_SECRET) ||
    "";
  return {
    enabled:
      payments?.bachsEnabled ??
      process.env.NEXT_PUBLIC_BACHS_ENABLED === "true",
    sandbox: Boolean(sandbox),
    apiKey: apiKey.trim(),
    webhookSecret: webhookSecret.trim(),
  };
}

/** Signing secrets for both environments — webhooks accept either. */
export async function getBachsWebhookSecrets() {
  const db = getAdminDb();
  const secrets = (
    await db.collection("privatePaymentSettings").doc("bachs").get()
  ).data();
  return [
    secrets?.sandboxWebhookSecret,
    secrets?.liveWebhookSecret,
    process.env.BACHS_SANDBOX_WEBHOOK_SECRET,
    process.env.BACHS_LIVE_WEBHOOK_SECRET,
  ].filter((v): v is string => typeof v === "string" && Boolean(v.trim()));
}
