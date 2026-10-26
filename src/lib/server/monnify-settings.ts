import { getAdminDb } from "@/lib/server/firebase-admin";

export async function getMonnifyConfiguration(sandboxOverride?: boolean) {
  const db = getAdminDb();
  const [settings, secrets] = await Promise.all([
    db.collection("settings").doc("app").get(),
    db.collection("privatePaymentSettings").doc("monnify").get(),
  ]);
  const payments = settings.data()?.payments;
  const sandbox =
    sandboxOverride ??
    payments?.monnifySandbox ??
    process.env.MONNIFY_SANDBOX !== "false";
  const values = secrets.data();
  const prefix = sandbox ? "sandbox" : "live";
  const envPrefix = sandbox ? "MONNIFY_TEST_" : "MONNIFY_LIVE_";
  const value = (field: string, env: string): string =>
    (values?.[prefix + field] || process.env[envPrefix + env] || "").trim();
  return {
    enabled:
      payments?.monnifyEnabled ??
      process.env.NEXT_PUBLIC_MONNIFY_ENABLED === "true",
    sandbox: Boolean(sandbox),
    apiKey: value("ApiKey", "API_KEY"),
    secretKey: value("SecretKey", "SECRET_KEY"),
    contractCode: value("ContractCode", "CONTRACT_CODE"),
  };
}
