/**
 * Production monitoring preparation.
 * Swap `setMonitoringSink` for Sentry / Datadog / LogRocket later.
 */

export type MonitoringLevel = "info" | "warning" | "error";

export type MonitoringEvent = {
  level: MonitoringLevel;
  source:
    | "api"
    | "payment"
    | "firestore"
    | "auth"
    | "client"
    | "storage"
    | "unknown";
  message: string;
  code?: string;
  meta?: Record<string, unknown>;
  at: string;
};

type MonitoringSink = (event: MonitoringEvent) => void | Promise<void>;

const buffer: MonitoringEvent[] = [];

let sink: MonitoringSink = (event) => {
  buffer.push(event);
  if (buffer.length > 200) buffer.shift();
  if (process.env.NODE_ENV === "development" && event.level !== "info") {
    // eslint-disable-next-line no-console
    console[event.level === "error" ? "error" : "warn"](
      `[monitor:${event.source}]`,
      event.message,
      event.meta ?? "",
    );
  }
};

export function setMonitoringSink(next: MonitoringSink) {
  sink = next;
}

export function reportEvent(
  partial: Omit<MonitoringEvent, "at"> & { at?: string },
) {
  const event: MonitoringEvent = {
    ...partial,
    at: partial.at ?? new Date().toISOString(),
  };
  try {
    void sink(event);
  } catch {
    // Never throw from monitoring.
  }
  return event;
}

export function reportApiError(
  message: string,
  meta?: Record<string, unknown>,
) {
  return reportEvent({ level: "error", source: "api", message, meta });
}

export function reportPaymentFailure(
  message: string,
  meta?: Record<string, unknown>,
) {
  return reportEvent({ level: "error", source: "payment", message, meta });
}

export function reportFirestoreFailure(
  message: string,
  meta?: Record<string, unknown>,
) {
  return reportEvent({ level: "error", source: "firestore", message, meta });
}

export function reportAuthError(
  message: string,
  meta?: Record<string, unknown>,
) {
  return reportEvent({ level: "error", source: "auth", message, meta });
}

export function reportClientException(
  error: unknown,
  meta?: Record<string, unknown>,
) {
  const message =
    error instanceof Error ? error.message : "Unknown client exception";
  return reportEvent({
    level: "error",
    source: "client",
    message,
    meta: {
      ...meta,
      stack: error instanceof Error ? error.stack : undefined,
    },
  });
}

export function getMonitoringBuffer() {
  return [...buffer];
}

export function clearMonitoringBuffer() {
  buffer.length = 0;
}
