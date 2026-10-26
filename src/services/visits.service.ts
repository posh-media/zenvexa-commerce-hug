import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getDb } from "@/firebase/firestore";
import { COLLECTIONS } from "@/constants/collections";

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
        doc(db, COLLECTIONS.pageVisitTotals, encodePath(path)),
        {
          path,
          count: increment(1),
          lastVisitAt: serverTimestamp(),
        },
        { merge: true },
      ),
      setDoc(
        doc(db, COLLECTIONS.pageVisitDays, todayKey()),
        {
          date: todayKey(),
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
  const [totalsSnap, todaySnap] = await Promise.all([
    getDocs(collection(db, COLLECTIONS.pageVisitTotals)),
    getDoc(doc(db, COLLECTIONS.pageVisitDays, todayKey())),
  ]);

  const pages: PageVisitStat[] = totalsSnap.docs
    .map((d) => {
      const data = d.data() as { path?: string; count?: number };
      return { path: data.path ?? d.id, count: Number(data.count ?? 0) };
    })
    .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));

  const todayData = todaySnap?.exists()
    ? (todaySnap.data() as { count?: number })
    : undefined;

  return {
    total: pages.reduce((sum, p) => sum + p.count, 0),
    today: Number(todayData?.count ?? 0),
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
  const snap = await getDocs(collection(db, COLLECTIONS.pageVisitDays));
  return snap.docs.reduce((sum, d) => {
    const data = d.data() as { date?: string; count?: number };
    const key = String(data.date ?? d.id);
    if (key < fromKey || key > toKey) return sum;
    return sum + Number(data.count ?? 0);
  }, 0);
}
