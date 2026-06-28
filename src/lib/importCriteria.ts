// The document import contract: required vs optional fields per type, the status
// rules, and the dedupe key. This is the deterministic heart of the pipeline —
// pure and Firebase-free so it's fully unit-testable.

export type DocStatus =
  | "imported"
  | "needs_review"
  | "uncategorized"
  | "unreadable"
  | "locked"
  | "data_removed";

export type DocType =
  | "credit-card-bill"
  | "bank-statement"
  | "payslip"
  | "form16"
  | "insurance"
  | "investment"
  | "loan-statement"
  | "utility-bill"
  | "receipt";

export interface DocTypeDef {
  id: DocType;
  label: string;
  required: string[];
  optional: string[];
  /** Fields combined (normalized) into the dedupe key / doc id. */
  dedupeFields: string[];
  /** Which module the imported data flows into. */
  flowsTo: "bills" | "transactions" | "taxProfile" | "none";
}

export const DOC_TYPES: Record<DocType, DocTypeDef> = {
  "credit-card-bill": {
    id: "credit-card-bill", label: "Credit card bill",
    required: ["issuer", "last4", "statementMonth", "totalDue"],
    optional: ["minimumDue", "dueDate", "transactions"],
    dedupeFields: ["issuer", "last4", "statementMonth", "totalDue"],
    flowsTo: "bills",
  },
  "bank-statement": {
    id: "bank-statement", label: "Bank statement",
    required: ["bank", "accountLast4", "statementPeriod"],
    optional: ["openingBalance", "closingBalance", "transactions"],
    dedupeFields: ["bank", "accountLast4", "statementPeriod"],
    flowsTo: "transactions",
  },
  payslip: {
    id: "payslip", label: "Payslip",
    required: ["employer", "month", "grossSalary"],
    optional: ["basic", "hra", "da", "pfEmployee", "tds", "netPay"],
    dedupeFields: ["employer", "month"],
    flowsTo: "taxProfile",
  },
  form16: {
    id: "form16", label: "Form 16",
    required: ["employer", "fy", "grossSalary", "tds"],
    optional: ["section80C", "standardDeduction"],
    dedupeFields: ["employer", "fy"],
    flowsTo: "taxProfile",
  },
  insurance: {
    id: "insurance", label: "Insurance / LIC",
    required: ["insurer", "premium", "policyNumber"],
    optional: ["dueDate", "sumAssured"],
    dedupeFields: ["insurer", "policyNumber"],
    flowsTo: "none",
  },
  investment: {
    id: "investment", label: "Investment",
    required: ["provider", "amount", "date"],
    optional: ["folio", "scheme"],
    dedupeFields: ["provider", "amount", "date"],
    flowsTo: "none",
  },
  "loan-statement": {
    id: "loan-statement", label: "Loan statement",
    required: ["lender", "emiAmount", "dueDate"],
    optional: ["principalOutstanding", "rate"],
    dedupeFields: ["lender", "emiAmount", "dueDate"],
    flowsTo: "bills",
  },
  "utility-bill": {
    id: "utility-bill", label: "Utility bill",
    required: ["provider", "amount", "dueDate"],
    optional: ["consumerNumber", "billMonth"],
    dedupeFields: ["provider", "amount", "dueDate"],
    flowsTo: "bills",
  },
  receipt: {
    id: "receipt", label: "Receipt",
    required: ["merchant", "amount", "date"],
    optional: ["category"],
    dedupeFields: ["merchant", "amount", "date"],
    flowsTo: "transactions",
  },
};

export const DOC_TYPE_LIST = Object.values(DOC_TYPES);

function isMissing(v: unknown): boolean {
  return v === undefined || v === null || v === "" || (typeof v === "number" && Number.isNaN(v));
}

export interface ImportEvaluation {
  status: Extract<DocStatus, "imported" | "needs_review" | "uncategorized">;
  missingRequired: string[];
}

/**
 * Decide a document's status from its type + extracted fields.
 * - unknown type → 'uncategorized'
 * - all required present → 'imported'
 * - some required missing → 'needs_review' (partial data kept, excluded from totals)
 *
 * (unreadable / locked are set by the extraction step, not here.)
 */
export function evaluateImport(
  type: DocType | null | undefined,
  extracted: Record<string, unknown>
): ImportEvaluation {
  if (!type || !DOC_TYPES[type]) return { status: "uncategorized", missingRequired: [] };
  const def = DOC_TYPES[type];
  const missingRequired = def.required.filter((f) => isMissing(extracted?.[f]));
  return { status: missingRequired.length === 0 ? "imported" : "needs_review", missingRequired };
}

/** CRITICAL: only 'imported' documents may contribute to any total/vital. */
export function countsTowardTotals(status: DocStatus): boolean {
  return status === "imported";
}

// ── Dedupe key (structural duplicate prevention) ──
function norm(v: unknown): string {
  if (typeof v === "number") return String(Math.round(v));
  return String(v ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 30);
}

/**
 * Stable dedupe key used AS the Firestore document id, so duplicates are
 * structurally impossible. For a credit card bill this is exactly
 * issuer + last4 + statement month + total due (AGENTS.md).
 * Returns null if any dedupe field is missing (can't safely dedupe → not imported).
 */
export function documentDedupeKey(type: DocType, extracted: Record<string, unknown>): string | null {
  const def = DOC_TYPES[type];
  if (!def) return null;
  const parts = def.dedupeFields.map((f) => norm(extracted?.[f]));
  if (parts.some((p) => p === "")) return null;
  return [norm(type), ...parts].join("_");
}
