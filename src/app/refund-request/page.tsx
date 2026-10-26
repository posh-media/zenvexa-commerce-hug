"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/field";

const SUPPORT_EMAIL = "info.shopbeta.store@shopbetaa.store";

const REFUND_REASONS = [
  "Item arrived damaged or defective",
  "Wrong item delivered",
  "Item not delivered",
  "Changed my mind",
  "Duplicate payment",
  "Other",
];

const MAILTO_BODY_LIMIT = 1800;

type TrackedOrder = {
  orderNumber?: string;
  id?: string;
  total?: number;
  customer?: { name?: string; email?: string; phone?: string };
  paymentStatus?: string;
  paymentMethod?: string;
  paymentReference?: string;
  paymentGateway?: string;
};

function RefundRequestForm() {
  const searchParams = useSearchParams();
  const initialOrder = searchParams.get("order") ?? "";

  const [orderId, setOrderId] = useState(initialOrder);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [orderTotal, setOrderTotal] = useState("");
  const [reason, setReason] = useState(REFUND_REASONS[0]!);
  const [details, setDetails] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draftOpened, setDraftOpened] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(false);

  // Prefill order/customer details when arriving with an order number.
  useEffect(() => {
    const value = initialOrder.trim();
    if (!value) return;
    let cancelled = false;
    setLoadingOrder(true);
    void fetch(`/api/track-order?order=${encodeURIComponent(value)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data?.ok || !data.order) return;
        const order = data.order as TrackedOrder;
        setOrderId(order.orderNumber ?? order.id ?? value);
        if (order.customer?.name) setName((v) => v || order.customer!.name!);
        if (order.customer?.email) setEmail((v) => v || order.customer!.email!);
        if (typeof order.total === "number") {
          setOrderTotal(formatPrice(order.total));
        }
        if (order.paymentReference) {
          setTransactionRef((v) => v || order.paymentReference!);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingOrder(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialOrder]);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!orderId.trim()) next.orderId = "Order ID is required.";
    if (!name.trim()) next.name = "Your name is required.";
    if (!email.trim() || !email.includes("@"))
      next.email = "A valid email address is required.";
    if (!orderTotal.trim()) next.orderTotal = "Order total is required.";
    if (!reason.trim()) next.reason = "Select a reason.";
    if (!details.trim() || details.trim().length < 10)
      next.details = "Please explain the issue in at least 10 characters.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = () => {
    setDraftOpened(false);
    if (!validate()) return;

    const subject = `Refund Request - ${orderId.trim()}`;
    const bodyLines = [
      "Dear Zenvexa Support,",
      "",
      "I would like to request a refund for the order below.",
      "",
      `Order ID: ${orderId.trim()}`,
      `Customer name: ${name.trim()}`,
      `Customer email: ${email.trim()}`,
      `Order total: ${orderTotal.trim()}`,
      transactionRef.trim()
        ? `Payment reference: ${transactionRef.trim()}`
        : null,
      `Reason: ${reason}`,
      "",
      "Details:",
      details.trim(),
      "",
      "Thank you.",
    ].filter((line): line is string => line !== null);

    let body = bodyLines.join("\n");
    if (body.length > MAILTO_BODY_LIMIT) {
      body = `${body.slice(0, MAILTO_BODY_LIMIT)}\n\n[Message truncated — please include full details in your reply.]`;
    }

    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    setDraftOpened(true);
  };

  return (
    <div className="sb-container">
      <PageHeader
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Orders", href: "/orders" },
          { label: "Refund request" },
        ]}
        title="Request a refund"
        description="Fill in the details below and we will prepare an email draft for you to send to our support team."
      />

      <Card className="mx-auto max-w-2xl">
        {loadingOrder ? (
          <p className="mb-4 text-[13px] text-muted">Loading order details…</p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="orderId">Order ID</Label>
            <Input
              id="orderId"
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              placeholder="SB-…"
            />
            {errors.orderId ? (
              <p className="mt-1 text-[12px] text-primary">{errors.orderId}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="orderTotal">Order total</Label>
            <Input
              id="orderTotal"
              value={orderTotal}
              onChange={(event) => setOrderTotal(event.target.value)}
              placeholder="₦0"
            />
            {errors.orderTotal ? (
              <p className="mt-1 text-[12px] text-primary">{errors.orderTotal}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Full name"
            />
            {errors.name ? (
              <p className="mt-1 text-[12px] text-primary">{errors.name}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="email">Your email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
            {errors.email ? (
              <p className="mt-1 text-[12px] text-primary">{errors.email}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="reason">Reason for refund</Label>
            <Select
              id="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            >
              {REFUND_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
            {errors.reason ? (
              <p className="mt-1 text-[12px] text-primary">{errors.reason}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="transactionRef" hint="Optional">
              Payment reference
            </Label>
            <Input
              id="transactionRef"
              value={transactionRef}
              onChange={(event) => setTransactionRef(event.target.value)}
              placeholder="If known"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="details">Explain the issue</Label>
            <Textarea
              id="details"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Tell us what happened, when the order arrived, and what went wrong."
            />
            {errors.details ? (
              <p className="mt-1 text-[12px] text-primary">{errors.details}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-6">
          <Button onClick={submit} className="w-full sm:w-auto">
            <Mail className="h-4 w-4" aria-hidden />
            Prepare refund request email
          </Button>
          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            This opens a prepared email in your mail app addressed to{" "}
            {SUPPORT_EMAIL}. Review it, then press send — your request is only
            submitted once you send the email.
          </p>
          {draftOpened ? (
            <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800" role="status">
              An email draft should now be open in your mail app. If nothing
              opened, email us directly at {SUPPORT_EMAIL} with your order ID
              and refund details.
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

export default function RefundRequestPage() {
  return (
    <Suspense
      fallback={
        <div className="sb-container py-16 text-center text-sm text-muted">
          Loading…
        </div>
      }
    >
      <RefundRequestForm />
    </Suspense>
  );
}
