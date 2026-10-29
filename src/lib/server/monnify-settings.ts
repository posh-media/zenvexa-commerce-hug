import {
  deploymentEnv,
  providerSecrets,
  storeSettingsRef,
} from "@/lib/server/store-context";

export async function getMonnifyConfiguration(sandboxOverride?: boolean) {
  const [settings, secrets] = await Promise.all([
    storeSettingsRef().get(),
    providerSecrets("monnify").then((data) => ({ data: () => data })),
  ]);
  const payments = settings.data()?.payments;
  const sandbox =
    sandboxOverride ??
    payments?.monnifySandbox ??
    deploymentEnv("MONNIFY_SANDBOX") !== "false";
  const values = secrets.data();
  const prefix = sandbox ? "sandbox" : "live";
  const envPrefix = sandbox ? "MONNIFY_TEST_" : "MONNIFY_LIVE_";
  const value = (field: string, env: string): string =>
    (values?.[prefix + field] || deploymentEnv(envPrefix + env) || "").trim();
  return {
    enabled:
      payments?.monnifyEnabled ??
      deploymentEnv("NEXT_PUBLIC_MONNIFY_ENABLED") === "true",
    sandbox: Boolean(sandbox),
    apiKey: value("ApiKey", "API_KEY"),
    secretKey: value("SecretKey", "SECRET_KEY"),
    contractCode: value("ContractCode", "CONTRACT_CODE"),
  };
}
