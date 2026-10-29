import {
  deploymentEnv,
  providerSecrets,
  storeSettingsRef,
} from "@/lib/server/store-context";

/**
 * Bachs credentials live in the write-only `privatePaymentSettings/bachs`
 * document, with environment-variable fallbacks — same pattern as Squad.
 * Sandbox and live keys/webhook signing secrets are stored separately.
 */
export async function getBachsConfiguration(sandboxOverride?: boolean) {
  const [settings, secrets] = await Promise.all([
    storeSettingsRef().get(),
    providerSecrets("bachs").then((data) => ({ data: () => data })),
  ]);
  const payments = settings.data()?.payments;
  const sandbox =
    sandboxOverride ??
    payments?.bachsSandbox ??
    deploymentEnv("BACHS_SANDBOX") !== "false";
  const data = secrets.data() ?? {};
  const apiKey: string =
    (sandbox ? data.sandboxApiKey : data.liveApiKey) ||
    (sandbox
      ? deploymentEnv("BACHS_SANDBOX_API_KEY")
      : deploymentEnv("BACHS_LIVE_API_KEY")) ||
    "";
  const webhookSecret: string =
    (sandbox ? data.sandboxWebhookSecret : data.liveWebhookSecret) ||
    (sandbox
      ? deploymentEnv("BACHS_SANDBOX_WEBHOOK_SECRET")
      : deploymentEnv("BACHS_LIVE_WEBHOOK_SECRET")) ||
    "";
  return {
    enabled:
      payments?.bachsEnabled ??
      deploymentEnv("NEXT_PUBLIC_BACHS_ENABLED") === "true",
    sandbox: Boolean(sandbox),
    apiKey: apiKey.trim(),
    webhookSecret: webhookSecret.trim(),
  };
}

/** Signing secrets for both environments — webhooks accept either. */
export async function getBachsWebhookSecrets() {
  const secrets = (
    await providerSecrets("bachs").then((data) => ({ data: () => data }))
  ).data();
  return [
    secrets?.sandboxWebhookSecret,
    secrets?.liveWebhookSecret,
    deploymentEnv("BACHS_SANDBOX_WEBHOOK_SECRET"),
    deploymentEnv("BACHS_LIVE_WEBHOOK_SECRET"),
  ].filter((v): v is string => typeof v === "string" && Boolean(v.trim()));
}
