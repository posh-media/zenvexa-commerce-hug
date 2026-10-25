import { useState } from "react";
import { callBackend } from "@/lib/firebase-client";
import type { MockOrder } from "./store-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function FirebaseOrderActions({ order }: { order: MockOrder }) {
  const [busy, setBusy] = useState(false);
  async function action(verify: boolean) {
    setBusy(true);
    try {
      if (verify) {
        const result = await callBackend<{ status: string }>("verifyPayment", {
          orderId: order.id,
        });
        toast.info(`Server payment status: ${result.status}`);
      } else {
        const result = await callBackend<{ authorizationUrl: string }>("initializePayment", {
          orderId: order.id,
        });
        const url = new URL(result.authorizationUrl);
        if (url.protocol !== "https:" || url.hostname !== "checkout.paystack.com")
          throw new Error("Unexpected checkout address.");
        window.location.assign(url.toString());
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payment action unavailable.");
    } finally {
      setBusy(false);
    }
  }
  if (order.backendStatus !== "pending_payment") return null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={busy} onClick={() => void action(false)}>
        Review total & open configured Paystack test checkout
      </Button>
      <Button variant="outline" disabled={busy} onClick={() => void action(true)}>
        Verify payment with server
      </Button>
      <p>
        No redirect or browser message confirms payment. Payments remain disabled until server test
        credentials are configured.
      </p>
    </div>
  );
}
