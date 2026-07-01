import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getCountFromServer, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { AppSettings } from "./settings";

export interface AdminUser {
  uid: string;
  name?: string;
  email?: string;
  photo?: string;
  role?: "user" | "admin";
  onboarded?: boolean;
  tourCompleted?: boolean;
  plan?: string;
  suspended?: boolean;
  isDefaultAdmin?: boolean;
  createdAt?: any;
  lastActive?: any;
}

export const PROTECTED_ADMIN_ERROR = "The default admin account cannot be suspended or deleted.";

/** Live list of all users — only succeeds for admins (security rules). */
export function useAllUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "users"),
      (s) => { setUsers(s.docs.map((d) => ({ uid: d.id, ...(d.data() as any) }))); setLoading(false); },
      (e) => { setError(e.message); setLoading(false); }
    );
    return () => unsub();
  }, []);
  return { users, loading, error };
}

const toMs = (ts: any): number => (ts?.toMillis ? ts.toMillis() : ts?.seconds ? ts.seconds * 1000 : 0);

export interface AdminStats {
  total: number;
  activeThisWeek: number;
  newThisWeek: number;
  onboarded: number;
  signups: { label: string; count: number }[];
}
export function adminStats(users: AdminUser[], nowMs: number): AdminStats {
  const weekAgo = nowMs - 7 * 86400000;
  const buckets = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(nowMs - i * 7 * 86400000);
    buckets.set(`${d.getMonth() + 1}/${d.getDate()}`, 0);
  }
  const labels = [...buckets.keys()];
  for (const u of users) {
    const c = toMs(u.createdAt);
    if (!c) continue;
    const weeksAgo = Math.floor((nowMs - c) / (7 * 86400000));
    if (weeksAgo >= 0 && weeksAgo < 6) {
      const label = labels[labels.length - 1 - weeksAgo];
      buckets.set(label, (buckets.get(label) || 0) + 1);
    }
  }
  return {
    total: users.length,
    activeThisWeek: users.filter((u) => toMs(u.lastActive) >= weekAgo).length,
    newThisWeek: users.filter((u) => toMs(u.createdAt) >= weekAgo).length,
    onboarded: users.filter((u) => u.onboarded).length,
    signups: labels.map((label) => ({ label, count: buckets.get(label) || 0 })),
  };
}

export async function countCollection(name: string): Promise<number> {
  try {
    return (await getCountFromServer(collection(db, name))).data().count;
  } catch {
    return 0;
  }
}

// ── Admin actions on users (role is NOT changeable here — console only) ──
// Suspend/delete take the full user so we can reject the protected default admin
// with a clear error even on a direct API call (Firestore rules enforce it server-side too).
export const suspendUser = (user: AdminUser, suspended: boolean) => {
  if (user.isDefaultAdmin) return Promise.reject(new Error(PROTECTED_ADMIN_ERROR));
  return updateDoc(doc(db, "users", user.uid), { suspended });
};
export const resetOnboarding = (uid: string) =>
  updateDoc(doc(db, "users", uid), { onboarded: false, tourCompleted: false });
export const changePlan = (uid: string, plan: string) => updateDoc(doc(db, "users", uid), { plan });
export const deleteUserDoc = (user: AdminUser) => {
  if (user.isDefaultAdmin) return Promise.reject(new Error(PROTECTED_ADMIN_ERROR));
  return deleteDoc(doc(db, "users", user.uid));
};

/** Admin-only write to systemSettings/global. */
export const updateSystemSettings = (patch: Partial<AppSettings>) =>
  setDoc(doc(db, "systemSettings", "global"), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
