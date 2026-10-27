"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { RequireAdmin } from "@/components/auth/require-admin";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label } from "@/components/ui/field";
import {
  getAppSettings,
  migrateLegacyPaymentSecrets,
  saveProviderSecrets,
  updateAppSettings,
} from "@/services/settings.service";
import { saveMonnifySecrets } from "@/services/monnify-settings.service";
import { saveSquadSecrets } from "@/services/squad-settings.service";
import { saveBachsSecrets } from "@/services/bachs-settings.service";
import { clearPaymentProviderSettingsCache } from "@/services/payments.service";
import { useUserStore } from "@/stores/user.store";
import { toastError, toastSuccess } from "@/stores/toast.store";

type ProviderKey =
  | "paystack"
  | "korapay"
  | "flutterwave"
  | "squad"
  | "monnify"
  | "bachs"
  | "cod"
  | "make";

const PROVIDER_ORDER: ProviderKey[] = [
  "paystack",
  "korapay",
  "flutterwave",
  "squad",
  "monnify",
  "bachs",
  "cod",
  "make",
];

function ProviderPanel({
  title,
  description,
  open,
  onToggle,
  saving,
  saved,
  children,
}: {
  title: string;
  description?: string;
  open: boolean;
  onToggle: () => void;
  saving: boolean;
  saved: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span>
          <span className="block text-sm font-semibold text-ink">{title}</span>
          {description ? (
            <span className="mt-0.5 block text-[12px] text-muted">
              {description}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="space-y-3 border-t border-line px-5 py-4">
          {children}
          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                `Save ${title}`
              )}
            </Button>
            {saved ? (
              <span className="text-[12px] text-emerald-600">Saved</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function WebhookUrlRow({ label, url }: { label: string; url: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={url} readOnly onFocus={(e) => e.target.select()} />
      <p className="mt-1 text-[11px] text-muted">
        Register this URL in the provider&apos;s webhook settings.
      </p>
    </div>
  );
}

const FUNCTIONS_BASE =
  "https://us-central1-shop-day84j.cloudfunctions.net";

export default function AdminIntegrationsPage() {
  const authUser = useUserStore((s) => s.authUser);
  const profile = useUserStore((s) => s.profile);
  const actor = {
    id: authUser?.uid ?? "",
    email: profile?.email ?? authUser?.email ?? undefined,
  };

  const [form, setForm] = useState({
    paystackEnabled: false,
    paystackSecretKey: "",
    korapayEnabled: false,
    korapaySecretKey: "",
    flutterwaveEnabled: false,
    flutterwaveSecretKey: "",
    squadEnabled: false,
    squadSandbox: true,
    squadSandboxSecretKey: "",
    squadLiveSecretKey: "",
    monnifyEnabled: false,
    monnifySandbox: true,
    monnifySandboxApiKey: "",
    monnifySandboxSecretKey: "",
    monnifySandboxContractCode: "",
    monnifyLiveApiKey: "",
    monnifyLiveSecretKey: "",
    monnifyLiveContractCode: "",
    bachsEnabled: false,
    bachsSandbox: true,
    bachsSandboxApiKey: "",
    bachsLiveApiKey: "",
    bachsSandboxWebhookSecret: "",
    bachsLiveWebhookSecret: "",
    codEnabled: true,
    codAllowedStates: "",
    makeWebhookUrl: "",
    transactionalEmailWebhookUrl: "",
  });
  const [configured, setConfigured] = useState<{
    paystack: boolean;
    korapay: boolean;
    flutterwave: boolean;
    squad: Record<string, boolean>;
    monnify: Record<string, boolean>;
    bachs: Record<string, boolean>;
  }>({
    paystack: false,
    korapay: false,
    flutterwave: false,
    squad: {},
    monnify: {},
    bachs: {},
  });
  const [open, setOpen] = useState<Record<ProviderKey, boolean>>({
    paystack: true,
    korapay: false,
    flutterwave: false,
    squad: false,
    monnify: false,
    bachs: false,
    cod: false,
    make: false,
  });
  const [saving, setSaving] = useState<ProviderKey | "all" | null>(null);
  const [saved, setSaved] = useState<Partial<Record<ProviderKey, boolean>>>({});

  useEffect(() => {
    // Copy any legacy paymentSecrets into the write-only collection and
    // remove them from the publicly-readable settings document.
    void migrateLegacyPaymentSecrets().catch(() => undefined);
    void fetch("/api/payment-settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setConfigured({
          paystack: Boolean(data.paystackKeyConfigured),
          korapay: Boolean(data.korapayKeyConfigured),
          flutterwave: Boolean(data.flutterwaveKeyConfigured),
          squad: data.squadKeyConfigured ?? {},
          monnify: data.monnifyKeyConfigured ?? {},
          bachs: data.bachsFieldsConfigured ?? {},
        });
      })
      .catch(() => undefined);
    void getAppSettings()
      .then((settings) => {
        if (!settings) return;
        setForm((f) => ({
          ...f,
          paystackEnabled: settings.payments?.paystackEnabled ?? false,
          korapayEnabled: settings.payments?.korapayEnabled ?? false,
          flutterwaveEnabled: settings.payments?.flutterwaveEnabled ?? false,
          squadEnabled: settings.payments?.squadEnabled ?? false,
          squadSandbox: settings.payments?.squadSandbox ?? true,
          monnifyEnabled: settings.payments?.monnifyEnabled ?? false,
          monnifySandbox: settings.payments?.monnifySandbox ?? true,
          bachsEnabled: settings.payments?.bachsEnabled ?? false,
          bachsSandbox: settings.payments?.bachsSandbox ?? true,
          codEnabled: settings.payments?.codEnabled ?? true,
          codAllowedStates: (
            settings.payments?.paymentOnDeliveryAllowedStates ?? []
          ).join(","),
          makeWebhookUrl: settings.notifications?.makeWebhookUrl ?? "",
          transactionalEmailWebhookUrl:
            settings.notifications?.transactionalEmailWebhookUrl ?? "",
        }));
      })
      .catch(() => undefined);
  }, []);

  const secretPlaceholder = (configuredFlag: boolean, label: string) =>
    configuredFlag
      ? "Configured — leave blank to keep existing key"
      : `Enter ${label} (not configured)`;

  /** Persist only the named provider's settings + secrets. */
  const saveProvider = async (provider: ProviderKey) => {
    switch (provider) {
      case "paystack":
        await updateAppSettings(
          { payments: { paystackEnabled: form.paystackEnabled } },
          actor,
        );
        await saveProviderSecrets({ paystackSecretKey: form.paystackSecretKey });
        break;
      case "korapay":
        await updateAppSettings(
          { payments: { korapayEnabled: form.korapayEnabled } },
          actor,
        );
        await saveProviderSecrets({ korapaySecretKey: form.korapaySecretKey });
        break;
      case "flutterwave":
        await updateAppSettings(
          { payments: { flutterwaveEnabled: form.flutterwaveEnabled } },
          actor,
        );
        await saveProviderSecrets({
          flutterwaveSecretKey: form.flutterwaveSecretKey,
        });
        break;
      case "squad":
        await updateAppSettings(
          {
            payments: {
              squadEnabled: form.squadEnabled,
              squadSandbox: form.squadSandbox,
            },
          },
          actor,
        );
        await saveSquadSecrets({
          sandboxSecretKey: form.squadSandboxSecretKey,
          liveSecretKey: form.squadLiveSecretKey,
        });
        break;
      case "monnify":
        await updateAppSettings(
          {
            payments: {
              monnifyEnabled: form.monnifyEnabled,
              monnifySandbox: form.monnifySandbox,
            },
          },
          actor,
        );
        await saveMonnifySecrets({
          sandboxApiKey: form.monnifySandboxApiKey,
          sandboxSecretKey: form.monnifySandboxSecretKey,
          sandboxContractCode: form.monnifySandboxContractCode,
          liveApiKey: form.monnifyLiveApiKey,
          liveSecretKey: form.monnifyLiveSecretKey,
          liveContractCode: form.monnifyLiveContractCode,
        });
        break;
      case "bachs":
        await updateAppSettings(
          {
            payments: {
              bachsEnabled: form.bachsEnabled,
              bachsSandbox: form.bachsSandbox,
            },
          },
          actor,
        );
        await saveBachsSecrets({
          sandboxApiKey: form.bachsSandboxApiKey,
          liveApiKey: form.bachsLiveApiKey,
          sandboxWebhookSecret: form.bachsSandboxWebhookSecret,
          liveWebhookSecret: form.bachsLiveWebhookSecret,
        });
        break;
      case "cod":
        await updateAppSettings(
          {
            payments: {
              codEnabled: form.codEnabled,
              paymentOnDeliveryAllowedStates: Array.from(
                new Set(
                  form.codAllowedStates
                    .split(",")
                    .map((s) => s.trim().replace(/\s+/g, " "))
                    .filter(Boolean),
                ),
              ),
            },
          },
          actor,
        );
        break;
      case "make":
        await updateAppSettings(
          {
            notifications: {
              makeWebhookUrl: form.makeWebhookUrl || undefined,
              transactionalEmailWebhookUrl:
                form.transactionalEmailWebhookUrl || undefined,
            },
          },
          actor,
        );
        break;
    }
  };

  const onSaveProvider = (provider: ProviderKey) => async (event: FormEvent) => {
    event.preventDefault();
    if (!actor.id || saving) return;
    setSaving(provider);
    try {
      await saveProvider(provider);
      clearPaymentProviderSettingsCache();
      setSaved((s) => ({ ...s, [provider]: true }));
      toastSuccess("Saved", `${provider} settings updated`);
    } catch (err) {
      toastError(
        "Save failed",
        err instanceof Error ? err.message : `Could not save ${provider}.`,
      );
    } finally {
      setSaving(null);
    }
  };

  const onSaveAll = async () => {
    if (!actor.id || saving) return;
    setSaving("all");
    const failed: ProviderKey[] = [];
    const done: Partial<Record<ProviderKey, boolean>> = {};
    for (const provider of PROVIDER_ORDER) {
      try {
        await saveProvider(provider);
        done[provider] = true;
      } catch {
        failed.push(provider);
      }
    }
    clearPaymentProviderSettingsCache();
    setSaved(done);
    if (failed.length) {
      toastError(
        "Some integrations were not saved",
        `Failed: ${failed.join(", ")}. Other changes were saved.`,
      );
    } else {
      toastSuccess("All integrations saved");
    }
    setSaving(null);
  };

  const toggle = (key: ProviderKey) =>
    setOpen((o) => ({ ...o, [key]: !o[key] }));

  return (
    <RequireAdmin permission="settings:write">
      <AdminPageHeader
        title="Payment &amp; Integrations"
        description="Payment providers, API credentials and webhook URLs. Secrets are stored in a write-only collection — blank fields keep saved values."
      />
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Paystack */}
        <form onSubmit={onSaveProvider("paystack")}>
          <ProviderPanel
            title="Paystack"
            description="Card, bank transfer and USSD via Paystack checkout."
            open={open.paystack}
            onToggle={() => toggle("paystack")}
            saving={saving === "paystack" || saving === "all"}
            saved={Boolean(saved.paystack)}
          >
            <Checkbox
              label="Paystack enabled"
              checked={form.paystackEnabled}
              onChange={() =>
                setForm((f) => ({ ...f, paystackEnabled: !f.paystackEnabled }))
              }
            />
            <div>
              <Label htmlFor="paystackSecret">Paystack Secret Key</Label>
              <Input
                id="paystackSecret"
                type="password"
                autoComplete="new-password"
                placeholder={secretPlaceholder(
                  configured.paystack,
                  "Paystack secret key",
                )}
                value={form.paystackSecretKey}
                onChange={(e) =>
                  setForm((f) => ({ ...f, paystackSecretKey: e.target.value }))
                }
              />
            </div>
            <WebhookUrlRow
              label="Paystack webhook URL"
              url={`${FUNCTIONS_BASE}/paystackWebhook`}
            />
          </ProviderPanel>
        </form>

        {/* KoraPay */}
        <form onSubmit={onSaveProvider("korapay")}>
          <ProviderPanel
            title="KoraPay"
            description="Card, bank transfer and USSD via KoraPay checkout."
            open={open.korapay}
            onToggle={() => toggle("korapay")}
            saving={saving === "korapay" || saving === "all"}
            saved={Boolean(saved.korapay)}
          >
            <Checkbox
              label="KoraPay enabled"
              checked={form.korapayEnabled}
              onChange={() =>
                setForm((f) => ({ ...f, korapayEnabled: !f.korapayEnabled }))
              }
            />
            <div>
              <Label htmlFor="korapaySecret">KoraPay Secret Key</Label>
              <Input
                id="korapaySecret"
                type="password"
                autoComplete="new-password"
                placeholder={secretPlaceholder(
                  configured.korapay,
                  "KoraPay secret key",
                )}
                value={form.korapaySecretKey}
                onChange={(e) =>
                  setForm((f) => ({ ...f, korapaySecretKey: e.target.value }))
                }
              />
            </div>
            <WebhookUrlRow
              label="KoraPay webhook URL"
              url={`${FUNCTIONS_BASE}/korapayWebhook`}
            />
          </ProviderPanel>
        </form>

        {/* Flutterwave */}
        <form onSubmit={onSaveProvider("flutterwave")}>
          <ProviderPanel
            title="Flutterwave"
            description="Flutterwave checkout (currently in preview)."
            open={open.flutterwave}
            onToggle={() => toggle("flutterwave")}
            saving={saving === "flutterwave" || saving === "all"}
            saved={Boolean(saved.flutterwave)}
          >
            <Checkbox
              label="Flutterwave enabled"
              checked={form.flutterwaveEnabled}
              onChange={() =>
                setForm((f) => ({
                  ...f,
                  flutterwaveEnabled: !f.flutterwaveEnabled,
                }))
              }
            />
            <div>
              <Label htmlFor="flutterwaveSecret">Flutterwave Secret Key</Label>
              <Input
                id="flutterwaveSecret"
                type="password"
                autoComplete="new-password"
                placeholder={secretPlaceholder(
                  configured.flutterwave,
                  "Flutterwave secret key",
                )}
                value={form.flutterwaveSecretKey}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    flutterwaveSecretKey: e.target.value,
                  }))
                }
              />
            </div>
          </ProviderPanel>
        </form>

        {/* Squad */}
        <form onSubmit={onSaveProvider("squad")}>
          <ProviderPanel
            title="Squad by GTBank"
            description="Squad hosted checkout — card, bank transfer, USSD."
            open={open.squad}
            onToggle={() => toggle("squad")}
            saving={saving === "squad" || saving === "all"}
            saved={Boolean(saved.squad)}
          >
            <Checkbox
              label="Squad enabled"
              checked={form.squadEnabled}
              onChange={() =>
                setForm((f) => ({ ...f, squadEnabled: !f.squadEnabled }))
              }
            />
            <Checkbox
              label="Use Squad sandbox (test payments)"
              checked={form.squadSandbox}
              onChange={() =>
                setForm((f) => ({ ...f, squadSandbox: !f.squadSandbox }))
              }
            />
            <div>
              <Label htmlFor="squadSandboxSecret">Squad Sandbox Secret Key</Label>
              <Input
                id="squadSandboxSecret"
                type="password"
                autoComplete="new-password"
                placeholder={secretPlaceholder(
                  Boolean(configured.squad.sandboxSecretKey),
                  "Squad sandbox secret key",
                )}
                value={form.squadSandboxSecretKey}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    squadSandboxSecretKey: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="squadLiveSecret">Squad Live Secret Key</Label>
              <Input
                id="squadLiveSecret"
                type="password"
                autoComplete="new-password"
                placeholder={secretPlaceholder(
                  Boolean(configured.squad.liveSecretKey),
                  "Squad live secret key",
                )}
                value={form.squadLiveSecretKey}
                onChange={(e) =>
                  setForm((f) => ({ ...f, squadLiveSecretKey: e.target.value }))
                }
              />
            </div>
            <WebhookUrlRow
              label="Squad webhook URL (API &amp; Webhook settings in the Squad dashboard)"
              url={`${FUNCTIONS_BASE}/squadWebhook`}
            />
          </ProviderPanel>
        </form>

        {/* Monnify */}
        <form onSubmit={onSaveProvider("monnify")}>
          <ProviderPanel
            title="Monnify"
            description="Monnify hosted checkout — card, bank transfer, USSD."
            open={open.monnify}
            onToggle={() => toggle("monnify")}
            saving={saving === "monnify" || saving === "all"}
            saved={Boolean(saved.monnify)}
          >
            <Checkbox
              label="Monnify enabled"
              checked={form.monnifyEnabled}
              onChange={() =>
                setForm((f) => ({ ...f, monnifyEnabled: !f.monnifyEnabled }))
              }
            />
            <Checkbox
              label="Use Monnify sandbox (test payments)"
              checked={form.monnifySandbox}
              onChange={() =>
                setForm((f) => ({ ...f, monnifySandbox: !f.monnifySandbox }))
              }
            />
            {(
              [
                ["monnifySandboxApiKey", "Monnify Sandbox API Key"],
                ["monnifySandboxSecretKey", "Monnify Sandbox Secret Key"],
                ["monnifySandboxContractCode", "Monnify Sandbox Contract Code"],
                ["monnifyLiveApiKey", "Monnify Live API Key"],
                ["monnifyLiveSecretKey", "Monnify Live Secret Key"],
                ["monnifyLiveContractCode", "Monnify Live Contract Code"],
              ] as const
            ).map(([field, label]) => {
              const configKey = field.replace(/^monnify/, "");
              const flagKey =
                configKey.charAt(0).toLowerCase() + configKey.slice(1);
              return (
                <div key={field}>
                  <Label htmlFor={field}>{label}</Label>
                  <Input
                    id={field}
                    type="password"
                    autoComplete="new-password"
                    placeholder={secretPlaceholder(
                      Boolean(configured.monnify[flagKey]),
                      label,
                    )}
                    value={form[field]}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [field]: e.target.value }))
                    }
                  />
                </div>
              );
            })}
            <WebhookUrlRow
              label="Monnify webhook URL"
              url={`${
                process.env.NEXT_PUBLIC_SITE_URL ??
                "https://www.shopbetaa.store"
              }/api/payments/monnify/webhook`}
            />
          </ProviderPanel>
        </form>

        {/* Bachs */}
        <form onSubmit={onSaveProvider("bachs")}>
          <ProviderPanel
            title="Bachs.io"
            description="Bachs hosted checkout — card, bank transfer, mobile money."
            open={open.bachs}
            onToggle={() => toggle("bachs")}
            saving={saving === "bachs" || saving === "all"}
            saved={Boolean(saved.bachs)}
          >
            <Checkbox
              label="Bachs enabled"
              checked={form.bachsEnabled}
              onChange={() =>
                setForm((f) => ({ ...f, bachsEnabled: !f.bachsEnabled }))
              }
            />
            <Checkbox
              label="Use Bachs sandbox (sk_sandbox_ keys)"
              checked={form.bachsSandbox}
              onChange={() =>
                setForm((f) => ({ ...f, bachsSandbox: !f.bachsSandbox }))
              }
            />
            <div>
              <Label htmlFor="bachsSandboxApiKey">Bachs Sandbox API Key</Label>
              <Input
                id="bachsSandboxApiKey"
                type="password"
                autoComplete="new-password"
                placeholder={secretPlaceholder(
                  Boolean(configured.bachs.sandboxApiKey),
                  "Bachs sandbox API key (sk_sandbox_…)",
                )}
                value={form.bachsSandboxApiKey}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bachsSandboxApiKey: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="bachsLiveApiKey">Bachs Live API Key</Label>
              <Input
                id="bachsLiveApiKey"
                type="password"
                autoComplete="new-password"
                placeholder={secretPlaceholder(
                  Boolean(configured.bachs.liveApiKey),
                  "Bachs live API key (sk_live_…)",
                )}
                value={form.bachsLiveApiKey}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bachsLiveApiKey: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="bachsSandboxWebhookSecret">
                Bachs Sandbox Webhook Signing Secret
              </Label>
              <Input
                id="bachsSandboxWebhookSecret"
                type="password"
                autoComplete="new-password"
                placeholder={secretPlaceholder(
                  Boolean(configured.bachs.sandboxWebhookSecret),
                  "sandbox webhook signing secret",
                )}
                value={form.bachsSandboxWebhookSecret}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    bachsSandboxWebhookSecret: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="bachsLiveWebhookSecret">
                Bachs Live Webhook Signing Secret
              </Label>
              <Input
                id="bachsLiveWebhookSecret"
                type="password"
                autoComplete="new-password"
                placeholder={secretPlaceholder(
                  Boolean(configured.bachs.liveWebhookSecret),
                  "live webhook signing secret",
                )}
                value={form.bachsLiveWebhookSecret}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    bachsLiveWebhookSecret: e.target.value,
                  }))
                }
              />
            </div>
            <WebhookUrlRow
              label="Bachs webhook URL (Developer Portal → Webhooks → Add destination)"
              url={`${FUNCTIONS_BASE}/bachsWebhook`}
            />
            <p className="text-[11px] text-muted">
              Subscribe to <code>collection.succeeded</code>,{" "}
              <code>collection.failed</code>, <code>checkout.completed</code>{" "}
              and <code>checkout.expired</code>. Copy the endpoint&apos;s
              signing secret into the matching field above.
            </p>
          </ProviderPanel>
        </form>

        {/* COD */}
        <form onSubmit={onSaveProvider("cod")}>
          <ProviderPanel
            title="Payment on Delivery (COD)"
            description="COD availability and the states it is offered in."
            open={open.cod}
            onToggle={() => toggle("cod")}
            saving={saving === "cod" || saving === "all"}
            saved={Boolean(saved.cod)}
          >
            <Checkbox
              label="Cash on delivery enabled"
              checked={form.codEnabled}
              onChange={() =>
                setForm((f) => ({ ...f, codEnabled: !f.codEnabled }))
              }
            />
            <div>
              <Label htmlFor="codAllowedStates">
                Allowed states (comma-separated)
              </Label>
              <Input
                id="codAllowedStates"
                value={form.codAllowedStates}
                onChange={(e) =>
                  setForm((f) => ({ ...f, codAllowedStates: e.target.value }))
                }
                placeholder="Lagos, Abuja, Rivers"
              />
              <p className="mt-1 text-[11px] text-muted">
                COD is only offered in these states. A 25% commitment fee is
                charged online before the order is confirmed.
              </p>
            </div>
          </ProviderPanel>
        </form>

        {/* Make.com */}
        <form onSubmit={onSaveProvider("make")}>
          <ProviderPanel
            title="Make.com"
            description="Order-notification and transactional-email webhooks."
            open={open.make}
            onToggle={() => toggle("make")}
            saving={saving === "make" || saving === "all"}
            saved={Boolean(saved.make)}
          >
            <div>
              <Label htmlFor="makeWebhookUrl">
                Make.com Order Email Webhook URL
              </Label>
              <Input
                id="makeWebhookUrl"
                type="url"
                placeholder="https://hook.us2.make.com/..."
                value={form.makeWebhookUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, makeWebhookUrl: e.target.value }))
                }
              />
              <p className="mt-1 text-[11px] text-muted">
                Notified after successful payments (existing order automation).
              </p>
            </div>
            <div>
              <Label htmlFor="transactionalEmailWebhookUrl">
                Transactional Email Webhook URL
              </Label>
              <Input
                id="transactionalEmailWebhookUrl"
                type="url"
                placeholder="https://hook.us2.make.com/..."
                value={form.transactionalEmailWebhookUrl}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    transactionalEmailWebhookUrl: e.target.value,
                  }))
                }
              />
              <p className="mt-1 text-[11px] text-muted">
                Dedicated Make.com webhook for admin-triggered transactional
                emails.
              </p>
            </div>
          </ProviderPanel>
        </form>

        <Button
          type="button"
          onClick={onSaveAll}
          disabled={Boolean(saving)}
          className="w-full"
        >
          {saving === "all" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Saving all…
            </>
          ) : (
            "Save all integrations"
          )}
        </Button>
      </div>
    </RequireAdmin>
  );
}
