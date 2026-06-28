// DEV-ONLY preview fixtures. Used solely by the /__preview/* routes in App.tsx,
// which are gated behind import.meta.env.DEV and stripped from production builds.
// This is a screenshot/test fixture — NOT app state and never shown to real users.
import type { Bill, Receivable, Subscription, Task, Transaction } from "../types";

export const PREVIEW_TODAY = "2026-06-27";

export const PREVIEW_TASKS: Task[] = [
  { id: "t1", userId: "preview", title: "Pay HDFC credit card bill", dueDate: "2026-06-27", dueTime: "18:00", category: "finance", completed: false, priority: "high" },
  { id: "t2", userId: "preview", title: "File ITR-1 for AY 2026-27", dueDate: "2026-07-31", category: "tax", completed: false, priority: "high" },
  { id: "t3", userId: "preview", title: "Renew bike insurance", dueDate: "2026-06-25", category: "general", completed: false, priority: "medium" },
  { id: "t4", userId: "preview", title: "Review quarterly SIP portfolio", dueDate: "2026-06-29", category: "finance", completed: false, priority: "medium" },
  { id: "t5", userId: "preview", title: "Submit project status deck", dueDate: "2026-06-28", category: "work", completed: false, priority: "low" },
  { id: "t6", userId: "preview", title: "Book dentist appointment", dueDate: "2026-06-22", category: "personal", completed: true, priority: "low" },
];

export const PREVIEW_BILLS: Bill[] = [
  { id: "b1", userId: "preview", payee: "BESCOM electricity", amount: 1240, dueDate: "2026-06-28", paid: false, category: "electricity" },
  { id: "b2", userId: "preview", payee: "Jio Fiber", amount: 825, dueDate: "2026-06-30", paid: false, category: "internet" },
  { id: "icici-credit-card_4821_2026-06_12500", userId: "preview", payee: "ICICI credit card", amount: 12500, dueDate: "2026-06-18", paid: true, category: "credit-card", last4: "4821", minimumDue: 2500, statementMonth: "2026-06", dedupeKey: "icici-credit-card_4821_2026-06_12500" },
  { id: "b4", userId: "preview", payee: "Apartment rent", amount: 22000, dueDate: "2026-06-30", paid: false, category: "rent" },
  { id: "hdfc-credit-card_7788_2026-06_18400", userId: "preview", payee: "HDFC credit card", amount: 18400, dueDate: "2026-06-29", paid: false, category: "credit-card", last4: "7788", minimumDue: 3680, statementMonth: "2026-06", dedupeKey: "hdfc-credit-card_7788_2026-06_18400" },
];

export const PREVIEW_TX: Transaction[] = [
  // June (current month)
  { id: "x1", userId: "preview", description: "Monthly salary", amount: 92000, type: "income", category: "salary", date: "2026-06-01" },
  { id: "x2", userId: "preview", description: "HDFC mutual fund SIP", amount: 8000, type: "expense", category: "investment", date: "2026-06-10" },
  { id: "x3", userId: "preview", description: "Swiggy dinner", amount: 640, type: "expense", category: "food", date: "2026-06-24" },
  { id: "x4", userId: "preview", description: "Electricity", amount: 1240, type: "expense", category: "utilities", date: "2026-06-12" },
  { id: "x8", userId: "preview", description: "Cult fitness", amount: 1000, type: "expense", category: "health", date: "2026-06-05" },
  // May (prior month — gives the waterfall an opening balance, MoM, and recurring detection)
  { id: "x5", userId: "preview", description: "Monthly salary", amount: 90000, type: "income", category: "salary", date: "2026-05-01" },
  { id: "x6", userId: "preview", description: "Swiggy dinner", amount: 520, type: "expense", category: "food", date: "2026-05-20" },
  { id: "x7", userId: "preview", description: "Cult fitness", amount: 1000, type: "expense", category: "health", date: "2026-05-05" },
];

export const PREVIEW_SUBS: Subscription[] = [
  { id: "s1", userId: "preview", name: "Netflix", amount: 649, frequency: "monthly", category: "entertainment", active: true },
  { id: "s2", userId: "preview", name: "AWS sandbox", amount: 2450, frequency: "monthly", category: "saas", active: true, isUnused: true, lastUsedDays: 40 },
];

export const PREVIEW_RECV: Receivable[] = [
  { id: "r1", userId: "preview", debtor: "Rohan", amount: 3500, date: "2026-06-15", description: "Trip share" },
];
