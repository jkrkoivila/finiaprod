import React, { useState, useEffect } from "react";
import {
  IndianRupee,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Calendar,
  Tag,
  AlertCircle,
  TrendingUp,
  Activity,
  Smartphone,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  Send,
  Sliders,
  DollarSign,
  AlertTriangle,
  FileText
} from "lucide-react";
import { FinanceEntry, Subscription, Receivable } from "../types";
import { auth } from "../lib/firebase";

interface FinanceViewProps {
  financeEntries: FinanceEntry[];
  onAddFinanceEntry: (entry: Omit<FinanceEntry, "id" | "date">) => void;
  subscriptions: Subscription[];
  receivables: Receivable[];
  onAddSubscription: (sub: Omit<Subscription, "id">) => Promise<void>;
  onToggleSubscription: (id: string, active: boolean) => Promise<void>;
  onDeleteSubscription: (id: string) => Promise<void>;
  onAddReceivable: (rec: Omit<Receivable, "id" | "reminded">) => Promise<void>;
  onToggleReminded: (id: string, reminded: boolean) => Promise<void>;
  onDeleteReceivable: (id: string) => Promise<void>;
}

export default function FinanceView({
  financeEntries,
  onAddFinanceEntry,
  subscriptions,
  receivables,
  onAddSubscription,
  onToggleSubscription,
  onDeleteSubscription,
  onAddReceivable,
  onToggleReminded,
  onDeleteReceivable
}: FinanceViewProps) {
  const [activeTab, setActiveTab] = useState<"cashbook" | "category" | "subscriptions" | "receivables">("cashbook");
  
  // States for general Cashbook
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("lifestyle");
  const [showAddForm, setShowAddForm] = useState(false);

  // Subscriptions Modal state
  const [showSubForm, setShowSubForm] = useState(false);
  const [subName, setSubName] = useState("");
  const [subAmount, setSubAmount] = useState("");
  const [subFreq, setSubFreq] = useState<"monthly" | "yearly">("monthly");
  const [subCat, setSubCat] = useState<Subscription["category"]>("entertainment");
  const [subLastUsed, setSubLastUsed] = useState("1");

  // Receivables Modal state
  const [showRecForm, setShowRecForm] = useState(false);
  const [recDebtor, setRecDebtor] = useState("");
  const [recAmount, setRecAmount] = useState("");
  const [recDesc, setRecDesc] = useState("");
  const [recDate, setRecDate] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Tallies
  const totalIncome = financeEntries
    .filter((e) => e.type === "income")
    .reduce((acc, e) => acc + e.amount, 0);

  const totalExpenses = financeEntries
    .filter((e) => e.type === "expense")
    .reduce((acc, e) => acc + e.amount, 0);

  const balance = totalIncome - totalExpenses;

  // Waterfall bars calculations
  const wfStarting = 0;
  const wfInflow = totalIncome;
  const wfOutflow = -totalExpenses;
  const wfSurplus = balance;

  const maxWfVal = Math.max(wfStarting, wfInflow, Math.abs(wfOutflow), Math.abs(wfSurplus), 1000);

  const getWfWidth = (val: number) => {
    return `${Math.min(Math.round((Math.abs(val) / maxWfVal) * 100), 100)}%`;
  };

  // Form handlers
  const handleSubmitCashbook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount) return;
    onAddFinanceEntry({
      description,
      amount: parseFloat(amount),
      type,
      category,
    });
    setDescription("");
    setAmount("");
    setCategory("lifestyle");
    setShowAddForm(false);
  };

  const handleAddSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subName.trim() || !subAmount) return;
    const days = parseInt(subLastUsed) || 1;
    await onAddSubscription({
      name: subName,
      amount: parseFloat(subAmount),
      frequency: subFreq,
      category: subCat,
      lastUsedDays: days,
      active: true,
      isUnused: days >= 14
    });
    setSubName("");
    setSubAmount("");
    setShowSubForm(false);
  };

  const handleToggleSubscription = async (id: string) => {
    const sub = subscriptions.find((s) => s.id === id);
    if (sub) {
      await onToggleSubscription(id, !sub.active);
    }
  };

  const handleDeleteSubscription = async (id: string) => {
    await onDeleteSubscription(id);
  };

  const handleAddReceivable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recDebtor.trim() || !recAmount || !recDesc || !recDate) return;
    await onAddReceivable({
      debtor: recDebtor,
      amount: parseFloat(recAmount),
      date: recDate,
      description: recDesc
    });
    setRecDebtor("");
    setRecAmount("");
    setRecDesc("");
    setRecDate("");
    setShowRecForm(false);
  };

  const handleToggleReminded = async (id: string) => {
    const rec = receivables.find((r) => r.id === id);
    if (rec) {
      await onToggleReminded(id, !rec.reminded);
    }
  };

  const handleDeleteReceivable = async (id: string) => {
    await onDeleteReceivable(id);
  };

  // WhatsApp reminder generator
  const getWhatsAppMessage = (rec: Receivable) => {
    return `Hi ${rec.debtor}, hope you're doing well! Just wanted to gently follow up on the ₹${rec.amount.toLocaleString("en-IN")} for "${rec.description}". Let me know if UPI works. Thanks!`;
  };

  const handleCopyWhatsApp = (rec: Receivable) => {
    const text = getWhatsAppMessage(rec);
    navigator.clipboard.writeText(text);
    setCopiedId(rec.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Date difference checker for receivables
  const getDaysOverdue = (dateStr: string) => {
    const dateObj = new Date(dateStr);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - dateObj.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Category values comparison
  const categories = ["salary", "investment", "rent", "utilities", "lifestyle", "other"];
  const currentCategoryExpense = (cat: string) => {
    return financeEntries
      .filter((e) => e.type === "expense" && e.category === cat)
      .reduce((acc, e) => acc + e.amount, 0);
  };

  // Month-over-month category percentage & dynamic baseline
  const getCategoryMoM = (cat: string) => {
    const currentMonthStr = "2026-06";
    const previousMonthStr = "2026-05";

    // Filter current month transactions for this category
    const currentTally = financeEntries
      .filter((e) => e.type === "expense" && e.category === cat && e.date.startsWith(currentMonthStr))
      .reduce((sum, e) => sum + e.amount, 0);

    // Filter previous month transactions for this category
    const prevTally = financeEntries
      .filter((e) => e.type === "expense" && e.category === cat && e.date.startsWith(previousMonthStr))
      .reduce((sum, e) => sum + e.amount, 0);

    let percent = 0;
    let direction: "up" | "down" | "neutral" = "neutral";

    if (prevTally === 0 && currentTally === 0) {
      percent = 0;
      direction = "neutral";
    } else if (prevTally === 0 && currentTally > 0) {
      percent = 100;
      direction = "up";
    } else if (prevTally > 0) {
      const diff = currentTally - prevTally;
      percent = Math.round((diff / prevTally) * 100);
      if (percent > 0) {
        direction = "up";
      } else if (percent < 0) {
        direction = "down";
        percent = Math.abs(percent);
      } else {
        direction = "neutral";
      }
    }

    const labels: Record<string, string> = {
      rent: "Flat / PG Rent Accommodation",
      investment: "Mutual Fund & SIP Portfolios",
      utilities: "Utility Statements & Service Fees",
      lifestyle: "Dining, Entertainment & Outlets",
      other: "Miscellaneous Outflows & Petty Cash",
    };

    return {
      label: labels[cat] || "Category Outflow",
      percent,
      direction,
      prevAmount: prevTally,
    };
  };

  // Annual Subscription projection
  const monthlySubscriptionCost = subscriptions
    .filter((s) => s.active)
    .reduce((acc, s) => {
      const amt = s.amount;
      return acc + (s.frequency === "monthly" ? amt : amt / 12);
    }, 0);

  const annualSubscriptionCost = monthlySubscriptionCost * 12;

  // Cash to collect
  const totalReceivablesPending = receivables
    .reduce((acc, r) => acc + r.amount, 0);

  return (
    <div className="space-y-6">
      
      {/* Tab Selector */}
      <div className="flex border-b border-slate-200 bg-white p-1 rounded-xl shadow-sm max-w-lg">
        <button
          onClick={() => setActiveTab("cashbook")}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === "cashbook"
              ? "bg-[#1B3A6B] text-white shadow-sm"
              : "text-slate-500 hover:text-[#1B3A6B] hover:bg-slate-50"
          }`}
        >
          Cashbook & Waterfall
        </button>
        <button
          onClick={() => setActiveTab("category")}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === "category"
              ? "bg-[#1B3A6B] text-white shadow-sm"
              : "text-slate-500 hover:text-[#1B3A6B] hover:bg-slate-50"
          }`}
        >
          Category MoM
        </button>
        <button
          onClick={() => setActiveTab("subscriptions")}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === "subscriptions"
              ? "bg-[#1B3A6B] text-white shadow-sm"
              : "text-slate-500 hover:text-[#1B3A6B] hover:bg-slate-50"
          }`}
        >
          Subscriptions
        </button>
        <button
          onClick={() => setActiveTab("receivables")}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === "receivables"
              ? "bg-[#1B3A6B] text-white shadow-sm"
              : "text-slate-500 hover:text-[#1B3A6B] hover:bg-slate-50"
          }`}
        >
          Receivables
        </button>
      </div>

      {/* TALLIES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Net Cash */}
        <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">net balance</div>
          <div className="text-2xl font-bold text-[#1B3A6B] flex items-center">
            <IndianRupee className="w-5 h-5 mr-0.5" />
            <span>{balance.toLocaleString("en-IN")}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 font-mono">Calculated from log cashbook</p>
        </div>

        {/* Total Income */}
        <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">monthly inflows</div>
          <div className="text-2xl font-bold text-teal-700 flex items-center">
            <ArrowUpRight className="w-5 h-5 text-teal-600 mr-1 shrink-0" />
            <IndianRupee className="w-5 h-5 mr-0.5" />
            <span>{totalIncome.toLocaleString("en-IN")}</span>
          </div>
          <p className="text-[10px] text-teal-600 mt-2 font-mono">Salary credit and payouts</p>
        </div>

        {/* Total Expenses */}
        <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">monthly outflows</div>
          <div className="text-2xl font-bold text-rose-600 flex items-center">
            <ArrowDownRight className="w-5 h-5 text-rose-500 mr-1 shrink-0" />
            <IndianRupee className="w-5 h-5 mr-0.5" />
            <span>{totalExpenses.toLocaleString("en-IN")}</span>
          </div>
          <p className="text-[10px] text-rose-500 mt-2 font-mono">Rent, utilities and lifestyle</p>
        </div>
      </div>

      {/* TAB 1: CASHBOOK & WATERFALL */}
      {activeTab === "cashbook" && (
        <div className="space-y-6">
          {/* Waterfall chart widget */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#1B3A6B]">Monthly Waterfall Analysis</h4>
                <p className="text-[11px] text-slate-400">Cashflow delta breakdown for the current period</p>
              </div>
              <span className="text-[10px] bg-[#1B3A6B]/5 text-[#1B3A6B] border border-[#1B3A6B]/15 px-2 py-0.5 rounded font-mono font-bold uppercase">
                Active Cycle
              </span>
            </div>

            <div className="space-y-4 pt-2">
              {/* Waterfall Bar 1: Base Starting */}
              <div className="space-y-1 text-left">
                <div className="flex justify-between text-xs font-medium text-slate-500">
                  <span>1. Opening Balance</span>
                  <span className="font-mono">₹{wfStarting.toLocaleString("en-IN")}</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-300" style={{ width: "2%" }} />
                </div>
              </div>

              {/* Waterfall Bar 2: Inflow */}
              <div className="space-y-1 text-left">
                <div className="flex justify-between text-xs font-medium text-teal-700">
                  <span className="flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5 text-teal-600" />
                    2. Inflows (+Salary/Payouts)
                  </span>
                  <span className="font-mono font-bold">+₹{wfInflow.toLocaleString("en-IN")}</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-600 rounded-full" style={{ width: getWfWidth(wfInflow) }} />
                </div>
              </div>

              {/* Waterfall Bar 3: Outflow */}
              <div className="space-y-1 text-left">
                <div className="flex justify-between text-xs font-medium text-rose-600">
                  <span className="flex items-center gap-1">
                    <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
                    3. Outflows (-Bills/Expenses)
                  </span>
                  <span className="font-mono font-bold">-₹{Math.abs(wfOutflow).toLocaleString("en-IN")}</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-rose-400 to-red-500 rounded-full" style={{ width: getWfWidth(wfOutflow) }} />
                </div>
              </div>

              {/* Waterfall Bar 4: Final Net Surplus */}
              <div className="space-y-1 text-left border-t border-slate-150 pt-3">
                <div className="flex justify-between text-xs font-bold text-[#1B3A6B]">
                  <span>4. Ending Surplus (Net Cash)</span>
                  <span className="font-mono">₹{wfSurplus.toLocaleString("en-IN")}</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#1B3A6B] rounded-full" style={{ width: getWfWidth(wfSurplus) }} />
                </div>
              </div>
            </div>
          </div>

          {/* Action bar */}
          <div className="flex justify-between items-center bg-white border-[0.5px] border-slate-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider">Cashbook Records</h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center px-3.5 py-1.5 text-xs font-bold text-white bg-[#1B3A6B] rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              log transaction
            </button>
          </div>

          {/* Add Transaction form */}
          {showAddForm && (
            <form onSubmit={handleSubmitCashbook} className="bg-white border-[0.5px] border-slate-200 rounded-xl p-5 space-y-4 shadow-sm text-left">
              <h3 className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider">add new entry</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">description</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., salary, hdfc sip, swiggy, chai..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border-[0.5px] border-slate-200 rounded-md focus:outline-none focus:border-[#1B3A6B]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">amount (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="amount in rupees"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border-[0.5px] border-slate-200 rounded-md focus:outline-none focus:border-[#1B3A6B]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border-[0.5px] border-slate-200 rounded-md focus:outline-none focus:border-[#1B3A6B]"
                  >
                    <option value="expense">outflow (expense)</option>
                    <option value="income">inflow (income)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border-[0.5px] border-slate-200 rounded-md focus:outline-none focus:border-[#1B3A6B]"
                  >
                    <option value="salary">salary</option>
                    <option value="investment">sip / mutual funds</option>
                    <option value="rent">rent & shelter</option>
                    <option value="utilities">bills & utilities</option>
                    <option value="lifestyle">lifestyle & chai</option>
                    <option value="other">other</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#1B3A6B] rounded-lg hover:bg-slate-800 transition-colors"
                >
                  save entry
                </button>
              </div>
            </form>
          )}

          {/* Transaction Log list */}
          <div className="bg-white border-[0.5px] border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 border-b-[0.5px] border-slate-200 text-left">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">transaction history</span>
            </div>
            <div className="divide-y-[0.5px] divide-slate-150">
              {financeEntries.map((entry) => (
                <div key={entry.id} className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors text-left">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${entry.type === "income" ? "bg-teal-50 text-teal-700" : "bg-red-50 text-red-700"}`}>
                      {entry.type === "income" ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">{entry.description}</h4>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-slate-400 font-mono">{entry.date}</span>
                        <span className="px-2 py-0.5 text-[9px] bg-slate-100 text-slate-600 font-bold rounded-full uppercase tracking-wider">
                          {entry.category}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className={`text-sm font-bold font-mono ${entry.type === "income" ? "text-teal-700" : "text-slate-700"}`}>
                    {entry.type === "income" ? "+" : "-"} ₹{entry.amount.toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
              {financeEntries.length === 0 && (
                <div className="p-8 text-center text-slate-400">
                  <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm">no transaction entries found.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CATEGORY MOM COMPREHENSION */}
      {activeTab === "category" && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
          <div className="text-left border-b border-slate-100 pb-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#1B3A6B]">Month-over-Month Expense Breakdowns</h4>
            <p className="text-xs text-slate-400 mt-1">Category tallies compared against previous month baselines</p>
          </div>

          <div className="space-y-5">
            {categories
              .filter((c) => c !== "salary")
              .map((cat) => {
                const current = currentCategoryExpense(cat);
                const mom = getCategoryMoM(cat);
                const baseline = mom.prevAmount;

                // Visual calculations
                const totalTarget = Math.max(current, baseline, 2000);
                const currWidth = `${(current / totalTarget) * 100}%`;
                const baseWidth = `${(baseline / totalTarget) * 100}%`;

                return (
                  <div key={cat} className="space-y-2 text-left border-b border-slate-100 pb-4 last:border-b-0">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h5 className="text-xs font-bold text-slate-800 capitalize">{cat}</h5>
                        <p className="text-[10px] text-slate-400">{mom.label}</p>
                      </div>

                      {/* MoM Badge */}
                      <div className="text-right">
                        <div className="flex items-center space-x-1.5">
                          {mom.direction === "up" && (
                            <span className="flex items-center gap-0.5 px-2 py-0.5 text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-100 rounded-full">
                              +{mom.percent}% MoM &uarr;
                            </span>
                          )}
                          {mom.direction === "down" && (
                            <span className="flex items-center gap-0.5 px-2 py-0.5 text-[9px] font-bold bg-teal-50 text-teal-700 border border-teal-100 rounded-full">
                              {mom.percent}% MoM &darr;
                            </span>
                          )}
                          {mom.direction === "neutral" && (
                            <span className="flex items-center gap-0.5 px-2 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200 rounded-full">
                              Stable MoM
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Dual comparison bars */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1.5">
                      {/* Current Month */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>Current Month Cycle</span>
                          <span className="font-semibold font-mono text-slate-700">₹{current.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-600 rounded-full" style={{ width: currWidth }} />
                        </div>
                      </div>

                      {/* Previous Month */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>Previous Month Cycle</span>
                          <span className="font-semibold font-mono text-slate-500">₹{baseline.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-400" style={{ width: baseWidth }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 3: SUBSCRIPTIONS TRACKER */}
      {activeTab === "subscriptions" && (
        <div className="space-y-6">
          {/* Summary / Annual Projection */}
          <div className="bg-gradient-to-r from-[#1B3A6B] to-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm text-white text-left flex justify-between items-center">
            <div>
              <span className="text-[9px] bg-white/15 px-2 py-0.5 rounded font-bold uppercase tracking-wider font-mono">
                Subscription Auditor
              </span>
              <h4 className="text-xl font-bold mt-1.5">₹{monthlySubscriptionCost.toLocaleString("en-IN")}<span className="text-xs text-slate-400 font-normal"> / month</span></h4>
              <p className="text-[10px] text-slate-300 mt-1 font-mono">Projected Annual Outflow: ₹{annualSubscriptionCost.toLocaleString("en-IN")}</p>
            </div>
            <button
              onClick={() => setShowSubForm(!showSubForm)}
              className="px-3.5 py-1.5 bg-white text-slate-900 text-xs font-bold rounded-lg hover:bg-slate-100 transition-colors"
            >
              Add Sub
            </button>
          </div>

          {/* Form */}
          {showSubForm && (
            <form onSubmit={handleAddSubscription} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm text-left">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#1B3A6B]">New Subscription</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Service Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Netflix, Spotify"
                    value={subName}
                    onChange={(e) => setSubName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1B3A6B]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="Rate"
                    value={subAmount}
                    onChange={(e) => setSubAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1B3A6B]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Frequency</label>
                  <select
                    value={subFreq}
                    onChange={(e) => setSubFreq(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1B3A6B]"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Last Used (Days Ago)</label>
                  <input
                    type="number"
                    required
                    placeholder="Days ago"
                    value={subLastUsed}
                    onChange={(e) => setSubLastUsed(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1B3A6B]"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubForm(false)}
                  className="px-3 py-1.5 text-xs text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#1B3A6B] rounded-lg"
                >
                  Save Sub
                </button>
              </div>
            </form>
          )}

          {/* List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {subscriptions.map((sub) => (
              <div
                key={sub.id}
                className={`p-4 border rounded-xl bg-white text-left flex justify-between items-start transition-all ${
                  sub.active ? "border-slate-200" : "border-slate-100 opacity-60"
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-800">{sub.name}</span>
                    {sub.active && sub.isUnused && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] font-bold bg-amber-50 text-amber-700 border border-amber-100 rounded uppercase">
                        <AlertTriangle className="w-2.5 h-2.5" /> Unused Alert
                      </span>
                    )}
                  </div>
                  <h5 className="text-base font-bold font-mono text-[#1B3A6B]">
                    ₹{sub.amount.toLocaleString("en-IN")}<span className="text-[10px] text-slate-400 font-normal">/{sub.frequency === "monthly" ? "mo" : "yr"}</span>
                  </h5>
                  <p className="text-[10px] text-slate-400">
                    Last active: <span className="font-semibold text-slate-600">{sub.lastUsedDays} days ago</span>
                  </p>
                  {sub.active && sub.isUnused && (
                    <p className="text-[9px] text-amber-600 leading-normal max-w-[180px]">
                      No recorded hits in 14+ days. Pause or cancel to optimize cache balance.
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end justify-between h-full space-y-4">
                  {/* Toggle Switch */}
                  <div className="flex items-center space-x-2">
                    <span className="text-[9px] uppercase font-bold text-slate-400">{sub.active ? "active" : "paused"}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleSubscription(sub.id)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        sub.active ? "bg-[#1B3A6B]" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          sub.active ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  <button
                    onClick={() => handleDeleteSubscription(sub.id)}
                    className="p-1 text-slate-400 hover:text-red-500 rounded"
                    title="Delete subscription"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: RECEIVABLES */}
      {activeTab === "receivables" && (
        <div className="space-y-6">
          {/* Tally */}
          <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-5 shadow-sm text-left flex justify-between items-center">
            <div>
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Money to Collect</span>
              <h4 className="text-2xl font-bold text-emerald-700 flex items-center mt-1">
                <IndianRupee className="w-5 h-5 mr-0.5" />
                <span>{totalReceivablesPending.toLocaleString("en-IN")}</span>
              </h4>
              <p className="text-[10px] text-slate-400 mt-1">From {receivables.length} pending receivables</p>
            </div>
            <button
              onClick={() => setShowRecForm(!showRecForm)}
              className="px-4 py-1.5 bg-[#1B3A6B] text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors"
            >
              Add Entry
            </button>
          </div>

          {/* Form */}
          {showRecForm && (
            <form onSubmit={handleAddReceivable} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm text-left">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#1B3A6B]">New Receivable</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Debtor Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Aravind Sharma"
                    value={recDebtor}
                    onChange={(e) => setRecDebtor(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="₹ Rate"
                    value={recAmount}
                    onChange={(e) => setRecAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date Borrowed / Split</label>
                  <input
                    type="date"
                    required
                    value={recDate}
                    onChange={(e) => setRecDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Description</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PG Room split, dinner split"
                    value={recDesc}
                    onChange={(e) => setRecDesc(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRecForm(false)}
                  className="px-3 py-1.5 text-xs text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#1B3A6B] rounded-lg"
                >
                  Save Entry
                </button>
              </div>
            </form>
          )}

          {/* List */}
          <div className="space-y-3">
            {receivables.map((rec) => {
              const diffDays = getDaysOverdue(rec.date);
              const isOverdue = diffDays >= 7;

              return (
                <div key={rec.id} className="p-4 bg-white border border-slate-200 rounded-xl text-left flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-bold text-slate-800">{rec.debtor}</h4>
                      {isOverdue && (
                        <span className="flex items-center gap-0.5 px-2 py-0.5 text-[8px] font-bold bg-red-50 text-red-700 border border-red-100 rounded uppercase">
                          7+ Days Overdue
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-medium">{rec.description}</p>
                    <div className="flex items-center space-x-3 text-[10px] text-slate-400 pt-0.5">
                      <span>Lent on: <span className="font-semibold text-slate-500">{rec.date}</span></span>
                      <span>&bull;</span>
                      <span>Overdue count: <span className="font-semibold text-slate-500">{diffDays} days</span></span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-3 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <h5 className="text-base font-bold font-mono text-emerald-700">₹{rec.amount.toLocaleString("en-IN")}</h5>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Reminded toggle */}
                      <button
                        onClick={() => handleToggleReminded(rec.id)}
                        className={`p-1.5 rounded-lg border text-xs transition-colors ${
                          rec.reminded
                            ? "bg-slate-100 border-slate-200 text-slate-500"
                            : "bg-amber-50 border-amber-200 text-amber-700"
                        }`}
                        title={rec.reminded ? "Mark un-reminded" : "Mark reminded"}
                      >
                        {rec.reminded ? "Reminded" : "Mark Reminded"}
                      </button>

                      {/* Draft reminder button */}
                      <button
                        onClick={() => handleCopyWhatsApp(rec)}
                        className="p-1.5 bg-[#0F766E]/10 hover:bg-[#0F766E]/20 text-[#0F766E] rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                        title="Copy WhatsApp reminder draft"
                      >
                        {copiedId === rec.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Remind</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleDeleteReceivable(rec.id)}
                        className="p-1 text-slate-400 hover:text-red-500 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {receivables.length === 0 && (
              <div className="p-8 text-center bg-white border border-slate-200 rounded-xl text-slate-400">
                <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm">No receivables tracked. Everything is settled!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
