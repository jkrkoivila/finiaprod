import type { Bill } from "../types";

// Pure dedupe-key helpers (no Firebase import) so they're testable in isolation.

function slug(s: string): string {
  return (
    (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "x"
  );
}

/**
 * Bills are de-duplicated by issuer + last4 + statement month + total due
 * (AGENTS.md). This key is used as the Firestore doc id so re-imports collide
 * on the same document instead of creating duplicates.
 */
export function billDedupeKey(input: {
  issuer: string;
  last4?: string;
  statementMonth: string;
  totalDue: number;
}): string {
  return [slug(input.issuer), input.last4 || "xxxx", input.statementMonth, Math.round(input.totalDue || 0)].join("_");
}

export function keyForBill(b: {
  payee: string;
  last4?: string;
  statementMonth?: string;
  dueDate: string;
  amount: number;
}): string {
  return billDedupeKey({
    issuer: b.payee,
    last4: b.last4,
    statementMonth: b.statementMonth || b.dueDate.slice(0, 7),
    totalDue: b.amount,
  });
}

export type { Bill };
