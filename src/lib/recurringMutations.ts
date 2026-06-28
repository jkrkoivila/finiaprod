import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { ymd } from "./dashboard";
import { generateDueDates, nextDueAfter, type Frequency, type PaymentInstance, type RecurringCategory, type RecurringPayment } from "./recurring";

export interface NewRecurring {
  title: string;
  category: RecurringCategory;
  plannedAmount: number;
  frequency: Frequency;
  dueDay: number;
  startDate: string;
  endDate?: string | null;
  reminderLeadDays: number;
  isActive: boolean;
  autoCreateTask: boolean;
}

const UPCOMING_BUFFER = 3;

async function instancesFor(uid: string, templateId: string): Promise<PaymentInstance[]> {
  const snap = await getDocs(query(collection(db, "paymentInstances"), where("userId", "==", uid)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).filter((i) => i.recurringPaymentId === templateId);
}

/**
 * Create one instance and (optionally) its linked Finance+Recurring task.
 * Idempotent: the instance doc id is deterministic (`templateId_dueDate`), and we
 * skip entirely if it already exists — so a double-submit or re-trigger can never
 * spawn a duplicate instance OR a duplicate task.
 */
async function createInstance(uid: string, templateId: string, t: NewRecurring | RecurringPayment, dueDate: string): Promise<string> {
  // Enforce the parent→child contract: never create an orphan instance.
  if (!templateId || !(await getDoc(doc(db, "recurringPayments", templateId))).exists()) {
    throw new Error("Cannot create a payment instance without its recurring template.");
  }
  const instId = `${templateId}_${dueDate}`;
  const instRef = doc(db, "paymentInstances", instId);
  if ((await getDoc(instRef)).exists()) return instId; // already generated → no-op

  await setDoc(instRef, {
    userId: uid,
    recurringPaymentId: templateId,
    title: t.title,
    category: t.category,
    dueDate,
    plannedAmount: t.plannedAmount,
    actualAmount: null,
    status: "upcoming",
    paidDate: null,
    proofUrl: null,
    note: null,
    taskId: null,
    nextCycleGenerated: false,
    createdAt: serverTimestamp(),
  });
  if (t.autoCreateTask) {
    const taskRef = await addDoc(collection(db, "tasks"), {
      userId: uid,
      title: t.title,
      dueDate,
      category: "finance",
      priority: "medium",
      completed: false,
      amount: t.plannedAmount,
      recurring: true,
      sourceInstanceId: instId,
      createdAt: serverTimestamp(),
    });
    await updateDoc(instRef, { taskId: taskRef.id });
  }
  return instId;
}

/** Create a template and generate the next few cycles (instances + tasks). */
export async function createRecurringPayment(uid: string, data: NewRecurring): Promise<string> {
  const ref = await addDoc(collection(db, "recurringPayments"), { userId: uid, ...data, createdAt: serverTimestamp() });
  const today = ymd(new Date());
  const anchor = data.startDate > today ? data.startDate : today;
  const dues = generateDueDates(data.frequency, data.dueDay, anchor, UPCOMING_BUFFER, data.endDate);
  for (const dueDate of dues) await createInstance(uid, ref.id, data, dueDate);
  return ref.id;
}

/** Repair: if a template somehow has no instances, generate the next few now. Idempotent. */
export async function ensureInstances(uid: string, template: RecurringPayment): Promise<void> {
  const existing = await instancesFor(uid, template.id);
  if (existing.length > 0) return;
  const today = ymd(new Date());
  const anchor = template.startDate > today ? template.startDate : today;
  for (const dueDate of generateDueDates(template.frequency, template.dueDay, anchor, UPCOMING_BUFFER, template.endDate)) {
    await createInstance(uid, template.id, template, dueDate);
  }
}

export interface PaymentRecord {
  actualAmount: number;
  paidDate: string;
  note?: string | null;
  proofUrl?: string | null;
}

/**
 * Record a payment against an instance: mark paid, complete its task, log the
 * actual amount as an expense (sourced from the instance), and top up the
 * upcoming buffer with the next cycle.
 */
export async function markInstancePaid(uid: string, instance: PaymentInstance, template: RecurringPayment, payment: PaymentRecord): Promise<void> {
  await updateDoc(doc(db, "paymentInstances", instance.id), {
    status: "paid",
    actualAmount: payment.actualAmount,
    paidDate: payment.paidDate,
    proofUrl: payment.proofUrl ?? null,
    note: payment.note ?? null,
  });

  if (instance.taskId) await updateDoc(doc(db, "tasks", instance.taskId), { completed: true }).catch(() => {});

  // Deterministic expense id → exactly one expense per instance payment (idempotent
  // even if mark-as-paid is triggered twice).
  await setDoc(
    doc(db, "transactions", `rp_${instance.id}`),
    {
      userId: uid,
      description: template.title,
      amount: payment.actualAmount,
      type: "expense",
      category: template.category,
      date: payment.paidDate,
      sourceInstanceId: instance.id,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Keep one more upcoming instance in the pipeline — exactly once per instance.
  if (template.isActive && !instance.nextCycleGenerated) {
    const all = await instancesFor(uid, template.id);
    const maxDue = all.reduce((m, i) => (i.dueDate > m ? i.dueDate : m), instance.dueDate);
    const next = nextDueAfter(maxDue, template.frequency, template.dueDay);
    const withinEnd = !template.endDate || next <= template.endDate;
    if (withinEnd && !all.some((i) => i.dueDate === next)) {
      await createInstance(uid, template.id, template, next); // deterministic id → safe
    }
    await updateDoc(doc(db, "paymentInstances", instance.id), { nextCycleGenerated: true });
  }
}

/** Edit a template. Never touches paid instances; optionally propagates the new
 *  planned amount to existing unpaid instances. */
export async function editTemplate(uid: string, templateId: string, patch: Partial<NewRecurring>, scope: "future" | "all-unpaid"): Promise<void> {
  await updateDoc(doc(db, "recurringPayments", templateId), patch);
  if (scope === "all-unpaid" && patch.plannedAmount != null) {
    const all = await instancesFor(uid, templateId);
    for (const i of all) {
      if (i.status !== "paid" && i.status !== "skipped") {
        await updateDoc(doc(db, "paymentInstances", i.id), { plannedAmount: patch.plannedAmount });
      }
    }
  }
}

export const pauseTemplate = (id: string, isActive: boolean) => updateDoc(doc(db, "recurringPayments", id), { isActive: !isActive });

/** Delete a template; optionally cascade-remove unpaid instances + their tasks
 *  (and their calendar entries, which are derived from the instances/tasks).
 *  Paid instances, their transactions, and proofs are always kept for records.
 *
 *  Robust to orphans: if the recurringPayments doc doesn't exist (template-less
 *  group), we skip deleting it — otherwise the rules deny the (null-resource)
 *  delete and the whole atomic batch fails, leaving everything behind. */
export async function deleteTemplate(uid: string, templateId: string, deleteUnpaid: boolean): Promise<void> {
  const all = await instancesFor(uid, templateId);
  const tplRef = doc(db, "recurringPayments", templateId);
  const tplExists = (await getDoc(tplRef)).exists();

  const batch = writeBatch(db);
  if (tplExists) batch.delete(tplRef);
  if (deleteUnpaid) {
    for (const i of all) {
      if (i.status !== "paid" && i.status !== "skipped") {
        batch.delete(doc(db, "paymentInstances", i.id));
        if (i.taskId) batch.delete(doc(db, "tasks", i.taskId)); // removes its calendar entry too
      }
    }
  }
  await batch.commit();
}

/**
 * Backfill a real recurringPayments template for an orphaned group. Uses the
 * existing recurringPaymentId as the stable doc id, so the instances are linked
 * automatically (they already point at it). Fields are reconstructed from the
 * instances (frequency defaults to monthly; dueDay from the due date).
 */
export async function backfillTemplate(uid: string, template: RecurringPayment): Promise<void> {
  await setDoc(doc(db, "recurringPayments", template.id), {
    userId: uid,
    title: template.title,
    category: template.category,
    plannedAmount: template.plannedAmount,
    frequency: template.frequency,
    dueDay: template.dueDay,
    startDate: template.startDate,
    endDate: template.endDate ?? null,
    reminderLeadDays: template.reminderLeadDays ?? 3,
    isActive: true,
    autoCreateTask: true,
    createdAt: serverTimestamp(),
    backfilled: true,
  });
}
