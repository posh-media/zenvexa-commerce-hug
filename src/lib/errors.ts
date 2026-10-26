/**
 * Shared user-facing error messages for Firestore, auth, and network failures.
 */

export type AppErrorKind =
  | "firestore"
  | "auth"
  | "network"
  | "permission"
  | "not-found"
  | "validation"
  | "unknown";

const MESSAGES: Record<AppErrorKind, string> = {
  firestore: "We couldn’t reach the catalogue. Please try again shortly.",
  auth: "Sign-in failed. Check your details and try again.",
  network: "Network error. Check your connection and retry.",
  permission: "You don’t have permission to do that.",
  "not-found": "We couldn’t find what you were looking for.",
  validation: "Please check the highlighted fields and try again.",
  unknown: "Something went wrong. Please try again.",
};

export function messageForErrorKind(kind: AppErrorKind): string {
  return MESSAGES[kind];
}

/** Map Firebase / Auth error codes to a friendly kind. */
export function classifyError(error: unknown): AppErrorKind {
  if (!error || typeof error !== "object") return "unknown";
  const code =
    "code" in error && typeof (error as { code: unknown }).code === "string"
      ? (error as { code: string }).code
      : "";

  if (
    code.startsWith("auth/") ||
    code === "permission-denied" ||
    code.includes("unauthenticated")
  ) {
    if (code === "permission-denied") return "permission";
    return "auth";
  }
  if (
    code === "unavailable" ||
    code === "deadline-exceeded" ||
    code.includes("network")
  ) {
    return "network";
  }
  if (code === "not-found") return "not-found";
  if (code.startsWith("firestore/") || code.includes("firestore")) {
    return "firestore";
  }
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return "network";
  }
  return "unknown";
}

export function friendlyErrorMessage(error: unknown, fallback?: string): string {
  const kind = classifyError(error);
  if (kind === "unknown" && fallback) return fallback;
  return messageForErrorKind(kind);
}
