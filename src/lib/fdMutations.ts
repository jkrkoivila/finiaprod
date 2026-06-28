import { addDoc, collection, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { ymd } from "./dashboard";
import { computeFd, daysBetween, payoutSchedule } from "./fd";
import { notifyEvent } from "./notifications";
import { upsertTask } from "./taskMutations";
import type { FdIncomeEntry, FixedDeposit } from "../types";

export interface NewFd {
  bank: string;
  principal: number;
  interestRate: number;
  startDate: string;
  maturityDate: string;
  compoundingFrequency: FixedDeposit["compoundingFrequency"];
  payoutType: FixedDeposit["payoutType"];
  payoutFrequency?: FixedDeposit["payoutFrequency"];
  description?: string;
  certificateNumber?: string;
  tdsDeducted: boolean;
  tdsRate?: number;
  autoRenew: boolean;
}

const fdDocId = (uid: string, fdId: string) => `${uid}_${fdId}`;

function clean<T extends Record<string, any>>(o: T): T {
  // Firestore rejects `undefined` — drop those keys.
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/** Create an FD and, for non-cumulative, its income payout schedule. */
export async function createFd(uid: string, data: NewFd): Promise<string> {
  const fdId = doc(collection(db, "fixedDeposits")).id;
  const id = fdDocId(uid, fdId);
  const fd: Record<string, any> = clean({
    userId: uid,
    fdId,
    bank: data.bank,
    principal: data.principal,
    interestRate: data.interestRate,
    startDate: data.startDate,
    maturityDate: data.maturityDate,
    compoundingFrequency: data.compoundingFrequency,
    payoutType: data.payoutType,
    payoutFrequency: data.payoutType === "non-cumulative" ? data.payoutFrequency || "quarterly" : undefined,
    description: data.description || undefined,
    certificateNumber: data.certificateNumber || undefined,
    tdsDeducted: data.tdsDeducted,
    tdsRate: data.tdsRate ?? 10,
    autoRenew: data.autoRenew,
    status: "active",
    taxTracked: false,
    tdsTracked: false,
    incomeScheduleGenerated: data.payoutType === "non-cumulative",
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, "fixedDeposits", id), fd);

  if (data.payoutType === "non-cumulative") {
    const payouts = payoutSchedule(
      { principal: data.principal, interestRate: data.interestRate, startDate: data.startDate, maturityDate: data.maturityDate } as FixedDeposit,
      data.payoutFrequency || "quarterly"
    );
    // Deterministic id per payout date → idempotent (re-run never doubles entries).
    for (const p of payouts) {
      await setDoc(
        doc(db, "fdIncomeSchedule", `${uid}_${fdId}_${p.date}`),
        { userId: uid, fdId, date: p.date, amount: p.interestAmount, status: "upcoming", transactionId: null, createdAt: serverTimestamp() },
        { merge: true }
      );
    }
  }
  return id;
}

export async function editFd(uid: string, fd: FixedDeposit, patch: Partial<NewFd>): Promise<void> {
  await updateDoc(doc(db, "fixedDeposits", fd.id), clean(patch as Record<string, any>));
  // All interest figures are derived live from the stored fields (computeFd), so the
  // detail view recalculates automatically. But the persisted income payout schedule
  // must be regenerated when dates/amount/frequency change. Rebuild unpaid entries
  // from the updated FD (deterministic ids → safe; paid payouts are preserved).
  const merged = { ...fd, ...patch } as FixedDeposit;
  if (merged.payoutType === "non-cumulative") {
    const snap = await getDocs(query(collection(db, "fdIncomeSchedule"), where("userId", "==", uid)));
    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
      const data: any = d.data();
      if (data.fdId === fd.fdId && data.status !== "paid") batch.delete(d.ref);
    });
    await batch.commit();
    for (const p of payoutSchedule(merged, merged.payoutFrequency || "quarterly")) {
      await setDoc(
        doc(db, "fdIncomeSchedule", `${uid}_${fd.fdId}_${p.date}`),
        { userId: uid, fdId: fd.fdId, date: p.date, amount: p.interestAmount, status: "upcoming", transactionId: null, createdAt: serverTimestamp() },
        { merge: true }
      );
    }
  }
}

export async function closeFd(fd: FixedDeposit): Promise<void> {
  await updateDoc(doc(db, "fixedDeposits", fd.id), { status: "closed" });
}

export async function markMatured(uid: string, fd: FixedDeposit): Promise<void> {
  await bookMaturity(uid, fd);
}

/** Renew: book the maturing FD as renewed and open a new one for the next tenure. */
export async function markRenewed(uid: string, fd: FixedDeposit): Promise<string> {
  const c = computeFd(fd, ymd(new Date()));
  await updateDoc(doc(db, "fixedDeposits", fd.id), { status: "renewed" });
  // New FD reinvests the maturity amount for the same tenure & terms.
  const tenureDays = c.tenureDays;
  const start = fd.maturityDate;
  const maturity = ymd(new Date(new Date(start + "T00:00:00").getTime() + tenureDays * 86_400_000));
  return createFd(uid, {
    bank: fd.bank,
    principal: c.maturityAmount,
    interestRate: fd.interestRate,
    startDate: start,
    maturityDate: maturity,
    compoundingFrequency: fd.compoundingFrequency,
    payoutType: fd.payoutType,
    payoutFrequency: fd.payoutFrequency,
    description: fd.description,
    certificateNumber: undefined,
    tdsDeducted: fd.tdsDeducted,
    tdsRate: fd.tdsRate,
    autoRenew: fd.autoRenew,
  });
}

export async function setFdTaxTracking(fd: FixedDeposit, patch: { taxTracked?: boolean; tdsTracked?: boolean }): Promise<void> {
  await updateDoc(doc(db, "fixedDeposits", fd.id), patch);
}

/** Cumulative maturity → one income transaction for the total interest + alert. */
async function bookMaturity(uid: string, fd: FixedDeposit): Promise<void> {
  const c = computeFd(fd, ymd(new Date()));
  const updates: Record<string, any> = { status: "matured" };
  if (fd.payoutType === "cumulative" && !fd.maturityIncomeBooked && c.totalInterest > 0) {
    // Deterministic id → exactly one maturity income transaction per FD.
    await setDoc(
      doc(db, "transactions", `fd_${fd.fdId}_maturity`),
      {
        userId: uid, description: `FD matured — ${fd.bank}`, amount: c.totalInterest, type: "income",
        category: "FD Interest", sourceType: "fd", fdId: fd.fdId, date: fd.maturityDate, createdAt: serverTimestamp(),
      },
      { merge: true }
    );
    updates.maturityIncomeBooked = true;
  }
  await updateDoc(doc(db, "fixedDeposits", fd.id), updates);
  try {
    // dedupeId → one maturity alert per FD, never stacked.
    await notifyEvent(uid, { type: "finance", title: "FD matured", body: `${fd.bank} FD of ₹${fd.principal.toLocaleString("en-IN")} has matured.`, link: "/fixed-deposits" }, `fd_${fd.fdId}_matured`);
  } catch (e) { console.warn("FD maturity notification skipped:", e); }
}

/**
 * On-load automation (idempotent, guarded by status fields):
 *  • Non-cumulative payouts that are now due → create the income transaction + mark paid.
 *  • Active FDs past maturity → auto-mature (cumulative books interest income + alert).
 * Returns true if anything changed (so callers can avoid spurious work).
 */
export async function syncFdEvents(uid: string, fds: FixedDeposit[], schedule: FdIncomeEntry[], today: string): Promise<void> {
  const bankOf = new Map(fds.map((f) => [f.fdId, f.bank]));

  for (const e of schedule) {
    if (e.status !== "upcoming" || e.date > today) continue;
    try {
      // Deterministic id (fd + fdId + date) → re-running never creates a second
      // income transaction for the same payout, even if the status flip races.
      const txId = `fd_${e.fdId}_${e.date}`;
      await setDoc(
        doc(db, "transactions", txId),
        {
          userId: uid, description: `FD interest — ${bankOf.get(e.fdId) || "FD"}`, amount: e.amount, type: "income",
          category: "FD Interest", sourceType: "fd", fdId: e.fdId, date: e.date, createdAt: serverTimestamp(),
        },
        { merge: true }
      );
      await updateDoc(doc(db, "fdIncomeSchedule", e.id), { status: "paid", transactionId: txId });
    } catch (err) {
      console.warn("FD payout booking failed:", err);
    }
  }

  for (const fd of fds) {
    if (fd.status === "active" && fd.maturityDate < today) {
      try {
        await bookMaturity(uid, fd);
        if (fd.autoRenew) await markRenewed(uid, { ...fd, status: "matured" });
      } catch (err) {
        console.warn("FD maturity processing failed:", err);
      }
    }
  }

  // ~7 days before maturity, create the "decide: renew or withdraw" task (idempotent id).
  for (const fd of fds) {
    if (fd.status !== "active") continue;
    const d = daysBetween(today, fd.maturityDate);
    if (d >= 0 && d <= 7) {
      try {
        await upsertTask(uid, `fd_decide_${fd.fdId}`, {
          title: `Decide: renew or withdraw ${fd.bank} FD of ₹${fd.principal.toLocaleString("en-IN")} — matures on ${fd.maturityDate}`,
          dueDate: today,
          category: "finance",
          priority: "high",
        });
      } catch (err) {
        console.warn("FD decide-task failed:", err);
      }
    }
  }
}
