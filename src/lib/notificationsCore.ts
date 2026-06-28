import { addDays } from "./dashboard";
import { CRISIS_THRESHOLD, clusteredDeadlines } from "./crisis";
import type { Bill, NotificationType, Task } from "../types";
import type { PaymentInstance } from "./recurring";

// Pure notification helpers (no Firebase import) so they're testable in isolation.

export interface NewNotification {
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
}

export interface DerivedNotification extends NewNotification {
  id: string; // deterministic, for idempotent create
}

const INR = (n: number) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;

/**
 * The notifications that SHOULD exist given current data, minus any whose id is
 * already present (so we never duplicate or un-read one).
 *  • bills due within the reminder lead time
 *  • recurring payment instances coming up within the lead time
 *  • tasks due today (tax tasks flagged as tax)
 *  • crisis: 3+ deadlines clustered within 48h (once per day)
 */
export function computeDerivedNotifications(
  data: { bills: Bill[]; tasks: Task[]; paymentInstances: PaymentInstance[] },
  today: string,
  leadDays: number,
  existingIds: Set<string>
): DerivedNotification[] {
  const out: DerivedNotification[] = [];
  const add = (n: DerivedNotification) => { if (!existingIds.has(n.id)) out.push(n); };
  const horizon = addDays(today, Math.max(0, leadDays));

  for (const b of data.bills) {
    if (b.paid || b.dueDate < today || b.dueDate > horizon) continue;
    add({ id: `bill-due:${b.id}:${b.dueDate}`, type: "finance", title: `Bill due: ${b.payee}`, body: `${INR(b.amount)} due ${b.dueDate}.`, link: "/bills" });
  }

  for (const i of data.paymentInstances) {
    if (i.status === "paid" || i.status === "skipped") continue;
    if (i.dueDate < today || i.dueDate > horizon) continue;
    add({ id: `recurring:${i.id}:${i.dueDate}`, type: "finance", title: `Payment due: ${i.title || "recurring payment"}`, body: `${INR(i.plannedAmount)} due ${i.dueDate}.`, link: "/recurring" });
  }

  for (const t of data.tasks) {
    if (t.completed || t.dueDate !== today) continue;
    const isTax = t.category === "tax";
    add({
      id: `task-today:${t.id}:${today}`,
      type: isTax ? "tax" : "task",
      title: isTax ? `Tax deadline: ${t.title}` : `Task due today: ${t.title}`,
      body: t.dueTime ? `Due today at ${t.dueTime}.` : "Due today.",
      link: isTax ? "/tax" : "/tasks",
    });
  }

  const cluster = clusteredDeadlines(data.tasks, today);
  if (cluster.length >= CRISIS_THRESHOLD) {
    add({ id: `crisis:${today}`, type: "crisis", title: "Crisis mode", body: `${cluster.length} deadlines clustered in the next 48 hours.`, link: "/crisis" });
  }

  return out;
}

/** "2h ago" from a Firestore Timestamp's seconds. */
export function relativeTime(seconds?: number): string {
  if (!seconds) return "just now";
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - seconds));
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
}
