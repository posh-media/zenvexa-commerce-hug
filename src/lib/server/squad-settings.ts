import {
  deploymentEnv,
  providerSecrets,
  storeSettingsRef,
} from "@/lib/server/store-context";

/** Squad alone uses Admin SDK settings reads and a non-public secret document. */
export async function getSquadConfiguration(sandboxOverride?: boolean) {
  const [settings, secrets] = await Promise.all([
    storeSettingsRef().get(),
    providerSecrets("squad").then((data) => ({ data: () => data })),
  ]);
  const payments = settings.data()?.payments;
  const sandbox =
    sandboxOverride ??
    payments?.squadSandbox ??
    deploymentEnv("SQUAD_SANDBOX") !== "false";
  const secretKey: string =
    (sandbox
      ? secrets.data()?.sandboxSecretKey
      : secrets.data()?.liveSecretKey) ||
    (sandbox
      ? deploymentEnv("SQUAD_TEST_SECRET_KEY")
      : deploymentEnv("SQUAD_LIVE_SECRET_KEY")) ||
    "";
  return {
    enabled:
      payments?.squadEnabled ??
      deploymentEnv("NEXT_PUBLIC_SQUAD_ENABLED") === "true",
    sandbox: Boolean(sandbox),
    secretKey: secretKey.trim(),
  };
}
