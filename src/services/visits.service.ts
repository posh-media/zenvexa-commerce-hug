import { COLLECTIONS } from "@/constants/collections";
import { getDb } from "@/firebase/firestore";
import { deploymentStoreId, scopedCounterId } from "@/lib/store";
import { storeDocuments } from "@/lib/store-queries";
import {
  collection,
  doc,
  increment,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

/**
 * Aggregated page-visit counters. Two small writes per visit:
 *   pageVisitTotals/{encodedPath} → { path, count, lastVisitAt }
 *   pageVisitDays/{YYYY-MM-DD}    → { date, count, updatedAt }
 * All-time total and top pages come from pageVisitTotals; today's count
 * comes from pageVisitDays.
 */

function encodePath(path: string) {
  return encodeURIComponent(path || "/");
}

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Record a public page visit. Fire-and-forget — never throws. */
export async function trackPageVisit(path: string) {
  try {
    if (!path || path.startsWith("/admin")) return;
    const db = getDb();
    await Promise.all([
      setDoc(
        doc(db, COLLECTIONS.pageVisitTotals, scopedCounterId(encodePath(path))),
        {
          path,
          storeId: deploymentStoreId(),
          count: increment(1),
          lastVisitAt: serverTimestamp(),
        },
        { merge: true },
      ),
      setDoc(
        doc(db, COLLECTIONS.pageVisitDays, scopedCounterId(todayKey())),
        {
          date: todayKey(),
          storeId: deploymentStoreId(),
          count: increment(1),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    ]);
  } catch {
    // Analytics must never break navigation.
  }
}

export type PageVisitStat = { path: string; count: number };

export async function getPageVisitStats(): Promise<{
  total: number;
  today: number;
  topPages: PageVisitStat[];
}> {
  const db = getDb();
  const [totals, days] = await Promise.all([
    storeDocuments(collection(db, COLLECTIONS.pageVisitTotals)),
    storeDocuments(collection(db, COLLECTIONS.pageVisitDays)),
  ]);
  const byPath = new Map<string, number>();
  for (const d of totals) {
    const data = d.data();
    const key = String(data.path ?? d.id);
    byPath.set(key, (byPath.get(key) || 0) + Number(data.count || 0));
  }
  const pages: PageVisitStat[] = Array.from(byPath, ([path, count]) => ({
    path,
    count,
  })).sort((a, b) => b.count - a.count);
  const today = days
    .filter((d) => (d.data().date ?? d.id) === todayKey())
    .reduce((n, d) => n + Number(d.data().count || 0), 0);

  return {
    total: pages.reduce((sum, p) => sum + p.count, 0),
    today: today,
    topPages: pages.slice(0, 10),
  };
}

/**
 * Sum pageVisitDays counters for every day key in [fromKey, toKey]
 * (YYYY-MM-DD, inclusive). One small aggregate doc exists per day.
 */
export async function getVisitsForDays(
  fromKey: string,
  toKey: string,
): Promise<number> {
  const db = getDb();
  const documents = await storeDocuments(
    collection(db, COLLECTIONS.pageVisitDays),
  );
  return documents.reduce((sum, d) => {
    const data = d.data() as { date?: string; count?: number };
    const key = String(data.date ?? d.id);
    if (key < fromKey || key > toKey) return sum;
    return sum + Number(data.count ?? 0);
  }, 0);
}
