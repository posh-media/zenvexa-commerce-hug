import type { Metadata } from "next";
import {
  Bell,
  Globe,
  Lock,
  Monitor,
  Moon,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  Wallet,
} from "lucide-react";
import { buildPrivateMetadata } from "@/lib/seo";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Label, Select, Toggle } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = buildPrivateMetadata(
  "Settings",
  "Account and preference settings.",
);

const themes = [
  { id: "light", label: "Light", icon: Sun, active: true },
  { id: "dark", label: "Dark", icon: Moon, active: false },
  { id: "system", label: "System", icon: Monitor, active: false },
];

const sessions = [
  { device: "MacBook Pro · Lagos", detail: "Chrome · active now", current: true },
  { device: "iPhone 16 Pro · Lagos", detail: "Zenvexa app · 2 hours ago", current: false },
  { device: "iPad Pro · Abuja", detail: "Safari · 3 days ago", current: false },
];

export default function SettingsPage() {
  return (
    <div className="sb-container">
      <PageHeader
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Profile", href: "/profile" },
          { label: "Settings" },
        ]}
        title="Settings"
        description="Appearance, language, currency, notifications, privacy and security."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Appearance */}
        <Card>
          <CardHeader
            title="Appearance"
            description="Theme switching is a visual placeholder in this design."
          />
          <div className="mt-5 grid grid-cols-3 gap-3">
            {themes.map(({ id, label, icon: Icon, active }) => (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                className={
                  active
                    ? "flex flex-col items-center gap-2.5 rounded-xl border-2 border-primary bg-primary-50/50 p-4 text-[13px] font-medium text-primary-700"
                    : "flex flex-col items-center gap-2.5 rounded-xl border border-line bg-white p-4 text-[13px] font-medium text-ink-soft transition-colors hover:border-ink/20"
                }
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </button>
            ))}
          </div>
          <div className="mt-6 border-t border-line pt-5">
            <Toggle
              label="Reduce motion"
              description="Turn off card lifts, fades and other transitions."
            />
            <Toggle
              label="Compact product grid"
              description="Fit more products per row on large screens."
            />
          </div>
        </Card>

        {/* Region */}
        <Card>
          <CardHeader
            title="Language & region"
            description="Affects prices, dates and delivery estimates."
          />
          <div className="mt-5 space-y-4">
            <div>
              <Label htmlFor="s-language">Language</Label>
              <Select id="s-language" defaultValue="English (UK)">
                <option>English (UK)</option>
                <option>English (US)</option>
                <option>Français</option>
                <option>Yorùbá</option>
                <option>Hausa</option>
                <option>Deutsch</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="s-currency">Currency</Label>
              <Select id="s-currency" defaultValue="USD — US Dollar">
                <option>USD — US Dollar</option>
                <option>NGN — Nigerian Naira</option>
                <option>GBP — Pound Sterling</option>
                <option>EUR — Euro</option>
                <option>GHS — Ghanaian Cedi</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="s-region">Delivery region</Label>
              <Select id="s-region" defaultValue="Lagos, Nigeria">
                <option>Lagos, Nigeria</option>
                <option>Abuja, Nigeria</option>
                <option>Accra, Ghana</option>
                <option>London, United Kingdom</option>
              </Select>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-soft/70 p-4">
              <Globe className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              <p className="text-[13px] text-muted">
                Prices shown include VAT where applicable.
              </p>
            </div>
          </div>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader
            title="Notification preferences"
            description="Choose what reaches you and where."
            action={<Bell className="h-[18px] w-[18px] text-primary" aria-hidden />}
          />
          <div className="mt-2 divide-y divide-line">
            <Toggle label="Order updates" description="Packing, dispatch and delivery" defaultChecked />
            <Toggle label="Delivery day reminders" description="A text on the morning of delivery" defaultChecked />
            <Toggle label="Price drops on saved items" description="Only for items in your wishlist" defaultChecked />
            <Toggle label="Flash sales and deals" description="Up to two emails a week" />
            <Toggle label="Product recommendations" description="Based on what you have viewed" />
            <Toggle label="Reviews reminders" description="A nudge two weeks after delivery" />
          </div>
        </Card>

        {/* Privacy */}
        <Card>
          <CardHeader
            title="Privacy"
            description="You control what is collected and kept."
            action={<ShieldCheck className="h-[18px] w-[18px] text-primary" aria-hidden />}
          />
          <div className="mt-2 divide-y divide-line">
            <Toggle label="Personalised recommendations" description="Use browsing history to rank products" defaultChecked />
            <Toggle label="Analytics cookies" description="Helps us find slow pages" defaultChecked />
            <Toggle label="Marketing cookies" description="Used for ad measurement" />
            <Toggle label="Share reviews publicly" description="Show your first name on reviews" defaultChecked />
          </div>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
            <Button variant="outline" size="sm">
              Download my data
            </Button>
            <Button variant="danger" size="sm">
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete account
            </Button>
          </div>
        </Card>

        {/* Security */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Security"
            description="Sign-in, two-factor authentication and active sessions."
            action={<Lock className="h-[18px] w-[18px] text-primary" aria-hidden />}
          />
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-line p-4">
                <div>
                  <p className="text-sm font-medium text-ink">Password</p>
                  <p className="mt-1 text-[13px] text-muted">Last changed 4 months ago</p>
                </div>
                <Button variant="outline" size="sm">
                  Change
                </Button>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-line p-4">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-ink">
                    Two-factor authentication
                    <Badge tone="success">On</Badge>
                  </p>
                  <p className="mt-1 text-[13px] text-muted">Authenticator app</p>
                </div>
                <Button variant="outline" size="sm">
                  Manage
                </Button>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-line p-4">
                <div>
                  <p className="text-sm font-medium text-ink">Payment PIN</p>
                  <p className="mt-1 text-[13px] text-muted">
                    Required for orders over $500
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  <Wallet className="h-4 w-4" aria-hidden />
                  Set up
                </Button>
              </div>
            </div>

            <div>
              <p className="mb-3 text-[13px] font-medium text-ink">Active sessions</p>
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                {sessions.map((session) => (
                  <li key={session.device} className="flex items-center gap-3 p-4">
                    <Smartphone className="h-[18px] w-[18px] shrink-0 text-muted" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {session.device}
                      </p>
                      <p className="mt-0.5 text-[13px] text-muted">{session.detail}</p>
                    </div>
                    {session.current ? (
                      <Badge tone="success">This device</Badge>
                    ) : (
                      <button
                        type="button"
                        className="shrink-0 text-[13px] font-medium text-primary hover:underline"
                      >
                        Sign out
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <Alert tone="warning" title="Sign out everywhere" className="mt-4">
                Ends every session except this one. You will need to sign in again on your other
                devices.
              </Alert>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
