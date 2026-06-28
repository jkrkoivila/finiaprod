import type {
  ActiveView,
  Bill,
  Receivable,
  Subscription,
  Task,
  Transaction,
} from "../types";
import type { FixedDeposit } from "../types";
import type { PaymentInstance } from "./recurring";
import { daysBetween } from "./fd";

// ── Date helpers (work on local YYYY-MM-DD strings; ISO dates sort lexically) ──
export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return ymd(dt);
}
const monthOf = (iso: string) => iso.slice(0, 7);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

// ── Money formatting (Indian grouping) ──
export function formatINR(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}₹${Math.abs(Math.round(n)).toLocaleString("en-IN")}`;
}

// ── Vital 1: tasks due today ──
export function tasksDueToday(tasks: Task[], today: string): Task[] {
  return tasks.filter((t) => !t.completed && t.dueDate === today);
}

// ── Vital 2: money due in the next `days` days (unpaid bills) ──
export function billsDueSoon(bills: Bill[], today: string, days = 7): Bill[] {
  const end = addDays(today, days);
  return bills.filter((b) => !b.paid && b.dueDate >= today && b.dueDate <= end);
}
export const sumAmount = (rows: { amount?: number }[]) =>
  rows.reduce((s, r) => s + (r.amount || 0), 0);

// ── "Money due" source of truth — every contributor to the vital, traceable. ──
// Unpaid bills AND upcoming recurring-payment instances within `days`. The dashboard
// vital and the "What's due" breakdown both read this, so they can never disagree.
export interface DueItem {
  kind: "bill" | "instance";
  id: string;
  title: string;
  amount: number;
  dueDate: string;
  recurringId?: string; // for instances: the template/group to open
}
export function moneyDueItems(bills: Bill[], instances: PaymentInstance[], today: string, days = 7): DueItem[] {
  const end = addDays(today, days);
  const out: DueItem[] = [];
  for (const b of bills)
    if (!b.paid && b.dueDate >= today && b.dueDate <= end)
      out.push({ kind: "bill", id: b.id, title: b.payee, amount: b.amount || 0, dueDate: b.dueDate });
  for (const i of instances)
    if (i.status !== "paid" && i.status !== "skipped" && i.dueDate >= today && i.dueDate <= end)
      out.push({ kind: "instance", id: i.id, title: i.title || "Recurring payment", amount: i.plannedAmount || 0, dueDate: i.dueDate, recurringId: i.recurringPaymentId });
  return out.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
}
export const moneyDueTotal = (items: DueItem[]) => items.reduce((s, i) => s + i.amount, 0);

// ── Vital 3: saved this month = income − expense for the current month ──
export function incomeForMonth(tx: Transaction[], ym: string): number {
  return tx.filter((t) => t.type === "income" && t.date?.startsWith(ym)).reduce((s, t) => s + (t.amount || 0), 0);
}
export function expenseForMonth(tx: Transaction[], ym: string): number {
  return tx.filter((t) => t.type === "expense" && t.date?.startsWith(ym)).reduce((s, t) => s + (t.amount || 0), 0);
}
export function savedThisMonth(tx: Transaction[], today: string): number {
  const ym = monthOf(today);
  return incomeForMonth(tx, ym) - expenseForMonth(tx, ym);
}

// ── Vital 4: health score (0–100) ──
//
// Weighted average of up to three components, over only the components that
// have data (weights re-normalise). Returns null when there's nothing to score
// (e.g. an empty database) so the UI can show "—" instead of a fake 0.
//
//   • Bill payment rate (weight 0.40): paid bills ÷ total bills
//   • Task completion   (weight 0.30): completed tasks ÷ total tasks
//   • Savings rate       (weight 0.30): clamp(saved ÷ income, 0..1) this month
//
//   score = round( 100 · Σ(wᵢ·sᵢ) / Σ(wᵢ for components that have data) )
export function healthScore(
  tasks: Task[],
  bills: Bill[],
  tx: Transaction[],
  today: string
): number | null {
  const ym = monthOf(today);
  const comps: { w: number; s: number }[] = [];

  if (bills.length > 0) {
    comps.push({ w: 0.4, s: bills.filter((b) => b.paid).length / bills.length });
  }
  if (tasks.length > 0) {
    comps.push({ w: 0.3, s: tasks.filter((t) => t.completed).length / tasks.length });
  }
  const income = incomeForMonth(tx, ym);
  if (income > 0) {
    const saved = income - expenseForMonth(tx, ym);
    comps.push({ w: 0.3, s: clamp(saved / income, 0, 1) });
  }

  if (comps.length === 0) return null;
  const wSum = comps.reduce((s, c) => s + c.w, 0);
  const value = comps.reduce((s, c) => s + c.w * c.s, 0) / wSum;
  return Math.round(value * 100);
}

export function healthBand(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Needs attention";
}

// ── Financial pulse: six live metrics ──
export interface Pulse {
  income: number;
  spent: number;
  saved: number;
  emis: number;
  subscriptions: number;
  toCollect: number;
  investments: number; // total FD corpus (sum of principals of open FDs)
}
export function financialPulse(
  bills: Bill[],
  tx: Transaction[],
  subs: Subscription[],
  recv: Receivable[],
  today: string,
  fds: FixedDeposit[] = [],
  instances: PaymentInstance[] = []
): Pulse {
  const ym = monthOf(today);
  const income = incomeForMonth(tx, ym);
  const spent = expenseForMonth(tx, ym);

  // EMIs = fixed monthly obligations still unpaid this month: bills (rent/card/loan)
  // AND recurring-payment instances tagged rent/EMI/loan.
  const emiBillCats = new Set(["rent", "credit-card", "other"]);
  const emiInstCats = new Set(["rent", "EMI", "loan"]);
  const emisBills = bills
    .filter((b) => !b.paid && monthOf(b.dueDate) === ym && emiBillCats.has(b.category))
    .reduce((s, b) => s + (b.amount || 0), 0);
  const emisInstances = instances
    .filter((i) => i.status !== "paid" && i.status !== "skipped" && monthOf(i.dueDate) === ym && emiInstCats.has(i.category || ""))
    .reduce((s, i) => s + (i.plannedAmount || 0), 0);
  const emis = emisBills + emisInstances;

  // Subscriptions normalised to a monthly figure.
  const subscriptions = subs
    .filter((s) => s.active !== false)
    .reduce((s, x) => s + (x.frequency === "yearly" ? (x.amount || 0) / 12 : x.amount || 0), 0);

  const toCollect = recv.reduce((s, r) => s + (r.amount || 0), 0);
  const investments = fds.filter((f) => f.status !== "closed").reduce((s, f) => s + (f.principal || 0), 0);

  return { income, spent, saved: income - spent, emis, subscriptions: Math.round(subscriptions), toCollect, investments };
}

// ── Priority tasks (urgency colour + ordering) ──
export type Urgency = "urgent" | "soon" | "normal" | "tax";
export function urgencyOf(t: Task, today: string): Urgency {
  if (t.category === "tax") return "tax";
  if (t.dueDate <= today) return "urgent"; // overdue or due today
  if (t.priority === "high" && t.dueDate <= addDays(today, 2)) return "urgent";
  if (t.dueDate <= addDays(today, 3)) return "soon";
  return "normal";
}

const PRIORITY_WEIGHT: Record<Task["priority"], number> = { high: 0, medium: 1, low: 2 };
export function priorityTasks(tasks: Task[], today: string, limit = 5): Task[] {
  void today;
  return tasks
    .filter((t) => !t.completed)
    .sort((a, b) => {
      if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
      return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    })
    .slice(0, limit);
}

// ── Alerts (all derived from real data; Gmail nudge is always present so the
//    panel is never empty) ──
export type AlertKind = "finance" | "tax" | "gmail";
export interface Alert {
  id: string;
  kind: AlertKind;
  title: string;
  description: string;
  actionLabel: string;
  actionView: ActiveView;
}
export function buildAlerts(
  tasks: Task[],
  bills: Bill[],
  subs: Subscription[],
  recv: Receivable[],
  today: string,
  fds: FixedDeposit[] = []
): Alert[] {
  const alerts: Alert[] = [];

  // FD maturities within 30 days.
  for (const fd of fds) {
    if (fd.status !== "active") continue;
    const d = daysBetween(today, fd.maturityDate);
    if (d >= 0 && d <= 30) {
      alerts.push({
        id: `fd-mat-${fd.id}`,
        kind: "finance",
        title: `FD maturing in ${d} day${d === 1 ? "" : "s"} — ${fd.bank} ${formatINR(fd.principal)}`,
        description: `Matures on ${fd.maturityDate}. Decide to renew or withdraw.`,
        actionLabel: "View fixed deposits",
        actionView: "finance",
      });
    }
  }

  const due = billsDueSoon(bills, today, 7);
  if (due.length > 0) {
    alerts.push({
      id: "bills-due",
      kind: "finance",
      title: `${due.length} bill${due.length === 1 ? "" : "s"} due this week`,
      description: `${formatINR(sumAmount(due))} due by ${due.map((b) => b.dueDate).sort()[0]}.`,
      actionLabel: "Review bills",
      actionView: "bills",
    });
  }

  const unused = subs.filter((s) => s.active !== false && s.isUnused);
  if (unused.length > 0) {
    const monthly = unused.reduce(
      (s, x) => s + (x.frequency === "yearly" ? (x.amount || 0) / 12 : x.amount || 0),
      0
    );
    alerts.push({
      id: "unused-subs",
      kind: "finance",
      title: `${unused.length} unused subscription${unused.length === 1 ? "" : "s"}`,
      description: `Costing about ${formatINR(monthly)}/mo. Cancel to save.`,
      actionLabel: "Manage subscriptions",
      actionView: "finance",
    });
  }

  const taxTasks = tasks
    .filter((t) => t.category === "tax" && !t.completed)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  if (taxTasks.length > 0) {
    alerts.push({
      id: "tax-deadline",
      kind: "tax",
      title: "Tax deadline coming up",
      description: `${taxTasks[0].title} — due ${taxTasks[0].dueDate}.`,
      actionLabel: "Open tax",
      actionView: "tax",
    });
  }

  const owed = sumAmount(recv);
  if (owed > 0) {
    alerts.push({
      id: "receivables",
      kind: "finance",
      title: `${formatINR(owed)} to collect`,
      description: `${recv.length} person${recv.length === 1 ? "" : "s"} owe you money.`,
      actionLabel: "View receivables",
      actionView: "finance",
    });
  }

  // Standing Gmail nudge — keeps the panel useful even with no data.
  alerts.push({
    id: "connect-gmail",
    kind: "gmail",
    title: "Connect Gmail",
    description: "Auto-import bills, receipts, and deadlines from your inbox.",
    actionLabel: "Connect Gmail",
    actionView: "documents",
  });

  return alerts;
}

// ── Sparkline series (real 7-day windows; empty data → all zeros → flat line) ──
export function tasksTrend(tasks: Task[], today: string): number[] {
  return range(-6, 0).map((i) => {
    const d = addDays(today, i);
    return tasks.filter((t) => t.dueDate === d).length;
  });
}
export function moneyDueTrend(bills: Bill[], today: string): number[] {
  return range(0, 6).map((i) => {
    const d = addDays(today, i);
    return bills.filter((b) => !b.paid && b.dueDate === d).reduce((s, b) => s + (b.amount || 0), 0);
  });
}
export function savedTrend(tx: Transaction[], today: string): number[] {
  return range(-6, 0).map((i) => {
    const d = addDays(today, i);
    const inc = tx.filter((t) => t.type === "income" && t.date === d).reduce((s, t) => s + (t.amount || 0), 0);
    const exp = tx.filter((t) => t.type === "expense" && t.date === d).reduce((s, t) => s + (t.amount || 0), 0);
    return inc - exp;
  });
}
