import React, { useState, useRef } from "react";
import {
  AlertCircle,
  Calendar as CalendarIcon,
  IndianRupee,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ShieldCheck,
  CheckCircle,
  Circle,
  Mail,
  Bell,
  Activity,
  ChevronRight,
  Sparkles,
  RefreshCw,
  PlusCircle,
  FileText,
  Bot,
  Upload,
  Lock,
  Unlock,
  Plus,
  Check,
  Smartphone,
  Info
} from "lucide-react";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { Task, FinanceEntry, Bill, ActiveView, Subscription, Receivable } from "../types";

interface DashboardViewProps {
  tasks: Task[];
  financeEntries: FinanceEntry[];
  bills: Bill[];
  subscriptions: Subscription[];
  receivables: Receivable[];
  taxProfile: any;
  setView: (view: ActiveView) => void;
  onToggleComplete?: (id: string) => void;
  onAddTask?: (task: Omit<Task, "id" | "completed">) => Promise<void>;
  onAddBill?: (bill: Omit<Bill, "id" | "paid">) => Promise<void>;
  onAddFinance?: (entry: Omit<FinanceEntry, "id" | "date">) => Promise<void>;
  onFiniaPromptAction?: (query: string) => void;
  onClearData?: () => void;
  isDemoMode?: boolean;
  onToggleDemoMode?: () => void;
}

// Sparkline component draws a beautiful micro SVG sparkline with area gradient fill aligned to the numbers
const Sparkline = ({ 
  color, 
  data = [] 
}: { 
  color: string; 
  data?: number[];
}) => {
  const strokeColorMap: Record<string, string> = {
    blue: "#2BA8E0",
    red: "#E24B4A",
    teal: "#0F766E",
    purple: "#6D28D9",
  };
  const stroke = strokeColorMap[color] || strokeColorMap.blue;
  const gradientId = `spark-${color}`;

  // If data is empty, default to zero trend
  const values = data.length > 0 ? data : [0, 0, 0, 0, 0, 0, 0];
  const n = values.length;

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal;

  const pointsList: string[] = [];
  for (let i = 0; i < n; i++) {
    const val = values[i];
    const x = 10 + (i / Math.max(1, n - 1)) * 90;
    let y = 20; // Default flat-line middle
    if (range === 0) {
      y = minVal === 0 ? 35 : 20;
    } else {
      y = 35 - ((val - minVal) / range) * 25; // Keep 5px padding from top/bottom
    }
    pointsList.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  const points = pointsList.join(" ");

  return (
    <div className="w-20 h-8 shrink-0">
      <svg viewBox="0 0 110 40" className="w-full h-full">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.3" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path
          d={`M 10,40 L ${points} L 100,40 Z`}
          fill={`url(#${gradientId})`}
        />
        <polyline
          fill="none"
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    </div>
  );
};

export default function DashboardView({
  tasks,
  financeEntries,
  bills,
  subscriptions,
  receivables,
  taxProfile,
  setView,
  onToggleComplete,
  onAddTask,
  onAddBill,
  onAddFinance,
  onFiniaPromptAction,
  onClearData,
  isDemoMode = false,
  onToggleDemoMode,
}: DashboardViewProps) {
  const todayStr = "2026-06-25";

  // Safe date parsing
  const parseDate = (dStr: string) => {
    if (!dStr) return 0;
    const parts = dStr.split("-");
    if (parts.length === 3) {
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
    }
    return new Date(dStr).getTime();
  };

  // Determine if database collections are empty
  const isTasksEmpty = tasks.length === 0;
  const isBillsEmpty = bills.length === 0;
  const isFinanceEmpty = financeEntries.length === 0;

  // Active data selection (read directly from Firestore)
  const activeTasks = tasks;
  const activeBills = bills;
  const activeFinance = financeEntries;

  // Extract year-month string dynamically from todayStr (e.g. "2026-06")
  const currentMonthStr = todayStr.substring(0, 7);

  // Derive dynamic EMIs (sum of bills tagged EMI or loan)
  const dynamicEmiSum = activeBills
    .filter((b) => b.category === "credit-card" || b.payee.toLowerCase().includes("emi") || b.payee.toLowerCase().includes("loan"))
    .reduce((sum, b) => sum + b.amount, 0);

  // Derive dynamic Subscriptions (from database-backed subscriptions prop, or utility bills)
  const dynamicSubscriptionSum = subscriptions.length > 0
    ? subscriptions
        .filter((s: any) => s.active)
        .reduce((sum: number, s: any) => {
          const amt = s.amount;
          return sum + (s.frequency === "monthly" ? amt : amt / 12);
        }, 0)
    : activeBills
        .filter((b) => b.category === "internet" || b.category === "other" || b.payee.toLowerCase().includes("subscription"))
        .reduce((sum, b) => sum + b.amount, 0);

  // Derive dynamic To Collect (receivables outstanding from database-backed receivables prop, or category claim from financeEntries)
  const dynamicToCollectSum = receivables.length > 0
    ? receivables.reduce((sum: number, r: any) => sum + r.amount, 0)
    : activeFinance
        .filter((e) => e.type === "income" && (e.category === "claim" || e.description.toLowerCase().includes("claim") || e.description.toLowerCase().includes("refund")))
        .reduce((sum, e) => sum + e.amount, 0);

  // 1. Tasks today
  const tasksDueToday = activeTasks.filter(
    (t) => !t.completed && t.dueDate === todayStr
  );
  const tasksDueTodayCount = tasksDueToday.length;

  // 2. Money due (unpaid bills due in next 7 days: 2026-06-25 to 2026-07-02)
  const todayMs = parseDate(todayStr);
  const sevenDaysLaterMs = todayMs + 7 * 24 * 60 * 60 * 1000;
  const billsDueSoon = activeBills.filter((b) => {
    if (b.paid) return false;
    const dueMs = parseDate(b.dueDate);
    return dueMs >= todayMs && dueMs <= sevenDaysLaterMs;
  });
  const moneyDueSum = billsDueSoon.reduce((sum, b) => sum + b.amount, 0);

  // 3. Saved this month (dynamic calendar month based on todayStr, e.g. "2026-06")
  const currentMonthEntries = activeFinance.filter((e) => e.date.startsWith(currentMonthStr));
  const JuneIncome = currentMonthEntries.filter((e) => e.type === "income").reduce(
    (sum, e) => sum + e.amount,
    0
  );
  const JuneExpense = currentMonthEntries.filter((e) => e.type === "expense").reduce(
    (sum, e) => sum + e.amount,
    0
  );
  const savedThisMonth = JuneIncome - JuneExpense;

  // 4. Financial Health Score (0-100)
  const hasEnoughHealthData = activeFinance.length > 0 || activeBills.length > 0;

  const totalBillsCount = activeBills.length;
  const paidBillsCount = activeBills.filter((b) => b.paid).length;
  const billScore = totalBillsCount > 0 ? (paidBillsCount / totalBillsCount) * 40 : 20;

  const totalTasksCount = activeTasks.length;
  const completedTasksCount = activeTasks.filter((t) => t.completed).length;
  const taskScore = totalTasksCount > 0 ? (completedTasksCount / totalTasksCount) * 20 : 10;

  const savingRate = JuneIncome > 0 ? (JuneIncome - JuneExpense) / JuneIncome : 0;
  const savingScore = JuneIncome > 0 ? Math.min(40, Math.max(0, savingRate * 40)) : 0;

  const computedHealthScore = Math.min(
    100,
    Math.max(0, Math.round(billScore + taskScore + savingScore))
  );

  // Generate date ranges for Trend alignment to the numbers
  const last7Days: string[] = [];
  const next7Days: string[] = [];
  const baseDateForTrends = new Date(2026, 5, 25); // June 25, 2026
  for (let i = 6; i >= 0; i--) {
    const d = new Date(baseDateForTrends);
    d.setDate(baseDateForTrends.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    last7Days.push(`${yyyy}-${mm}-${dd}`);
  }
  for (let i = 0; i < 7; i++) {
    const d = new Date(baseDateForTrends);
    d.setDate(baseDateForTrends.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    next7Days.push(`${yyyy}-${mm}-${dd}`);
  }

  // 1. Tasks Trend (count of incomplete tasks due on each of the last 7 days)
  const tasksTrendData = last7Days.map((date) => {
    return activeTasks.filter((t) => !t.completed && t.dueDate === date).length;
  });

  // 2. Money Due Trend (sum of unpaid bills due on each of the next 7 days, aligning with Money Due metric)
  const moneyDueTrendData = next7Days.map((date) => {
    return activeBills
      .filter((b) => !b.paid && b.dueDate === date)
      .reduce((sum, b) => sum + b.amount, 0);
  });

  // 3. Saved This Month Trend (net balance on each of the last 7 days)
  const savingsTrendData = last7Days.map((date) => {
    const dayEntries = activeFinance.filter((e) => e.date === date);
    const income = dayEntries.filter((e) => e.type === "income").reduce((sum, e) => sum + e.amount, 0);
    const expense = dayEntries.filter((e) => e.type === "expense").reduce((sum, e) => sum + e.amount, 0);
    return income - expense;
  });

  // 4. Health Score Trend (calculated daily health score across last 7 days)
  const healthScoreTrendData = last7Days.map((date) => {
    const billsUpToDate = activeBills.filter((b) => b.dueDate <= date);
    const tasksUpToDate = activeTasks.filter((t) => t.dueDate <= date || (!t.dueDate && t.completed));
    const financeUpToDate = activeFinance.filter((e) => e.date <= date);

    if (financeUpToDate.length === 0 && billsUpToDate.length === 0) {
      return 0; // Flat zero trend line when no transactional/liability data is logged
    }

    const totalBills = billsUpToDate.length;
    const paidBills = billsUpToDate.filter((b) => b.paid).length;
    const billSc = totalBills > 0 ? (paidBills / totalBills) * 40 : 20;

    const totalTasks = tasksUpToDate.length;
    const completedTasks = tasksUpToDate.filter((t) => t.completed).length;
    const taskSc = totalTasks > 0 ? (completedTasks / totalTasks) * 20 : 10;

    const income = financeUpToDate.filter((e) => e.type === "income").reduce((sum, e) => sum + e.amount, 0);
    const expense = financeUpToDate.filter((e) => e.type === "expense").reduce((sum, e) => sum + e.amount, 0);
    const savRate = income > 0 ? (income - expense) / income : 0;
    const savSc = income > 0 ? Math.min(40, Math.max(0, savRate * 40)) : 0;

    return Math.min(100, Math.max(0, Math.round(billSc + taskSc + savSc)));
  });

  // Priority Tasks list (sorted by urgency)
  const sortedPriorityTasks = [...activeTasks]
    .filter((t) => !t.completed)
    .sort((a, b) => {
      const pA = a.priority === "high" ? 3 : a.priority === "medium" ? 2 : 1;
      const pB = b.priority === "high" ? 3 : b.priority === "medium" ? 2 : 1;
      if (pA !== pB) return pB - pA;
      if (a.category === "tax" && b.category !== "tax") return -1;
      if (b.category === "tax" && a.category !== "tax") return 1;
      return a.dueDate.localeCompare(b.dueDate);
    });

  const getTaskBorderColor = (task: Task) => {
    if (task.category === "tax") return "border-l-purple-500";
    if (task.priority === "high") return "border-l-red-500";
    if (task.priority === "medium") return "border-l-amber-500";
    return "border-l-blue-500";
  };

  const getTaskCheckboxColor = (task: Task) => {
    if (task.category === "tax") return "text-purple-600 focus:ring-purple-500";
    if (task.priority === "high") return "text-red-600 focus:ring-red-500";
    if (task.priority === "medium") return "text-amber-600 focus:ring-amber-500";
    return "text-blue-600 focus:ring-blue-500";
  };

  const getDueLabel = (dueDateStr: string) => {
    if (dueDateStr === todayStr) return "due today";
    if (dueDateStr === "2026-06-26") return "due tomorrow";
    return `due ${dueDateStr}`;
  };

  const upcomingUnpaidBill = [...activeBills]
    .filter((b) => !b.paid)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  let proactiveMsg = "hello! your workspaces, bills, and tax accounts are completely in order. how can i help you optimize your filings today?";
  let quickReplies = [
    "show me tax-saving tips under section 80C",
    "what are the new tax slabs?",
    "calculate my financial summary"
  ];

  const limitStr = "2026-06-27";
  const clusteredTasks = tasks.filter((t) => {
    if (t.completed) return false;
    return t.dueDate >= todayStr && t.dueDate <= limitStr;
  });
  const hasCrisis = clusteredTasks.length >= 3;

  if (upcomingUnpaidBill) {
    proactiveMsg = `your ${upcomingUnpaidBill.payee} bill of ₹${upcomingUnpaidBill.amount.toLocaleString("en-IN")} is due on ${upcomingUnpaidBill.dueDate}. want me to help you block focus time to settle it or set a reminder?`;
    quickReplies = [
      `block focus time for ${upcomingUnpaidBill.payee}`,
      `set a reminder for ${upcomingUnpaidBill.payee}`,
      `what other bills are due?`
    ];
  }

  // --- NEW STATES FOR GMAIL & DOCUMENT INTELLIGENCE ---
  const [syncTab, setSyncTab] = useState<"gmail" | "decrypt">("gmail");
  
  // Gmail Scanner States
  const [gmailLoading, setGmailLoading] = useState<boolean>(false);
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [extractedGmailData, setExtractedGmailData] = useState<{
    bills: Array<{ bank: string; amount: number; dueDate: string; description: string; imported?: boolean }>;
    deadlines: Array<{ title: string; dueDate: string; description: string; priority: string; category: string; imported?: boolean }>;
    receipts: Array<{ merchant: string; amount: number; date: string; category: string; description: string; imported?: boolean }>;
    subscriptions: Array<{ service: string; amount: number; nextRenewalDate: string; billingCycle: string; imported?: boolean }>;
  } | null>(null);

  // E-Statement Decrypt States
  const [decryptLoading, setDecryptLoading] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [passwordFormat, setPasswordFormat] = useState<string>("SBI = DDMMYYYY");
  const [decryptedData, setDecryptedData] = useState<{
    bank: string;
    dueDate: string;
    totalAmountDue: number;
    transactions: Array<{ date: string; merchant: string; amount: number; category: string; imported?: boolean }>;
  } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const decryptFileInputRef = useRef<HTMLInputElement>(null);

  // Trigger Google popup Auth, extract fresh token, and scan Gmail!
  const handleGmailSmartScan = async () => {
    setGmailLoading(true);
    setGmailError(null);
    setExtractedGmailData(null);
    try {
      // Re-trigger sign-in to capture explicit user permission and refresh access token
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;

      if (!accessToken) {
        throw new Error("Unable to retrieve Google OAuth access token. Please authorize Gmail.");
      }

      // Call our secure backend Gmail Scan API
      const res = await fetch("/api/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to scan emails.");
      }

      const parsedItems = await res.json();
      setExtractedGmailData(parsedItems);
    } catch (err: any) {
      console.error(err);
      setGmailError(err.message || "OAuth validation failed or permission was denied.");
    } finally {
      setGmailLoading(false);
    }
  };

  // Convert PDF statement file to Base64 and send to decrypt API
  const handleDecryptedPDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setFileError(null);
    setDecryptedData(null);
    
    if (!passwordInput.trim()) {
      setFileError("Please enter your e-statement PDF password first.");
      return;
    }

    setDecryptLoading(true);
    try {
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base = (reader.result as string).split(",")[1];
          resolve(base);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await fetch("/api/credit-card/decrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64,
          password: passwordInput
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to decrypt PDF. Check your password.");
      }

      const result = await response.json();
      setDecryptedData(result);
    } catch (err: any) {
      console.error(err);
      setFileError(err.message || "Failed to parse PDF statement.");
    } finally {
      setDecryptLoading(false);
    }
  };

  // --- SAVE EXTRACTED ITEMS DIRECTLY TO FIRESTORE ---
  const saveImportedBill = async (index: number) => {
    if (!extractedGmailData || !onAddBill) return;
    const b = extractedGmailData.bills[index];
    try {
      await onAddBill({
        payee: `${b.bank} Credit Card`,
        amount: b.amount,
        dueDate: b.dueDate,
        category: "credit-card"
      });
      // Mark as imported in UI
      const updatedBills = [...extractedGmailData.bills];
      updatedBills[index] = { ...b, imported: true };
      setExtractedGmailData({ ...extractedGmailData, bills: updatedBills });
    } catch (err) {
      console.error("Firestore save error:", err);
    }
  };

  const saveImportedDeadline = async (index: number) => {
    if (!extractedGmailData || !onAddTask) return;
    const d = extractedGmailData.deadlines[index];
    try {
      await onAddTask({
        title: d.title,
        dueDate: d.dueDate,
        priority: d.priority,
        category: d.category
      });
      const updatedDeadlines = [...extractedGmailData.deadlines];
      updatedDeadlines[index] = { ...d, imported: true };
      setExtractedGmailData({ ...extractedGmailData, deadlines: updatedDeadlines });
    } catch (err) {
      console.error("Firestore save error:", err);
    }
  };

  const saveImportedReceipt = async (index: number) => {
    if (!extractedGmailData || !onAddFinance) return;
    const r = extractedGmailData.receipts[index];
    try {
      await onAddFinance({
        description: r.merchant,
        amount: r.amount,
        type: "expense",
        category: r.category.toLowerCase()
      });
      const updatedReceipts = [...extractedGmailData.receipts];
      updatedReceipts[index] = { ...r, imported: true };
      setExtractedGmailData({ ...extractedGmailData, receipts: updatedReceipts });
    } catch (err) {
      console.error("Firestore save error:", err);
    }
  };

  const saveImportedSubscription = async (index: number) => {
    if (!extractedGmailData || !onAddBill) return;
    const s = extractedGmailData.subscriptions[index];
    try {
      await onAddBill({
        payee: `${s.service} Subscription`,
        amount: s.amount,
        dueDate: s.nextRenewalDate,
        category: "internet"
      });
      const updatedSubs = [...extractedGmailData.subscriptions];
      updatedSubs[index] = { ...s, imported: true };
      setExtractedGmailData({ ...extractedGmailData, subscriptions: updatedSubs });
    } catch (err) {
      console.error("Firestore save error:", err);
    }
  };

  // Import single transaction from decrypted statement
  const saveDecryptedTransaction = async (index: number) => {
    if (!decryptedData || !onAddFinance) return;
    const t = decryptedData.transactions[index];
    try {
      await onAddFinance({
        description: t.merchant,
        amount: t.amount,
        type: "expense",
        category: t.category.toLowerCase()
      });
      const updatedTrans = [...decryptedData.transactions];
      updatedTrans[index] = { ...t, imported: true };
      setDecryptedData({ ...decryptedData, transactions: updatedTrans });
    } catch (err) {
      console.error("Firestore save error:", err);
    }
  };

  // Save all transaction items at once
  const saveAllDecryptedTransactions = async () => {
    if (!decryptedData || !onAddFinance) return;
    try {
      for (let i = 0; i < decryptedData.transactions.length; i++) {
        const t = decryptedData.transactions[i];
        if (!t.imported) {
          await onAddFinance({
            description: t.merchant,
            amount: t.amount,
            type: "expense",
            category: t.category.toLowerCase()
          });
        }
      }
      const updatedTrans = decryptedData.transactions.map(t => ({ ...t, imported: true }));
      setDecryptedData({ ...decryptedData, transactions: updatedTrans });
    } catch (err) {
      console.error("Error bulk importing", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Crisis Mode Strip */}
      {hasCrisis && (
        <div 
          onClick={() => setView("crisis")}
          className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold md:text-sm px-5 py-3.5 rounded-xl flex items-center justify-between cursor-pointer shadow-sm animate-pulse transition-all group shrink-0"
        >
          <div className="flex items-center space-x-2.5">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
            </span>
            <span>
              {clusteredTasks.length} deadlines clustered — Finia detected a crisis. View crisis mode.
            </span>
          </div>
          <span className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-rose-600 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            Enter crisis mode &rarr;
          </span>
        </div>
      )}

      {/* Demo Mode Information Banner */}
      {isDemoMode && (
        <div className="bg-amber-500/10 dark:bg-amber-400/5 border border-amber-200 dark:border-amber-800/60 rounded-xl p-5 shadow-sm text-amber-900 dark:text-amber-300">
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-amber-100 dark:bg-amber-950/30 rounded-lg shrink-0 text-amber-600 dark:text-amber-400">
              <Info className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-1">
              <h4 className="text-sm font-bold tracking-tight">Viewing Finia in Demo Mode</h4>
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed max-w-3xl">
                You are currently exploring Finia using standard pre-populated sandbox data. You can freely add transactions, schedule bills, toggle tasks, or modify the tax profile. All of these changes are stored locally in your browser sandbox and will not modify your live Firestore database.
              </p>
              {onToggleDemoMode && (
                <div className="pt-2">
                  <button
                    onClick={onToggleDemoMode}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 text-white dark:text-amber-300 text-[11px] font-bold rounded-md transition-all cursor-pointer shadow-sm"
                  >
                    Switch to Live Mode (Your Own Data)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Finia Proactive Greeting Widget */}
      <div className="bg-gradient-to-r from-[#1B3A6B]/10 to-[#2BA8E0]/10 border-[0.5px] border-[#1B3A6B]/20 rounded-xl p-5 shadow-sm">
        <div className="flex items-start space-x-4">
          <div className="w-10 h-10 rounded-full bg-[#1B3A6B] flex items-center justify-center relative shrink-0 shadow-md">
            <svg viewBox="0 0 512 512" className="w-6 h-6 fill-none stroke-white">
              <path d="M 80 256 L 180 256 L 200 290 L 230 110 L 260 410 L 290 290 L 310 256 L 432 256" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="230" cy="110" r="32" fill="white" stroke="none" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2BA8E0] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#2BA8E0]"></span>
            </span>
          </div>

          <div className="flex-1 space-y-3 min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider">finia says:</span>
              <Sparkles className="w-3.5 h-3.5 text-[#2BA8E0]" />
            </div>
            <p className="text-xs md:text-sm text-slate-700 leading-relaxed font-medium lowercase">
              "{proactiveMsg}"
            </p>
            {onFiniaPromptAction && (
              <div className="flex flex-wrap gap-2 pt-1">
                {quickReplies.map((reply) => (
                  <button
                    key={reply}
                    onClick={() => onFiniaPromptAction(reply)}
                    className="px-3 py-1.5 text-[11px] bg-white hover:bg-slate-50 border-[0.5px] border-slate-200 hover:border-slate-300 text-slate-700 font-medium rounded-full shadow-sm transition-all text-left focus:outline-none cursor-pointer"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Friendly Empty State / Demo Banner */}
      {isDemoMode && (
        <div className="bg-[#1B3A6B]/5 border-[0.5px] border-[#1B3A6B]/20 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start md:items-center space-x-3">
            <Sparkles className="w-5 h-5 text-[#2BA8E0] shrink-0 mt-0.5 md:mt-0" />
            <div>
              <h4 className="text-xs font-semibold text-[#1B3A6B] uppercase tracking-wider">Demo Sandbox Mode Active</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                We've populated friendly placeholders. Sync your Gmail or add live tasks & payments in the sidebar to feed actual Firestore data.
              </p>
            </div>
          </div>
          <button
            onClick={() => setView("tasks")}
            className="text-xs font-medium bg-[#1B3A6B] hover:bg-slate-800 text-white px-3.5 py-2 rounded-lg transition-colors shrink-0 focus:outline-none flex items-center gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add Live Task</span>
          </button>
        </div>
      )}

      {/* Top Row: Four Vital Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tasks Today */}
        <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-5 hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Tasks today</p>
              <h3 className="text-3xl font-bold text-[#1B3A6B] mt-1 font-mono">{tasksDueTodayCount}</h3>
            </div>
            <Sparkline color="blue" data={tasksTrendData} />
          </div>
          <div className="mt-4 pt-3 border-t-[0.5px] border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="capitalize">{activeTasks.filter(t => t.completed).length} completed today</span>
            <span className="text-[#2BA8E0] font-medium bg-[#2BA8E0]/10 px-1.5 py-0.5 rounded uppercase tracking-wider text-[9px]">task blue</span>
          </div>
        </div>

        {/* Card 2: Money Due */}
        <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-5 hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Money due</p>
              <h3 className="text-3xl font-bold text-[#E24B4A] mt-1 font-mono">
                ₹{moneyDueSum.toLocaleString("en-IN")}
              </h3>
            </div>
            <Sparkline color="red" data={moneyDueTrendData} />
          </div>
          <div className="mt-4 pt-3 border-t-[0.5px] border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="truncate max-w-full">
              {isBillsEmpty ? "Add bills or sync Gmail to track upcoming payables" : `${billsDueSoon.length} bills in next 7 days`}
            </span>
            <span className="text-[#E24B4A] font-medium bg-[#E24B4A]/10 px-1.5 py-0.5 rounded uppercase tracking-wider text-[9px] shrink-0">crisis red</span>
          </div>
        </div>

        {/* Card 3: Saved This Month */}
        <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-5 hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Saved this month</p>
              <h3 className="text-3xl font-bold text-[#0F766E] mt-1 font-mono">
                ₹{savedThisMonth.toLocaleString("en-IN")}
              </h3>
            </div>
            <Sparkline color="teal" data={savingsTrendData} />
          </div>
          <div className="mt-4 pt-3 border-t-[0.5px] border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="truncate max-w-full">
              {isFinanceEmpty ? "Log income/expenses to track monthly savings" : `Inflow: ₹${JuneIncome.toLocaleString("en-IN")}`}
            </span>
            <span className="text-[#0F766E] font-medium bg-[#0F766E]/10 px-1.5 py-0.5 rounded uppercase tracking-wider text-[9px] shrink-0">finance teal</span>
          </div>
        </div>

        {/* Card 4: Health Score */}
        <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-5 hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center gap-1">
                <span>Health score</span>
                <span className="cursor-help" title="Formula: 40% Bill Payment Consistency + 40% Savings Rate + 20% Task/Filing Progress.">
                  <Info className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                </span>
              </p>
              <h3 
                className="text-3xl font-bold text-[#6D28D9] mt-1 font-mono"
                title={!hasEnoughHealthData ? "Add income and expenses to see your score" : `Financial Health: ${computedHealthScore}%`}
              >
                {hasEnoughHealthData ? `${computedHealthScore}%` : "—"}
              </h3>
            </div>
            <Sparkline color="purple" data={healthScoreTrendData} />
          </div>
          <div className="mt-4 pt-3 border-t-[0.5px] border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="truncate max-w-full">
              {!hasEnoughHealthData ? "Add income and expenses to see your score" : (computedHealthScore >= 80 ? "excellent standing" : computedHealthScore >= 60 ? "good progress" : "needs attention")}
            </span>
            <span className="text-[#6D28D9] font-medium bg-[#6D28D9]/10 px-1.5 py-0.5 rounded uppercase tracking-wider text-[9px] shrink-0">tax purple</span>
          </div>
        </div>
      </div>

      {/* --- NEW SECTION: SMART SYNC & DOCUMENT INTELLIGENCE --- */}
      <div id="gmail-sync-section" className="bg-white border-[0.5px] border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {/* Header and Switcher tabs */}
        <div className="p-4 bg-[#1B3A6B]/5 border-b-[0.5px] border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center space-x-2">
            <Bot className="w-5 h-5 text-[#2BA8E0]" />
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Finia Intelligent Sync Hub</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">automated reading, decryption, and parsing of invoices & statements</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-lg shrink-0">
            <button
              onClick={() => setSyncTab("gmail")}
              className={`px-3 py-1 text-[10px] font-bold uppercase rounded transition-all ${
                syncTab === "gmail" ? "bg-[#1B3A6B] text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Gmail Auto-Scanner
            </button>
            <button
              onClick={() => setSyncTab("decrypt")}
              className={`px-3 py-1 text-[10px] font-bold uppercase rounded transition-all ${
                syncTab === "decrypt" ? "bg-[#1B3A6B] text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Decrypt Statements
            </button>
          </div>
        </div>

        {/* Tab 1 Content: Gmail Scan */}
        {syncTab === "gmail" && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-150">
              <div className="space-y-1">
                <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-indigo-600" />
                  Read-Only Smart Scan with Google Workspace
                </h5>
                <p className="text-xs text-slate-500 max-w-xl">
                  Finia will securely scan recent emails for billing invoices, credit card statements, and regulatory compliance deadlines. Our sandbox operates completely read-only.
                </p>
              </div>
              <button
                onClick={handleGmailSmartScan}
                disabled={gmailLoading}
                className="w-full md:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow transition-all shrink-0 cursor-pointer disabled:opacity-50"
              >
                {gmailLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>scanning mailbox...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>sync and scan now</span>
                  </>
                )}
              </button>
            </div>

            {gmailError && (
              <div className="p-3.5 bg-red-50 border border-red-100 text-red-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                <span>{gmailError}</span>
              </div>
            )}

            {extractedGmailData && (
              <div className="space-y-6">
                {/* 1. Credit Card Bills */}
                {extractedGmailData.bills.length > 0 && (
                  <div className="space-y-3">
                    <span className="text-[10px] font-bold text-[#1B3A6B] uppercase tracking-wider">Credit Card Outstanding Bills found:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {extractedGmailData.bills.map((bill, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 p-4 rounded-xl flex justify-between items-center hover:shadow-sm transition-shadow">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-indigo-600">{bill.bank} CC</span>
                            <h5 className="text-base font-bold text-slate-800 font-mono mt-1">₹{bill.amount.toLocaleString("en-IN")}</h5>
                            <p className="text-[10px] text-slate-400 mt-1">Due Date: {bill.dueDate}</p>
                          </div>
                          {bill.imported ? (
                            <span className="text-emerald-600 p-1.5 bg-emerald-50 rounded-full border border-emerald-200">
                              <Check className="w-4 h-4" />
                            </span>
                          ) : (
                            <button
                              onClick={() => saveImportedBill(idx)}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-[#1B3A6B] text-indigo-700 hover:text-white rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" /> Import
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Deadlines */}
                {extractedGmailData.deadlines.length > 0 && (
                  <div className="space-y-3">
                    <span className="text-[10px] font-bold text-[#1B3A6B] uppercase tracking-wider">Upcoming Compliance Deadlines found:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {extractedGmailData.deadlines.map((dl, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 p-4 rounded-xl flex justify-between items-center hover:shadow-sm transition-shadow">
                          <div className="min-w-0 pr-3">
                            <span className="text-[9px] uppercase font-bold bg-purple-50 text-purple-600 border border-purple-100 px-1.5 py-0.5 rounded">
                              {dl.category}
                            </span>
                            <h5 className="text-xs font-bold text-slate-800 mt-2 truncate">{dl.title}</h5>
                            <p className="text-[10px] text-slate-400 mt-1">Due: {dl.dueDate}</p>
                          </div>
                          {dl.imported ? (
                            <span className="text-emerald-600 p-1.5 bg-emerald-50 rounded-full border border-emerald-200 shrink-0">
                              <Check className="w-4 h-4" />
                            </span>
                          ) : (
                            <button
                              onClick={() => saveImportedDeadline(idx)}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-[#1B3A6B] text-indigo-700 hover:text-white rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" /> Import
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Receipts */}
                {extractedGmailData.receipts.length > 0 && (
                  <div className="space-y-3">
                    <span className="text-[10px] font-bold text-[#1B3A6B] uppercase tracking-wider">Recent UPI & Payment Receipts:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {extractedGmailData.receipts.map((rc, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 p-4 rounded-xl flex justify-between items-center hover:shadow-sm transition-shadow">
                          <div>
                            <span className="text-[9px] uppercase font-bold bg-teal-50 text-teal-600 border border-teal-100 px-1.5 py-0.5 rounded">
                              {rc.category}
                            </span>
                            <h5 className="text-xs font-bold text-slate-800 mt-2 truncate">{rc.merchant}</h5>
                            <h5 className="text-sm font-bold text-slate-700 font-mono mt-1">₹{rc.amount}</h5>
                          </div>
                          {rc.imported ? (
                            <span className="text-emerald-600 p-1.5 bg-emerald-50 rounded-full border border-emerald-200">
                              <Check className="w-4 h-4" />
                            </span>
                          ) : (
                            <button
                              onClick={() => saveImportedReceipt(idx)}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-[#1B3A6B] text-indigo-700 hover:text-white rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" /> Import
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Subscriptions */}
                {extractedGmailData.subscriptions.length > 0 && (
                  <div className="space-y-3">
                    <span className="text-[10px] font-bold text-[#1B3A6B] uppercase tracking-wider">Active Subscriptions found:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {extractedGmailData.subscriptions.map((sub, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 p-4 rounded-xl flex justify-between items-center hover:shadow-sm transition-shadow">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-[#2BA8E0]">{sub.service}</span>
                            <h5 className="text-base font-bold text-slate-800 font-mono mt-1">₹{sub.amount}/{sub.billingCycle === "monthly" ? "mo" : "yr"}</h5>
                            <p className="text-[10px] text-slate-400 mt-1">Renewal: {sub.nextRenewalDate}</p>
                          </div>
                          {sub.imported ? (
                            <span className="text-emerald-600 p-1.5 bg-emerald-50 rounded-full border border-emerald-200">
                              <Check className="w-4 h-4" />
                            </span>
                          ) : (
                            <button
                              onClick={() => saveImportedSubscription(idx)}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-[#1B3A6B] text-indigo-700 hover:text-white rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" /> Import
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {extractedGmailData.bills.length === 0 &&
                 extractedGmailData.deadlines.length === 0 &&
                 extractedGmailData.receipts.length === 0 &&
                 extractedGmailData.subscriptions.length === 0 && (
                   <div className="text-center p-8 text-slate-400 border border-slate-150 rounded-xl">
                     <Mail className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                     <p className="text-sm">Finia scanned your emails, but no new billing items or upcoming deadlines were found.</p>
                   </div>
                 )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2 Content: Statement Decryption */}
        {syncTab === "decrypt" && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Credentials & Password card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center space-x-2">
                  <Lock className="w-4.5 h-4.5 text-indigo-600" />
                  <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Decryption configuration</h5>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Credit card e-statements are heavily protected. Specify your password per bank format (such as SBI = DDMMYYYY) to let our vision engine safely unlock, extract, and balance statement rows.
                </p>

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Bank Format</label>
                    <input
                      type="text"
                      value={passwordFormat}
                      onChange={(e) => setPasswordFormat(e.target.value)}
                      placeholder="e.g. SBI = DDMMYYYY"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Decryption Password (DDMMYYYY)</label>
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="In-memory only"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded focus:outline-none font-mono"
                    />
                    <span className="text-[8px] text-slate-400 mt-1 block">Finia never logs or stores this raw password.</span>
                  </div>
                </div>

                <input
                  ref={decryptFileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleDecryptedPDFUpload}
                  className="hidden"
                />

                <button
                  onClick={() => decryptFileInputRef.current?.click()}
                  disabled={decryptLoading}
                  className="w-full py-2.5 bg-[#1B3A6B] hover:bg-slate-800 text-white rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {decryptLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Decrypting & Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Select Statement PDF</span>
                    </>
                  )}
                </button>

                {fileError && (
                  <div className="p-3 bg-red-50 text-red-700 border border-red-100 rounded text-[11px] flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{fileError}</span>
                  </div>
                )}
              </div>

              {/* Transactions display card */}
              <div className="md:col-span-2 border border-slate-200 rounded-xl overflow-hidden flex flex-col min-h-[300px] bg-white">
                {decryptedData ? (
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      {/* Statement Header */}
                      <div className="p-4 bg-slate-50 border-b border-slate-150 flex justify-between items-center flex-wrap gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">{decryptedData.bank} Statement</span>
                          <p className="text-xs text-slate-400 mt-0.5">Due Date: {decryptedData.dueDate}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">Total Due</span>
                          <span className="text-base font-bold text-rose-600 font-mono">₹{decryptedData.totalAmountDue.toLocaleString("en-IN")}</span>
                        </div>
                      </div>

                      {/* Transaction Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50/50 border-b border-slate-150 text-[10px] font-bold uppercase text-slate-400 font-sans text-left">
                            <tr>
                              <th className="p-3">Date</th>
                              <th className="p-3">Merchant</th>
                              <th className="p-3">Category</th>
                              <th className="p-3 text-right">Amount</th>
                              <th className="p-3 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono">
                            {decryptedData.transactions.map((t, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="p-3 text-slate-500 whitespace-nowrap">{t.date}</td>
                                <td className="p-3 font-semibold text-slate-800 font-sans">{t.merchant}</td>
                                <td className="p-3">
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] uppercase font-sans">
                                    {t.category}
                                  </span>
                                </td>
                                <td className="p-3 text-right text-slate-800 font-bold">₹{t.amount}</td>
                                <td className="p-3 text-center">
                                  {t.imported ? (
                                    <span className="text-emerald-600 text-xs flex justify-center">
                                      <Check className="w-4 h-4" />
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => saveDecryptedTransaction(idx)}
                                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[9px] font-bold uppercase tracking-wider font-sans shrink-0 cursor-pointer"
                                    >
                                      Import
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Footer Import Action */}
                    <div className="p-4 bg-slate-50 border-t border-slate-150 flex justify-between items-center">
                      <span className="text-[10px] text-slate-400 font-sans">
                        {decryptedData.transactions.filter(t => !t.imported).length} transaction(s) pending import
                      </span>
                      <button
                        onClick={saveAllDecryptedTransactions}
                        className="px-4 py-1.5 bg-[#0F766E] hover:bg-slate-800 text-white rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Import All Transactions
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 text-center">
                    <Unlock className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="text-sm font-medium">Select a secure credit card statement to decrypt and scan</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-[320px]">
                      Specify statement password. decrypted safely inside browser memory — no passwords or raw PDFs are ever saved or logged.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Middle Row: Priority Tasks Side-by-Side with Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Priority Tasks */}
        <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-6 flex flex-col h-[380px]">
          <div className="flex justify-between items-center mb-4 pb-2 border-b-[0.5px] border-slate-100 shrink-0">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-[#1B3A6B]" />
              <h4 className="text-xs font-semibold text-[#1B3A6B] uppercase tracking-wider">Priority Tasks</h4>
            </div>
            <button
              onClick={() => setView("tasks")}
              className="text-[10px] text-[#2BA8E0] font-semibold uppercase tracking-wider hover:underline flex items-center gap-0.5"
            >
              <span>Manage</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {sortedPriorityTasks.slice(0, 4).map((task) => (
              <div
                key={task.id}
                className={`p-3 bg-slate-50 border-l-4 ${getTaskBorderColor(task)} rounded-r-lg border-[0.5px] border-y-slate-200 border-r-slate-200 flex items-center justify-between transition-colors hover:bg-slate-100/60`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => onToggleComplete && onToggleComplete(task.id)}
                    className={`w-4 h-4 rounded cursor-pointer border-slate-300 ${getTaskCheckboxColor(task)}`}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800 truncate capitalize">{task.title}</p>
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider font-mono block mt-0.5">
                      {getDueLabel(task.dueDate)}
                    </span>
                  </div>
                </div>
                <span className="text-[8px] font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded-full uppercase tracking-wider text-slate-500 shrink-0 capitalize">
                  {task.category}
                </span>
              </div>
            ))}

            {sortedPriorityTasks.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                <CheckCircle className="w-8 h-8 text-emerald-500 mb-2" />
                <p className="text-xs font-medium text-slate-700">All key tasks complete!</p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">You are fully up to date with compliance events.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Alerts */}
        <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-6 flex flex-col h-[380px]">
          <div className="flex justify-between items-center mb-4 pb-2 border-b-[0.5px] border-slate-100 shrink-0">
            <div className="flex items-center space-x-2">
              <Bell className="w-4 h-4 text-[#1B3A6B]" />
              <h4 className="text-xs font-semibold text-[#1B3A6B] uppercase tracking-wider">Urgent Alerts</h4>
            </div>
            <span className="text-[9px] text-slate-400 font-mono tracking-wider">SYSTEM SECURE</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {/* Alert 1: Finance (Amber) */}
            {billsDueSoon.length > 0 ? (
              <div className="p-3.5 bg-amber-50/50 border-[0.5px] border-amber-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <h5 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Finance Alert</h5>
                  <p className="text-[11px] text-amber-700/90 mt-1 leading-normal">
                    You have {billsDueSoon.length} bills (total ₹{moneyDueSum.toLocaleString("en-IN")}) due within 7 days. Pay early to ensure solid credit standing.
                  </p>
                  <button
                    onClick={() => setView("bills")}
                    className="text-[10px] text-amber-800 font-bold uppercase tracking-wider hover:underline mt-2 flex items-center gap-0.5"
                  >
                    <span>Settle bills now</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-emerald-50/30 border-[0.5px] border-emerald-100 rounded-xl flex items-start gap-3">
                <ShieldCheck className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <h5 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">No Bills Outstanding</h5>
                  <p className="text-[11px] text-emerald-700/90 mt-1 leading-normal">
                    Excellent standing! All scheduled invoices and recurring expenses are fully cleared.
                  </p>
                  <button
                    onClick={() => setView("bills")}
                    className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider hover:underline mt-2"
                  >
                    Manage Recurring setup
                  </button>
                </div>
              </div>
            )}

            {/* Alert 2: Tax (Purple) */}
            <div className="p-3.5 bg-purple-50/50 border-[0.5px] border-purple-200 rounded-xl flex items-start gap-3">
              <Sparkles className="w-4.5 h-4.5 text-purple-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <h5 className="text-xs font-bold text-purple-800 uppercase tracking-wider">Tax Compliance</h5>
                <p className="text-[11px] text-purple-700/90 mt-1 leading-normal">
                  {(() => {
                    const totalDeductions = (taxProfile?.deduction80C || 0) +
                                            (taxProfile?.deduction80D || 0) +
                                            (taxProfile?.deduction80CCD || 0) +
                                            (taxProfile?.deduction80E || 0) +
                                            (taxProfile?.deduction80G || 0) +
                                            (taxProfile?.hraReceived || 0) +
                                            (taxProfile?.homeLoanInterest || 0);
                    return taxProfile?.grossIncome === 0 ? (
                      "AY 2026-27 tax filing window is open. Your tax profile gross income is set to ₹0. Set up your income and deductions to get optimal tax regime recommendations."
                    ) : (
                      `AY 2026-27 tax filing window is open. Gross Income is ₹${taxProfile?.grossIncome?.toLocaleString("en-IN")} with ₹${totalDeductions.toLocaleString("en-IN")} in deductions. Review our optimal tax regime recommendations.`
                    );
                  })()}
                </p>
                <button
                  onClick={() => setView("tax")}
                  className="text-[10px] text-purple-800 font-bold uppercase tracking-wider hover:underline mt-2 flex items-center gap-0.5"
                >
                  <span>Optimize Filing & 80C</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Alert 3: Gmail Compliance (Blue) */}
            <div className="p-3.5 bg-blue-50/50 border-[0.5px] border-blue-200 rounded-xl flex items-start gap-3">
              <Mail className="w-4.5 h-4.5 text-blue-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <h5 className="text-xs font-bold text-blue-800 uppercase tracking-wider">Gmail Scanner Active</h5>
                <p className="text-[11px] text-blue-700/90 mt-1 leading-normal">
                  {!extractedGmailData ? (
                    "Link your Google account to scan for bills, tasks, and receipts. The sandbox engine runs in read-only mode."
                  ) : (
                    (() => {
                      const totalFound = extractedGmailData.bills.length +
                                         extractedGmailData.deadlines.length +
                                         extractedGmailData.receipts.length +
                                         extractedGmailData.subscriptions.length;
                      
                      const totalPending = extractedGmailData.bills.filter(b => !b.imported).length +
                                           extractedGmailData.deadlines.filter(d => !d.imported).length +
                                           extractedGmailData.receipts.filter(r => !r.imported).length +
                                           extractedGmailData.subscriptions.filter(s => !s.imported).length;

                      return `Gmail Smart Scan completed. Found ${totalFound} items. ${totalPending} items are ready for import.`;
                    })()
                  )}
                </p>
                <button
                  onClick={() => {
                    const syncSection = document.getElementById("gmail-sync-section");
                    if (syncSection) {
                      syncSection.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                  className="text-[10px] text-blue-800 font-bold uppercase tracking-wider hover:underline mt-2 flex items-center gap-0.5"
                >
                  <span>Go to Sync Hub</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Financial Pulse */}
      <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-6">
        <div className="flex items-center space-x-2 mb-6 pb-2 border-b-[0.5px] border-slate-100">
          <Activity className="w-4.5 h-4.5 text-[#1B3A6B]" />
          <h4 className="text-xs font-semibold text-[#1B3A6B] uppercase tracking-wider">Financial Pulse</h4>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Pulse Item 1: Income */}
          <div className="p-4 bg-slate-50 border-[0.5px] border-slate-200 rounded-xl hover:bg-slate-100/50 transition-colors">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block">Income</span>
            <div className="text-lg font-bold text-[#0F766E] mt-1 font-mono">
              ₹{JuneIncome.toLocaleString("en-IN")}
            </div>
            <span className="text-[9px] text-slate-400 block mt-1">Salary & credits</span>
          </div>

          {/* Pulse Item 2: Spent */}
          <div className="p-4 bg-slate-50 border-[0.5px] border-slate-200 rounded-xl hover:bg-slate-100/50 transition-colors">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block">Spent</span>
            <div className="text-lg font-bold text-slate-700 mt-1 font-mono">
              ₹{JuneExpense.toLocaleString("en-IN")}
            </div>
            <span className="text-[9px] text-slate-400 block mt-1">Direct outflows</span>
          </div>

          {/* Pulse Item 3: Saved */}
          <div className="p-4 bg-slate-50 border-[0.5px] border-slate-200 rounded-xl hover:bg-slate-100/50 transition-colors">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block">Saved</span>
            <div className="text-lg font-bold text-[#1B3A6B] mt-1 font-mono">
              ₹{(JuneIncome - JuneExpense).toLocaleString("en-IN")}
            </div>
            <span className="text-[9px] text-[#0F766E] font-medium block mt-1">
              {JuneIncome > 0 ? Math.round(((JuneIncome - JuneExpense) / JuneIncome) * 100) : 0}% savings rate
            </span>
          </div>

          {/* Pulse Item 4: EMIs */}
          <div className="p-4 bg-slate-50 border-[0.5px] border-slate-200 rounded-xl hover:bg-slate-100/50 transition-colors">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block">EMIs</span>
            <div className="text-lg font-bold text-slate-700 mt-1 font-mono">₹{dynamicEmiSum.toLocaleString("en-IN")}</div>
            <span className="text-[9px] text-slate-400 block mt-1">Home & auto loans</span>
          </div>

          {/* Pulse Item 5: Subscriptions */}
          <div className="p-4 bg-slate-50 border-[0.5px] border-slate-200 rounded-xl hover:bg-slate-100/50 transition-colors">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block">Subscriptions</span>
            <div className="text-lg font-bold text-slate-700 mt-1 font-mono">₹{dynamicSubscriptionSum.toLocaleString("en-IN")}</div>
            <span className="text-[9px] text-slate-400 block mt-1">Broadband & mobile</span>
          </div>

          {/* Pulse Item 6: To Collect */}
          <div className="p-4 bg-slate-50 border-[0.5px] border-slate-200 rounded-xl hover:bg-slate-100/50 transition-colors">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block">To Collect</span>
            <div className="text-lg font-bold text-[#6D28D9] mt-1 font-mono">₹{dynamicToCollectSum.toLocaleString("en-IN")}</div>
            <span className="text-[9px] text-slate-400 block mt-1">Pending claims</span>
          </div>
        </div>

        {/* Empty state Call to Action banner */}
        {isFinanceEmpty && isBillsEmpty && (
          <div className="mt-6 p-4.5 bg-slate-50 border-[0.5px] border-dashed border-slate-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-center sm:text-left">
            <div>
              <p className="text-xs font-semibold text-slate-700">Your Financial Pulse is currently at zero</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Sync your Gmail or add live transactions and bills to populate real-time metrics.</p>
            </div>
            <button
              onClick={() => {
                const docSection = document.getElementById("gmail-sync-section");
                if (docSection) {
                  docSection.scrollIntoView({ behavior: "smooth" });
                } else {
                  setView("documents");
                }
              }}
              className="px-4 py-2 bg-[#1B3A6B] hover:bg-[#1B3A6B]/90 text-white font-medium text-xs rounded-lg transition-all focus:outline-none shrink-0"
            >
              Sync your Gmail to populate this
            </button>
          </div>
        )}

        {/* Dangerous Zone / Troubleshooting Card */}
        {onClearData && (
          <div className="mt-8 p-5 bg-rose-50/40 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">Database Administration</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Want to remove your seeded data and start clean? Clear your entire live Firestore database profile.
              </p>
            </div>
            <button
              onClick={onClearData}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg transition-colors focus:outline-none shrink-0 cursor-pointer shadow-sm shadow-rose-200 dark:shadow-none"
            >
              Clear Live Firestore Data
            </button>
          </div>
        )}

        {/* Sandbox Demo Mode Toggle Utility */}
        {onToggleDemoMode && (
          <div className="mt-4 p-5 bg-amber-50/40 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Sandbox Playground</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isDemoMode 
                  ? "You are currently in Demo Mode viewing pre-populated sandbox data. Click below to return to your normal account."
                  : "Want to try Finia with ready-to-use sample data? Switch to Demo Mode without wiping your live database."}
              </p>
            </div>
            <button
              onClick={onToggleDemoMode}
              className={`px-4 py-2 text-white font-semibold text-xs rounded-lg transition-colors focus:outline-none shrink-0 cursor-pointer shadow-sm ${
                isDemoMode 
                  ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-150 dark:shadow-none"
                  : "bg-amber-600 hover:bg-amber-700 shadow-amber-150 dark:shadow-none"
              }`}
            >
              {isDemoMode ? "Switch to Live Mode" : "Explore Demo Mode"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
