import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { addTask } from "./taskMutations";
import { addDays } from "./dashboard";
import { notifyEvent } from "./notifications";
import type { Subscription, Transaction } from "../types";

const inr = (n: number) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;

/**
 * Flag subscriptions with no matching expense in the last 60 days as unused.
 * Fuzzy match: any 3+ char token of the sub name appears in a recent expense
 * description (plain string includes, no AI). Fires a one-time alert per sub.
 */
export async function refreshUnusedSubscriptions(uid: string, subs: Subscription[], transactions: Transaction[], today: string): Promise<void> {
  const cutoff = addDays(today, -60);
  const recentExpenses = transactions.filter((t) => t.type === "expense" && t.date >= cutoff);
  for (const s of subs) {
    if (s.active === false) continue;
    const tokens = (s.name || "").toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
    const used = tokens.length > 0 && recentExpenses.some((t) => tokens.some((tok) => (t.description || "").toLowerCase().includes(tok)));
    const shouldBeUnused = !used;
    if (!!s.isUnused === shouldBeUnused) continue; // no change
    await updateDoc(doc(db, "subscriptions", s.id), { isUnused: shouldBeUnused });
    if (shouldBeUnused) {
      try {
        await notifyEvent(uid, { type: "finance", title: "Possible unused subscription", body: `${s.name} ${inr(s.amount)}/mo — no payment found in 60 days.`, link: "/finance" }, `unused_sub_${s.id}`);
      } catch (e) { /* non-fatal */ }
    }
  }
}

export async function addTransaction(uid: string, t: Omit<Transaction, "id" | "userId">) {
  await addDoc(collection(db, "transactions"), { userId: uid, ...t, createdAt: serverTimestamp() });
}

export async function addSubscription(
  uid: string,
  s: { name: string; amount: number; frequency: "monthly" | "yearly"; category: string }
) {
  await addDoc(collection(db, "subscriptions"), { userId: uid, ...s, active: true, isUnused: false, createdAt: serverTimestamp() });
}
export const toggleSubscriptionActive = (id: string, active: boolean) => updateDoc(doc(db, "subscriptions", id), { active: !active });
export const deleteSubscription = (id: string) => deleteDoc(doc(db, "subscriptions", id));

/** One-click cancel: create a task to cancel, and pause the subscription. */
export async function cancelSubscription(uid: string, sub: Subscription, today: string) {
  await addTask(uid, { title: `Cancel ${sub.name} subscription`, dueDate: today, category: "finance", priority: "medium" });
  await updateDoc(doc(db, "subscriptions", sub.id), { active: false });
}

export async function addReceivable(uid: string, r: { debtor: string; amount: number; date: string; description?: string }) {
  await addDoc(collection(db, "receivables"), { userId: uid, ...r, reminded: false, createdAt: serverTimestamp() });
}
export const toggleReminded = (id: string, reminded: boolean) => updateDoc(doc(db, "receivables", id), { reminded: !reminded });
export const deleteReceivable = (id: string) => deleteDoc(doc(db, "receivables", id));
