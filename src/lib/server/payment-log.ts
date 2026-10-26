/**
 * Structured payment logging (temporary verbose for flow diagnosis).
 */
import { reportEvent } from "@/lib/monitoring";

export type PaymentLogStage =
  | "checkout.button"
  | "checkout.order"
  | "init.request"
  | "init.admin"
  | "init.functions"
  | "init.paystack"
  | "init.korapay"
  | "init.success"
  | "init.redirect"
  | "init.failure"
  | "callback.start"
  | "callback.verify"
  | "callback.listener"
  | "callback.success"
  | "callback.failure"
  | "webhook.incoming"
  | "webhook.functions"
  | "webhook.signature"
  | "webhook.event"
  | "webhook.verify"
  | "webhook.firestore"
  | "webhook.make"
  | "webhook.success"
  | "webhook.failure"
  | "webhook.ignored";

export function paymentLog(
  stage: PaymentLogStage,
  message: string,
  meta?: Record<string, unknown>,
) {
  const level =
    stage.endsWith("failure") || stage === "webhook.signature"
      ? "error"
      : stage === "webhook.ignored"
        ? "warning"
        : "info";

  reportEvent({
    level,
    source: "payment",
    message: `[${stage}] ${message}`,
    code: stage,
    meta,
  });

  if (process.env.NODE_ENV !== "test") {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        payment: {
          at: new Date().toISOString(),
          stage,
          message,
          ...meta,
        },
      }),
    );
  }
}
