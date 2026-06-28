import { Fragment, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Plus, X, Repeat, Pause, Play, Trash2, Pencil, Check, Paperclip, ArrowLeft, ChevronRight } from "lucide-react";
import { formatINR, ymd } from "../lib/dashboard";
import {
  amountDeltaNote, instanceStatus, FREQUENCY_LABELS, WEEKDAYS,
  type Frequency, type InstanceStatus, type PaymentInstance, type RecurringCategory, type RecurringPayment,
} from "../lib/recurring";
import type { NewRecurring, PaymentRecord } from "../lib/recurringMutations";

interface RecurringViewProps {
  templates: RecurringPayment[];
  instances: PaymentInstance[];
  today?: string;
  onCreate: (data: NewRecurring) => void | Promise<void>;
  onEdit: (id: string, patch: Partial<NewRecurring>, scope: "future" | "all-unpaid") => void | Promise<void>;
  onPause: (id: string, isActive: boolean) => void | Promise<void>;
  onDelete: (id: string, deleteUnpaid: boolean) => void | Promise<void>;
  onMarkPaid: (instance: PaymentInstance, template: RecurringPayment, record: PaymentRecord, file?: File) => Promise<void>;
  onBack: () => void;
  /** Synthetic groups for instances whose template was deleted (read-only template). */
  orphanedIds?: Set<string>;
  /** Open this group's detail on mount (deep-link from calendar / Money due). */
  initialDetailId?: string;
  /** True while Firestore is still delivering the first snapshot. */
  loading?: boolean;
  /** Last delete/backfill error to surface. */
  error?: string | null;
  /** Recreate a real template for an orphaned group. */
  onBackfill?: (template: RecurringPayment) => void | Promise<void>;
}

const CATEGORIES: RecurringCategory[] = ["rent", "EMI", "utility", "subscription", "insurance", "other"];
const STATUS_COLOR: Record<InstanceStatus, string> = {
  upcoming: "#2563EB", due: "#D97706", paid: "#0F766E", overdue: "#E24B4A", skipped: "#94A3B8",
};

const emptyForm = (today: string): NewRecurring => ({
  title: "", category: "rent", plannedAmount: 0, frequency: "monthly", dueDay: 5,
  startDate: today, endDate: null, reminderLeadDays: 3, isActive: true, autoCreateTask: true,
});

export default function RecurringView(props: RecurringViewProps) {
  const t = props.today ?? ymd(new Date());
  const [detailId, setDetailId] = useState<string | null>(props.initialDetailId ?? null);
  const isOrphan = (id: string) => !!props.orphanedIds?.has(id);

  // The deep-linked detail target. While data is still loading it may be momentarily
  // absent — don't drop it then (that's the "loops back to the list" bug); only reset
  // once loading is done and it's genuinely missing.
  const detailTpl = detailId ? props.templates.find((x) => x.id === detailId) : null;
  useEffect(() => {
    if (detailId && !props.loading && !detailTpl) setDetailId(null);
  }, [detailId, detailTpl, props.loading]);
  const [form, setForm] = useState<NewRecurring | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [record, setRecord] = useState<{ instance: PaymentInstance; template: RecurringPayment } | null>(null);
  const [delTarget, setDelTarget] = useState<RecurringPayment | null>(null);
  const [editScope, setEditScope] = useState<NewRecurring | null>(null);
  const [creating, setCreating] = useState(false); // guards double-submit of the create form

  const instancesOf = (tid: string) => props.instances.filter((i) => i.recurringPaymentId === tid);

  const nextDue = (tid: string) =>
    instancesOf(tid).filter((i) => i.status !== "paid" && i.status !== "skipped").map((i) => i.dueDate).sort()[0];

  const monthStatus = (tid: string): InstanceStatus | null => {
    const ym = t.slice(0, 7);
    const inMonth = instancesOf(tid).filter((i) => i.dueDate.startsWith(ym));
    if (inMonth.some((i) => i.status === "paid")) return "paid";
    if (inMonth.some((i) => instanceStatus(i, t) === "overdue")) return "overdue";
    if (inMonth.length) return "upcoming";
    return null;
  };

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!form || !form.title.trim() || !form.plannedAmount || creating) return;
    if (editId) {
      setEditScope(form); // ask future-only vs all-unpaid
    } else {
      setCreating(true);
      try {
        await props.onCreate(form);
        setForm(null);
      } finally {
        setCreating(false);
      }
    }
  };

  // ── Detail view ──
  if (detailId) {
    if (!detailTpl) {
      // Deep-linked target not resolved yet → spinner while loading; otherwise the
      // effect above resets to the list (so we never flash the wrong screen).
      if (props.loading) return <div className="p-10 flex justify-center"><span className="w-5 h-5 border-2 border-slate-300 border-t-navy rounded-full animate-spin" /></div>;
      return null;
    }
    const tpl = detailTpl;
    const list = instancesOf(detailId).sort((a, b) => (a.dueDate > b.dueDate ? -1 : 1));
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
        <button onClick={() => setDetailId(null)} className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-navy"><ArrowLeft size={14} /> All recurring payments</button>
        {props.error && <div className="text-[12px] text-crisis bg-crisis/5 border-[0.5px] border-crisis/20 rounded-lg px-3 py-2">{props.error}</div>}
        <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4">
          <div className="flex items-center justify-between">
            <div><h1 className="text-[18px] font-medium text-navy">{tpl.title}</h1><p className="text-[12px] text-slate-500 capitalize">{tpl.category} · {FREQUENCY_LABELS[tpl.frequency]} · {formatINR(tpl.plannedAmount)}</p></div>
            {isOrphan(tpl.id) ? (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#D97706]/10 text-[#D97706]">Instances only</span>
            ) : (
              <span className={`text-[11px] px-2 py-0.5 rounded-full ${tpl.isActive ? "bg-finance/10 text-finance" : "bg-slate-100 text-slate-500"}`}>{tpl.isActive ? "Active" : "Paused"}</span>
            )}
          </div>
          {isOrphan(tpl.id) && (
            <div className="mt-2 flex items-start justify-between gap-3 flex-wrap">
              <p className="text-[12px] text-slate-500 flex-1 min-w-[200px]">The original recurring template was removed — showing this payment's history. Record payments, recreate the template, or delete it below.</p>
              {props.onBackfill && <button onClick={() => props.onBackfill!(tpl)} className="h-8 px-3 rounded-lg bg-navy text-white text-[12px] font-medium whitespace-nowrap shrink-0">Create template</button>}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4">
          <h2 className="text-[13px] font-medium text-navy mb-2">History</h2>
          <ul className="divide-y divide-black/5">
            {list.map((i) => {
              const st = instanceStatus(i, t);
              const delta = i.actualAmount != null ? amountDeltaNote(i.plannedAmount, i.actualAmount) : null;
              return (
                <li key={i.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_COLOR[st] }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-navy">{i.dueDate}</div>
                    <div className="text-[11px] text-slate-400">
                      planned {formatINR(i.plannedAmount)}{i.actualAmount != null ? ` · paid ${formatINR(i.actualAmount)}` : ""}{i.paidDate ? ` on ${i.paidDate}` : ""}{delta ? ` · ${delta}` : ""}
                    </div>
                  </div>
                  {i.proofUrl ? <a href={i.proofUrl} target="_blank" rel="noreferrer" className="text-[11px] text-pulse hover:underline flex items-center gap-1"><Paperclip size={12} /> proof</a> : null}
                  {st !== "paid" && st !== "skipped" ? (
                    <button onClick={() => setRecord({ instance: i, template: tpl })} className="h-8 px-2.5 rounded-lg bg-finance text-white text-[11px] font-medium">Record payment</button>
                  ) : <span className="text-[11px] capitalize" style={{ color: STATUS_COLOR[st] }}>{st}</span>}
                </li>
              );
            })}
          </ul>
        </div>
        {record && <RecordDialog {...record} onClose={() => setRecord(null)} onSave={async (rec, file) => { await props.onMarkPaid(record.instance, record.template, rec, file); setRecord(null); }} />}
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button onClick={props.onBack} className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-navy"><ArrowLeft size={14} /> Finance</button>
        <button onClick={() => { setEditId(null); setForm(emptyForm(t)); }} className="h-9 px-3 rounded-lg bg-navy text-white text-[12px] font-medium flex items-center gap-1.5 hover:bg-navy/90"><Plus size={15} /> Add recurring payment</button>
      </div>
      <h1 className="text-[20px] font-medium text-navy">Recurring payments</h1>

      {props.error && <div className="text-[12px] text-crisis bg-crisis/5 border-[0.5px] border-crisis/20 rounded-lg px-3 py-2">{props.error}</div>}

      {form && (
        <RecurringForm
          form={form} setForm={setForm} editing={!!editId} today={t}
          onSubmit={submitForm} onCancel={() => { setForm(null); setEditId(null); }}
        />
      )}

      {props.templates.length === 0 && !form ? (
        <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-8 text-center">
          <div className="w-10 h-10 rounded-lg bg-navy/5 flex items-center justify-center mx-auto"><Repeat size={18} className="text-navy/50" /></div>
          <p className="mt-3 text-[13px] font-medium text-navy">No recurring payments yet</p>
          <p className="mt-1 text-[12px] text-slate-500">Add rent, EMIs, or subscriptions — Finia will generate the tasks each cycle.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {props.templates.map((tpl) => {
            const nd = nextDue(tpl.id);
            const ms = monthStatus(tpl.id);
            return (
              <Fragment key={tpl.id}>
                <li className={`flex items-center gap-3 rounded-lg border-[0.5px] border-black/10 bg-white p-3 ${tpl.isActive ? "" : "opacity-60"}`}>
                  <button onClick={() => setDetailId(tpl.id)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                    <div className="w-9 h-9 rounded-lg bg-finance/10 flex items-center justify-center shrink-0"><Repeat size={16} className="text-finance" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-navy truncate">{tpl.title}</div>
                      <div className="text-[11px] text-slate-400 capitalize">{formatINR(tpl.plannedAmount)} · {FREQUENCY_LABELS[tpl.frequency]}{nd ? ` · next ${nd}` : ""}</div>
                    </div>
                    {isOrphan(tpl.id) && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#D97706]/10 text-[#D97706]">Instances only</span>}
                    {ms && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full capitalize" style={{ background: `${STATUS_COLOR[ms]}14`, color: STATUS_COLOR[ms] }}>{ms}</span>}
                    <ChevronRight size={16} className="text-slate-300 shrink-0" />
                  </button>
                  {/* Edit/Pause need a real template doc — hidden for orphaned (template-less) groups. */}
                  {isOrphan(tpl.id) && props.onBackfill && <button onClick={() => props.onBackfill!(tpl)} title="Create template" className="h-8 px-2.5 rounded-lg border-[0.5px] border-navy/20 text-navy text-[11px] font-medium hover:bg-navy/5 whitespace-nowrap">Create template</button>}
                  {!isOrphan(tpl.id) && <button onClick={() => props.onPause(tpl.id, tpl.isActive)} title={tpl.isActive ? "Pause" : "Resume"} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-surface hover:text-navy">{tpl.isActive ? <Pause size={15} /> : <Play size={15} />}</button>}
                  {!isOrphan(tpl.id) && <button onClick={() => { setEditId(tpl.id); setForm({ ...emptyForm(t), ...tpl }); }} title="Edit" className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-surface hover:text-navy"><Pencil size={15} /></button>}
                  <button onClick={() => setDelTarget(tpl)} title="Delete" className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-crisis/10 hover:text-crisis"><Trash2 size={15} /></button>
                </li>
              </Fragment>
            );
          })}
        </ul>
      )}

      {/* Edit scope prompt */}
      {editScope && editId && (
        <Modal onClose={() => setEditScope(null)} title="Apply changes to…">
          <p className="text-[12px] text-slate-500 mb-3">Paid instances are never changed.</p>
          <div className="flex flex-col gap-2">
            <button onClick={async () => { await props.onEdit(editId, editScope, "future"); setEditScope(null); setForm(null); setEditId(null); }} className="h-9 px-3 rounded-lg border-[0.5px] border-black/15 text-[12px] font-medium text-navy hover:bg-surface">Future instances only</button>
            <button onClick={async () => { await props.onEdit(editId, editScope, "all-unpaid"); setEditScope(null); setForm(null); setEditId(null); }} className="h-9 px-3 rounded-lg bg-navy text-white text-[12px] font-medium">Apply to all unpaid instances too</button>
          </div>
        </Modal>
      )}

      {/* Delete prompt */}
      {delTarget && (
        <Modal onClose={() => setDelTarget(null)} title={`Delete "${delTarget.title}"?`}>
          <p className="text-[12px] text-slate-500 mb-3">Paid instances, their expenses, and proofs are always kept for your records.</p>
          <div className="flex flex-col gap-2">
            <button onClick={async () => { await props.onDelete(delTarget.id, true); setDelTarget(null); }} className="h-9 px-3 rounded-lg bg-crisis text-white text-[12px] font-medium">Delete template + unpaid future instances</button>
            <button onClick={async () => { await props.onDelete(delTarget.id, false); setDelTarget(null); }} className="h-9 px-3 rounded-lg border-[0.5px] border-black/15 text-[12px] font-medium text-navy hover:bg-surface">Delete template only (keep instances)</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function RecurringForm({ form, setForm, editing, today, onSubmit, onCancel }: { form: NewRecurring; setForm: (f: NewRecurring) => void; editing: boolean; today: string; onSubmit: (e: FormEvent) => void; onCancel: () => void }) {
  void today;
  return (
    <form onSubmit={onSubmit} className="bg-white rounded-xl border-[0.5px] border-black/10 p-4 space-y-3">
      <div className="flex items-center justify-between"><h2 className="text-[13px] font-medium text-navy">{editing ? "Edit recurring payment" : "New recurring payment"}</h2><button type="button" onClick={onCancel} className="text-slate-400 hover:text-navy"><X size={16} /></button></div>
      <Field label="Title"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="House rent" autoFocus className="inp" /></Field>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Field label="Category"><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as RecurringCategory })} className="inp capitalize">{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
        <Field label="Planned amount (₹)"><input type="number" min={0} value={form.plannedAmount || ""} onChange={(e) => setForm({ ...form, plannedAmount: Number(e.target.value) || 0 })} className="inp" /></Field>
        <Field label="Frequency"><select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as Frequency })} className="inp">{(Object.keys(FREQUENCY_LABELS) as Frequency[]).map((f) => <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>)}</select></Field>
        <Field label={form.frequency === "weekly" ? "Day of week" : "Day of month"}>
          {form.frequency === "weekly" ? (
            <select value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: Number(e.target.value) })} className="inp">{WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}</select>
          ) : (
            <input type="number" min={1} max={31} value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })} className="inp" />
          )}
        </Field>
        <Field label="Start date"><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="inp" /></Field>
        <Field label="End date (optional)"><input type="date" value={form.endDate || ""} onChange={(e) => setForm({ ...form, endDate: e.target.value || null })} className="inp" /></Field>
        <Field label="Reminder lead days"><input type="number" min={0} value={form.reminderLeadDays} onChange={(e) => setForm({ ...form, reminderLeadDays: Math.max(0, Number(e.target.value) || 0) })} className="inp" /></Field>
      </div>
      <label className="flex items-center gap-2 text-[12px] text-navy"><input type="checkbox" checked={form.autoCreateTask} onChange={(e) => setForm({ ...form, autoCreateTask: e.target.checked })} /> Auto-create a task each cycle</label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-9 px-3 rounded-lg border-[0.5px] border-black/15 text-[12px] text-slate-600 hover:bg-surface">Cancel</button>
        <button type="submit" disabled={!form.title.trim() || !form.plannedAmount} className="h-9 px-4 rounded-lg bg-navy text-white text-[12px] font-medium disabled:opacity-50">{editing ? "Save changes" : "Create"}</button>
      </div>
    </form>
  );
}

function RecordDialog({ instance, template, onClose, onSave }: { instance: PaymentInstance; template: RecurringPayment; onClose: () => void; onSave: (rec: PaymentRecord, file?: File) => Promise<void> }) {
  const [actual, setActual] = useState(String(instance.plannedAmount));
  const [paidDate, setPaidDate] = useState(ymd(new Date()));
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const delta = amountDeltaNote(instance.plannedAmount, Number(actual) || 0);

  return (
    <Modal onClose={onClose} title={`Record payment — ${template.title}`}>
      <div className="space-y-3">
        <Field label="Actual amount paid (₹)">
          <input type="number" min={0} value={actual} onChange={(e) => setActual(e.target.value)} className="inp" />
        </Field>
        {delta && <p className="text-[12px]" style={{ color: Number(actual) > instance.plannedAmount ? "#D97706" : "#0F766E" }}>{delta} (planned {formatINR(instance.plannedAmount)})</p>}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Paid date"><input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} className="inp" /></Field>
          <Field label="Note (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. late fee" className="inp" /></Field>
        </div>
        <Field label="Payment proof (optional)">
          <label className="flex items-center gap-2 h-9 px-3 rounded-lg border-[0.5px] border-dashed border-black/20 text-[12px] text-slate-500 cursor-pointer hover:bg-surface">
            <Paperclip size={14} /> {file ? file.name : "Attach screenshot / receipt / PDF"}
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        </Field>
        {error && (
          <p className="text-[12px] text-crisis bg-crisis/5 border-[0.5px] border-crisis/20 rounded-lg px-3 py-2">{error}</p>
        )}
        <button
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onSave({ actualAmount: Number(actual) || 0, paidDate, note: note || null }, file || undefined);
            } catch (e) {
              setError((e as Error).message || "Couldn't save payment — try again.");
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy || !Number(actual)}
          className="w-full h-10 rounded-lg bg-finance text-white text-[13px] font-medium flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          {busy ? <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <Check size={15} />} Save payment
        </button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/30" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-xl border-[0.5px] border-black/10 p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h3 className="text-[14px] font-medium text-navy">{title}</h3><button onClick={onClose} className="text-slate-400 hover:text-navy"><X size={16} /></button></div>
        {children}
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>{children}</label>;
}
