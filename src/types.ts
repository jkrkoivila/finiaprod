export type ActiveView =
  | "dashboard"
  | "tasks"
  | "calendar"
  | "finance"
  | "bills"
  | "tax"
  | "documents"
  | "analytics";

export type ChatState = "open" | "minimised" | "closed";

export type TaskCategory = "tax" | "finance" | "personal" | "general" | "work";

export interface Task {
  id: string;
  userId: string;
  title: string;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:MM
  category: TaskCategory;
  completed: boolean;
  priority: "high" | "medium" | "low";
  amount?: number;
  sourceDocumentId?: string | null;
  sourceInstanceId?: string | null; // links to a recurring paymentInstance
  recurring?: boolean;
  isManuallyEdited?: boolean;
}

export interface Bill {
  id: string; // Firestore doc id === dedupeKey
  userId: string;
  payee: string; // issuer
  amount: number; // total due
  dueDate: string; // YYYY-MM-DD
  paid: boolean;
  category: "electricity" | "rent" | "internet" | "credit-card" | "other";
  last4?: string; // card last 4 digits (credit-card bills)
  minimumDue?: number;
  statementMonth?: string; // YYYY-MM
  dedupeKey?: string;
  sourceDocumentId?: string | null;
  isManuallyEdited?: boolean;
}

export interface Transaction {
  id: string;
  userId: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string; // YYYY-MM-DD
  sourceDocumentId?: string | null;
  sourceInstanceId?: string | null; // links to a recurring paymentInstance
  sourceType?: "fd" | null; // FD interest income
  fdId?: string | null;
}

// ── Fixed Deposits ──
export type FdCompounding = "quarterly" | "monthly" | "half-yearly" | "annually" | "simple";
export type FdPayoutType = "cumulative" | "non-cumulative";
export type FdPayoutFrequency = "monthly" | "quarterly";
export type FdStatus = "active" | "matured" | "renewed" | "closed";

export interface FixedDeposit {
  id: string; // Firestore doc id === `${uid}_${fdId}`
  userId: string;
  fdId: string;
  principal: number;
  startDate: string; // YYYY-MM-DD
  maturityDate: string; // YYYY-MM-DD
  interestRate: number; // annual %
  compoundingFrequency: FdCompounding;
  payoutType: FdPayoutType;
  payoutFrequency?: FdPayoutFrequency; // non-cumulative only
  bank: string;
  description?: string;
  certificateNumber?: string;
  tdsDeducted: boolean;
  tdsRate?: number; // default 10
  autoRenew: boolean;
  status: FdStatus;
  taxTracked?: boolean; // user opted to include interest in tax calc
  tdsTracked?: boolean; // user opted to count TDS as advance tax paid
  incomeScheduleGenerated?: boolean; // non-cumulative payout schedule was created
  maturityIncomeBooked?: boolean; // the matured income transaction was created
  createdAt?: unknown;
}

export interface FdIncomeEntry {
  id: string;
  userId: string;
  fdId: string;
  date: string; // YYYY-MM-DD payout date
  amount: number;
  status: "upcoming" | "paid";
  transactionId?: string | null;
}

export interface Subscription {
  id: string;
  userId: string;
  name: string;
  amount: number;
  frequency: "monthly" | "yearly";
  category: string;
  active: boolean;
  isUnused?: boolean;
  lastUsedDays?: number;
}

export interface Receivable {
  id: string;
  userId: string;
  debtor: string;
  amount: number;
  date: string; // YYYY-MM-DD
  description?: string;
  reminded?: boolean;
}

export type NotificationType = "finance" | "tax" | "task" | "crisis" | "gmail";

export interface FiniaNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null; // app path to navigate to on tap
  read: boolean;
  createdAt?: any; // Firestore Timestamp
}

import type { DocStatus, DocType } from "./lib/importCriteria";

export interface FiniaDocument {
  id: string; // dedupeKey when importable, else generated
  userId: string;
  type: DocType | null;
  status: DocStatus;
  fileName: string;
  storageUrl?: string | null; // raw file location (when stored)
  size?: string;
  source: "upload" | "gmail";
  extractedData: Record<string, any>;
  confidenceFlags?: Record<string, boolean>; // true => uncertain, show "please verify"
  missingRequired?: string[];
  tags?: string[];
  summary?: string;
  dedupeKey?: string | null;
  uploadedAt?: unknown;
}
