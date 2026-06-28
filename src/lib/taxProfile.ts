import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { DeductionEntry, Regime } from "./taxComponents";

export interface YearProfile {
  grossSalary: number;
  entries: DeductionEntry[];
  regime: Regime;
}
export interface TwoYearProfile {
  current: YearProfile;
  previous: YearProfile;
}

export const EMPTY_YEAR: YearProfile = { grossSalary: 0, entries: [], regime: "new" };

/** Live two-year tax profile from `taxProfile/{uid}`. Defaults to empty years. */
export function useTaxProfile(uid: string | undefined) {
  const [data, setData] = useState<TwoYearProfile | null>(null);
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "taxProfile", uid), (snap) => {
      const d = snap.exists() ? (snap.data() as any) : {};
      setData({
        current: { ...EMPTY_YEAR, ...(d.current || {}), entries: d.current?.entries ?? [] },
        previous: { ...EMPTY_YEAR, ...(d.previous || {}), entries: d.previous?.entries ?? [] },
      });
    });
    return () => unsub();
  }, [uid]);
  return data;
}

export async function saveTaxProfile(uid: string, profile: TwoYearProfile): Promise<void> {
  await setDoc(doc(db, "taxProfile", uid), { userId: uid, ...profile, updatedAt: serverTimestamp() }, { merge: true });
}
