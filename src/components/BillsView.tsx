import { Fragment, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Plus,
  Zap,
  Home,
  Wifi,
  CreditCard,
  Receipt,
  X,
  Check,
  Trash2,
  CalendarPlus,
  Bell,
  Save,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { formatINR, ymd } from "../lib/dashboard";
import { keyForBill } from "../lib/billKey";
import type { NewBill } from "../lib/billMutations";
import type { Bill, Transaction } from "../types";

interface BillsViewProps {
  bills: Bill[];
  transactions: Transaction[];
  loading: boolean;
  today?: string;
  onAddOrUpdate: (data: NewBill) => void | Promise<void>;
  onSetPaid: (id: string, paid: boolean) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onCreatePaymentTask: (bill: Bill) => void | Promise<void>;
  onSetReminder: (bill: Bill) => void | Promise<void>;
  onSaveToLibrary: (bill: Bill) => void | Promise<void>;
}

const CATEGORIES: Bill["category"][] = ["electricity", "rent", "internet", "credit-card", "other"];
const CATEGORY_ICON: Record<Bill["category"], LucideIcon> = {
  electricity: Zap,
  rent: Home,
  internet: Wifi,
  "credit-card": CreditCard,
  other: Receipt,
};
const CATEGORY_COLOR: Record<Bill["category"], string> = {
  electricity: "#D97706",
  rent: "#1B3A6B",
  internet: "#2563EB",
  "credit-card": "#6D28D9",
  other: "#475569",
};

const emptyForm = (today: string): NewBill => ({
  payee: "",
  amount: 0,
  dueDate: today,
  category: "credit-card",
  last4: "",
  minimumDue: undefined,
});

type StatusFilter = "unpaid" | "all" | "paid";

function daysUntil(today: string, due: string): number {
  const [ay, am, ad] = today.split("-").map(Number);
  const [by, bm, bd] = due.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

function dueLabel(today: string, due: string): string {
  const d = daysUntil(today, due);
  if (d < 0) return `Overdue by ${-d}d`;
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  return `Due in ${d}d`;
}

export default function BillsView({
  bills,
  transactions,
  loading,
  today,
  onAddOrUpdate,
  onSetPaid,
  onDelete,
  onCreatePaymentTask,
  onSetReminder,
  onSaveToLibrary,
}: BillsViewProps) {
  const t = today ?? ymd(new Date());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewBill>(emptyForm(t));
  const [dupNotice, setDupNotice] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("unpaid");
  const [selected, setSelected] = useState<Bill | null>(null);

  const tallies = useMemo(() => {
    const unpaid = bills.filter((b) => !b.paid);
    const outstanding = unpaid.reduce((s, b) => s + (b.amount || 0), 0);
    const dueWeek = unpaid
      .filter((b) => daysUntil(t, b.dueDate) >= 0 && daysUntil(t, b.dueDate) <= 7)
      .reduce((s, b) => s + (b.amount || 0), 0);
    const paidThisMonth = bills
      .filter((b) => b.paid && b.dueDate.startsWith(t.slice(0, 7)))
      .reduce((s, b) => s + (b.amount || 0), 0);
    return { outstanding, unpaidCount: unpaid.length, dueWeek, paidThisMonth };
  }, [bills, t]);

  const visible = useMemo(() => {
    let list = bills.slice();
    if (status === "unpaid") list = list.filter((b) => !b.paid);
    if (status === "paid") list = list.filter((b) => b.paid);
    return list.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  }, [bills, status]);

  const onTitleType = (next: NewBill) => {
    setForm(next);
    if (next.payee && next.amount > 0) {
      const key = keyForBill({ payee: next.payee, last4: next.last4, dueDate: next.dueDate, amount: next.amount });
      setDupNotice(
        bills.some((b) => b.id === key)
          ? "A matching bill already exists — saving will update it, not duplicate it."
          : null
      );
    } else {
      setDupNotice(null);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.payee.trim() || !form.amount) return;
    await onAddOrUpdate({
      ...form,
      payee: form.payee.trim(),
      last4: form.last4?.trim() || undefined,
      minimumDue: form.minimumDue || undefined,
    });
    setShowForm(false);
    setForm(emptyForm(t));
    setDupNotice(null);
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-medium text-navy">Bills</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            {bills.length === 0 ? "Add a bill, or sync Gmail to import statements." : `${tallies.unpaidCount} unpaid`}
          </p>
        </div>
        <button
          onClick={() => {
            setForm(emptyForm(t));
            setDupNotice(null);
            setShowForm((s) => !s);
          }}
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-navy text-white text-[12px] font-medium hover:bg-navy/90 transition-colors shrink-0"
        >
          <Plus size={15} /> Add bill
        </button>
      </div>

      {/* Tallies */}
      <div className="grid grid-cols-3 gap-4">
        <Tally label="Outstanding" value={formatINR(tallies.outstanding)} color="#E24B4A" />
        <Tally label="Due in 7 days" value={formatINR(tallies.dueWeek)} color="#D97706" />
        <Tally label="Paid this month" value={formatINR(tallies.paidThisMonth)} color="#0F766E" />
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={submit} className="bg-white rounded-xl border-[0.5px] border-black/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-medium text-navy">New bill</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-navy" aria-label="Close">
              <X size={16} />
            </button>
          </div>
          <input
            value={form.payee}
            onChange={(e) => onTitleType({ ...form, payee: e.target.value })}
            placeholder="Issuer / payee (e.g. HDFC credit card)"
            autoFocus
            className="w-full h-9 px-3 rounded-lg border-[0.5px] border-black/15 text-[13px] outline-none focus:border-navy"
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Field label="Total due (₹)">
              <input
                type="number"
                min={0}
                value={form.amount || ""}
                onChange={(e) => onTitleType({ ...form, amount: Number(e.target.value) })}
                className="w-full h-9 px-2 rounded-lg border-[0.5px] border-black/15 text-[12px] outline-none focus:border-navy"
              />
            </Field>
            <Field label="Due date">
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => onTitleType({ ...form, dueDate: e.target.value })}
                className="w-full h-9 px-2 rounded-lg border-[0.5px] border-black/15 text-[12px] outline-none focus:border-navy"
              />
            </Field>
            <Field label="Category">
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as Bill["category"] })}
                className="w-full h-9 px-2 rounded-lg border-[0.5px] border-black/15 text-[12px] outline-none focus:border-navy capitalize"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.replace("-", " ")}</option>
                ))}
              </select>
            </Field>
            <Field label="Card last 4 (optional)">
              <input
                value={form.last4 || ""}
                maxLength={4}
                inputMode="numeric"
                onChange={(e) => onTitleType({ ...form, last4: e.target.value.replace(/\D/g, "") })}
                placeholder="1234"
                className="w-full h-9 px-2 rounded-lg border-[0.5px] border-black/15 text-[12px] outline-none focus:border-navy"
              />
            </Field>
          </div>
          {dupNotice && (
            <p className="text-[12px] text-[#D97706] bg-[#D97706]/10 border-[0.5px] border-[#D97706]/25 rounded-lg px-3 py-2">
              {dupNotice}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="h-9 px-3 rounded-lg border-[0.5px] border-black/15 text-[12px] text-slate-600 hover:bg-surface">
              Cancel
            </button>
            <button type="submit" disabled={!form.payee.trim() || !form.amount} className="h-9 px-4 rounded-lg bg-navy text-white text-[12px] font-medium disabled:opacity-50 hover:bg-navy/90 transition-colors">
              Save bill
            </button>
          </div>
        </form>
      )}

      {/* Filter */}
      <div className="flex rounded-lg border-[0.5px] border-black/10 bg-white p-0.5 w-fit">
        {(["unpaid", "all", "paid"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`h-7 px-3 rounded-md text-[12px] capitalize transition-colors ${
              status === s ? "bg-navy text-white font-medium" : "text-slate-500 hover:text-navy"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-white border-[0.5px] border-black/10" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-8 flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-lg bg-navy/5 flex items-center justify-center">
            <Receipt size={18} className="text-navy/50" />
          </div>
          <p className="mt-3 text-[13px] font-medium text-navy">
            {bills.length === 0 ? "No bills yet" : "Nothing here"}
          </p>
          <p className="mt-1 text-[12px] text-slate-500 max-w-xs">
            {bills.length === 0 ? "Add one above, or sync Gmail to auto-import statements." : "Switch filter to see other bills."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((bill) => (
            <Fragment key={bill.id}>
              <BillRow bill={bill} today={t} onOpen={() => setSelected(bill)} onSetPaid={onSetPaid} />
            </Fragment>
          ))}
        </ul>
      )}

      {selected && (
        <BillDetail
          bill={selected}
          bills={bills}
          transactions={transactions}
          today={t}
          onClose={() => setSelected(null)}
          onSetPaid={onSetPaid}
          onDelete={(id) => {
            onDelete(id);
            setSelected(null);
          }}
          onCreatePaymentTask={onCreatePaymentTask}
          onSetReminder={onSetReminder}
          onSaveToLibrary={onSaveToLibrary}
        />
      )}
    </div>
  );
}

function Tally({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide" style={{ color }}>{label}</div>
      <div className="mt-1.5 text-[20px] font-medium text-navy tabular-nums">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function BillRow({
  bill,
  today,
  onOpen,
  onSetPaid,
}: {
  bill: Bill;
  today: string;
  onOpen: () => void;
  onSetPaid: (id: string, paid: boolean) => void | Promise<void>;
}) {
  const Icon = CATEGORY_ICON[bill.category];
  const color = CATEGORY_COLOR[bill.category];
  const overdue = !bill.paid && daysUntil(today, bill.dueDate) < 0;

  return (
    <li className="flex items-center gap-3 rounded-lg border-[0.5px] border-black/10 bg-white p-3">
      <button onClick={onOpen} className="flex items-center gap-3 min-w-0 flex-1 text-left">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}14` }}>
          <Icon size={17} style={{ color }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-navy truncate">
            {bill.payee}
            {bill.last4 && <span className="text-slate-400 font-normal"> ···· {bill.last4}</span>}
          </div>
          <div className={`text-[11px] ${bill.paid ? "text-finance" : overdue ? "text-crisis" : "text-slate-400"}`}>
            {bill.paid ? "Paid" : dueLabel(today, bill.dueDate)} · {bill.dueDate}
          </div>
        </div>
        <div className="text-[14px] font-medium text-navy tabular-nums shrink-0">{formatINR(bill.amount)}</div>
      </button>
      <button
        onClick={() => onSetPaid(bill.id, !bill.paid)}
        className={`h-8 px-3 rounded-lg text-[12px] font-medium shrink-0 transition-colors ${
          bill.paid
            ? "border-[0.5px] border-black/15 text-slate-500 hover:bg-surface"
            : "bg-finance text-white hover:bg-finance/90"
        }`}
      >
        {bill.paid ? "Unpay" : "Mark paid"}
      </button>
    </li>
  );
}

function BillDetail({
  bill,
  bills,
  transactions,
  today,
  onClose,
  onSetPaid,
  onDelete,
  onCreatePaymentTask,
  onSetReminder,
  onSaveToLibrary,
}: {
  bill: Bill;
  bills: Bill[];
  transactions: Transaction[];
  today: string;
  onClose: () => void;
  onSetPaid: (id: string, paid: boolean) => void | Promise<void>;
  onDelete: (id: string) => void;
  onCreatePaymentTask: (bill: Bill) => void | Promise<void>;
  onSetReminder: (bill: Bill) => void | Promise<void>;
  onSaveToLibrary: (bill: Bill) => void | Promise<void>;
}) {
  const Icon = CATEGORY_ICON[bill.category];
  const color = CATEGORY_COLOR[bill.category];
  const [insight, setInsight] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [saved, setSaved] = useState(false);

  // Transactions related to this bill (by category or payee keyword).
  const matched = useMemo(() => {
    const key = bill.payee.toLowerCase().split(/\s+/)[0];
    return transactions.filter((t) => t.type === "expense" && (t.category === bill.category || (t.description || "").toLowerCase().includes(key)));
  }, [transactions, bill]);

  const breakdown = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of matched) m.set(t.category || "other", (m.get(t.category || "other") || 0) + t.amount);
    const total = [...m.values()].reduce((s, v) => s + v, 0) || 1;
    return [...m.entries()].map(([c, a]) => ({ category: c, amount: a, pct: Math.round((a / total) * 100) })).sort((a, b) => b.amount - a.amount);
  }, [matched]);

  const topTx = useMemo(() => [...matched].sort((a, b) => b.amount - a.amount).slice(0, 4), [matched]);
  const history = useMemo(() => bills.filter((b) => b.payee === bill.payee && b.id !== bill.id).sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1)), [bills, bill]);

  // Gemini bill insight.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/bill-insight", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bill, transactions: matched }) })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setInsight(d.insight || null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [bill, matched]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/30" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-xl border-[0.5px] border-black/10 overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 h-12 border-b-[0.5px] border-black/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}14` }}><Icon size={15} style={{ color }} /></div>
            <span className="text-[13px] font-medium text-navy">{bill.payee}{bill.last4 ? ` ···· ${bill.last4}` : ""}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-navy" aria-label="Close"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto scrollbar-thin">
          <div className="grid grid-cols-2 gap-3">
            <DetailStat label="Total due" value={formatINR(bill.amount)} />
            <DetailStat label="Minimum due" value={bill.minimumDue != null ? formatINR(bill.minimumDue) : "—"} />
            <DetailStat label="Due date" value={`${bill.dueDate} · ${bill.paid ? "Paid" : dueLabel(today, bill.dueDate)}`} />
            <DetailStat label="Statement month" value={bill.statementMonth || bill.dueDate.slice(0, 7)} />
          </div>

          {/* Gemini insight */}
          <div className="rounded-lg border-[0.5px] border-pulse/25 bg-pulse/5 px-3 py-2.5 flex items-start gap-2">
            <Sparkles size={14} className="text-pulse shrink-0 mt-0.5" />
            <p className="text-[12px] text-navy leading-relaxed">{insight || "Analysing this bill…"}</p>
          </div>

          {/* Spend breakdown */}
          {breakdown.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1.5">Spend breakdown</div>
              <ul className="space-y-1.5">
                {breakdown.map((b) => (
                  <li key={b.category}>
                    <div className="flex justify-between text-[12px] text-navy"><span className="capitalize">{b.category}</span><span className="tabular-nums">{formatINR(b.amount)} · {b.pct}%</span></div>
                    <div className="h-1.5 rounded-full mt-0.5" style={{ width: `${b.pct}%`, background: color }} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Top transactions */}
          {topTx.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1.5">Top transactions</div>
              <ul className="divide-y divide-black/5">
                {topTx.map((t, i) => (
                  <li key={t.id || i} className="flex justify-between py-1.5 text-[12px]"><span className="text-navy truncate">{t.description}</span><span className="text-slate-500 tabular-nums shrink-0">{formatINR(t.amount)}</span></li>
                ))}
              </ul>
            </div>
          )}

          {/* Bill history */}
          {history.length > 0 && (
            <div>
              <button onClick={() => setShowHistory((v) => !v)} className="text-[12px] font-medium text-navy hover:underline">{showHistory ? "Hide" : "Show"} bill history ({history.length})</button>
              {showHistory && (
                <ul className="mt-1.5 divide-y divide-black/5">
                  {history.map((h) => (
                    <li key={h.id} className="flex justify-between py-1.5 text-[12px]"><span className="text-slate-500">{h.statementMonth || h.dueDate}</span><span className="text-navy tabular-nums">{formatINR(h.amount)} · {h.paid ? "paid" : "unpaid"}</span></li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="text-[10px] font-mono text-slate-400 break-all">id: {bill.dedupeKey || bill.id}</div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <ActionBtn icon={Check} label={bill.paid ? "Mark unpaid" : "Mark paid"} primary={!bill.paid} onClick={() => onSetPaid(bill.id, !bill.paid)} />
            <ActionBtn icon={CalendarPlus} label="Add payment task" onClick={() => onCreatePaymentTask(bill)} />
            <ActionBtn icon={Bell} label="Set reminder" onClick={() => onSetReminder(bill)} />
            <ActionBtn icon={Save} label={saved ? "Saved to library" : "Save to library"} onClick={() => { onSaveToLibrary(bill); setSaved(true); }} />
          </div>
          <button onClick={() => onDelete(bill.id)} className="w-full h-9 rounded-lg border-[0.5px] border-crisis/30 text-[12px] font-medium text-crisis hover:bg-crisis/10 flex items-center justify-center gap-1.5">
            <Trash2 size={14} /> Delete bill
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick, primary }: { icon: LucideIcon; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick} className={`h-9 px-3 rounded-lg text-[12px] font-medium flex items-center justify-center gap-1.5 ${primary ? "bg-finance text-white hover:bg-finance/90" : "border-[0.5px] border-black/15 text-navy hover:bg-surface"}`}>
      <Icon size={14} /> {label}
    </button>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-[13px] font-medium text-navy tabular-nums">{value}</div>
    </div>
  );
}
