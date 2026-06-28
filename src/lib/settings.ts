import { DEFAULT_TAX_CONFIG, DEFAULT_TAX_CONFIG_PREV, type TaxConfig } from "./taxConfig";

export type FeatureKey =
  | "finance" | "tax" | "documents" | "crisis" | "gmailSync" | "payslip" | "agent"
  | "recurring" | "fixedDeposits" | "documentImport";

/** Per-feature access state: everyone / pro-only / nobody. */
export type FeatureState = "everyone" | "pro" | "nobody";

/** The admin-configured 3-state access map (source of truth). */
export type FeatureAccess = Record<FeatureKey, FeatureState>;

/** Resolved booleans for ONE user (derived from FeatureAccess + their plan/role). */
export type FeatureFlags = Record<FeatureKey, boolean>;

export const FEATURE_KEYS: FeatureKey[] = [
  "finance", "tax", "documents", "crisis", "gmailSync", "payslip", "agent",
  "recurring", "fixedDeposits", "documentImport",
];

export interface FreeTierLimits {
  maxTasks: number;
  maxBills: number;
  maxDocuments: number;
}

export interface AppSettings {
  featureAccess: FeatureAccess;
  defaultPlan: "free" | "pro";
  gmailSyncFrequency: "manual" | "daily" | "realtime";
  freeTier: FreeTierLimits;
  maintenanceMode: boolean;
  announcement: { enabled: boolean; message: string };
  taxConfig: TaxConfig; // current year
  taxConfigPrev: TaxConfig; // previous year (for two-year comparison)
}

const ALL_EVERYONE: FeatureAccess = FEATURE_KEYS.reduce((a, k) => ((a[k] = "everyone"), a), {} as FeatureAccess);

export const DEFAULT_SETTINGS: AppSettings = {
  featureAccess: ALL_EVERYONE,
  defaultPlan: "free",
  gmailSyncFrequency: "manual",
  freeTier: { maxTasks: 100, maxBills: 100, maxDocuments: 100 },
  maintenanceMode: false,
  announcement: { enabled: false, message: "" },
  taxConfig: DEFAULT_TAX_CONFIG,
  taxConfigPrev: DEFAULT_TAX_CONFIG_PREV,
};

/** Build a valid FeatureAccess, migrating from a legacy boolean `featureFlags` doc. */
function normalizeAccess(raw: any): FeatureAccess {
  const access = raw?.featureAccess;
  const legacy = raw?.featureFlags; // pre-3-state boolean map
  const out = {} as FeatureAccess;
  for (const k of FEATURE_KEYS) {
    const v = access?.[k];
    if (v === "everyone" || v === "pro" || v === "nobody") out[k] = v;
    else if (legacy && typeof legacy[k] === "boolean") out[k] = legacy[k] ? "everyone" : "nobody";
    else out[k] = "everyone";
  }
  return out;
}

/** Merge a (possibly partial) Firestore settings doc onto the defaults. */
export function mergeSettings(raw: any): AppSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_SETTINGS;
  return {
    featureAccess: normalizeAccess(raw),
    defaultPlan: raw.defaultPlan || DEFAULT_SETTINGS.defaultPlan,
    gmailSyncFrequency: raw.gmailSyncFrequency || DEFAULT_SETTINGS.gmailSyncFrequency,
    freeTier: { ...DEFAULT_SETTINGS.freeTier, ...(raw.freeTier || {}) },
    maintenanceMode: !!raw.maintenanceMode,
    announcement: { ...DEFAULT_SETTINGS.announcement, ...(raw.announcement || {}) },
    taxConfig: raw.taxConfig && raw.taxConfig.regimes ? raw.taxConfig : DEFAULT_TAX_CONFIG,
    taxConfigPrev: raw.taxConfigPrev && raw.taxConfigPrev.regimes ? raw.taxConfigPrev : DEFAULT_TAX_CONFIG_PREV,
  };
}

/** Whether a given user (plan/role) can access a feature in a given state. */
export function canAccess(state: FeatureState, plan: string, isAdmin: boolean): boolean {
  if (state === "nobody") return false;
  if (state === "pro") return isAdmin || plan === "pro";
  return true; // everyone
}

/** Resolve the whole access map to per-user booleans. */
export function resolveFlags(access: FeatureAccess, plan: string, isAdmin: boolean): FeatureFlags {
  const out = {} as FeatureFlags;
  for (const k of FEATURE_KEYS) out[k] = canAccess(access[k], plan, isAdmin);
  return out;
}

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  finance: "Finance", tax: "Tax", documents: "Documents", crisis: "Crisis mode",
  gmailSync: "Gmail sync", payslip: "Payslip analyser", agent: "AI agent",
  recurring: "Recurring Payments", fixedDeposits: "Fixed Deposits", documentImport: "Document import",
};
