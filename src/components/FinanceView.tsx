import { Fragment, useMemo, useState, type FormEvent } from "react";
import {
  Wallet, TrendingUp, TrendingDown, BarChart3, Repeat, HandCoins, Plus, Trash2, Pause, Play, XCircle, MessageCircle, Copy, ArrowUpRight, ArrowDownRight, Landmark, type LucideIcon,
} from "lucide-react";
import { formatINR, ymd } from "../lib/dashboard";
import {
  categoryMoM, detectRecurring, monthlyTotals, prevMonth, subscriptionAnnualCost, subscriptionMonthlyCost,
  daysSince, shouldRemind, waterfall, whatsappDraft, whatsappLink,
} from "../lib/finance";
import type { Receivable, Subscription, Transaction } from "../types";
import type { PaymentInstance } from "../lib/recurring";

interface FinanceViewProps {
  transactions: Transaction[];
  subscriptions: Subscription[];
  receivables: Receivable[];
  paymentInstances?: PaymentInstance[];
  today?: string;
  onAddTransaction: (t: Omit<Transaction, "id" | "userId">) => void | Promise<void>;
  onAddSubscription: (s: { name: string; amount: number; frequency: "monthly" | "yearly"; category: string }) => void | Promise<void>;
  onToggleSub: (id: string, active: boolean) => void | Promise<void>;
  onDeleteSub: (id: string) => void | Promise<void>;
  onCancelSub: (sub: Subscription) => void | Promise<void>;
  onAddReceivable: (r: { debtor: string; amount: number; date: string; description?: string }) => void | Promise<void>;
  onToggleReminded: (id: string, reminded: boolean) => void | Promise<void>;
  onDeleteReceivable: (id: string) => void | Promise<void>;
  onOpenRecurring?: () => void;
  onOpenFDs?: () => void;
}

type Tab = "cashflow" | "categories" | "subscriptions" | "receivables";
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function FinanceView(props: FinanceViewProps) {
  const { transactions, subscriptions, receivables, paymentInstances = [] } = props;
  const t = props.today ?? ymd(new Date());
  const ym = t.slice(0, 7);
  const [tab, setTab] = useState<Tab>("cashflow");
  const monthName = MONTHS[Number(ym.slice(5, 7)) - 1];

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[20px] font-medium text-navy">Finance</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">{monthName} · income, spending, subscriptions, and receivables.</p>
        </div>
        <div className="flex items-center gap-2">
          {props.onOpenRecurring && (
            <button onClick={props.onOpenRecurring} className="h-9 px-3 rounded-lg border-[0.5px] border-black/15 text-[12px] font-medium text-navy hover:bg-surface flex items-center gap-1.5">
              <Repeat size={14} /> Recurring payments
            </button>
          )}
          {props.onOpenFDs && (
            <button onClick={props.onOpenFDs} className="h-9 px-3 rounded-lg border-[0.5px] border-black/15 text-[12px] font-medium text-navy hover:bg-surface flex items-center gap-1.5">
              <Landmark size={14} /> Fixed deposits
            </button>
          )}
        </div>
      </div>

      <div className="flex rounded-lg border-[0.5px] border-black/10 bg-white p-0.5 w-fit overflow-x-auto">
        {([
          { id: "cashflow", label: "Cashflow", icon: Wallet },
          { id: "categories", label: "Categories", icon: BarChart3 },
          { id: "subscriptions", label: "Subscriptions", icon: Repeat },
          { id: "receivables", label: "Receivables", icon: HandCoins },
        ] as { id: Tab; label: string; icon: LucideIcon }[]).map((x) => {
          const Icon = x.icon;
          return (
            <button key={x.id} onClick={() => setTab(x.id)} className={`h-8 px-3 rounded-md text-[12px] font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors ${tab === x.id ? "bg-navy text-white" : "text-slate-500 hover:text-navy"}`}>
              <Icon size={14} /> {x.label}
            </button>
          );
        })}
      </div>

      {tab === "cashflow" && (
        <Cashflow
          transactions={transactions}
          subscriptions={subscriptions}
          receivables={receivables}
          paymentInstances={paymentInstances}
          ym={ym}
          onAdd={props.onAddTransaction}
        />
      )}
      {tab === "categories" && <Categories transactions={transactions} ym={ym} monthName={monthName} />}
      {tab === "subscriptions" && <Subscriptions {...props} today={t} />}
      {tab === "receivables" && <Receivables {...props} today={t} />}
    </div>
  );
}

// ── Cashflow + waterfall ──
function Cashflow({ transactions, subscriptions, receivables, paymentInstances, ym, onAdd }: {
  transactions: Transaction[];
  subscriptions: Subscription[];
  receivables: Receivable[];
  paymentInstances: PaymentInstance[];
  ym: string;
  onAdd: FinanceViewProps["onAddTransaction"];
}) {
  const totals = monthlyTotals(transactions, ym);
  const wf = waterfall(transactions, ym);
  const recent = [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8);

  // Committed / expected money that isn't realized cash yet.
  const subsMonthly = subscriptionMonthlyCost(subscriptions);
  const recurringDue = paymentInstances
    .filter((i) => i.status !== "paid" && i.status !== "skipped" && i.dueDate.startsWith(ym))
    .reduce((s, i) => s + (i.plannedAmount || 0), 0);
  const toCollect = receivables.reduce((s, r) => s + (r.amount || 0), 0);
  const projectedNet = wf.closing - subsMonthly - recurringDue + toCollect;
  const hasProjection = subsMonthly > 0 || recurringDue > 0 || toCollect > 0;
  const [form, setForm] = useState({ description: "", amount: "", type: "expense" as "income" | "expense", category: "" });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.description.trim() || !Number(form.amount)) return;
    onAdd({ description: form.description.trim(), amount: Number(form.amount), type: form.type, category: form.category.trim() || "general", date: ymd(new Date()) });
    setForm({ description: "", amount: "", type: "expense", category: "" });
  };

  const bars = [
    { label: "Opening", value: wf.opening, color: "#1B3A6B" },
    { label: "Inflows", value: wf.inflows, color: "#0F766E" },
    { label: "Outflows", value: -wf.outflows, color: "#E24B4A" },
    { label: "Net", value: wf.closing, color: "#2BA8E0" },
  ];
  const max = Math.max(1, ...bars.map((b) => Math.abs(b.value)));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Tally label="Net balance" value={formatINR(wf.closing)} color="#1B3A6B" />
        <Tally label="Inflows" value={formatINR(totals.income)} color="#0F766E" />
        <Tally label="Outflows" value={formatINR(totals.expense)} color="#E24B4A" />
      </div>

      <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4">
        <h2 className="text-[13px] font-medium text-navy mb-3">Monthly waterfall</h2>
        <div className="flex items-end gap-4 h-36">
          {bars.map((b) => (
            <div key={b.label} className="flex-1 flex flex-col items-center justify-end h-full">
              <span className="text-[11px] tabular-nums mb-1" style={{ color: b.color }}>{formatINR(b.value)}</span>
              <div className="w-full rounded-t-md" style={{ height: `${Math.max(4, (Math.abs(b.value) / max) * 100)}%`, background: b.color, opacity: b.value < 0 ? 0.85 : 1 }} />
              <span className="text-[11px] text-slate-500 mt-1.5">{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      {hasProjection && (
        <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4">
          <h2 className="text-[13px] font-medium text-navy">Upcoming & expected this month</h2>
          <p className="text-[11px] text-slate-400 mb-2.5">Committed and expected money — not yet in your actual balance.</p>
          <ul className="space-y-1.5 text-[13px]">
            <ProjRow label="Subscriptions (recurring)" value={-subsMonthly} hint="active subscriptions" />
            <ProjRow label="Recurring due (rent, EMI…)" value={-recurringDue} hint="unpaid this month" />
            <ProjRow label="To collect (receivables)" value={toCollect} hint="owed to you" />
          </ul>
          <div className="flex items-center justify-between border-t-[0.5px] border-black/10 mt-2 pt-2 text-[13px]">
            <span className="font-medium text-navy">Projected net</span>
            <span className="font-medium text-navy tabular-nums">{formatINR(projectedNet)}</span>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="bg-white rounded-xl border-[0.5px] border-black/10 p-4 grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
        <Inp label="Description" className="col-span-2" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        <Inp label="Amount (₹)" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} />
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-slate-400">Type</span>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })} className="h-9 px-2 rounded-lg border-[0.5px] border-black/15 text-[12px] outline-none focus:border-navy">
            <option value="expense">Expense</option><option value="income">Income</option>
          </select>
        </label>
        <button type="submit" className="h-9 rounded-lg bg-navy text-white text-[12px] font-medium flex items-center justify-center gap-1.5 hover:bg-navy/90"><Plus size={14} /> Add</button>
      </form>

      <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4">
        <h2 className="text-[13px] font-medium text-navy mb-2">Recent transactions</h2>
        {recent.length === 0 ? <p className="text-[12px] text-slate-400">No transactions yet — sync Gmail or add one above.</p> : (
          <ul className="divide-y divide-black/5">
            {recent.map((tx, i) => (
              <li key={tx.id || i} className="flex items-center gap-3 py-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: tx.type === "income" ? "#0F766E14" : "#E24B4A14" }}>
                  {tx.type === "income" ? <ArrowUpRight size={14} className="text-finance" /> : <ArrowDownRight size={14} className="text-crisis" />}
                </div>
                <div className="min-w-0 flex-1"><div className="text-[13px] text-navy truncate">{tx.description}</div><div className="text-[11px] text-slate-400">{tx.category} · {tx.date}</div></div>
                <div className={`text-[13px] font-medium tabular-nums ${tx.type === "income" ? "text-finance" : "text-navy"}`}>{tx.type === "income" ? "+" : "−"}{formatINR(tx.amount)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Categories MoM ──
function Categories({ transactions, ym, monthName }: { transactions: Transaction[]; ym: string; monthName: string }) {
  const rows = useMemo(() => categoryMoM(transactions, ym), [transactions, ym]);
  const max = Math.max(1, ...rows.flatMap((r) => [r.current, r.previous]));
  const prevName = MONTHS[Number(prevMonth(ym).slice(5, 7)) - 1];
  return (
    <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4">
      <h2 className="text-[13px] font-medium text-navy mb-1">Expense by category</h2>
      <p className="text-[11px] text-slate-400 mb-3">{monthName} vs {prevName}</p>
      {rows.length === 0 ? <p className="text-[12px] text-slate-400">No expenses recorded this month.</p> : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.category}>
              <div className="flex items-center justify-between text-[12px] mb-1">
                <span className="text-navy capitalize">{r.category}</span>
                <span className="flex items-center gap-2">
                  <span className="text-navy font-medium tabular-nums">{formatINR(r.current)}</span>
                  {r.changePct !== null && (
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full" style={r.changePct > 0 ? { background: "#E24B4A14", color: "#E24B4A" } : { background: "#0F766E14", color: "#0F766E" }}>
                      {r.changePct > 0 ? "+" : ""}{r.changePct}%
                    </span>
                  )}
                </span>
              </div>
              <div className="space-y-1">
                <div className="h-2 rounded-full bg-navy" style={{ width: `${(r.current / max) * 100}%` }} />
                <div className="h-2 rounded-full bg-slate-200" style={{ width: `${(r.previous / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Subscriptions ──
function Subscriptions({ transactions, subscriptions, today, onAddSubscription, onToggleSub, onDeleteSub, onCancelSub }: FinanceViewProps & { today: string }) {
  const monthly = subscriptionMonthlyCost(subscriptions);
  const annual = subscriptionAnnualCost(subscriptions);
  const tracked = new Set(subscriptions.map((s) => s.name.toLowerCase()));
  const detected = detectRecurring(transactions).filter((d) => !tracked.has(d.name.toLowerCase())).slice(0, 4);
  const [form, setForm] = useState({ name: "", amount: "", frequency: "monthly" as "monthly" | "yearly", category: "other" });
  void today;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !Number(form.amount)) return;
    onAddSubscription({ name: form.name.trim(), amount: Number(form.amount), frequency: form.frequency, category: form.category });
    setForm({ name: "", amount: "", frequency: "monthly", category: "other" });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Tally label="Monthly cost" value={formatINR(monthly)} color="#6D28D9" />
        <Tally label="Annual projection" value={formatINR(annual)} color="#1B3A6B" />
      </div>

      {detected.length > 0 && (
        <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4">
          <h2 className="text-[13px] font-medium text-navy mb-2">Detected recurring charges</h2>
          <ul className="space-y-1.5">
            {detected.map((d) => (
              <li key={d.name} className="flex items-center justify-between gap-2 rounded-lg border-[0.5px] border-black/10 px-2.5 py-1.5">
                <span className="text-[12px] text-navy">{d.name} · {formatINR(d.amount)} · {d.months} months</span>
                <button onClick={() => onAddSubscription({ name: d.name, amount: d.amount, frequency: "monthly", category: "other" })} className="text-[11px] font-medium text-pulse hover:underline">Track</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={submit} className="bg-white rounded-xl border-[0.5px] border-black/10 p-4 grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
        <Inp label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <Inp label="Amount (₹)" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} />
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-slate-400">Frequency</span>
          <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as any })} className="h-9 px-2 rounded-lg border-[0.5px] border-black/15 text-[12px] outline-none focus:border-navy">
            <option value="monthly">Monthly</option><option value="yearly">Yearly</option>
          </select>
        </label>
        <button type="submit" className="h-9 rounded-lg bg-navy text-white text-[12px] font-medium flex items-center justify-center gap-1.5 hover:bg-navy/90"><Plus size={14} /> Add</button>
      </form>

      <div className="space-y-2">
        {subscriptions.length === 0 ? (
          <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-6 text-center text-[12px] text-slate-400">No subscriptions tracked yet.</div>
        ) : subscriptions.map((s) => (
          <Fragment key={s.id}>
            <div className={`flex items-center gap-3 rounded-lg border-[0.5px] border-black/10 bg-white p-3 ${s.active === false ? "opacity-60" : ""}`}>
              <div className="w-9 h-9 rounded-lg bg-tax/10 flex items-center justify-center shrink-0"><Repeat size={16} className="text-tax" /></div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-navy truncate flex items-center gap-2">{s.name}{s.isUnused && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#D97706]/14 text-[#D97706]">Unused</span>}</div>
                <div className="text-[11px] text-slate-400">{formatINR(s.amount)}/{s.frequency === "yearly" ? "yr" : "mo"}{s.frequency === "monthly" ? ` · ${formatINR((s.amount || 0) * 12)}/yr` : ""}</div>
              </div>
              <button onClick={() => onToggleSub(s.id, s.active !== false)} aria-label="Pause/resume" className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-surface hover:text-navy">{s.active === false ? <Play size={15} /> : <Pause size={15} />}</button>
              <button onClick={() => onCancelSub(s)} className="h-8 px-2.5 rounded-lg text-[11px] font-medium text-crisis border-[0.5px] border-crisis/30 hover:bg-crisis/10 flex items-center gap-1"><XCircle size={13} /> Cancel</button>
              <button onClick={() => onDeleteSub(s.id)} aria-label="Delete" className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-crisis/10 hover:text-crisis"><Trash2 size={15} /></button>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// ── Receivables ──
function Receivables({ receivables, today, onAddReceivable, onToggleReminded, onDeleteReceivable }: FinanceViewProps & { today: string }) {
  const total = receivables.reduce((s, r) => s + (r.amount || 0), 0);
  const [form, setForm] = useState({ debtor: "", amount: "", description: "", date: ymd(new Date()) });
  const [copied, setCopied] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.debtor.trim() || !Number(form.amount)) return;
    onAddReceivable({ debtor: form.debtor.trim(), amount: Number(form.amount), date: form.date, description: form.description.trim() || undefined });
    setForm({ debtor: "", amount: "", description: "", date: ymd(new Date()) });
  };
  const copy = (r: Receivable) => { navigator.clipboard?.writeText(whatsappDraft(r)); setCopied(r.id); setTimeout(() => setCopied(null), 1500); };

  return (
    <div className="space-y-4">
      <Tally label="Money to collect" value={formatINR(total)} color="#2BA8E0" />
      <form onSubmit={submit} className="bg-white rounded-xl border-[0.5px] border-black/10 p-4 grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
        <Inp label="Who owes you" value={form.debtor} onChange={(v) => setForm({ ...form, debtor: v })} />
        <Inp label="Amount (₹)" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} />
        <Inp label="For (optional)" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        <button type="submit" className="h-9 rounded-lg bg-navy text-white text-[12px] font-medium flex items-center justify-center gap-1.5 hover:bg-navy/90"><Plus size={14} /> Add</button>
      </form>

      <div className="space-y-2">
        {receivables.length === 0 ? (
          <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-6 text-center text-[12px] text-slate-400">Nobody owes you right now.</div>
        ) : receivables.map((r) => {
          const days = daysSince(r.date, today);
          const remind = shouldRemind(r, today);
          return (
            <Fragment key={r.id}>
              <div className="flex items-center gap-3 rounded-lg border-[0.5px] border-black/10 bg-white p-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-navy truncate">{r.debtor} · {formatINR(r.amount)}</div>
                  <div className={`text-[11px] ${remind ? "text-crisis" : "text-slate-400"}`}>{r.description ? `${r.description} · ` : ""}{days}d ago{remind ? " · follow up" : ""}{r.reminded ? " · reminded" : ""}</div>
                </div>
                <a href={whatsappLink(r)} target="_blank" rel="noreferrer" className="h-8 px-2.5 rounded-lg text-[11px] font-medium text-finance border-[0.5px] border-finance/30 hover:bg-finance/10 flex items-center gap-1"><MessageCircle size={13} /> WhatsApp</a>
                <button onClick={() => copy(r)} aria-label="Copy reminder" className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-surface hover:text-navy">{copied === r.id ? <span className="text-[10px] text-finance">✓</span> : <Copy size={14} />}</button>
                <button onClick={() => onToggleReminded(r.id, !!r.reminded)} className="h-8 px-2.5 rounded-lg text-[11px] text-slate-500 border-[0.5px] border-black/15 hover:bg-surface">{r.reminded ? "Unmark" : "Mark reminded"}</button>
                <button onClick={() => onDeleteReceivable(r.id)} aria-label="Delete" className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-crisis/10 hover:text-crisis"><Trash2 size={15} /></button>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ── Shared bits ──
function Tally({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide" style={{ color }}>{label}</div>
      <div className="mt-1.5 text-[20px] font-medium text-navy tabular-nums">{value}</div>
    </div>
  );
}
function ProjRow({ label, value, hint }: { label: string; value: number; hint: string }) {
  const color = value === 0 ? "#94a3b8" : value < 0 ? "#E24B4A" : "#0F766E";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return (
    <li className="flex items-center justify-between">
      <span className="text-slate-600">{label} <span className="text-slate-400 text-[11px]">· {hint}</span></span>
      <span className="tabular-nums" style={{ color }}>{sign}{formatINR(Math.abs(value))}</span>
    </li>
  );
}

function Inp({ label, value, onChange, type = "text", className = "" }: { label: string; value: string; onChange: (v: string) => void; type?: string; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 px-2 rounded-lg border-[0.5px] border-black/15 text-[12px] outline-none focus:border-navy" />
    </label>
  );
}
