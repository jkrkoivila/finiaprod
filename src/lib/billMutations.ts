import { deleteDoc, doc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { billDedupeKey } from "./billKey";
import type { Bill } from "../types";

export { billDedupeKey, keyForBill } from "./billKey";

export interface NewBill {
  payee: string; // issuer
  amount: number; // total due
  dueDate: string; // YYYY-MM-DD
  category: Bill["category"];
  last4?: string;
  minimumDue?: number;
  statementMonth?: string; // YYYY-MM; defaults to the due date's month
}

/**
 * Create or update a bill at its dedupeKey doc id. merge:true preserves an
 * existing `paid` flag so a re-import never silently marks a paid bill unpaid.
 */
export async function addOrUpdateBill(uid: string, data: NewBill): Promise<string> {
  const statementMonth = data.statementMonth || data.dueDate.slice(0, 7);
  const key = billDedupeKey({ issuer: data.payee, last4: data.last4, statementMonth, totalDue: data.amount });
  await setDoc(
    doc(db, "bills", key),
    {
      userId: uid,
      payee: data.payee,
      amount: data.amount,
      dueDate: data.dueDate,
      category: data.category,
      statementMonth,
      dedupeKey: key,
      ...(data.last4 ? { last4: data.last4 } : {}),
      ...(data.minimumDue != null ? { minimumDue: data.minimumDue } : {}),
      paid: false,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return key;
}

export async function setBillPaid(id: string, paid: boolean): Promise<void> {
  await updateDoc(doc(db, "bills", id), { paid });
}

export async function deleteBill(id: string): Promise<void> {
  await deleteDoc(doc(db, "bills", id));
}
