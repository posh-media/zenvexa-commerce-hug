"use client";

import { useEffect } from "react";
import { reportClientException } from "@/lib/monitoring";

/** Catch unhandled client errors and route them to the monitoring sink. */
export function ClientErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      reportClientException(event.error ?? event.message, {
        filename: event.filename,
        lineno: event.lineno,
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      reportClientException(event.reason, { type: "unhandledrejection" });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
