export type ActiveView =
  | "dashboard"
  | "tasks"
  | "calendar"
  | "finance"
  | "bills"
  | "tax"
  | "documents"
  | "analytics"
  | "crisis";

export interface Task {
  id: string;
  title: string;
  dueDate: string;
  dueTime?: string;
  category: "tax" | "finance" | "personal" | "general" | "work";
  completed: boolean;
  amount?: number;
  priority: "high" | "medium" | "low";
  sourceDocumentId?: string | null;
  isManuallyEdited?: boolean;
}

export interface FinanceEntry {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  sourceDocumentId?: string | null;
  isManuallyEdited?: boolean;
}

export interface Bill {
  id: string;
  payee: string;
  amount: number;
  dueDate: string;
  paid: boolean;
  category: "electricity" | "rent" | "internet" | "credit-card" | "other";
  sourceDocumentId?: string | null;
  isManuallyEdited?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "agent";
  text: string;
  timestamp: string;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  frequency: "monthly" | "yearly";
  category: "entertainment" | "utility" | "saas" | "other";
  lastUsedDays: number;
  active: boolean;
  isUnused: boolean;
}

export interface Receivable {
  id: string;
  debtor: string;
  amount: number;
  date: string;
  description: string;
  reminded: boolean;
}

export interface Document {
  id: string;
  userId: string;
  fileName: string;
  fileType: string; // the document category / type (e.g. invoice, payslip, statement)
  storageUrl: string;
  uploadedAt: string; // ISO format
  status: "imported" | "needs_review" | "uncategorized" | "unreadable" | "locked" | "data_removed";
  extractedData: Record<string, any>;
  confidenceFlags: Record<string, boolean>;
  size?: string;
  tags?: string[];
}

export interface PayslipData {
  id: string;
  userId: string;
  sourceDocumentId?: string | null;
  isManuallyEdited?: boolean;
  [key: string]: any;
}

export interface Deduction {
  id: string;
  userId: string;
  sourceDocumentId?: string | null;
  isManuallyEdited?: boolean;
  [key: string]: any;
}

