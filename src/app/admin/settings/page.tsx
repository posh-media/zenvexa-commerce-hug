"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { RequireAdmin } from "@/components/auth/require-admin";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label } from "@/components/ui/field";
import { getAppSettings, updateAppSettings } from "@/services/settings.service";
import { saveMonnifySecrets } from "@/services/monnify-settings.service";
import { saveSquadSecrets } from "@/services/squad-settings.service";
import { clearPaymentProviderSettingsCache } from "@/services/payments.service";
import { useUserStore } from "@/stores/user.store";
import { toastError, toastSuccess } from "@/stores/toast.store";

export default function AdminSettingsPage() {
  const authUser = useUserStore((s) => s.authUser);
  const profile = useUserStore((s) => s.profile);
  const actor = {
    id: authUser?.uid ?? "",
    email: profile?.email ?? authUser?.email ?? undefined,
  };
  const [form, setForm] = useState({
    name: "",
    tagline: "",
    logoUrl: "",
    email: "",
    phone: "",
    whatsapp: "",
    facebook: "",
    instagram: "",
    twitter: "",
    taxRate: "0.075",
    countries: "Nigeria,Ghana,Kenya",
    codEnabled: true,
    codAllowedStates: "",
    paystackEnabled: false,
    korapayEnabled: false,
    monnifyEnabled: false,
    monnifySandbox: true,
    monnifySandboxApiKey: "",
    monnifySandboxSecretKey: "",
    monnifySandboxContractCode: "",
    monnifyLiveApiKey: "",
    monnifyLiveSecretKey: "",
    monnifyLiveContractCode: "",
    squadEnabled: false,
    squadSandbox: true,
    squadSandboxSecretKey: "",
    squadLiveSecretKey: "",
    flutterwaveEnabled: false,
    orderEmailEnabled: true,
    promoPushEnabled: true,
    brandColor: "#FD4646",
    makeWebhookUrl: "",
    transactionalEmailWebhookUrl: "",
    paystackSecretKey: "",
    korapaySecretKey: "",
    flutterwaveSecretKey: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getAppSettings()
      .then((settings) => {
        if (!settings) return;
        setForm((f) => ({
          ...f,
          name: settings.storeInformation?.name ?? f.name,
          tagline: settings.storeInformation?.tagline ?? f.tagline,
          logoUrl: settings.storeInformation?.logoUrl ?? f.logoUrl,
          email: settings.contactDetails?.email ?? f.email,
          phone: settings.contactDetails?.phone ?? f.phone,
          whatsapp: settings.contactDetails?.whatsapp ?? f.whatsapp,
          facebook: settings.socialLinks?.facebook ?? f.facebook,
          instagram: settings.socialLinks?.instagram ?? f.instagram,
          twitter: settings.socialLinks?.twitter ?? f.twitter,
          taxRate: String(settings.taxRate ?? 0.075),
          countries: (settings.supportedCountries ?? []).join(",") || f.countries,
          codEnabled: settings.payments?.codEnabled ?? true,
          codAllowedStates: (settings.payments?.paymentOnDeliveryAllowedStates ?? []).join(","),
          paystackEnabled: settings.payments?.paystackEnabled ?? false,
          korapayEnabled: settings.payments?.korapayEnabled ?? false,
          monnifyEnabled: settings.payments?.monnifyEnabled ?? false,
          monnifySandbox: settings.payments?.monnifySandbox ?? true,
          squadEnabled: settings.payments?.squadEnabled ?? false,
          squadSandbox: settings.payments?.squadSandbox ?? true,
          flutterwaveEnabled: settings.payments?.flutterwaveEnabled ?? false,
          orderEmailEnabled: settings.notifications?.orderEmailEnabled ?? true,
          promoPushEnabled: settings.notifications?.promoPushEnabled ?? true,
          brandColor: settings.theme?.brandColor ?? f.brandColor,
          makeWebhookUrl: settings.notifications?.makeWebhookUrl ?? "",
          transactionalEmailWebhookUrl: settings.notifications?.transactionalEmailWebhookUrl ?? "",
          paystackSecretKey: "", // Never pre-fill secret keys
          korapaySecretKey: "", // Never pre-fill secret keys
          flutterwaveSecretKey: "", // Never pre-fill secret keys
        }));
      })
      .catch(() => undefined);
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!actor.id) return;
    setSaving(true);
    try {
      await saveMonnifySecrets({
        sandboxApiKey: form.monnifySandboxApiKey,
        sandboxSecretKey: form.monnifySandboxSecretKey,
        sandboxContractCode: form.monnifySandboxContractCode,
        liveApiKey: form.monnifyLiveApiKey,
        liveSecretKey: form.monnifyLiveSecretKey,
        liveContractCode: form.monnifyLiveContractCode,
      });
      await saveSquadSecrets({ sandboxSecretKey: form.squadSandboxSecretKey, liveSecretKey: form.squadLiveSecretKey });
      await updateAppSettings(
        {
          storeInformation: {
            name: form.name,
            tagline: form.tagline,
            logoUrl: form.logoUrl || undefined,
          },
          contactDetails: {
            email: form.email,
            phone: form.phone,
            whatsapp: form.whatsapp || undefined,
          },
          socialLinks: {
            facebook: form.facebook || undefined,
            instagram: form.instagram || undefined,
            twitter: form.twitter || undefined,
          },
          supportedCountries: form.countries
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean),
          taxRate: Number(form.taxRate) || 0.075,
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
            paystackEnabled: form.paystackEnabled,
            korapayEnabled: form.korapayEnabled,
            monnifyEnabled: form.monnifyEnabled,
            monnifySandbox: form.monnifySandbox,
            squadEnabled: form.squadEnabled,
            squadSandbox: form.squadSandbox,
            flutterwaveEnabled: form.flutterwaveEnabled,
          },
          paymentSecrets: {
            ...(form.paystackSecretKey ? { paystackSecretKey: form.paystackSecretKey } : {}),
            ...(form.korapaySecretKey ? { korapaySecretKey: form.korapaySecretKey } : {}),
            ...(form.flutterwaveSecretKey ? { flutterwaveSecretKey: form.flutterwaveSecretKey } : {}),
          },
          notifications: {
            orderEmailEnabled: form.orderEmailEnabled,
            promoPushEnabled: form.promoPushEnabled,
            makeWebhookUrl: form.makeWebhookUrl || undefined,
            transactionalEmailWebhookUrl: form.transactionalEmailWebhookUrl || undefined,
          },
          theme: {
            brandColor: form.brandColor,
          },
        },
        actor,
      );
      setForm(f => ({ ...f, squadSandboxSecretKey: "", squadLiveSecretKey: "", monnifySandboxApiKey: "", monnifySandboxSecretKey: "", monnifySandboxContractCode: "", monnifyLiveApiKey: "", monnifyLiveSecretKey: "", monnifyLiveContractCode: "" }));
      clearPaymentProviderSettingsCache();
      toastSuccess("Settings saved");
    } catch (err) {
      toastError(
        "Save failed",
        err instanceof Error ? err.message : "Could not save settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <RequireAdmin permission="settings:write">
      <AdminPageHeader
        title="Store settings"
        description="General, commerce and payment toggles. Secret Paystack keys stay in environment variables only."
      />
      <form
        onSubmit={onSubmit}
        className="mx-auto max-w-2xl space-y-6 rounded-2xl border border-line bg-white p-5"
      >
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">General</h2>
          <div>
            <Label htmlFor="name">Store name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              value={form.tagline}
              onChange={(e) =>
                setForm((f) => ({ ...f, tagline: e.target.value }))
              }
            />
          </div>
          <ImageUploadField
            label="Logo"
            folder="misc"
            value={form.logoUrl}
            onChange={(url) => setForm((f) => ({ ...f, logoUrl: url }))}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">Contact</h2>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input
              id="whatsapp"
              value={form.whatsapp}
              onChange={(e) =>
                setForm((f) => ({ ...f, whatsapp: e.target.value }))
              }
            />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">Social</h2>
          <Input
            placeholder="Facebook URL"
            value={form.facebook}
            onChange={(e) =>
              setForm((f) => ({ ...f, facebook: e.target.value }))
            }
          />
          <Input
            placeholder="Instagram URL"
            value={form.instagram}
            onChange={(e) =>
              setForm((f) => ({ ...f, instagram: e.target.value }))
            }
          />
          <Input
            placeholder="Twitter / X URL"
            value={form.twitter}
            onChange={(e) => setForm((f) => ({ ...f, twitter: e.target.value }))}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">Commerce</h2>
          <div>
            <Label htmlFor="tax">Tax rate</Label>
            <Input
              id="tax"
              value={form.taxRate}
              onChange={(e) =>
                setForm((f) => ({ ...f, taxRate: e.target.value }))
              }
            />
          </div>
          <div>
            <Label htmlFor="countries">Supported countries (comma-separated)</Label>
            <Input
              id="countries"
              value={form.countries}
              onChange={(e) =>
                setForm((f) => ({ ...f, countries: e.target.value }))
              }
            />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">Payments</h2>
          <p className="text-[12px] text-muted">
            Configure payment providers. Secret keys are stored securely in Firestore and never exposed to the client.
          </p>
          
          <div className="space-y-3">
            <h3 className="text-[13px] font-medium text-ink">Provider Availability</h3>
            <Checkbox
              label="Paystack enabled"
              checked={form.paystackEnabled}
              onChange={() =>
                setForm((f) => ({ ...f, paystackEnabled: !f.paystackEnabled }))
              }
            />
            <Checkbox
              label="KoraPay enabled"
              checked={form.korapayEnabled}
              onChange={() =>
                setForm((f) => ({ ...f, korapayEnabled: !f.korapayEnabled }))
              }
            />
            <Checkbox
              label="Squad by GTBank enabled"
              checked={form.squadEnabled}
              onChange={() => setForm(f => ({ ...f, squadEnabled: !f.squadEnabled }))}
            />
            <Checkbox
              label="Flutterwave enabled"
              checked={form.flutterwaveEnabled}
              onChange={() =>
                setForm((f) => ({ ...f, flutterwaveEnabled: !f.flutterwaveEnabled }))
              }
            />
            <Checkbox
              label="Cash on delivery enabled"
              checked={form.codEnabled}
              onChange={() =>
                setForm((f) => ({ ...f, codEnabled: !f.codEnabled }))
              }
            />
            <div>
              <Label htmlFor="codAllowedStates">
                Payment on Delivery — allowed states (comma-separated)
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
                COD is only offered in these states. A 25% commitment fee is charged online before the order is confirmed. Leave empty to disable COD everywhere.
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-line p-4">
            <h3 className="text-[13px] font-medium text-ink">Monnify</h3>
            <Checkbox label="Monnify enabled" checked={form.monnifyEnabled} onChange={() => setForm(f => ({ ...f, monnifyEnabled: !f.monnifyEnabled }))} />
            <Checkbox label="Use Monnify sandbox (test payments)" checked={form.monnifySandbox} onChange={() => setForm(f => ({ ...f, monnifySandbox: !f.monnifySandbox }))} />
            <p className="text-[12px] text-muted">Save API key, secret key and contract code for the selected environment before enabling Monnify. Blank fields keep saved values.</p>
            <div><Label htmlFor="monnifySandboxApiKey">Monnify Sandbox API Key</Label>
              <Input id="monnifySandboxApiKey" type="password" autoComplete="new-password" value={form.monnifySandboxApiKey} placeholder="Enter Monnify sandbox api key" onChange={e => setForm(f => ({ ...f, monnifySandboxApiKey: e.target.value }))} /></div>
            <div><Label htmlFor="monnifySandboxSecretKey">Monnify Sandbox Secret Key</Label>
              <Input id="monnifySandboxSecretKey" type="password" autoComplete="new-password" value={form.monnifySandboxSecretKey} placeholder="Enter Monnify sandbox secret key" onChange={e => setForm(f => ({ ...f, monnifySandboxSecretKey: e.target.value }))} /></div>
            <div><Label htmlFor="monnifySandboxContractCode">Monnify Sandbox Contract Code</Label>
              <Input id="monnifySandboxContractCode" type="password" autoComplete="new-password" value={form.monnifySandboxContractCode} placeholder="Enter Monnify sandbox contract code" onChange={e => setForm(f => ({ ...f, monnifySandboxContractCode: e.target.value }))} /></div>
            <div><Label htmlFor="monnifyLiveApiKey">Monnify Live API Key</Label>
              <Input id="monnifyLiveApiKey" type="password" autoComplete="new-password" value={form.monnifyLiveApiKey} placeholder="Enter Monnify live api key" onChange={e => setForm(f => ({ ...f, monnifyLiveApiKey: e.target.value }))} /></div>
            <div><Label htmlFor="monnifyLiveSecretKey">Monnify Live Secret Key</Label>
              <Input id="monnifyLiveSecretKey" type="password" autoComplete="new-password" value={form.monnifyLiveSecretKey} placeholder="Enter Monnify live secret key" onChange={e => setForm(f => ({ ...f, monnifyLiveSecretKey: e.target.value }))} /></div>
            <div><Label htmlFor="monnifyLiveContractCode">Monnify Live Contract Code</Label>
              <Input id="monnifyLiveContractCode" type="password" autoComplete="new-password" value={form.monnifyLiveContractCode} placeholder="Enter Monnify live contract code" onChange={e => setForm(f => ({ ...f, monnifyLiveContractCode: e.target.value }))} /></div>
          </div>
          <div className="space-y-3">
            <h3 className="text-[13px] font-medium text-ink">Squad by GTBank</h3>
            <Checkbox label="Use Squad sandbox (test payments)"
              checked={form.squadSandbox}
              onChange={() => setForm(f => ({ ...f, squadSandbox: !f.squadSandbox }))} />
            <p className="text-[11px] text-muted">
              Save the key for the selected environment before enabling Squad. Leave a key blank to keep its saved value.
            </p>
            <div>
              <Label htmlFor="squadSandboxSecret">Squad Sandbox Secret Key</Label>
              <Input id="squadSandboxSecret" type="password" autoComplete="new-password"
                value={form.squadSandboxSecretKey} placeholder="Enter Squad sandbox secret key"
                onChange={e => setForm(f => ({ ...f, squadSandboxSecretKey: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="squadLiveSecret">Squad Live Secret Key</Label>
              <Input id="squadLiveSecret" type="password" autoComplete="new-password"
                value={form.squadLiveSecretKey} placeholder="Enter Squad live secret key"
                onChange={e => setForm(f => ({ ...f, squadLiveSecretKey: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-[13px] font-medium text-ink">Secret Keys</h3>
            <p className="text-[11px] text-muted">
              Enter secret keys to configure payment providers. Keys are stored securely and never displayed after saving.
            </p>
            <div>
              <Label htmlFor="paystackSecret">Paystack Secret Key</Label>
              <Input
                id="paystackSecret"
                type="password"
                placeholder="Enter Paystack secret key"
                value={form.paystackSecretKey}
                onChange={(e) =>
                  setForm((f) => ({ ...f, paystackSecretKey: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="korapaySecret">KoraPay Secret Key</Label>
              <Input
                id="korapaySecret"
                type="password"
                placeholder="Enter KoraPay secret key"
                value={form.korapaySecretKey}
                onChange={(e) =>
                  setForm((f) => ({ ...f, korapaySecretKey: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="flutterwaveSecret">Flutterwave Secret Key</Label>
              <Input
                id="flutterwaveSecret"
                type="password"
                placeholder="Enter Flutterwave secret key"
                value={form.flutterwaveSecretKey}
                onChange={(e) =>
                  setForm((f) => ({ ...f, flutterwaveSecretKey: e.target.value }))
                }
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">Notifications</h2>
          <Checkbox
            label="Order email templates enabled (structure)"
            checked={form.orderEmailEnabled}
            onChange={() =>
              setForm((f) => ({
                ...f,
                orderEmailEnabled: !f.orderEmailEnabled,
              }))
            }
          />
          <Checkbox
            label="Promo push settings enabled"
            checked={form.promoPushEnabled}
            onChange={() =>
              setForm((f) => ({
                ...f,
                promoPushEnabled: !f.promoPushEnabled,
              }))
            }
          />
          <div>
            <Label htmlFor="makeWebhookUrl">Make.com Order Email Webhook URL</Label>
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
              The Make.com webhook URL notified after successful payments (existing order automation).
            </p>
          </div>
          <div>
            <Label htmlFor="transactionalEmailWebhookUrl">Transactional Email Webhook URL</Label>
            <Input
              id="transactionalEmailWebhookUrl"
              type="url"
              placeholder="https://hook.us2.make.com/..."
              value={form.transactionalEmailWebhookUrl}
              onChange={(e) =>
                setForm((f) => ({ ...f, transactionalEmailWebhookUrl: e.target.value }))
              }
            />
            <p className="mt-1 text-[11px] text-muted">
              Dedicated Make.com webhook for admin-triggered transactional emails (e.g. the &quot;Send Email&quot; button in Admin Orders).
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">Theme</h2>
          <div>
            <Label htmlFor="color">Brand color</Label>
            <Input
              id="color"
              value={form.brandColor}
              onChange={(e) =>
                setForm((f) => ({ ...f, brandColor: e.target.value }))
              }
            />
          </div>
        </section>

        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </form>
    </RequireAdmin>
  );
}
