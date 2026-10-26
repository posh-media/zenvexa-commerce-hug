/** Payment purpose marker on `payments` docs used for COD commitment fees. */
export const COD_FEE_PURPOSE = "cod_commitment_fee";

export const COD_FEE_RATE = 0.25;

/** Normalize a state/region name for comparison (trim + case-insensitive). */
export function normalizeStateName(state?: string | null): string {
  return String(state ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Normalize a configured allowed-states list (dedupe, drop blanks). */
export function normalizeAllowedStates(states?: unknown): string[] {
  if (!Array.isArray(states)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of states) {
    const name = String(raw ?? "").trim().replace(/\s+/g, " ");
    if (!name) continue;
    const key = normalizeStateName(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function isCodStateAllowed(
  allowedStates: string[] | undefined,
  state?: string | null,
): boolean {
  const normalized = normalizeAllowedStates(allowedStates);
  if (!normalized.length || !state?.trim()) return false;
  const key = normalizeStateName(state);
  return normalized.some((s) => normalizeStateName(s) === key);
}

/** Required COD commitment fee — 25% of the authoritative order total, rounded up. */
export function computeCodCommitmentFee(orderTotal: number): number {
  const total = Number(orderTotal);
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.ceil(total * COD_FEE_RATE);
}
