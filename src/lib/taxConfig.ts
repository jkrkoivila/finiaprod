// FY 2025-26 (AY 2026-27) tax configuration.
//
// This is the DEFAULT config. The live values are read from Firestore
// `systemSettings/global.taxConfig` (see useSystemSettings) so an admin can
// update slabs/caps without a code change. The calc engine reads these arrays —
// nothing about the rates is hardcoded into the math.

export interface Slab {
  upTo: number | null; // null = no upper bound
  rate: number; // fraction, e.g. 0.05
}

export interface RegimeConfig {
  slabs: Slab[];
  standardDeduction: number;
  rebate87AIncomeLimit: number; // taxable income at/under which tax becomes nil
}

export interface AdvanceTaxInstalment {
  label: string;
  by: string; // human date
  dueDate: string; // YYYY-MM-DD (for calendar tasks)
  cumulativePct: number; // 15 / 45 / 75 / 100
}

export interface TaxConfig {
  fyLabel: string;
  ayLabel: string;
  cessRate: number;
  deductionCaps: {
    d80C: number;
    d80D: number;
    d80CCD1B: number;
    homeLoanInterest: number; // Section 24(b)
  };
  regimes: {
    new: RegimeConfig;
    old: RegimeConfig;
  };
  advanceTaxSchedule: AdvanceTaxInstalment[];
  itrDeadline: string; // YYYY-MM-DD
}

export const DEFAULT_TAX_CONFIG: TaxConfig = {
  fyLabel: "FY 2025-26",
  ayLabel: "AY 2026-27",
  cessRate: 0.04,
  deductionCaps: {
    d80C: 150000,
    d80D: 25000,
    d80CCD1B: 50000,
    homeLoanInterest: 200000,
  },
  regimes: {
    new: {
      slabs: [
        { upTo: 400000, rate: 0 },
        { upTo: 800000, rate: 0.05 },
        { upTo: 1200000, rate: 0.1 },
        { upTo: 1600000, rate: 0.15 },
        { upTo: 2000000, rate: 0.2 },
        { upTo: 2400000, rate: 0.25 },
        { upTo: null, rate: 0.3 },
      ],
      standardDeduction: 75000,
      rebate87AIncomeLimit: 1200000, // income up to ₹12L is effectively tax-free
    },
    old: {
      slabs: [
        { upTo: 250000, rate: 0 },
        { upTo: 500000, rate: 0.05 },
        { upTo: 1000000, rate: 0.2 },
        { upTo: null, rate: 0.3 },
      ],
      standardDeduction: 50000,
      rebate87AIncomeLimit: 500000,
    },
  },
  advanceTaxSchedule: [
    { label: "1st instalment", by: "15 Jun 2025", dueDate: "2025-06-15", cumulativePct: 15 },
    { label: "2nd instalment", by: "15 Sep 2025", dueDate: "2025-09-15", cumulativePct: 45 },
    { label: "3rd instalment", by: "15 Dec 2025", dueDate: "2025-12-15", cumulativePct: 75 },
    { label: "4th instalment", by: "15 Mar 2026", dueDate: "2026-03-15", cumulativePct: 100 },
  ],
  itrDeadline: "2026-07-31",
};

// Previous year — FY 2024-25 (AY 2025-26). New-regime slabs differed.
export const DEFAULT_TAX_CONFIG_PREV: TaxConfig = {
  fyLabel: "FY 2024-25",
  ayLabel: "AY 2025-26",
  cessRate: 0.04,
  deductionCaps: { d80C: 150000, d80D: 25000, d80CCD1B: 50000, homeLoanInterest: 200000 },
  regimes: {
    new: {
      slabs: [
        { upTo: 300000, rate: 0 },
        { upTo: 700000, rate: 0.05 },
        { upTo: 1000000, rate: 0.1 },
        { upTo: 1200000, rate: 0.15 },
        { upTo: 1500000, rate: 0.2 },
        { upTo: null, rate: 0.3 },
      ],
      standardDeduction: 75000,
      rebate87AIncomeLimit: 700000,
    },
    old: {
      slabs: [
        { upTo: 250000, rate: 0 },
        { upTo: 500000, rate: 0.05 },
        { upTo: 1000000, rate: 0.2 },
        { upTo: null, rate: 0.3 },
      ],
      standardDeduction: 50000,
      rebate87AIncomeLimit: 500000,
    },
  },
  advanceTaxSchedule: [
    { label: "1st instalment", by: "15 Jun 2024", dueDate: "2024-06-15", cumulativePct: 15 },
    { label: "2nd instalment", by: "15 Sep 2024", dueDate: "2024-09-15", cumulativePct: 45 },
    { label: "3rd instalment", by: "15 Dec 2024", dueDate: "2024-12-15", cumulativePct: 75 },
    { label: "4th instalment", by: "15 Mar 2025", dueDate: "2025-03-15", cumulativePct: 100 },
  ],
  itrDeadline: "2025-07-31",
};
