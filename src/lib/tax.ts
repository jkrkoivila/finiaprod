import type { Slab, TaxConfig } from "./taxConfig";

export interface TaxInputs {
  grossSalary: number;
  hraReceived: number;
  annualRent: number; // for the HRA exemption calc (old regime)
  metro: boolean;
  homeLoanInterest: number; // Section 24(b)
  d80C: number;
  d80D: number;
  d80CCD1B: number;
  d80E: number;
  d80G: number;
}

export const ZERO_INPUTS: TaxInputs = {
  grossSalary: 0, hraReceived: 0, annualRent: 0, metro: true,
  homeLoanInterest: 0, d80C: 0, d80D: 0, d80CCD1B: 0, d80E: 0, d80G: 0,
};

export interface RegimeResult {
  taxableIncome: number;
  deductionsApplied: number;
  taxBeforeRebate: number;
  rebate: number;
  taxAfterRebate: number;
  cess: number;
  totalTax: number;
}

/** Progressive tax across slab brackets. */
export function taxFromSlabs(taxable: number, slabs: Slab[]): number {
  let tax = 0;
  let lower = 0;
  for (const s of slabs) {
    const upper = s.upTo ?? Infinity;
    if (taxable > lower) tax += (Math.min(taxable, upper) - lower) * s.rate;
    lower = upper;
    if (taxable <= upper) break;
  }
  return tax;
}

/** HRA exemption (old regime). Basic is assumed to be 50% of gross when not known. */
export function hraExemption(inputs: TaxInputs): number {
  if (!inputs.annualRent || !inputs.hraReceived) return 0;
  const basic = 0.5 * inputs.grossSalary;
  return Math.max(
    0,
    Math.min(
      inputs.hraReceived,
      inputs.annualRent - 0.1 * basic,
      (inputs.metro ? 0.5 : 0.4) * basic
    )
  );
}

function finalise(taxable: number, slabs: Slab[], rebateLimit: number, cessRate: number, deductionsApplied: number): RegimeResult {
  const before = taxFromSlabs(taxable, slabs);
  const rebate = taxable <= rebateLimit ? before : 0;
  const after = before - rebate;
  const cess = after * cessRate;
  return {
    taxableIncome: Math.round(taxable),
    deductionsApplied: Math.round(deductionsApplied),
    taxBeforeRebate: Math.round(before),
    rebate: Math.round(rebate),
    taxAfterRebate: Math.round(after),
    cess: Math.round(cess),
    totalTax: Math.round(after + cess),
  };
}

/** New regime: only the standard deduction applies. */
export function computeNewRegime(inputs: TaxInputs, config: TaxConfig): RegimeResult {
  const r = config.regimes.new;
  const taxable = Math.max(0, inputs.grossSalary - r.standardDeduction);
  return finalise(taxable, r.slabs, r.rebate87AIncomeLimit, config.cessRate, r.standardDeduction);
}

/** Old regime: standard deduction + HRA + home-loan interest + chapter VI-A deductions. */
export function computeOldRegime(inputs: TaxInputs, config: TaxConfig): RegimeResult {
  const r = config.regimes.old;
  const caps = config.deductionCaps;
  const deductions =
    r.standardDeduction +
    Math.min(inputs.d80C, caps.d80C) +
    Math.min(inputs.d80D, caps.d80D) +
    Math.min(inputs.d80CCD1B, caps.d80CCD1B) +
    Math.min(inputs.homeLoanInterest, caps.homeLoanInterest) +
    Math.max(0, inputs.d80E) +
    Math.max(0, inputs.d80G) +
    hraExemption(inputs);
  const taxable = Math.max(0, inputs.grossSalary - deductions);
  return finalise(taxable, r.slabs, r.rebate87AIncomeLimit, config.cessRate, deductions);
}

export interface Comparison {
  new: RegimeResult;
  old: RegimeResult;
  better: "new" | "old";
  saving: number;
  betterTax: number;
}

export function compareRegimes(inputs: TaxInputs, config: TaxConfig): Comparison {
  const neu = computeNewRegime(inputs, config);
  const old = computeOldRegime(inputs, config);
  const better = neu.totalTax <= old.totalTax ? "new" : "old";
  return {
    new: neu,
    old,
    better,
    saving: Math.abs(neu.totalTax - old.totalTax),
    betterTax: better === "new" ? neu.totalTax : old.totalTax,
  };
}

export function monthlyTDS(totalTax: number): number {
  return Math.round(totalTax / 12);
}

export interface AdvanceRow {
  label: string;
  by: string;
  cumulativePct: number;
  cumulativeAmount: number;
  instalment: number;
}
export function advanceTaxSchedule(totalTax: number, config: TaxConfig): AdvanceRow[] {
  let prev = 0;
  return config.advanceTaxSchedule.map((s) => {
    const cumulativeAmount = Math.round((totalTax * s.cumulativePct) / 100);
    const instalment = cumulativeAmount - prev;
    prev = cumulativeAmount;
    return { label: s.label, by: s.by, cumulativePct: s.cumulativePct, cumulativeAmount, instalment };
  });
}

export interface Headroom {
  section: string;
  used: number;
  cap: number;
  headroom: number;
}
export function deductionHeadroom(inputs: TaxInputs, config: TaxConfig): Headroom[] {
  const caps = config.deductionCaps;
  const mk = (section: string, used: number, cap: number): Headroom => ({
    section, used, cap, headroom: Math.max(0, cap - used),
  });
  return [
    mk("80C", inputs.d80C, caps.d80C),
    mk("80D", inputs.d80D, caps.d80D),
    mk("80CCD(1B) NPS", inputs.d80CCD1B, caps.d80CCD1B),
    mk("24(b) home loan", inputs.homeLoanInterest, caps.homeLoanInterest),
  ];
}
