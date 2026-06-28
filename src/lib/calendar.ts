import type { ActiveView, Bill, FixedDeposit, Task } from "../types";
import type { PaymentInstance } from "./recurring";
import { payoutSchedule } from "./fd";
import type { TaxConfig } from "./taxConfig";

export type CalItemType = "task" | "bill" | "recurring" | "tax" | "focus" | "reminder";

export interface CalendarItem {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  title: string;
  type: CalItemType;
  amount?: number;
  overdue: boolean;
  done: boolean;
  nav: ActiveView; // where tapping the item goes
  sourceId: string;
  recurringId?: string; // for recurring items: the template/group to open
  instanceId?: string; // for recurring items: the specific paymentInstance
  fdId?: string; // for FD items: the fixedDeposits doc id to open
}

export const TYPE_COLOR: Record<CalItemType, string> = {
  task: "#2563EB",
  bill: "#0F766E",
  recurring: "#0F766E",
  tax: "#6D28D9",
  focus: "#1B3A6B",
  reminder: "#2BA8E0",
};
export const OVERDUE_COLOR = "#E24B4A";
export const TYPE_LABEL: Record<CalItemType, string> = {
  task: "Task", bill: "Bill", recurring: "Recurring", tax: "Tax", focus: "Focus block", reminder: "Reminder",
};

function taskType(t: Task): CalItemType {
  if (/^\[focus\]/i.test(t.title)) return "focus";
  if (/^reminder:/i.test(t.title)) return "reminder";
  return "task";
}

export interface CalendarSources {
  tasks: Task[];
  bills: Bill[];
  paymentInstances: PaymentInstance[];
  fixedDeposits?: FixedDeposit[];
}

const inr = (n: number) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;

/**
 * Merge EVERY dated Firestore item into one list. The calendar stores no copy —
 * it reads tasks, bills, recurring instances, and tax dates and merges them.
 */
export function buildCalendarItems(src: CalendarSources, taxConfig: TaxConfig, today: string): CalendarItem[] {
  const items: CalendarItem[] = [];

  for (const t of src.tasks) {
    if (!t.dueDate) continue;
    const type = taskType(t);
    items.push({
      id: `task-${t.id}`, sourceId: t.id, date: t.dueDate, time: t.dueTime,
      title: t.title, type, amount: t.amount, done: !!t.completed,
      overdue: !t.completed && t.dueDate < today, nav: "tasks",
    });
  }

  for (const b of src.bills) {
    if (!b.dueDate) continue;
    items.push({
      id: `bill-${b.id}`, sourceId: b.id, date: b.dueDate, title: b.payee, type: "bill",
      amount: b.amount, done: !!b.paid, overdue: !b.paid && b.dueDate < today, nav: "bills",
    });
  }

  for (const p of src.paymentInstances) {
    if (!p.dueDate || p.status === "skipped") continue;
    const done = p.status === "paid";
    items.push({
      id: `inst-${p.id}`, sourceId: p.id, instanceId: p.id, recurringId: p.recurringPaymentId,
      date: p.dueDate, title: p.title || "Recurring payment",
      type: "recurring", amount: p.plannedAmount, done, overdue: !done && p.dueDate < today, nav: "finance",
    });
  }

  // Fixed deposits: maturity (purple, via "tax" colour) + non-cumulative payouts (teal, via "bill").
  for (const fd of src.fixedDeposits || []) {
    if (fd.status === "closed") continue;
    items.push({
      id: `fd-mat-${fd.id}`, sourceId: fd.id, fdId: fd.id, date: fd.maturityDate,
      title: `FD matures — ${fd.bank} ${inr(fd.principal)}`, type: "tax",
      done: fd.status === "matured" || fd.status === "renewed", overdue: false, nav: "finance",
    });
    if (fd.payoutType === "non-cumulative" && fd.status === "active") {
      for (const p of payoutSchedule(fd, fd.payoutFrequency || "quarterly")) {
        items.push({
          id: `fd-pay-${fd.id}-${p.date}`, sourceId: fd.id, fdId: fd.id, date: p.date,
          title: `FD payout — ${fd.bank} ${inr(p.interestAmount)}`, type: "bill", amount: p.interestAmount,
          done: p.date < today, overdue: false, nav: "finance",
        });
      }
    }
  }

  for (const s of taxConfig.advanceTaxSchedule) {
    items.push({
      id: `tax-${s.dueDate}`, sourceId: `tax-${s.dueDate}`, date: s.dueDate,
      title: `Advance tax · ${s.label} (${s.cumulativePct}%)`, type: "tax", done: false,
      overdue: s.dueDate < today, nav: "tax",
    });
  }
  items.push({
    id: `tax-itr-${taxConfig.itrDeadline}`, sourceId: "tax-itr", date: taxConfig.itrDeadline,
    title: `File ITR (${taxConfig.ayLabel})`, type: "tax", done: false, overdue: taxConfig.itrDeadline < today, nav: "tax",
  });

  return items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || "") < (b.time || "") ? -1 : 1));
}

export function colorOf(item: CalendarItem): string {
  return item.overdue ? OVERDUE_COLOR : TYPE_COLOR[item.type];
}

export function groupByDate(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const m = new Map<string, CalendarItem[]>();
  for (const i of items) {
    const arr = m.get(i.date) || [];
    arr.push(i);
    m.set(i.date, arr);
  }
  return m;
}

// ── Date grid helpers (Monday-start month matrix) ──
const pad = (n: number) => String(n).padStart(2, "0");
export const iso = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`;

export function monthMatrix(year: number, month0: number): (string | null)[] {
  const firstDow = (new Date(year, month0, 1).getDay() + 6) % 7; // Monday = 0
  const days = new Date(year, month0 + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(iso(year, month0, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function weekDates(anchorISO: string): string[] {
  const [y, m, d] = anchorISO.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(date);
    x.setDate(date.getDate() + i);
    return iso(x.getFullYear(), x.getMonth(), x.getDate());
  });
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const MONTH_LABELS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
