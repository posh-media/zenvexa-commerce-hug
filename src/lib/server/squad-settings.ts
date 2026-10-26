import { getAdminDb } from "@/lib/server/firebase-admin";

/** Squad alone uses Admin SDK settings reads and a non-public secret document. */
export async function getSquadConfiguration(sandboxOverride?: boolean) {
  const db = getAdminDb();
  const [settings, secrets] = await Promise.all([
    db.collection("settings").doc("app").get(),
    db.collection("privatePaymentSettings").doc("squad").get(),
  ]);
  const payments = settings.data()?.payments;
  const sandbox =
    sandboxOverride ??
    payments?.squadSandbox ??
    process.env.SQUAD_SANDBOX !== "false";
  const secretKey: string =
    (sandbox
      ? secrets.data()?.sandboxSecretKey
      : secrets.data()?.liveSecretKey) ||
    (sandbox
      ? process.env.SQUAD_TEST_SECRET_KEY
      : process.env.SQUAD_LIVE_SECRET_KEY) ||
    "";
  return {
    enabled:
      payments?.squadEnabled ??
      process.env.NEXT_PUBLIC_SQUAD_ENABLED === "true",
    sandbox: Boolean(sandbox),
    secretKey: secretKey.trim(),
  };
}
