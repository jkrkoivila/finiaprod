import {
  billsDueSoon,
  expenseForMonth,
  formatINR,
  incomeForMonth,
  savedThisMonth,
  sumAmount,
  tasksDueToday,
} from "./dashboard";
import type { NewTask } from "./taskMutations";
import type { Bill, Task, Transaction } from "../types";

export interface FnCall {
  name: string;
  args: Record<string, any>;
}

/** The four functions the agent can call. */
export type FnName = "create_task" | "block_calendar_time" | "set_reminder" | "get_financial_summary";

/**
 * Map a write-capable function call to a Task payload. Pure & Firebase-free so
 * it's unit-testable. Returns null for get_financial_summary (read-only).
 */
export function functionCallToTaskPayload(call: FnCall): NewTask | null {
  const a = call.args || {};
  switch (call.name) {
    case "create_task":
      return {
        title: a.title,
        dueDate: a.dueDate,
        priority: a.priority || "medium",
        category: a.category || "general",
      };
    case "block_calendar_time":
      return {
        title: `${a.taskTitle} (${a.startTime}–${a.endTime})`,
        dueDate: a.date,
        dueTime: a.startTime,
        category: "work",
        priority: "medium",
      };
    case "set_reminder": {
      const [d, t] = String(a.remindAt || "").split(" ");
      return {
        title: `Reminder: ${a.taskTitle}`,
        dueDate: d || a.remindAt,
        dueTime: t || "09:00",
        category: "general",
        priority: "medium",
      };
    }
    default:
      return null;
  }
}

export interface AgentSummary {
  income: number;
  spent: number;
  saved: number;
  billsDue: number;
  tasksToday: number;
}

export interface AgentContext {
  tasks: { title: string; dueDate: string; priority: string; category: string }[];
  bills: { payee: string; amount: number; dueDate: string }[];
  summary: AgentSummary;
}

/** Trim live Firestore data into a compact context payload for the model. */
export function buildAgentContext(
  tasks: Task[],
  bills: Bill[],
  transactions: Transaction[],
  today: string
): AgentContext {
  const ym = today.slice(0, 7);
  const due = billsDueSoon(bills, today, 7);
  return {
    tasks: tasks
      .filter((t) => !t.completed)
      .slice(0, 20)
      .map((t) => ({ title: t.title, dueDate: t.dueDate, priority: t.priority, category: t.category })),
    bills: bills.filter((b) => !b.paid).map((b) => ({ payee: b.payee, amount: b.amount, dueDate: b.dueDate })),
    summary: {
      income: incomeForMonth(transactions, ym),
      spent: expenseForMonth(transactions, ym),
      saved: savedThisMonth(transactions, today),
      billsDue: sumAmount(due),
      tasksToday: tasksDueToday(tasks, today).length,
    },
  };
}

/** Proactive opener summarising what's due. */
export function buildProactiveMessage(tasks: Task[], bills: Bill[], today: string): string {
  const dueToday = tasksDueToday(tasks, today).length;
  const amt = sumAmount(billsDueSoon(bills, today, 7));
  let s = "Hi, I'm Finia. ";
  if (dueToday > 0 && amt > 0)
    s += `You have ${dueToday} task${dueToday > 1 ? "s" : ""} due today and ${formatINR(amt)} in bills due this week.`;
  else if (dueToday > 0) s += `You have ${dueToday} task${dueToday > 1 ? "s" : ""} due today.`;
  else if (amt > 0) s += `Nothing's due today, but ${formatINR(amt)} in bills are due this week.`;
  else s += "You're all caught up — nothing due today.";
  return s + " How can I help?";
}

export const PROACTIVE_CHIPS = [
  "What's due this week?",
  "Add a task to pay rent Friday",
  "Summarise my finances",
];
