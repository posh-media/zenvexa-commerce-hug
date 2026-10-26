import type { Metadata } from "next";
import {
  CreditCard,
  Mail,
  MessageSquare,
  Package,
  Phone,
  RotateCcw,
  Search,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { buildListingMetadata } from "@/lib/seo";
import { faqs } from "@/lib/data";
import { PageHeader } from "@/components/layout/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, SectionHeading } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Accordion } from "@/components/ui/accordion";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = buildListingMetadata({
  title: "Help centre",
  description:
    "Delivery, returns, refunds and account help for Zenvexa customers.",
  path: "/help",
  keywords: ["help", "support", "returns", "delivery", "Zenvexa"],
});

const topics = [
  { icon: Truck, title: "Delivery", body: "Windows, costs and rescheduling" },
  { icon: Package, title: "Order help", body: "Changes, cancellations, missing items" },
  { icon: RotateCcw, title: "Returns", body: "How to send something back" },
  { icon: CreditCard, title: "Refunds", body: "Timelines and payment methods" },
  { icon: ShieldCheck, title: "Warranty", body: "Claims and repair status" },
  { icon: MessageSquare, title: "Account", body: "Login, security, preferences" },
];

const channels = [
  {
    icon: MessageSquare,
    title: "Live chat",
    body: "Fastest option. Average wait under 2 minutes.",
    action: "Start chat",
    note: "Online now",
  },
  {
    icon: Mail,
    title: "Email",
    body: "support@shopbeta.example — replies within 4 hours.",
    action: "Send email",
    note: "24/7",
  },
  {
    icon: Phone,
    title: "Phone",
    body: "+234 700 100 2000 — Mon to Sat, 08:00–20:00.",
    action: "Call support",
    note: "Open until 20:00",
  },
];

export default function HelpCenterPage() {
  return (
    <div className="sb-container">
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Help centre" }]}
        title="How can we help?"
        description="Search the guides, browse common questions, or talk to a human — whichever is quicker."
      />

      <Card className="mb-10">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <Input
              placeholder="Search help articles, e.g. “change delivery address”"
              aria-label="Search help articles"
              icon={<Search className="h-[18px] w-[18px]" />}
            />
          </div>
          <Button size="lg" className="sm:w-auto">
            Search
          </Button>
        </div>
      </Card>

      {/* Topics */}
      <section>
        <SectionHeading eyebrow="Guides" title="Browse by topic" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map(({ icon: Icon, title, body }) => (
            <button
              key={title}
              type="button"
              className="group flex items-start gap-4 rounded-2xl border border-line bg-white p-5 text-left transition-all duration-300 ease-premium hover:-translate-y-1 hover:border-transparent hover:sb-shadow-soft"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-50">
                <Icon className="h-5 w-5 text-primary" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold tracking-[-0.01em] text-ink">
                  {title}
                </span>
                <span className="mt-1 block text-[13px] text-muted">{body}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Contact channels */}
      <section className="pt-16 sm:pt-20">
        <SectionHeading
          eyebrow="Contact support"
          title="Talk to a person"
          description="Real people, based in Lagos and London. No phone trees."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          {channels.map(({ icon: Icon, title, body, action, note }) => (
            <Card key={title} className="flex flex-col">
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-soft">
                  <Icon className="h-5 w-5 text-ink" aria-hidden />
                </span>
                <Badge tone="success">{note}</Badge>
              </div>
              <h3 className="mt-5 text-[15px] font-semibold tracking-[-0.01em] text-ink">
                {title}
              </h3>
              <p className="mt-2 flex-1 text-[14px] leading-relaxed text-muted">{body}</p>
              <Button variant="outline" size="sm" className="mt-5 self-start">
                {action}
              </Button>
            </Card>
          ))}
        </div>
        <Alert tone="info" title="Live chat is a placeholder in this design" className="mt-4">
          The widget, transcript view and agent handoff are visual only — no chat service is
          connected.
        </Alert>
      </section>

      {/* FAQ */}
      <section className="pt-16 sm:pt-20">
        <SectionHeading
          eyebrow="FAQ"
          title="Frequently asked questions"
          description="The six questions support answers most often."
        />
        <Accordion items={faqs} />
      </section>

      {/* Contact form + policies */}
      <section className="grid gap-4 pt-16 lg:grid-cols-[1.3fr_1fr] sm:pt-20">
        <Card>
          <h2 className="text-[15px] font-semibold text-ink">Send us a message</h2>
          <p className="mt-1 text-[13px] text-muted">
            We reply to every message within four hours during opening times.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="h-name">Your name</Label>
              <Input id="h-name" placeholder="Amara Bello" />
            </div>
            <div>
              <Label htmlFor="h-email">Email</Label>
              <Input id="h-email" type="email" placeholder="you@example.com" />
            </div>
            <div>
              <Label htmlFor="h-order">Order number</Label>
              <Input id="h-order" placeholder="SB-72841" />
            </div>
            <div>
              <Label htmlFor="h-topic">Topic</Label>
              <Select id="h-topic">
                <option>Order help</option>
                <option>Delivery</option>
                <option>Returns and refunds</option>
                <option>Warranty claim</option>
                <option>Something else</option>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="h-message">Message</Label>
              <Textarea id="h-message" placeholder="Tell us what happened…" />
            </div>
          </div>
          <Button className="mt-6">Send message</Button>
        </Card>

        <div className="space-y-4">
          <Card>
            <h3 className="text-[15px] font-semibold text-ink">Returns policy</h3>
            <p className="mt-3 text-[14px] leading-relaxed text-muted">
              30 days on unopened items, 14 days on opened electronics with all accessories
              included. Start a return from Order History and we email a prepaid label
              immediately.
            </p>
          </Card>
          <Card>
            <h3 className="text-[15px] font-semibold text-ink">Refund policy</h3>
            <p className="mt-3 text-[14px] leading-relaxed text-muted">
              Refunds are issued to the original payment method within three working days of
              the item reaching our warehouse. Wallet refunds are instant.
            </p>
          </Card>
          <Card className="bg-soft/60">
            <h3 className="text-[15px] font-semibold text-ink">Still stuck?</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">
              Track an order to see exactly where it is before contacting us — it answers most
              questions.
            </p>
            <ButtonLink href="/track-order" variant="secondary" size="sm" className="mt-4">
              Track an order
            </ButtonLink>
          </Card>
        </div>
      </section>
    </div>
  );
}
