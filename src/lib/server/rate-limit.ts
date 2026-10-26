/**
 * Lightweight in-memory rate limiter for serverless routes.
 * Prepare for Redis / Upstash in production multi-instance deploys.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
};

export function rateLimit(input: {
  key: string;
  limit?: number;
  windowMs?: number;
}): RateLimitResult {
  const limit = input.limit ?? 30;
  const windowMs = input.windowMs ?? 60_000;
  const now = Date.now();
  const existing = buckets.get(input.key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(input.key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: Math.max(0, existing.resetAt - now),
    };
  }

  existing.count += 1;
  return {
    ok: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterMs: 0,
  };
}

export function clientKeyFromRequest(request: Request, suffix: string) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `${suffix}:${ip}`;
}

/** Sanitize errors so secrets / stack traces are not returned to clients. */
export function publicErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  const message = error.message || fallback;
  // Allow actionable config guidance without leaking secret values.
  if (/FIREBASE_SERVICE_ACCOUNT|GOOGLE_APPLICATION_CREDENTIALS|not configured/i.test(message)) {
    return message.slice(0, 240);
  }
  if (/secret|credential|api\.key|token|private.?key/i.test(message)) {
    return fallback;
  }
  return message.slice(0, 240);
}
