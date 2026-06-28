// Pure scheduling + status logic for recurring payments. Firebase-free → testable.

export type Frequency = "weekly" | "monthly" | "quarterly" | "half-yearly" | "yearly";
export type RecurringCategory = "rent" | "EMI" | "utility" | "subscription" | "insurance" | "other";
export type InstanceStatus = "upcoming" | "due" | "paid" | "overdue" | "skipped";

export interface RecurringPayment {
  id: string;
  userId: string;
  title: string;
  category: RecurringCategory;
  plannedAmount: number;
  frequency: Frequency;
  dueDay: number; // day-of-month (1-31), or day-of-week (0=Sun..6=Sat) for weekly
  startDate: string; // YYYY-MM-DD
  endDate?: string | null;
  reminderLeadDays: number;
  isActive: boolean;
  autoCreateTask: boolean;
  createdAt?: unknown;
}

export interface PaymentInstance {
  id: string;
  userId: string;
  recurringPaymentId: string;
  title?: string;
  category?: RecurringCategory;
  dueDate: string;
  plannedAmount: number;
  actualAmount?: number | null;
  status: InstanceStatus;
  paidDate?: string | null;
  proofUrl?: string | null;
  note?: string | null;
  taskId?: string | null;
  nextCycleGenerated?: boolean; // the next cycle was already spawned on payment
}

export const MONTHS_FOR: Record<Exclude<Frequency, "weekly">, number> = {
  monthly: 1,
  quarterly: 3,
  "half-yearly": 6,
  yearly: 12,
};

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function parse(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
/** A date in (year, month) on `day`, clamped to the month's last day (handles 31 → 28/30). */
function clampDay(year: number, month0: number, day: number): Date {
  const lastDay = new Date(year, month0 + 1, 0).getDate();
  return new Date(year, month0, Math.min(day, lastDay));
}
function addMonthsOnDueDay(from: Date, n: number, dueDay: number): Date {
  return clampDay(from.getFullYear(), from.getMonth() + n, dueDay);
}

/** First due date on or after `anchor`, aligned to the schedule. */
export function firstDueOnOrAfter(anchorISO: string, freq: Frequency, dueDay: number): string {
  const a = parse(anchorISO);
  if (freq === "weekly") {
    const delta = (((dueDay - a.getDay()) % 7) + 7) % 7;
    const d = new Date(a);
    d.setDate(d.getDate() + delta);
    return ymd(d);
  }
  const cand = clampDay(a.getFullYear(), a.getMonth(), dueDay);
  if (cand >= a) return ymd(cand);
  return ymd(addMonthsOnDueDay(cand, MONTHS_FOR[freq], dueDay));
}

/** The due date one cycle after `currentISO`. */
export function nextDueAfter(currentISO: string, freq: Frequency, dueDay: number): string {
  const c = parse(currentISO);
  if (freq === "weekly") {
    const d = new Date(c);
    d.setDate(d.getDate() + 7);
    return ymd(d);
  }
  return ymd(addMonthsOnDueDay(c, MONTHS_FOR[freq], dueDay));
}

/** Generate up to `count` upcoming due dates from `anchor`, respecting endDate. */
export function generateDueDates(
  freq: Frequency,
  dueDay: number,
  anchorISO: string,
  count: number,
  endDate?: string | null
): string[] {
  const out: string[] = [];
  let d = firstDueOnOrAfter(anchorISO, freq, dueDay);
  while (out.length < count) {
    if (endDate && d > endDate) break;
    out.push(d);
    d = nextDueAfter(d, freq, dueDay);
  }
  return out;
}

/** Display status of an instance given today (stored paid/skipped win). */
export function instanceStatus(inst: Pick<PaymentInstance, "status" | "dueDate">, today: string): InstanceStatus {
  if (inst.status === "paid" || inst.status === "skipped") return inst.status;
  if (inst.dueDate < today) return "overdue";
  if (inst.dueDate === today) return "due";
  return "upcoming";
}

export function reminderDate(dueDate: string, leadDays: number): string {
  const d = parse(dueDate);
  d.setDate(d.getDate() - Math.max(0, leadDays));
  return ymd(d);
}

/** "₹500 more than planned" / "₹200 less than planned" / null when equal. */
export function amountDeltaNote(planned: number, actual: number): string | null {
  const diff = Math.round(actual - planned);
  if (diff === 0) return null;
  const abs = `₹${Math.abs(diff).toLocaleString("en-IN")}`;
  return diff > 0 ? `${abs} more than planned` : `${abs} less than planned`;
}

/**
 * Reconstruct a read-only template for orphaned instances — paymentInstances whose
 * recurringPayments template was deleted (e.g. "delete template, keep instances")
 * but which still drive the calendar + Money due. isActive:false so paying one
 * never generates a wrong next cycle (we don't know the real schedule).
 */
export function syntheticTemplateForInstances(recurringPaymentId: string, insts: PaymentInstance[]): RecurringPayment {
  const first = insts[0];
  const earliest = insts.map((i) => i.dueDate).sort()[0] || first?.dueDate || "";
  const dueDay = earliest ? Number(earliest.slice(8, 10)) || 1 : 1;
  return {
    id: recurringPaymentId,
    userId: first?.userId || "",
    title: first?.title || "Recurring payment",
    category: (first?.category as RecurringCategory) || "other",
    plannedAmount: first?.plannedAmount || 0,
    frequency: "monthly",
    dueDay,
    startDate: earliest,
    endDate: null,
    reminderLeadDays: 3,
    isActive: false,
    autoCreateTask: false,
  };
}

/**
 * Templates to render in the Finance view = real templates PLUS a synthetic one
 * per orphaned recurringPaymentId, so instances are never invisible there.
 * Returns the merged template list and the set of synthetic (orphaned) ids.
 */
export function recurringGroups(
  templates: RecurringPayment[],
  instances: PaymentInstance[]
): { templates: RecurringPayment[]; orphanedIds: Set<string> } {
  const known = new Set(templates.map((t) => t.id));
  const orphanByRid = new Map<string, PaymentInstance[]>();
  for (const i of instances) {
    if (!i.recurringPaymentId || known.has(i.recurringPaymentId)) continue;
    const arr = orphanByRid.get(i.recurringPaymentId) || [];
    arr.push(i);
    orphanByRid.set(i.recurringPaymentId, arr);
  }
  const synthetic: RecurringPayment[] = [];
  const orphanedIds = new Set<string>();
  for (const [rid, insts] of orphanByRid) {
    synthetic.push(syntheticTemplateForInstances(rid, insts));
    orphanedIds.add(rid);
  }
  return { templates: [...templates, ...synthetic], orphanedIds };
}

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  "half-yearly": "Half-yearly",
  yearly: "Yearly",
};
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
