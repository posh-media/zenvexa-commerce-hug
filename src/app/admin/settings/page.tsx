"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { RequireAdmin } from "@/components/auth/require-admin";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label } from "@/components/ui/field";
import {
  getAppSettings,
  migrateLegacyPaymentSecrets,
  updateAppSettings,
} from "@/services/settings.service";
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
    orderEmailEnabled: true,
    promoPushEnabled: true,
    brandColor: "#FD4646",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Copy any legacy paymentSecrets into the write-only collection and
    // remove them from the publicly-readable settings document.
    void migrateLegacyPaymentSecrets().catch(() => undefined);
  }, []);

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
          orderEmailEnabled: settings.notifications?.orderEmailEnabled ?? true,
          promoPushEnabled: settings.notifications?.promoPushEnabled ?? true,
          brandColor: settings.theme?.brandColor ?? f.brandColor,
        }));
      })
      .catch(() => undefined);
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!actor.id) return;
    setSaving(true);
    try {
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
          notifications: {
            orderEmailEnabled: form.orderEmailEnabled,
            promoPushEnabled: form.promoPushEnabled,
          },
          theme: {
            brandColor: form.brandColor,
          },
        },
        actor,
      );
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
        description="General storefront and commerce settings. Payment providers and integration keys live under Payment &amp; Integrations."
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
          <h2 className="text-sm font-semibold text-ink">Payments &amp; integrations</h2>
          <p className="text-[12px] text-muted">
            Payment providers, API keys and webhook URLs have moved to{" "}
            <a href="/admin/integrations" className="text-primary underline">
              Payment &amp; Integrations
            </a>
            .
          </p>
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
