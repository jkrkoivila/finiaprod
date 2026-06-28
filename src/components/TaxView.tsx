import { Fragment, useMemo, useRef, useState, type FormEvent } from "react";
import { Calculator, FileText, Sparkles, GitCompareArrows, Plus, X, Upload, AlertTriangle, Check, CalendarPlus, Send } from "lucide-react";
import { formatINR } from "../lib/dashboard";
import { advanceTaxSchedule, monthlyTDS } from "../lib/tax";
import {
  addableIn, computeRegime, DEDUCTIONS, effectiveRate, validateEntries,
  type DeductionEntry, type DeductionId, type Regime,
} from "../lib/taxComponents";
import { analysePayslip, type PayslipData } from "../lib/taxApi";
import { streamChat } from "../lib/agent";
import type { TwoYearProfile, YearProfile } from "../lib/taxProfile";
import type { TaxConfig } from "../lib/taxConfig";

interface TaxViewProps {
  configCurrent: TaxConfig;
  configPrev: TaxConfig;
  configSource: "settings" | "default";
  profile: TwoYearProfile;
  /** Income from Other Sources (e.g. opted-in FD interest) — current year. */
  otherIncome?: number;
  /** TDS / advance tax already paid (e.g. opted-in FD TDS) — current year. */
  taxesPaid?: number;
  onChange: (p: TwoYearProfile) => void;
  onAddCalendarTasks: () => void | Promise<void>;
  calendarAdded: boolean;
}
type Tab = "calc" | "compare" | "payslip" | "expert";
type YearKey = "current" | "previous";

export default function TaxView(props: TaxViewProps) {
  const [tab, setTab] = useState<Tab>("calc");
  const [editYear, setEditYear] = useState<YearKey>("current");
  const [autoAdded, setAutoAdded] = useState<string[] | null>(null);

  const configFor = (y: YearKey) => (y === "current" ? props.configCurrent : props.configPrev);
  const setYear = (y: YearKey, patch: Partial<YearProfile>) => props.onChange({ ...props.profile, [y]: { ...props.profile[y], ...patch } });

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[20px] font-medium text-navy">Tax intelligence</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">{props.configCurrent.fyLabel} · {props.configCurrent.ayLabel}</p>
        </div>
        <span className="text-[11px] px-2.5 py-1 rounded-full border-[0.5px]" style={props.configSource === "settings" ? { color: "#0F766E", borderColor: "#0F766E40", background: "#0F766E10" } : { color: "#64748b", borderColor: "var(--line)", background: "var(--card)" }}>
          {props.configSource === "settings" ? "Slabs from systemSettings" : "Default config (editable via systemSettings)"}
        </span>
      </div>

      <div className="flex rounded-lg border-[0.5px] border-black/10 bg-white p-0.5 w-fit overflow-x-auto">
        {([
          { id: "calc", label: "Calculator", icon: Calculator },
          { id: "compare", label: "Compare years", icon: GitCompareArrows },
          { id: "payslip", label: "Form 16 / payslip", icon: FileText },
          { id: "expert", label: "AI tax expert", icon: Sparkles },
        ] as { id: Tab; label: string; icon: any }[]).map((t) => {
          const Icon = t.icon;
          return <button key={t.id} onClick={() => setTab(t.id)} className={`h-8 px-3 rounded-md text-[12px] font-medium flex items-center gap-1.5 whitespace-nowrap ${tab === t.id ? "bg-navy text-white" : "text-slate-500 hover:text-navy"}`}><Icon size={14} /> {t.label}</button>;
        })}
      </div>

      {tab === "calc" && (
        <Calc
          year={props.profile[editYear]} editYear={editYear} setEditYear={setEditYear}
          config={configFor(editYear)} configCurrent={props.configCurrent} configPrev={props.configPrev}
          setYear={(patch) => setYear(editYear, patch)}
          autoAdded={autoAdded} clearAuto={() => setAutoAdded(null)}
          otherIncome={editYear === "current" ? props.otherIncome || 0 : 0}
          taxesPaid={editYear === "current" ? props.taxesPaid || 0 : 0}
          onAddCalendarTasks={props.onAddCalendarTasks} calendarAdded={props.calendarAdded}
        />
      )}
      {tab === "compare" && <Compare profile={props.profile} configCurrent={props.configCurrent} configPrev={props.configPrev} setYear={setYear} />}
      {tab === "payslip" && (
        <Payslip onApply={(p) => { applyPayslip(p, props.profile, props.onChange, setAutoAdded); setEditYear("current"); setTab("calc"); }} />
      )}
      {tab === "expert" && <Expert year={props.profile.current} config={props.configCurrent} otherIncome={props.otherIncome || 0} taxesPaid={props.taxesPaid || 0} />}
    </div>
  );
}

// ── Form 16 → components mapping ──
function applyPayslip(p: PayslipData, profile: TwoYearProfile, onChange: (p: TwoYearProfile) => void, setAuto: (l: string[]) => void) {
  const entries: DeductionEntry[] = [];
  const added: string[] = [];
  const annualBasic = Math.round((p.basic || 0) * 12);
  const push = (id: DeductionId, e: Partial<DeductionEntry>) => { entries.push({ id, ...e }); added.push(DEDUCTIONS[id].label); };
  if (p.section80C) push("80C", { value: p.section80C });
  if (p.section80CCD1B) push("80CCD1B", { value: p.section80CCD1B });
  if (p.section80CCD2) push("80CCD2", { fields: { employerNps: p.section80CCD2, basic: annualBasic } });
  if (p.section80D) push("80D", { fields: { selfFamily: p.section80D } });
  if (p.professionalTax) push("profTax", { value: p.professionalTax });
  if (p.hraExemption || p.hra) push("hra", { fields: { hraReceived: Math.round((p.hra || 0) * 12), basic: annualBasic, rent: 0, metro: true } });
  const gross = Math.round(p.annualGrossSalary || p.grossSalary * 12);
  onChange({ ...profile, current: { grossSalary: gross, entries, regime: (p.regime as Regime) || "new" } });
  setAuto(added);
}

// ── Calculator ──
function Calc({ year, editYear, setEditYear, config, setYear, autoAdded, clearAuto, otherIncome, taxesPaid, onAddCalendarTasks, calendarAdded }: {
  year: YearProfile; editYear: YearKey; setEditYear: (y: YearKey) => void;
  config: TaxConfig; configCurrent: TaxConfig; configPrev: TaxConfig;
  setYear: (patch: Partial<YearProfile>) => void;
  autoAdded: string[] | null; clearAuto: () => void;
  otherIncome: number; taxesPaid: number;
  onAddCalendarTasks: () => void | Promise<void>; calendarAdded: boolean;
}) {
  const [addId, setAddId] = useState<DeductionId | "">("");
  const errors = useMemo(() => validateEntries(year.entries), [year.entries]);
  // When any selected deduction is missing a required sub-field, we refuse to show
  // a tax figure — a partial computation would silently treat the field as ₹0 and
  // understate the tax. Keep results hidden until the inputs are complete.
  const hasErrors = Object.keys(errors).length > 0;
  const neu = useMemo(() => computeRegime(year.grossSalary, year.entries, "new", config, otherIncome, taxesPaid), [year, config, otherIncome, taxesPaid]);
  const old = useMemo(() => computeRegime(year.grossSalary, year.entries, "old", config, otherIncome, taxesPaid), [year, config, otherIncome, taxesPaid]);
  const better: Regime = neu.totalTax <= old.totalTax ? "new" : "old";
  const betterTax = better === "new" ? neu.totalTax : old.totalTax;
  const schedule = advanceTaxSchedule(betterTax, config);

  const addedIds = new Set(year.entries.map((e) => e.id));
  const options = (Object.values(DEDUCTIONS)).filter((d) => !addedIds.has(d.id));
  const setEntry = (idx: number, patch: Partial<DeductionEntry>) => setYear({ entries: year.entries.map((e, i) => (i === idx ? { ...e, ...patch } : e)) });
  const removeEntry = (idx: number) => setYear({ entries: year.entries.filter((_, i) => i !== idx) });
  const addEntry = (id: DeductionId) => { setYear({ entries: [...year.entries, { id, value: 0, fields: {} }] }); setAddId(""); };

  return (
    <div className="space-y-4">
      {/* Year selector */}
      <div className="flex items-center gap-2">
        {(["current", "previous"] as YearKey[]).map((y) => (
          <button key={y} onClick={() => setEditYear(y)} className={`h-8 px-3 rounded-lg text-[12px] font-medium border-[0.5px] ${editYear === y ? "bg-navy text-white border-navy" : "border-black/15 text-slate-500 hover:text-navy"}`}>
            {y === "current" ? config.ayLabel : "Previous year"}
          </button>
        ))}
        <span className="text-[11px] text-slate-400 ml-1">editing {editYear === "current" ? config.ayLabel : "the previous year"}</span>
      </div>

      {autoAdded && autoAdded.length > 0 && (
        <div className="rounded-lg border-[0.5px] border-pulse/25 bg-pulse/5 px-3 py-2.5 flex items-start gap-2">
          <Sparkles size={14} className="text-pulse shrink-0 mt-0.5" />
          <div className="text-[12px] text-navy"><b>Auto-added from your document:</b> {autoAdded.join(", ")}. Verify the values below.
            <button onClick={clearAuto} className="ml-2 text-pulse hover:underline">dismiss</button></div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Inputs */}
        <div className="lg:col-span-2 space-y-3 self-start">
          <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4 space-y-3">
            <Money label="Annual gross salary" value={year.grossSalary} onChange={(v) => setYear({ grossSalary: v })} />
            {otherIncome > 0 && (
              <div className="flex items-center justify-between text-[12px] rounded-lg bg-tax/5 border-[0.5px] border-tax/20 px-3 py-2">
                <span className="text-slate-600">Income from Other Sources <span className="text-slate-400">(FD interest)</span></span>
                <span className="text-navy font-medium tabular-nums">{formatINR(otherIncome)}</span>
              </div>
            )}
            {taxesPaid > 0 && (
              <div className="flex items-center justify-between text-[12px] rounded-lg bg-finance/5 border-[0.5px] border-finance/20 px-3 py-2">
                <span className="text-slate-600">TDS / advance tax paid <span className="text-slate-400">(FD)</span></span>
                <span className="text-finance font-medium tabular-nums">− {formatINR(taxesPaid)}</span>
              </div>
            )}
            <div className="text-[11px] text-slate-400">Standard deduction ({formatINR(config.regimes.new.standardDeduction)} new / {formatINR(config.regimes.old.standardDeduction)} old) is applied automatically.</div>
          </div>

          {/* Deductions manager */}
          <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4 space-y-3">
            <h2 className="text-[13px] font-medium text-navy">Deductions & exemptions</h2>
            {year.entries.length === 0 && <p className="text-[12px] text-slate-400">None added. Use the picker below to add only what applies to you.</p>}
            {year.entries.map((e, idx) => (
              <Fragment key={e.id}>
                <DeductionRow entry={e} idx={idx} errors={errors[e.id] || []} onChange={(patch) => setEntry(idx, patch)} onRemove={() => removeEntry(idx)} />
              </Fragment>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <select value={addId} onChange={(ev) => setAddId(ev.target.value as DeductionId)} className="flex-1 min-w-0 box-border h-9 px-2 rounded-lg border-[0.5px] border-black/15 text-[12px] outline-none focus:border-navy">
                <option value="">Add deduction…</option>
                {options.map((d) => <option key={d.id} value={d.id}>{d.label}{!d.regimes.includes("new") ? " (old regime only)" : ""}</option>)}
              </select>
              <button onClick={() => addId && addEntry(addId)} disabled={!addId} className="shrink-0 box-border h-9 px-3 rounded-lg bg-navy text-white text-[12px] font-medium disabled:opacity-40 flex items-center gap-1 whitespace-nowrap"><Plus size={14} /> Add</button>
            </div>
            {Object.keys(errors).length > 0 && (
              <p className="text-[12px] text-crisis flex items-center gap-1.5"><AlertTriangle size={13} /> Fill the required fields highlighted above to compute correctly.</p>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-3 space-y-4">
          {hasErrors ? (
            <div className="bg-white rounded-xl border-[0.5px] border-crisis/30 p-8 flex flex-col items-center text-center gap-2.5">
              <div className="w-11 h-11 rounded-xl bg-crisis/10 flex items-center justify-center"><AlertTriangle size={20} className="text-crisis" /></div>
              <div className="text-[14px] font-medium text-navy">Fill the highlighted required fields to calculate</div>
              <p className="text-[12px] text-slate-500 max-w-sm">One or more deductions are missing required details. Finia won't show a tax figure until they're complete — so you never see a partial or misleading number.</p>
            </div>
          ) : (
            <>
              <div className="bg-navy text-white rounded-xl p-4">
                <div className="text-[12px] text-white/70">Recommended regime</div>
                <div className="text-[20px] font-medium capitalize mt-0.5">{better} regime{Math.abs(neu.totalTax - old.totalTax) > 0 ? ` · saves ${formatINR(Math.abs(neu.totalTax - old.totalTax))}` : ""}</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-white/10 px-3 py-2"><div className="text-[11px] text-white/60">Monthly TDS</div><div className="text-[15px] font-medium tabular-nums">{formatINR(monthlyTDS(betterTax))}</div></div>
                  <div className="rounded-lg bg-white/10 px-3 py-2"><div className="text-[11px] text-white/60">Annual tax ({better})</div><div className="text-[15px] font-medium tabular-nums">{formatINR(betterTax)}</div></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <RegimeCard title="New regime" c={neu} best={better === "new"} gross={year.grossSalary} />
                <RegimeCard title="Old regime" c={old} best={better === "old"} gross={year.grossSalary} />
              </div>

              {neu.deductions.ignored.length > 0 && (
                <div className="bg-white rounded-xl border-[0.5px] border-[#D97706]/30 p-3">
                  <div className="text-[12px] font-medium text-[#D97706] mb-1">Ignored in the new regime</div>
                  <ul className="text-[12px] text-slate-500 space-y-0.5">
                    {neu.deductions.ignored.map((i) => <li key={i.id}>• {i.label} ({formatINR(i.claimed)}) — {i.reason}</li>)}
                  </ul>
                </div>
              )}

              <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4">
                <h2 className="text-[13px] font-medium text-navy mb-2">Advance tax schedule</h2>
                <div className="overflow-x-auto"><table className="w-full text-[12px]">
                  <thead><tr className="text-slate-400 text-left"><th className="font-normal py-1">Instalment</th><th className="font-normal py-1">By</th><th className="font-normal py-1 text-right">Cumulative</th><th className="font-normal py-1 text-right">Pay now</th></tr></thead>
                  <tbody className="tabular-nums">{schedule.map((r) => <tr key={r.label} className="border-t-[0.5px] border-black/5"><td className="py-1.5 text-navy">{r.label}</td><td className="py-1.5 text-slate-500">{r.by}</td><td className="py-1.5 text-right text-slate-500">{r.cumulativePct}% · {formatINR(r.cumulativeAmount)}</td><td className="py-1.5 text-right font-medium text-navy">{formatINR(r.instalment)}</td></tr>)}</tbody>
                </table></div>
              </div>
            </>
          )}

          <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4">
            <div className="flex items-center justify-between mb-2"><h2 className="text-[13px] font-medium text-navy">Tax calendar</h2>
              <button onClick={onAddCalendarTasks} disabled={calendarAdded} className="h-8 px-3 rounded-lg bg-navy text-white text-[12px] font-medium flex items-center gap-1.5 disabled:opacity-60">{calendarAdded ? <><Check size={13} /> Added</> : <><CalendarPlus size={13} /> Add to my tasks</>}</button>
            </div>
            <ul className="text-[12px] divide-y divide-black/5">
              {config.advanceTaxSchedule.map((s) => <li key={s.label} className="flex justify-between py-1.5"><span className="text-navy">Advance tax · {s.label} ({s.cumulativePct}%)</span><span className="text-slate-500">{s.by}</span></li>)}
              <li className="flex justify-between py-1.5"><span className="text-navy font-medium">File ITR ({config.ayLabel})</span><span className="text-crisis">{config.itrDeadline}</span></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeductionRow({ entry, errors, onChange, onRemove }: { entry: DeductionEntry; idx: number; errors: string[]; onChange: (p: Partial<DeductionEntry>) => void; onRemove: () => void }) {
  const def = DEDUCTIONS[entry.id];
  const setField = (k: string, v: any) => onChange({ fields: { ...entry.fields, [k]: v } });
  return (
    <div className="rounded-lg border-[0.5px] border-black/10 p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-medium text-navy">{def.section} <span className="text-slate-400 font-normal">{def.label.replace(/^[^—]*—\s*/, "")}</span></span>
        <button onClick={onRemove} className="text-slate-400 hover:text-crisis"><X size={14} /></button>
      </div>
      {def.hint && <p className="text-[10px] text-finance mb-1.5">{def.hint}</p>}
      {!def.subFields ? (
        <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-slate-400">₹</span>
          <input type="number" min={0} value={entry.value || ""} onChange={(e) => onChange({ value: Number(e.target.value) || 0 })} className="w-full h-8 pl-5 pr-2 rounded-lg border-[0.5px] border-black/15 text-[12px] outline-none focus:border-navy" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {def.subFields.map((f) => {
            const missing = errors.includes(f.key);
            const common = { borderColor: missing ? "#E24B4A" : "var(--line)" } as any;
            return (
              <label key={f.key} className="flex flex-col gap-0.5">
                <span className="text-[10px]" style={{ color: missing ? "#E24B4A" : "#94a3b8" }}>{f.label}{f.required && " *"}</span>
                {f.kind === "checkbox" ? (
                  <input type="checkbox" checked={!!entry.fields?.[f.key]} onChange={(e) => setField(f.key, e.target.checked)} className="h-8 w-8" />
                ) : f.kind === "select" ? (
                  <select value={entry.fields?.[f.key] ?? ""} onChange={(e) => setField(f.key, e.target.value)} className="h-8 px-1.5 rounded-lg border-[0.5px] text-[12px] outline-none focus:border-navy" style={common}>
                    <option value="">—</option>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input type="number" min={0} value={entry.fields?.[f.key] ?? ""} onChange={(e) => setField(f.key, Number(e.target.value) || 0)} className="h-8 px-2 rounded-lg border-[0.5px] text-[12px] outline-none focus:border-navy" style={common} />
                )}
                {missing && <span className="text-[10px] text-crisis">{f.label} is required</span>}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RegimeCard({ title, c, best, gross }: { title: string; c: ReturnType<typeof computeRegime>; best: boolean; gross: number }) {
  return (
    <div className={`rounded-xl border-[0.5px] p-4 bg-white ${best ? "border-finance" : "border-black/10"}`}>
      <div className="flex items-center justify-between"><h3 className="text-[13px] font-medium text-navy">{title}</h3>{best && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-finance/10 text-finance">Best</span>}</div>
      <div className="mt-3 text-[24px] font-medium text-navy tabular-nums">{formatINR(c.totalTax)}</div>
      <div className="mt-2 space-y-1 text-[11px] text-slate-500 tabular-nums">
        <Row k="Taxable income" v={formatINR(c.taxableIncome)} />
        <Row k="Total deductions" v={formatINR(c.deductions.total)} />
        {c.rebate > 0 && <Row k="87A rebate" v={`− ${formatINR(c.rebate)}`} />}
        <Row k="Cess" v={formatINR(c.cess)} />
        <Row k="Effective rate" v={`${effectiveRate(c.totalTax, gross)}%`} />
      </div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) { return <div className="flex justify-between"><span>{k}</span><span className="text-navy">{v}</span></div>; }

// ── Two-year comparison ──
function Compare({ profile, configCurrent, configPrev, setYear }: { profile: TwoYearProfile; configCurrent: TaxConfig; configPrev: TaxConfig; setYear: (y: YearKey, patch: Partial<YearProfile>) => void }) {
  const cur = computeRegime(profile.current.grossSalary, profile.current.entries, profile.current.regime, configCurrent);
  const prev = computeRegime(profile.previous.grossSalary, profile.previous.entries, profile.previous.regime, configPrev);
  const taxDelta = cur.totalTax - prev.totalTax;
  const incomeDelta = profile.current.grossSalary - profile.previous.grossSalary;
  const fmtDelta = (n: number) => (n === 0 ? "no change" : `${n > 0 ? "up" : "down"} ${formatINR(Math.abs(n))}`);

  const Col = ({ label, cfg, yk, gross, c }: { label: string; cfg: TaxConfig; yk: YearKey; gross: number; c: ReturnType<typeof computeRegime> }) => (
    <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4">
      <div className="text-[13px] font-medium text-navy">{label}</div>
      <div className="text-[11px] text-slate-400 mb-2">{cfg.fyLabel}</div>
      <div className="flex items-center gap-1 mb-3">
        {(["new", "old"] as Regime[]).map((r) => (
          <button key={r} onClick={() => setYear(yk, { regime: r })} className={`h-6 px-2 rounded-md text-[11px] capitalize ${profile[yk].regime === r ? "bg-navy text-white" : "border-[0.5px] border-black/15 text-slate-500"}`}>{r}</button>
        ))}
      </div>
      <div className="space-y-1 text-[12px] tabular-nums">
        <Row k="Gross income" v={formatINR(gross)} />
        <Row k="Total deductions" v={formatINR(c.deductions.total)} />
        <Row k="Taxable income" v={formatINR(c.taxableIncome)} />
        <div className="flex justify-between border-t-[0.5px] border-black/5 pt-1.5 mt-1.5"><span className="font-medium text-navy">Tax payable</span><span className="font-medium text-navy">{formatINR(c.totalTax)}</span></div>
        <Row k="Effective rate" v={`${effectiveRate(c.totalTax, gross)}%`} />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Col label="Previous year" cfg={configPrev} yk="previous" gross={profile.previous.grossSalary} c={prev} />
        <Col label="Current year" cfg={configCurrent} yk="current" gross={profile.current.grossSalary} c={cur} />
      </div>
      <div className="bg-navy text-white rounded-xl p-4">
        <div className="text-[12px] text-white/70">Year over year</div>
        <div className="text-[15px] font-medium mt-1">Tax {fmtDelta(taxDelta)} · income {fmtDelta(incomeDelta)}</div>
        <p className="text-[11px] text-white/60 mt-1">Each year uses its own slab values ({configPrev.ayLabel} vs {configCurrent.ayLabel}) and chosen regime.</p>
      </div>
    </div>
  );
}

// ── Payslip / Form 16 ──
function Payslip({ onApply }: { onApply: (p: PayslipData) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PayslipData | null>(null);
  const handle = async (file?: File) => {
    if (!file) return;
    setBusy(true); setError(null); setResult(null);
    try { setResult(await analysePayslip(file)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="max-w-xl space-y-4">
      <label className="block bg-white rounded-xl border-[0.5px] border-dashed border-black/20 p-8 text-center cursor-pointer hover:bg-surface">
        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
        {busy ? <div className="flex flex-col items-center gap-2 text-slate-500"><span className="w-6 h-6 border-2 border-slate-300 border-t-navy rounded-full animate-spin" /><span className="text-[13px]">Reading with Gemini Vision…</span></div>
          : <div className="flex flex-col items-center gap-2"><div className="w-11 h-11 rounded-xl bg-navy/5 flex items-center justify-center"><Upload size={20} className="text-navy/60" /></div><div className="text-[13px] font-medium text-navy">Upload Form 16 or payslip</div><div className="text-[12px] text-slate-500">Gemini extracts gross, 80C, 80CCD(2), 80D, HRA, regime…</div></div>}
      </label>
      {error && <p className="text-[12px] text-crisis bg-crisis/5 border-[0.5px] border-crisis/20 rounded-lg px-3 py-2">{error}</p>}
      {result && (
        <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4">
          <h3 className="text-[13px] font-medium text-navy mb-2">Extracted</h3>
          <div className="grid grid-cols-2 gap-2 text-[12px] tabular-nums">
            <Row k="Annual gross" v={formatINR(result.annualGrossSalary || result.grossSalary * 12)} />
            <Row k="Regime" v={result.regime || "—"} />
            <Row k="80C" v={formatINR(result.section80C || 0)} />
            <Row k="80CCD(1B)" v={formatINR(result.section80CCD1B || 0)} />
            <Row k="80CCD(2) employer" v={formatINR(result.section80CCD2 || 0)} />
            <Row k="80D" v={formatINR(result.section80D || 0)} />
            <Row k="Professional tax" v={formatINR(result.professionalTax || 0)} />
          </div>
          <button onClick={() => onApply(result)} className="mt-3 h-9 px-4 rounded-lg bg-navy text-white text-[12px] font-medium">Auto-fill the calculator</button>
        </div>
      )}
    </div>
  );
}

// ── AI tax expert ──
interface Msg { id: number; sender: "user" | "agent"; text: string }
function Expert({ year, config, otherIncome = 0, taxesPaid = 0 }: { year: YearProfile; config: TaxConfig; otherIncome?: number; taxesPaid?: number }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const contents = useRef<any[]>([]);
  const id = useRef(0);
  const neu = computeRegime(year.grossSalary, year.entries, "new", config, otherIncome, taxesPaid);
  const old = computeRegime(year.grossSalary, year.entries, "old", config, otherIncome, taxesPaid);
  const context = { grossSalary: year.grossSalary, otherIncome, newTax: neu.totalTax, oldTax: old.totalTax, recommended: neu.totalTax <= old.totalTax ? "new" : "old" };
  const send = async (text: string) => {
    const m = text.trim(); if (!m || busy) return; setInput("");
    const uid = ++id.current, aid = ++id.current;
    setMessages((x) => [...x, { id: uid, sender: "user", text: m }, { id: aid, sender: "agent", text: "" }]);
    contents.current.push({ role: "user", parts: [{ text: m }] }); setBusy(true);
    try { let acc = ""; await streamChat({ contents: contents.current, context }, { onToken: (t) => { acc += t; setMessages((x) => x.map((y) => (y.id === aid ? { ...y, text: acc } : y))); }, onFunctionCall: () => {} }, "/api/tax-ai-expert"); contents.current.push({ role: "model", parts: [{ text: acc }] }); }
    catch (e) { setMessages((x) => x.map((y) => (y.id === aid ? { ...y, text: `Sorry — ${(e as Error).message}` } : y))); } finally { setBusy(false); }
  };
  const onSubmit = (e: FormEvent) => { e.preventDefault(); send(input); };
  return (
    <div className="max-w-2xl bg-white rounded-xl border-[0.5px] border-black/10 flex flex-col h-[460px]">
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-2.5">
        <div className="flex justify-start"><div className="max-w-[85%] px-3 py-2 rounded-xl rounded-bl-sm bg-surface border-[0.5px] border-black/10 text-[13px] text-slate-700">Ask about regime choice, deductions, HRA, advance tax, or the ITR deadline.</div></div>
        {messages.length === 0 && <div className="flex flex-wrap gap-1.5">{["Which regime is better for me?", "Is 80CCD(2) allowed in the new regime?", "How is my HRA exemption computed?"].map((c) => <button key={c} onClick={() => send(c)} className="text-[11px] px-2.5 py-1 rounded-full border-[0.5px] border-navy/20 text-navy hover:bg-navy/5">{c}</button>)}</div>}
        {messages.map((m) => <Fragment key={m.id}><div className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] px-3 py-2 rounded-xl text-[13px] leading-relaxed whitespace-pre-wrap ${m.sender === "user" ? "bg-navy text-white rounded-br-sm" : "bg-surface border-[0.5px] border-black/10 text-slate-700 rounded-bl-sm"}`}>{m.text || "…"}</div></div></Fragment>)}
      </div>
      <form onSubmit={onSubmit} className="border-t-[0.5px] border-black/10 p-2.5 flex items-center gap-2"><input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a tax question…" className="flex-1 h-9 px-3 rounded-lg bg-surface border-[0.5px] border-black/10 text-[13px] outline-none focus:border-navy" /><button type="submit" disabled={busy || !input.trim()} className="w-9 h-9 rounded-lg bg-navy text-white flex items-center justify-center disabled:opacity-40"><Send size={15} /></button></form>
    </div>
  );
}

function Money({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
      <div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-slate-400">₹</span>
        <input type="number" min={0} value={value || ""} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} placeholder="0" className="w-full h-9 pl-6 pr-2 rounded-lg border-[0.5px] border-black/15 text-[13px] tabular-nums outline-none focus:border-navy" /></div>
    </label>
  );
}
