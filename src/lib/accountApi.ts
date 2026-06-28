import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where, writeBatch } from "firebase/firestore";
import { deleteUser } from "firebase/auth";
import { auth, db } from "./firebase";

// Every per-user collection the dashboard reads (and that export/clear must cover).
// Keep in sync with useFinanceData's COLLECTIONS — recurringPayments + paymentInstances
// feed "Money due", so omitting them leaves orphaned dues after a clear.
const USER_COLLECTIONS = [
  "tasks", "bills", "transactions", "subscriptions", "receivables", "documents",
  "recurringPayments", "paymentInstances", "notifications",
  "fixedDeposits", "fdIncomeSchedule", "crisisTriage",
];

export const updateUserDoc = (uid: string, patch: Record<string, unknown>) => setDoc(doc(db, "users", uid), patch, { merge: true });

// Fresh-start Gmail cursor: clears historyId + processed-message set so the next
// sync re-scans the last 90 days (duplicates are skipped by dedupeKey).
const GMAIL_SYNC_RESET = { historyId: null, processedIds: [], lastSyncedAt: null, syncTimes: [] };
export const resetGmailSync = (uid: string) => setDoc(doc(db, "users", uid), { gmailSync: GMAIL_SYNC_RESET }, { merge: true });

/** Gather everything the user owns into one JSON object. */
export async function exportData(uid: string): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), userId: uid };
  const profile = await getDoc(doc(db, "users", uid));
  out.profile = profile.exists() ? profile.data() : null;
  const tax = await getDoc(doc(db, "taxProfile", uid));
  out.taxProfile = tax.exists() ? tax.data() : null;
  for (const c of USER_COLLECTIONS) {
    const snap = await getDocs(query(collection(db, c), where("userId", "==", uid)));
    out[c] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  return out;
}

export function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Delete all financial records (keeps the account + profile). */
export async function deleteFinancialData(uid: string) {
  for (const c of USER_COLLECTIONS) {
    const snap = await getDocs(query(collection(db, c), where("userId", "==", uid)));
    if (snap.empty) continue;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(doc(db, c, d.id)));
    await batch.commit();
  }
  await deleteDoc(doc(db, "taxProfile", uid)).catch(() => {});
  // Always reset the Gmail cursor so a fresh sync works immediately after a clear.
  await resetGmailSync(uid).catch(() => {});
}

/** Delete everything + the user doc, then the auth account (may require recent sign-in). */
export async function deleteAccount(uid: string) {
  await deleteFinancialData(uid);
  await deleteDoc(doc(db, "users", uid)).catch(() => {});
  try {
    if (auth.currentUser) await deleteUser(auth.currentUser);
  } catch (e) {
    console.warn("Auth deletion needs a recent sign-in:", e);
  }
}
