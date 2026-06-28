// Pure Fixed-Deposit math (no Firebase, no side effects) → fully testable.
import type { FixedDeposit } from "../types";

export type Compounding = "quarterly" | "monthly" | "half-yearly" | "annually" | "simple";
export type PayoutType = "cumulative" | "non-cumulative";
export type PayoutFrequency = "monthly" | "quarterly";

// Compounding periods per year.
export const PERIODS_PER_YEAR: Record<Exclude<Compounding, "simple">, number> = {
  monthly: 12,
  quarterly: 4,
  "half-yearly": 2,
  annually: 1,
};
export const COMPOUNDING_LABELS: Record<Compounding, string> = {
  quarterly: "Quarterly",
  monthly: "Monthly",
  "half-yearly": "Half-yearly",
  annually: "Annually",
  simple: "Simple interest",
};

const round = (n: number) => Math.round(n);
const pad = (n: number) => String(n).padStart(2, "0");

function parse(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function daysBetween(aISO: string, bISO: string): number {
  return Math.round((parse(bISO).getTime() - parse(aISO).getTime()) / 86_400_000);
}
/** Tenure in decimal years. 365-day basis → "exactly 1 year" (365 days) gives T = 1. */
export function yearsBetween(aISO: string, bISO: string): number {
  return daysBetween(aISO, bISO) / 365;
}
/** Same day-of-month `months` later, clamped to the month's last day. */
export function addMonths(iso: string, months: number): string {
  const d = parse(iso);
  const targetMonth = d.getMonth() + months;
  const last = new Date(d.getFullYear(), targetMonth + 1, 0).getDate();
  return ymd(new Date(d.getFullYear(), targetMonth, Math.min(d.getDate(), last)));
}

/** Maturity/value amount for principal held for `years` at `rate`% with `compounding`. */
export function amountAfter(principal: number, rate: number, years: number, compounding: Compounding): number {
  if (years <= 0) return principal;
  if (compounding === "simple") return principal + (principal * rate * years) / 100;
  const n = PERIODS_PER_YEAR[compounding];
  return principal * Math.pow(1 + rate / (n * 100), n * years);
}

/** Interest accrued from start to `asOf` (clamped at maturity). */
export function interestAccrued(fd: Pick<FixedDeposit, "principal" | "interestRate" | "startDate" | "maturityDate" | "compoundingFrequency">, asOfISO: string): number {
  const asOf = asOfISO < fd.startDate ? fd.startDate : asOfISO > fd.maturityDate ? fd.maturityDate : asOfISO;
  const t = yearsBetween(fd.startDate, asOf);
  return Math.max(0, amountAfter(fd.principal, fd.interestRate, t, fd.compoundingFrequency) - fd.principal);
}

export interface SchedulePeriod {
  date: string; // period end / payout date
  periodStart?: string; // period start (for the schedule table)
  interestAmount: number;
}
/**
 * Interest earned in each compounding period from start to maturity (cumulative
 * FDs) — used for tax accrual and the detail schedule table. For simple interest
 * the schedule is yearly (plus a final partial year).
 */
export function interestSchedule(fd: Pick<FixedDeposit, "principal" | "interestRate" | "startDate" | "maturityDate" | "compoundingFrequency">): SchedulePeriod[] {
  const { principal, interestRate: rate, startDate, maturityDate, compoundingFrequency } = fd;
  const totalYears = yearsBetween(startDate, maturityDate);
  if (totalYears <= 0) return [];
  const out: SchedulePeriod[] = [];

  if (compoundingFrequency === "simple") {
    const wholeYears = Math.floor(totalYears + 1e-9);
    for (let i = 1; i <= wholeYears; i++) out.push({ date: addMonths(startDate, i * 12), interestAmount: round((principal * rate) / 100) });
    const frac = totalYears - wholeYears;
    if (frac > 1e-6) out.push({ date: maturityDate, interestAmount: round((principal * rate * frac) / 100) });
    return out;
  }

  const n = PERIODS_PER_YEAR[compoundingFrequency];
  const periods = Math.max(1, Math.round(n * totalYears));
  const periodMonths = 12 / n;
  let prev = principal;
  for (let i = 1; i <= periods; i++) {
    const A = principal * Math.pow(1 + rate / (n * 100), i);
    out.push({ date: addMonths(startDate, i * periodMonths), interestAmount: round(A - prev) });
    prev = A;
  }
  return out;
}

/** Payout entries for a non-cumulative FD (interest paid out, not compounded). */
export function payoutSchedule(
  fd: Pick<FixedDeposit, "principal" | "interestRate" | "startDate" | "maturityDate">,
  payoutFrequency: PayoutFrequency
): SchedulePeriod[] {
  const perYear = payoutFrequency === "monthly" ? 12 : 4;
  const periodMonths = 12 / perYear;
  const perPayout = round((fd.principal * fd.interestRate) / (perYear * 100));
  const out: SchedulePeriod[] = [];
  let periodStart = fd.startDate;
  let date = addMonths(fd.startDate, periodMonths);
  while (date <= fd.maturityDate) {
    out.push({ date, periodStart, interestAmount: perPayout });
    periodStart = date;
    date = addMonths(date, periodMonths);
  }
  // Final stub period to the maturity date (prorated) — so the last row is maturity.
  if (periodStart < fd.maturityDate) {
    const stubDays = daysBetween(periodStart, fd.maturityDate);
    out.push({ date: fd.maturityDate, periodStart, interestAmount: round((fd.principal * fd.interestRate * stubDays) / 36500) });
  }
  return out;
}

export interface FdComputed {
  tenureYears: number;
  tenureDays: number;
  daysToMaturity: number;
  maturityAmount: number;
  totalInterest: number;
  interestAccruedToDate: number;
  dailyAccrualRate: number;
  perSecondRate: number;
  /** First-year interest — the amount taxable per year ("accrues yearly"). */
  annualInterest: number;
  /** Projected TDS (principal × rate% × tdsRate%) per the spec. */
  projectedTds: number;
  netInterestAfterTds: number;
  schedule: SchedulePeriod[];
  payouts: SchedulePeriod[];
}

/** Derive every live figure for an FD. Recompute on load — never stored. */
export function computeFd(fd: FixedDeposit, todayISO: string): FdComputed {
  const tenureYears = yearsBetween(fd.startDate, fd.maturityDate);
  const tenureDays = daysBetween(fd.startDate, fd.maturityDate);
  const daysToMaturity = daysBetween(todayISO, fd.maturityDate);
  const maturityAmount = round(amountAfter(fd.principal, fd.interestRate, tenureYears, fd.compoundingFrequency));
  const totalInterest = maturityAmount - fd.principal;
  const interestAccruedToDate = round(interestAccrued(fd, todayISO));
  const dailyAccrualRate = tenureDays > 0 ? totalInterest / tenureDays : 0;
  const annualInterest = round(amountAfter(fd.principal, fd.interestRate, 1, fd.compoundingFrequency) - fd.principal);
  const tdsRate = fd.tdsRate ?? 10;
  const projectedTds = fd.tdsDeducted ? round((fd.principal * fd.interestRate * tdsRate) / 10000) : 0;
  const netInterestAfterTds = fd.tdsDeducted ? round(totalInterest * (1 - tdsRate / 100)) : totalInterest;
  return {
    tenureYears,
    tenureDays,
    daysToMaturity,
    maturityAmount,
    totalInterest,
    interestAccruedToDate,
    dailyAccrualRate,
    perSecondRate: dailyAccrualRate / 86_400,
    annualInterest,
    projectedTds,
    netInterestAfterTds,
    // Non-cumulative: schedule IS the per-payout breakdown (one row per period).
    // Cumulative: per-compounding-period interest.
    schedule: fd.payoutType === "non-cumulative" ? payoutSchedule(fd, fd.payoutFrequency || "quarterly") : interestSchedule(fd),
    payouts: fd.payoutType === "non-cumulative" ? payoutSchedule(fd, fd.payoutFrequency || "quarterly") : [],
  };
}

/** Live accrued value including the fraction of today elapsed since `sinceMs`. */
export function liveAccrued(base: number, perSecondRate: number, elapsedSeconds: number): number {
  return base + perSecondRate * elapsedSeconds;
}
