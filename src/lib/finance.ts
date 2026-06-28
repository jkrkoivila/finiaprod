import { expenseForMonth, incomeForMonth } from "./dashboard";
import type { Receivable, Subscription, Transaction } from "../types";

export const monthKey = (iso: string) => iso.slice(0, 7);

export function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export interface MonthTotals {
  income: number;
  expense: number;
  net: number;
}
export function monthlyTotals(tx: Transaction[], ym: string): MonthTotals {
  const income = incomeForMonth(tx, ym);
  const expense = expenseForMonth(tx, ym);
  return { income, expense, net: income - expense };
}

export interface Waterfall {
  opening: number;
  inflows: number;
  outflows: number;
  closing: number;
}
/** Opening balance (everything before this month) → inflows → outflows → closing. */
export function waterfall(tx: Transaction[], ym: string): Waterfall {
  const start = `${ym}-01`;
  const opening = tx
    .filter((t) => t.date < start)
    .reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
  const inflows = incomeForMonth(tx, ym);
  const outflows = expenseForMonth(tx, ym);
  return { opening, inflows, outflows, closing: opening + inflows - outflows };
}

export interface CategorySlice {
  category: string;
  amount: number;
}
export function categoryBreakdown(tx: Transaction[], ym: string): CategorySlice[] {
  const map = new Map<string, number>();
  for (const t of tx) {
    if (t.type !== "expense" || !t.date?.startsWith(ym)) continue;
    map.set(t.category || "other", (map.get(t.category || "other") || 0) + t.amount);
  }
  return [...map.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

export interface CategoryMoM {
  category: string;
  current: number;
  previous: number;
  changePct: number | null; // null when previous is 0
}
export function categoryMoM(tx: Transaction[], ym: string): CategoryMoM[] {
  const prev = prevMonth(ym);
  const cur = new Map<string, number>();
  const old = new Map<string, number>();
  for (const t of tx) {
    if (t.type !== "expense") continue;
    if (t.date?.startsWith(ym)) cur.set(t.category || "other", (cur.get(t.category || "other") || 0) + t.amount);
    else if (t.date?.startsWith(prev)) old.set(t.category || "other", (old.get(t.category || "other") || 0) + t.amount);
  }
  const cats = new Set([...cur.keys(), ...old.keys()]);
  return [...cats]
    .map((category) => {
      const current = cur.get(category) || 0;
      const previous = old.get(category) || 0;
      const changePct = previous === 0 ? null : Math.round(((current - previous) / previous) * 100);
      return { category, current, previous, changePct };
    })
    .sort((a, b) => b.current - a.current);
}

export function subscriptionMonthlyCost(subs: Subscription[]): number {
  return subs
    .filter((s) => s.active !== false)
    .reduce((sum, s) => sum + (s.frequency === "yearly" ? (s.amount || 0) / 12 : s.amount || 0), 0);
}
export const subscriptionAnnualCost = (subs: Subscription[]) => subscriptionMonthlyCost(subs) * 12;

/** Detect likely recurring charges: same merchant, similar amount, ≥2 distinct months. */
export interface RecurringCandidate {
  name: string;
  amount: number;
  months: number;
}
export function detectRecurring(tx: Transaction[]): RecurringCandidate[] {
  const groups = new Map<string, { amounts: number[]; months: Set<string> }>();
  for (const t of tx) {
    if (t.type !== "expense") continue;
    const key = (t.description || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key) continue;
    const g = groups.get(key) || { amounts: [], months: new Set<string>() };
    g.amounts.push(t.amount);
    g.months.add(monthKey(t.date));
    groups.set(key, g);
  }
  const out: RecurringCandidate[] = [];
  for (const [key, g] of groups) {
    if (g.months.size < 2) continue;
    const avg = g.amounts.reduce((s, a) => s + a, 0) / g.amounts.length;
    const spread = Math.max(...g.amounts) - Math.min(...g.amounts);
    if (spread <= avg * 0.15) {
      out.push({ name: key.replace(/\b\w/g, (c) => c.toUpperCase()), amount: Math.round(avg), months: g.months.size });
    }
  }
  return out.sort((a, b) => b.amount - a.amount);
}

export function daysSince(iso: string, today: string): number {
  const [ay, am, ad] = today.split("-").map(Number);
  const [by, bm, bd] = iso.split("-").map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000);
}

export const REMIND_AFTER_DAYS = 7;
export function shouldRemind(r: Receivable, today: string): boolean {
  return !r.reminded && daysSince(r.date, today) >= REMIND_AFTER_DAYS;
}

export function whatsappDraft(r: Receivable): string {
  const amt = `₹${(r.amount || 0).toLocaleString("en-IN")}`;
  const note = r.description ? ` for ${r.description}` : "";
  return `Hi ${r.debtor}, hope you're doing well! Just a gentle reminder about the ${amt}${note}. Whenever convenient, could you please settle it? Thanks a lot!`;
}
export function whatsappLink(r: Receivable): string {
  return `https://wa.me/?text=${encodeURIComponent(whatsappDraft(r))}`;
}
