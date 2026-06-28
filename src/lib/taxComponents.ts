import { taxFromSlabs } from "./tax";
import type { TaxConfig } from "./taxConfig";

export type Regime = "old" | "new";

export type DeductionId =
  | "80C" | "80CCC" | "80CCD1" | "80CCD1B" | "80CCD2"
  | "80D" | "80E" | "80G" | "80TTA" | "80TTB" | "80DD" | "80DDB" | "80U" | "80CCH"
  | "hra" | "lta" | "sec10_14" | "homeLoan24b" | "profTax";

export interface SubField {
  key: string;
  label: string;
  kind: "number" | "select" | "checkbox";
  required?: boolean;
  options?: { value: string; label: string }[];
}

export interface DeductionEntry {
  id: DeductionId;
  value?: number; // simple amount-based components
  fields?: Record<string, any>; // conditional components (HRA, 80D, 24b, 80CCD2…)
}

export interface DeductionDef {
  id: DeductionId;
  label: string;
  section: string;
  regimes: Regime[]; // regimes in which this deduction is legally allowed
  group?: "80C"; // counts toward the combined ₹1.5L cap
  cap?: number; // individual statutory cap (applied after `amount`)
  hint?: string;
  subFields?: SubField[]; // required sub-fields revealed when the component is added
  amount: (e: DeductionEntry, ctx: { salary: number }) => number;
}

const num = (v: any) => Number(v) || 0;

/** HRA exemption = least of (actual HRA, 50%/40% basic, rent − 10% basic). */
export function hraExemptionOf(f: Record<string, any>): number {
  const hra = num(f.hraReceived), basic = num(f.basic), rent = num(f.rent);
  if (!hra || !basic || !rent) return 0;
  return Math.max(0, Math.round(Math.min(hra, (f.metro ? 0.5 : 0.4) * basic, rent - 0.1 * basic)));
}

export const DEDUCTIONS: Record<DeductionId, DeductionDef> = {
  "80C": { id: "80C", label: "80C — LIC, PF, ELSS, PPF, principal, tuition", section: "80C", regimes: ["old"], group: "80C", amount: (e) => num(e.value) },
  "80CCC": { id: "80CCC", label: "80CCC — pension funds", section: "80CCC", regimes: ["old"], group: "80C", amount: (e) => num(e.value) },
  "80CCD1": { id: "80CCD1", label: "80CCD(1) — employee NPS (within 1.5L)", section: "80CCD(1)", regimes: ["old"], group: "80C", amount: (e) => num(e.value) },
  "80CCD1B": { id: "80CCD1B", label: "80CCD(1B) — additional NPS", section: "80CCD(1B)", regimes: ["old"], cap: 50000, amount: (e) => num(e.value) },
  "80CCD2": {
    id: "80CCD2", label: "80CCD(2) — employer NPS contribution", section: "80CCD(2)", regimes: ["old", "new"],
    hint: "Allowed in BOTH regimes (up to 14% of salary for govt, 10% private).",
    subFields: [
      { key: "employerNps", label: "Employer NPS amount (annual)", kind: "number", required: true },
      { key: "basic", label: "Basic + DA (annual)", kind: "number", required: true },
      { key: "govt", label: "Government employee (14% cap)", kind: "checkbox" },
    ],
    amount: (e) => num(e.fields?.employerNps),
  },
  "80D": {
    id: "80D", label: "80D — health insurance", section: "80D", regimes: ["old"],
    subFields: [
      { key: "selfFamily", label: "Self / family premium", kind: "number", required: true },
      { key: "parents", label: "Parents' premium", kind: "number" },
      { key: "parentsSenior", label: "Parents are senior citizens", kind: "checkbox" },
    ],
    amount: (e) => {
      const f = e.fields || {};
      return Math.min(num(f.selfFamily), 25000) + Math.min(num(f.parents), f.parentsSenior ? 50000 : 25000);
    },
  },
  "80E": { id: "80E", label: "80E — education loan interest", section: "80E", regimes: ["old"], hint: "No cap.", amount: (e) => num(e.value) },
  "80G": {
    id: "80G", label: "80G — donations", section: "80G", regimes: ["old"],
    subFields: [
      { key: "donation", label: "Donation amount", kind: "number", required: true },
      { key: "pct", label: "Eligible %", kind: "select", required: true, options: [{ value: "100", label: "100%" }, { value: "50", label: "50%" }] },
    ],
    amount: (e) => Math.round((num(e.fields?.donation) * (num(e.fields?.pct) || 100)) / 100),
  },
  "80TTA": { id: "80TTA", label: "80TTA — savings interest", section: "80TTA", regimes: ["old"], cap: 10000, amount: (e) => num(e.value) },
  "80TTB": { id: "80TTB", label: "80TTB — interest (seniors)", section: "80TTB", regimes: ["old"], cap: 50000, amount: (e) => num(e.value) },
  "80DD": { id: "80DD", label: "80DD — dependent disability", section: "80DD", regimes: ["old"], cap: 125000, amount: (e) => num(e.value) },
  "80DDB": { id: "80DDB", label: "80DDB — specified illness", section: "80DDB", regimes: ["old"], cap: 100000, amount: (e) => num(e.value) },
  "80U": { id: "80U", label: "80U — self disability", section: "80U", regimes: ["old"], cap: 125000, amount: (e) => num(e.value) },
  "80CCH": { id: "80CCH", label: "80CCH — Agnipath scheme", section: "80CCH", regimes: ["old", "new"], hint: "Allowed in both regimes.", amount: (e) => num(e.value) },
  hra: {
    id: "hra", label: "HRA — 10(13A)", section: "10(13A)", regimes: ["old"],
    subFields: [
      { key: "hraReceived", label: "HRA received (annual)", kind: "number", required: true },
      { key: "basic", label: "Basic salary (annual)", kind: "number", required: true },
      { key: "rent", label: "Rent paid (annual)", kind: "number", required: true },
      { key: "metro", label: "Metro city", kind: "checkbox" },
    ],
    amount: (e) => hraExemptionOf(e.fields || {}),
  },
  lta: { id: "lta", label: "LTA — 10(5)", section: "10(5)", regimes: ["old"], amount: (e) => num(e.value) },
  sec10_14: { id: "sec10_14", label: "Other exemptions — 10(14)", section: "10(14)", regimes: ["old"], amount: (e) => num(e.value) },
  homeLoan24b: {
    id: "homeLoan24b", label: "Home loan interest — 24(b)", section: "24(b)", regimes: ["old"],
    subFields: [
      { key: "interest", label: "Interest paid (annual)", kind: "number", required: true },
      { key: "occupancy", label: "Property", kind: "select", required: true, options: [{ value: "self", label: "Self-occupied" }, { value: "letout", label: "Let-out" }] },
    ],
    amount: (e) => Math.min(num(e.fields?.interest), 200000),
  },
  profTax: { id: "profTax", label: "Professional tax — 16(iii)", section: "16(iii)", regimes: ["old"], cap: 2500, amount: (e) => num(e.value) },
};

export interface DeductionLine {
  id: DeductionId;
  label: string;
  claimed: number;
  allowed: number;
}
export interface IgnoredLine {
  id: DeductionId;
  label: string;
  claimed: number;
  reason: string;
}
export interface DeductionResult {
  standardDeduction: number;
  applied: DeductionLine[];
  ignored: IgnoredLine[];
  total: number;
}

/** Apply each entry only where the regime allows it, respecting caps + the 80C group cap. */
export function computeDeductions(salary: number, entries: DeductionEntry[], regime: Regime, config: TaxConfig): DeductionResult {
  const std = config.regimes[regime].standardDeduction;
  const group80CCap = config.deductionCaps.d80C;
  const cap80CCD1B = config.deductionCaps.d80CCD1B;

  const applied: DeductionLine[] = [];
  const ignored: IgnoredLine[] = [];
  let group80C = 0;

  for (const e of entries) {
    const def = DEDUCTIONS[e.id];
    if (!def) continue;
    const claimed = Math.round(def.amount(e, { salary }));

    if (!def.regimes.includes(regime)) {
      ignored.push({ id: e.id, label: def.label, claimed, reason: `Not allowed in the ${regime} regime` });
      continue;
    }

    let allowed = claimed;
    if (def.id === "80CCD2") {
      const basic = num(e.fields?.basic);
      if (basic > 0) allowed = Math.min(allowed, Math.round((e.fields?.govt ? 0.14 : 0.1) * basic));
    } else if (def.id === "80CCD1B") {
      allowed = Math.min(allowed, cap80CCD1B);
    } else if (def.cap != null) {
      allowed = Math.min(allowed, def.cap);
    }

    if (def.group === "80C") {
      const room = Math.max(0, group80CCap - group80C);
      allowed = Math.min(allowed, room);
      group80C += allowed;
    }
    applied.push({ id: e.id, label: def.label, claimed, allowed });
  }

  const total = std + applied.reduce((s, l) => s + l.allowed, 0);
  return { standardDeduction: std, applied, ignored, total };
}

export interface RegimeComputation {
  taxableIncome: number;
  deductions: DeductionResult;
  taxBeforeRebate: number;
  rebate: number;
  cess: number;
  otherIncome: number; // income from other sources (e.g. FD interest)
  taxesPaid: number; // TDS / advance tax already paid
  totalTax: number; // net payable after taxesPaid
}

/**
 * @param otherIncome  Income from Other Sources (FD interest, etc.) — added to the taxable base.
 * @param taxesPaid    TDS / advance tax already paid — reduces the net payable (floored at 0).
 */
export function computeRegime(
  salary: number,
  entries: DeductionEntry[],
  regime: Regime,
  config: TaxConfig,
  otherIncome = 0,
  taxesPaid = 0
): RegimeComputation {
  const deductions = computeDeductions(salary, entries, regime, config);
  const taxable = Math.max(0, salary + otherIncome - deductions.total);
  const r = config.regimes[regime];
  const before = taxFromSlabs(taxable, r.slabs);
  const rebate = taxable <= r.rebate87AIncomeLimit ? before : 0;
  const afterRebate = before - rebate;
  const cess = afterRebate * config.cessRate;
  const gross = afterRebate + cess;
  return {
    taxableIncome: Math.round(taxable),
    deductions,
    taxBeforeRebate: Math.round(before),
    rebate: Math.round(rebate),
    cess: Math.round(cess),
    otherIncome: Math.round(otherIncome),
    taxesPaid: Math.round(taxesPaid),
    totalTax: Math.max(0, Math.round(gross - taxesPaid)),
  };
}

export function effectiveRate(totalTax: number, grossSalary: number): number {
  if (!grossSalary) return 0;
  return Math.round((totalTax / grossSalary) * 1000) / 10; // one decimal %
}

/** Components addable in a given regime (for the "Add deduction" picker). */
export function addableIn(regime: Regime): DeductionDef[] {
  return Object.values(DEDUCTIONS).filter((d) => d.regimes.includes(regime));
}

/** Validate required sub-fields of selected entries. Returns {entryId: [missingKeys]}. */
export function validateEntries(entries: DeductionEntry[]): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const e of entries) {
    const def = DEDUCTIONS[e.id];
    if (!def?.subFields) continue;
    const missing = def.subFields.filter((f) => f.required && !num(e.fields?.[f.key]) && e.fields?.[f.key] !== true).map((f) => f.key);
    if (missing.length) errors[e.id] = missing;
  }
  return errors;
}
