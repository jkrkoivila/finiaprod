import { Fragment, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Plus, X, Landmark, ChevronRight, Check, FileText } from "lucide-react";
import { formatINR, ymd } from "../lib/dashboard";
import {
  amountAfter, computeFd, liveAccrued, yearsBetween, daysBetween, COMPOUNDING_LABELS,
  type Compounding, type PayoutType, type PayoutFrequency,
} from "../lib/fd";
import type { FdIncomeEntry, FixedDeposit, FdStatus } from "../types";
import type { NewFd } from "../lib/fdMutations";

const BANK_PICKS = ["HDFC", "SBI", "ICICI", "Post Office", "Axis", "Kotak"];
const STATUS_BADGE: Record<FdStatus, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-finance/10 text-finance" },
  matured: { label: "Matured", cls: "bg-[#D97706]/10 text-[#D97706]" },
  renewed: { label: "Auto-renewed", cls: "bg-tax/10 text-tax" },
  closed: { label: "Closed", cls: "bg-slate-100 text-slate-500" },
};
// Color strip by days to maturity.
function stripColor(days: number): string {
  if (days < 30) return "#E24B4A";
  if (days <= 180) return "#D97706";
  return "#0F766E";
}

interface Props {
  fds: FixedDeposit[];
  schedule: FdIncomeEntry[];
  today?: string;
  loading?: boolean;
  initialDetailId?: string;
  onCreate: (data: NewFd) => void | Promise<void>;
  onEdit: (fd: FixedDeposit, patch: Partial<NewFd>) => void | Promise<void>;
  onMarkMatured: (fd: FixedDeposit) => void | Promise<void>;
  onMarkRenewed: (fd: FixedDeposit) => void | Promise<void>;
  onClose: (fd: FixedDeposit) => void | Promise<void>;
  onSetTax: (fd: FixedDeposit, patch: { taxTracked?: boolean; tdsTracked?: boolean }) => void | Promise<void>;
  onBack: () => void;
}

export default function FixedDepositsView(props: Props) {
  const t = props.today ?? ymd(new Date());
  const [detailId, setDetailId] = useState<string | null>(props.initialDetailId ?? null);
  const [form, setForm] = useState<{ editing: FixedDeposit | null; draft: FdDraft } | null>(null);

  const detailFd = detailId ? props.fds.find((f) => f.id === detailId) : null;
  useEffect(() => {
    if (detailId && !props.loading && !detailFd) setDetailId(null);
  }, [detailId, detailFd, props.loading]);

  // ── Form (add / edit) ──
  if (form) {
    return (
      <FdForm
        today={t}
        editing={form.editing}
        draft={form.draft}
        setDraft={(d) => setForm((f) => (f ? { ...f, draft: d } : f))}
        onCancel={() => setForm(null)}
        onSubmit={async () => {
          const data = draftToNew(form.draft);
          if (form.editing) await props.onEdit(form.editing, data);
          else await props.onCreate(data);
          setForm(null);
        }}
      />
    );
  }

  // ── Detail ──
  if (detailId) {
    if (!detailFd) {
      if (props.loading) return <div className="p-10 flex justify-center"><Spin /></div>;
      return null;
    }
    return (
      <FdDetail
        fd={detailFd}
        today={t}
        schedule={props.schedule.filter((s) => s.fdId === detailFd.fdId)}
        onBack={() => setDetailId(null)}
        onEdit={() => setForm({ editing: detailFd, draft: fdToDraft(detailFd) })}
        onMarkMatured={() => props.onMarkMatured(detailFd)}
        onMarkRenewed={() => props.onMarkRenewed(detailFd)}
        onClose={() => { props.onClose(detailFd); setDetailId(null); }}
        onSetTax={(patch) => props.onSetTax(detailFd, patch)}
      />
    );
  }

  // ── List ──
  const active = props.fds.filter((f) => f.status !== "closed");
  const corpus = active.reduce((s, f) => s + (f.principal || 0), 0);
  const projectedInterest = active.reduce((s, f) => s + computeFd(f, t).totalInterest, 0);
  const accruedSoFar = active.reduce((s, f) => s + computeFd(f, t).interestAccruedToDate, 0);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button onClick={props.onBack} className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-navy"><ArrowLeft size={14} /> Finance</button>
        <button onClick={() => setForm({ editing: null, draft: emptyDraft(t) })} className="h-9 px-3 rounded-lg bg-navy text-white text-[12px] font-medium flex items-center gap-1.5 hover:bg-navy/90"><Plus size={15} /> Add FD</button>
      </div>
      <div>
        <h1 className="text-[20px] font-medium text-navy">Fixed Deposits</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">Total corpus {formatINR(corpus)} · accrued so far {formatINR(accruedSoFar)} · projected interest {formatINR(projectedInterest)}</p>
      </div>

      {props.loading ? (
        <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-6 text-[13px] text-slate-500">Loading…</div>
      ) : props.fds.length === 0 ? (
        <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-8 text-center">
          <div className="w-10 h-10 rounded-lg bg-navy/5 flex items-center justify-center mx-auto"><Landmark size={18} className="text-navy/50" /></div>
          <p className="mt-3 text-[13px] font-medium text-navy">No fixed deposits yet</p>
          <p className="mt-1 text-[12px] text-slate-500">Add an FD to track interest, maturity, and income automatically.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {props.fds.map((fd) => {
            const c = computeFd(fd, t);
            const strip = fd.status === "active" ? stripColor(c.daysToMaturity) : "#94A3B8";
            const badge = STATUS_BADGE[fd.status];
            return (
              <Fragment key={fd.id}>
                <li className="flex items-stretch rounded-lg border-[0.5px] border-black/10 bg-white overflow-hidden">
                  <span className="w-1 shrink-0" style={{ background: strip }} />
                  <button onClick={() => setDetailId(fd.id)} className="flex items-center gap-3 min-w-0 flex-1 text-left p-3">
                    <div className="w-9 h-9 rounded-lg bg-navy/5 flex items-center justify-center shrink-0 text-[13px] font-medium text-navy">{(fd.bank || "?").charAt(0)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-navy truncate">{fd.bank} · {formatINR(fd.principal)}</div>
                      <div className="text-[11px] text-slate-400">{fd.interestRate}% · {COMPOUNDING_LABELS[fd.compoundingFrequency]} · matures {fd.maturityDate}{fd.status === "active" ? ` · ${c.daysToMaturity < 0 ? "overdue" : `${c.daysToMaturity}d left`}` : ""}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[13px] font-medium text-navy tabular-nums">{formatINR(c.maturityAmount)}</div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 shrink-0" />
                  </button>
                </li>
              </Fragment>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Detail view ──
function FdDetail({ fd, today, schedule, onBack, onEdit, onMarkMatured, onMarkRenewed, onClose, onSetTax }: {
  fd: FixedDeposit; today: string; schedule: FdIncomeEntry[];
  onBack: () => void; onEdit: () => void; onMarkMatured: () => void; onMarkRenewed: () => void; onClose: () => void;
  onSetTax: (patch: { taxTracked?: boolean; tdsTracked?: boolean }) => void;
}) {
  const c = useMemo(() => computeFd(fd, today), [fd, today]);
  const [taxOpen, setTaxOpen] = useState(false);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-navy"><ArrowLeft size={14} /> All fixed deposits</button>

      {/* Live accrual counter */}
      <div className="bg-navy text-white rounded-xl p-4">
        <div className="text-[12px] text-white/70">{fd.bank} · {fd.payoutType === "cumulative" ? "Accrued so far" : "Interest accrued"}</div>
        <LiveCounter base={c.interestAccruedToDate} perSecondRate={fd.status === "active" ? c.perSecondRate : 0} />
        {fd.payoutType === "cumulative" && <div className="text-[11px] text-white/55 mt-1">Unrealised until maturity on {fd.maturityDate}</div>}
      </div>

      {/* Key figures */}
      <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[13px] font-medium text-navy">{fd.bank} fixed deposit</h2>
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_BADGE[fd.status].cls}`}>{STATUS_BADGE[fd.status].label}</span>
        </div>
        {fd.description && <p className="text-[12px] text-slate-500 mb-2">{fd.description}</p>}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[12px]">
          <Fig k="Principal" v={formatINR(fd.principal)} />
          <Fig k="Rate" v={`${fd.interestRate}% · ${COMPOUNDING_LABELS[fd.compoundingFrequency]}`} />
          <Fig k="Tenure" v={`${c.tenureYears.toFixed(2)} yr · ${c.tenureDays}d`} />
          <Fig k="Maturity amount" v={formatINR(c.maturityAmount)} />
          <Fig k="Total interest" v={formatINR(c.totalInterest)} />
          {fd.tdsDeducted && <Fig k="Net after TDS" v={formatINR(c.netInterestAfterTds)} />}
          <Fig k="Maturity date" v={fd.maturityDate} />
          <Fig k="Payout" v={fd.payoutType === "cumulative" ? "Cumulative" : `Non-cumulative · ${fd.payoutFrequency}`} />
          {fd.certificateNumber && <Fig k="Certificate" v={fd.certificateNumber} />}
        </div>
        {fd.certificateNumber && (
          <a href="#" onClick={(e) => e.preventDefault()} className="mt-2 inline-flex items-center gap-1 text-[12px] text-pulse"><FileText size={13} /> View certificate in document library</a>
        )}
      </div>

      {/* Interest schedule */}
      <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4">
        <h2 className="text-[13px] font-medium text-navy mb-2">Interest schedule</h2>
        <div className="overflow-x-auto"><table className="w-full text-[12px]">
          <thead><tr className="text-slate-400 text-left"><th className="font-normal py-1">Period ends</th><th className="font-normal py-1 text-right">Interest</th></tr></thead>
          <tbody className="tabular-nums">
            {c.schedule.map((p, i) => (
              <tr key={i} className="border-t-[0.5px] border-black/5"><td className="py-1.5 text-navy">{p.date}</td><td className="py-1.5 text-right text-slate-600">{formatINR(p.interestAmount)}</td></tr>
            ))}
          </tbody>
        </table></div>
      </div>

      {/* Payout history (non-cumulative) */}
      {fd.payoutType === "non-cumulative" && (
        <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4">
          <h2 className="text-[13px] font-medium text-navy mb-2">Payout history</h2>
          {schedule.length === 0 ? (
            <p className="text-[12px] text-slate-500">No payouts scheduled.</p>
          ) : (
            <ul className="divide-y divide-black/5">
              {[...schedule].sort((a, b) => (a.date < b.date ? -1 : 1)).map((s) => (
                <li key={s.id} className="flex items-center justify-between py-1.5 text-[12px]">
                  <span className="text-navy">{s.date}</span>
                  <span className="tabular-nums text-slate-600">{formatINR(s.amount)}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.status === "paid" ? "bg-finance/10 text-finance" : "bg-slate-100 text-slate-500"}`}>{s.status === "paid" ? "Paid" : "Upcoming"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Tax tracking — optional, user-controlled */}
      <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4">
        <button onClick={() => setTaxOpen((v) => !v)} className="w-full flex items-center justify-between text-[13px] font-medium text-navy">
          Tax tracking <span className="text-[11px] text-slate-400">{taxOpen ? "Hide" : "Optional — tap to expand"}</span>
        </button>
        {taxOpen && (
          <div className="mt-3 space-y-3">
            <ToggleRow label="Include this FD's interest in my tax calculation" sub={`Adds ₹${c.annualInterest.toLocaleString("en-IN")}/yr to Income from Other Sources. FD interest is taxable in the year it accrues, not at maturity.`} on={!!fd.taxTracked} onClick={() => onSetTax({ taxTracked: !fd.taxTracked })} />
            <ToggleRow label="Bank deducts TDS on this FD" sub={fd.tdsTracked ? `Projected TDS ₹${c.projectedTds.toLocaleString("en-IN")} will count as advance tax paid in the tax module.` : `Projected TDS ₹${c.projectedTds.toLocaleString("en-IN")} (principal × rate% × ${fd.tdsRate ?? 10}%). Toggle on to count it as advance tax paid.`} on={!!fd.tdsTracked} onClick={() => onSetTax({ tdsTracked: !fd.tdsTracked })} />
            <p className="text-[11px] text-slate-500 bg-surface rounded-lg px-3 py-2">FD interest does not qualify for the 80TTA deduction — it is fully taxable under Income from Other Sources. If this FD belongs to a family member, leave these off so it isn't added to your return.</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button onClick={onEdit} className="h-9 px-3 rounded-lg border-[0.5px] border-black/15 text-[12px] font-medium text-navy hover:bg-surface">Edit FD</button>
        {fd.status === "active" && <button onClick={onMarkMatured} className="h-9 px-3 rounded-lg border-[0.5px] border-black/15 text-[12px] font-medium text-navy hover:bg-surface">Mark as matured</button>}
        {fd.status === "active" && <button onClick={onMarkRenewed} className="h-9 px-3 rounded-lg border-[0.5px] border-black/15 text-[12px] font-medium text-navy hover:bg-surface">Mark as renewed</button>}
        {fd.status !== "closed" && <button onClick={onClose} className="h-9 px-3 rounded-lg border-[0.5px] border-crisis/30 text-[12px] font-medium text-crisis hover:bg-crisis/10">Close FD</button>}
      </div>
    </div>
  );
}

function LiveCounter({ base, perSecondRate }: { base: number; perSecondRate: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (perSecondRate <= 0) return;
    const id = window.setInterval(() => setElapsed((e) => e + 3), 3000);
    return () => window.clearInterval(id);
  }, [perSecondRate]);
  const val = liveAccrued(base, perSecondRate, elapsed);
  return <div className="text-[26px] font-medium tabular-nums mt-0.5">₹{val.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>;
}

// ── Add / edit form ──
interface FdDraft {
  bank: string; principal: string; interestRate: string; startDate: string; maturityDate: string;
  compoundingFrequency: Compounding; payoutType: PayoutType; payoutFrequency: PayoutFrequency;
  description: string; certificateNumber: string; tdsDeducted: boolean; autoRenew: boolean;
}
const emptyDraft = (today: string): FdDraft => ({
  bank: "", principal: "", interestRate: "", startDate: today, maturityDate: "",
  compoundingFrequency: "quarterly", payoutType: "cumulative", payoutFrequency: "quarterly",
  description: "", certificateNumber: "", tdsDeducted: true, autoRenew: false,
});
const fdToDraft = (fd: FixedDeposit): FdDraft => ({
  bank: fd.bank, principal: String(fd.principal), interestRate: String(fd.interestRate), startDate: fd.startDate, maturityDate: fd.maturityDate,
  compoundingFrequency: fd.compoundingFrequency, payoutType: fd.payoutType, payoutFrequency: fd.payoutFrequency || "quarterly",
  description: fd.description || "", certificateNumber: fd.certificateNumber || "", tdsDeducted: fd.tdsDeducted, autoRenew: fd.autoRenew,
});
const draftToNew = (d: FdDraft): NewFd => ({
  bank: d.bank.trim(), principal: Number(d.principal) || 0, interestRate: Number(d.interestRate) || 0,
  startDate: d.startDate, maturityDate: d.maturityDate, compoundingFrequency: d.compoundingFrequency,
  payoutType: d.payoutType, payoutFrequency: d.payoutType === "non-cumulative" ? d.payoutFrequency : undefined,
  description: d.description.trim() || undefined, certificateNumber: d.certificateNumber.trim() || undefined,
  tdsDeducted: d.tdsDeducted, autoRenew: d.autoRenew,
});

function FdForm({ today, editing, draft, setDraft, onCancel, onSubmit }: {
  today: string; editing: FixedDeposit | null; draft: FdDraft; setDraft: (d: FdDraft) => void; onCancel: () => void; onSubmit: () => Promise<void>;
}) {
  void today;
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<FdDraft>) => setDraft({ ...draft, ...patch });
  const principal = Number(draft.principal) || 0;
  const rate = Number(draft.interestRate) || 0;
  const valid = !!(principal > 0 && rate > 0 && draft.startDate && draft.maturityDate && draft.bank.trim() && draft.maturityDate > draft.startDate);

  const preview = useMemo(() => {
    if (!valid) return null;
    const T = yearsBetween(draft.startDate, draft.maturityDate);
    const maturity = Math.round(amountAfter(principal, rate, T, draft.compoundingFrequency));
    return { maturity, interest: maturity - principal, days: daysBetween(draft.startDate, draft.maturityDate), years: T };
  }, [valid, principal, rate, draft.startDate, draft.maturityDate, draft.compoundingFrequency]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    try { await onSubmit(); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[18px] font-medium text-navy">{editing ? "Edit fixed deposit" : "Add fixed deposit"}</h1>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-navy"><X size={18} /></button>
      </div>

      <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4 space-y-3">
        <Field label="Bank / organisation *">
          <input value={draft.bank} onChange={(e) => set({ bank: e.target.value })} placeholder="HDFC" className="inp" />
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {BANK_PICKS.map((b) => <button type="button" key={b} onClick={() => set({ bank: b })} className="text-[11px] px-2 py-0.5 rounded-full border-[0.5px] border-navy/20 text-navy hover:bg-navy/5">{b}</button>)}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Principal (₹) *"><input type="number" min={0} value={draft.principal} onChange={(e) => set({ principal: e.target.value })} className="inp" /></Field>
          <Field label="Interest rate (% p.a.) *"><input type="number" min={0} step="0.01" value={draft.interestRate} onChange={(e) => set({ interestRate: e.target.value })} className="inp" /></Field>
          <Field label="Start date *"><input type="date" value={draft.startDate} onChange={(e) => set({ startDate: e.target.value })} className="inp" /></Field>
          <Field label="Maturity date *"><input type="date" value={draft.maturityDate} onChange={(e) => set({ maturityDate: e.target.value })} className="inp" /></Field>
        </div>
        {draft.startDate && draft.maturityDate && draft.maturityDate > draft.startDate && (
          <p className="text-[11px] text-slate-500">Tenure: {yearsBetween(draft.startDate, draft.maturityDate).toFixed(2)} years ({daysBetween(draft.startDate, draft.maturityDate)} days)</p>
        )}
        <Field label="Compounding frequency *">
          <select value={draft.compoundingFrequency} onChange={(e) => set({ compoundingFrequency: e.target.value as Compounding })} className="inp">
            {(Object.keys(COMPOUNDING_LABELS) as Compounding[]).map((k) => <option key={k} value={k}>{COMPOUNDING_LABELS[k]}</option>)}
          </select>
        </Field>
        <Field label="Payout type *">
          <div className="flex gap-2">
            {(["cumulative", "non-cumulative"] as PayoutType[]).map((p) => (
              <button type="button" key={p} onClick={() => set({ payoutType: p })} className={`h-9 px-3 rounded-lg text-[12px] font-medium border-[0.5px] capitalize ${draft.payoutType === p ? "bg-navy text-white border-navy" : "border-black/15 text-slate-600"}`}>{p}</button>
            ))}
          </div>
        </Field>
        {draft.payoutType === "non-cumulative" && (
          <Field label="Payout frequency">
            <select value={draft.payoutFrequency} onChange={(e) => set({ payoutFrequency: e.target.value as PayoutFrequency })} className="inp">
              <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option>
            </select>
          </Field>
        )}
        <Field label="Description (optional)"><input value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="Emergency fund" className="inp" /></Field>
        <Field label="FD certificate number (optional)"><input value={draft.certificateNumber} onChange={(e) => set({ certificateNumber: e.target.value })} className="inp" /></Field>
        <label className="flex items-center gap-2 text-[12px] text-navy"><input type="checkbox" checked={draft.tdsDeducted} onChange={(e) => set({ tdsDeducted: e.target.checked })} /> Bank deducts TDS on this FD</label>
        <label className="flex items-center gap-2 text-[12px] text-navy"><input type="checkbox" checked={draft.autoRenew} onChange={(e) => set({ autoRenew: e.target.checked })} /> Auto-renew at maturity</label>
      </div>

      {/* Live preview */}
      {preview && (
        <div className="bg-finance/5 border-[0.5px] border-finance/20 rounded-xl p-3 text-[12px] text-navy">
          At maturity on <b>{draft.maturityDate}</b> you will receive <b>{formatINR(preview.maturity)}</b> = {formatINR(principal)} + {formatINR(preview.interest)} interest.
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-9 px-3 rounded-lg border-[0.5px] border-black/15 text-[12px] text-slate-600 hover:bg-surface">Cancel</button>
        <button type="submit" disabled={!valid || busy} className="h-9 px-4 rounded-lg bg-navy text-white text-[12px] font-medium disabled:opacity-50 flex items-center gap-1.5">{busy ? <Spin small /> : <Check size={14} />} {editing ? "Save changes" : "Add FD"}</button>
      </div>
    </form>
  );
}

// ── Small shared bits ──
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>{children}</label>;
}
function Fig({ k, v }: { k: string; v: string }) {
  return <div><div className="text-[10px] uppercase tracking-wide text-slate-400">{k}</div><div className="text-[13px] text-navy tabular-nums">{v}</div></div>;
}
function ToggleRow({ label, sub, on, onClick }: { label: string; sub: string; on: boolean; onClick: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1"><div className="text-[12px] font-medium text-navy">{label}</div><div className="text-[11px] text-slate-500 mt-0.5">{sub}</div></div>
      <button onClick={onClick} aria-pressed={on} className={`shrink-0 w-10 h-6 rounded-full transition-colors relative ${on ? "bg-finance" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? "left-[1.125rem]" : "left-0.5"}`} />
      </button>
    </div>
  );
}
function Spin({ small }: { small?: boolean }) {
  return <span className={`${small ? "w-4 h-4 border-white/50 border-t-white" : "w-5 h-5 border-slate-300 border-t-navy"} border-2 rounded-full animate-spin`} />;
}
