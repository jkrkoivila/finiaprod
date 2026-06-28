import React, { useState, useEffect } from "react";
import {
  IndianRupee,
  Check,
  AlertCircle,
  Plus,
  Calendar,
  Tag,
  Clock,
  Sparkles,
  Bookmark,
  BellRing,
  CheckCircle,
  TrendingDown,
  X,
  CreditCard,
  Zap,
  Globe,
  HelpCircle
} from "lucide-react";
import { Bill, FinanceEntry } from "../types";

interface BillsViewProps {
  bills: Bill[];
  financeEntries: FinanceEntry[];
  onMarkPaid: (id: string) => void;
  onAddBill: (bill: Omit<Bill, "id" | "paid">) => void;
  onAddTask: (task: {
    title: string;
    dueDate: string;
    category: "tax" | "finance" | "personal" | "general" | "work";
    priority: "high" | "medium" | "low";
    amount?: number;
  }) => Promise<void>;
  onAddDocument: (
    name: string,
    size: string,
    type: string,
    category?: string,
    tags?: string[],
    summary?: string
  ) => Promise<void>;
}

export default function BillsView({
  bills,
  financeEntries,
  onMarkPaid,
  onAddBill,
  onAddTask,
  onAddDocument
}: BillsViewProps) {
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState<Bill["category"]>("other");
  const [showAddForm, setShowAddForm] = useState(false);

  // Bill Detail View States
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [taskAddedFeedback, setTaskAddedFeedback] = useState(false);
  const [reminderAddedFeedback, setReminderAddedFeedback] = useState(false);
  const [docSavedFeedback, setDocSavedFeedback] = useState(false);

  // Gemini AI insight state and hook
  const [aiInsight, setAiInsight] = useState("");
  const [loadingInsight, setLoadingInsight] = useState(false);

  const getRealBillTransactions = (bill: Bill, transactions: FinanceEntry[]) => {
    const expenses = transactions.filter(t => t.type === "expense");
    if (bill.category === "credit-card") {
      // credit card: matches all expenses that are not direct utility/rent payments
      return expenses.filter(t => !t.description.toLowerCase().startsWith("paid bill:"));
    } else {
      // utilities / rent: matches descriptions that contain the payee name or category
      const payeeKeywords = bill.payee.toLowerCase().split(/\s+/).filter(w => w.length > 2 && w !== "card" && w !== "bill");
      return expenses.filter(t => {
        const descLower = t.description.toLowerCase();
        const matchesPayee = payeeKeywords.some(kw => descLower.includes(kw));
        const matchesCategory = (bill.category === "electricity" && t.category === "utilities") ||
                                (bill.category === "internet" && t.category === "utilities") ||
                                (bill.category === "rent" && t.category === "rent");
        return matchesPayee || matchesCategory;
      });
    }
  };

  useEffect(() => {
    if (!selectedBill) {
      setAiInsight("");
      return;
    }

    const fetchInsight = async () => {
      setLoadingInsight(true);
      setAiInsight("Analyzing statement with Finia AI Auditor...");
      try {
        const matchedTx = getRealBillTransactions(selectedBill, financeEntries);
        const res = await fetch("/api/bill-insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bill: selectedBill, transactions: matchedTx }),
        });
        if (res.ok) {
          const data = await res.json();
          setAiInsight(data.insight);
        } else {
          setAiInsight("Finia AI Insight: Unable to connect to auditor. Good to schedule payment.");
        }
      } catch (err) {
        setAiInsight("Finia AI Insight: Error auditing statement. Good to schedule payment.");
      } finally {
        setLoadingInsight(false);
      }
    };

    fetchInsight();
  }, [selectedBill, financeEntries]);

  const pendingBills = bills.filter((b) => !b.paid);
  const paidBills = bills.filter((b) => b.paid);
  const totalPendingAmount = pendingBills.reduce((acc, b) => acc + b.amount, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payee.trim() || !amount || !dueDate) return;
    onAddBill({
      payee,
      amount: parseFloat(amount),
      dueDate,
      category,
    });
    setPayee("");
    setAmount("");
    setDueDate("");
    setCategory("other");
    setShowAddForm(false);
  };

  // Helper to calculate countdown days
  const getCountdownText = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dateStr);
    due.setHours(0, 0, 0, 0);

    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return { text: "Due today", color: "bg-amber-50 text-amber-700 border-amber-200" };
    } else if (diffDays === 1) {
      return { text: "Due tomorrow", color: "bg-orange-50 text-orange-700 border-orange-200" };
    } else if (diffDays > 1) {
      return { text: `Due in ${diffDays} days`, color: "bg-[#2BA8E0]/10 text-[#1B3A6B] border-[#2BA8E0]/20" };
    } else {
      return { text: `${Math.abs(diffDays)} days overdue`, color: "bg-red-50 text-red-700 border-red-200 animate-pulse" };
    }
  };

  // Spend breakdown generator per category
  const getSpendBreakdown = (bill: Bill) => {
    const matchedTx = getRealBillTransactions(bill, financeEntries);
    const totalMatchedAmount = matchedTx.reduce((sum, t) => sum + t.amount, 0);
    const breakdown = [];
    if (totalMatchedAmount > 0) {
      const categorySums: Record<string, number> = {};
      matchedTx.forEach((t) => {
        categorySums[t.category] = (categorySums[t.category] || 0) + t.amount;
      });
      const colors: Record<string, string> = {
        lifestyle: "bg-indigo-600",
        investment: "bg-purple-600",
        utilities: "bg-sky-600",
        rent: "bg-amber-600",
        other: "bg-slate-400",
      };
      Object.entries(categorySums).forEach(([cat, sum]) => {
        breakdown.push({
          name: cat.charAt(0).toUpperCase() + cat.slice(1),
          pct: Math.round((sum / totalMatchedAmount) * 100),
          color: colors[cat] || "bg-slate-500",
        });
      });
      breakdown.sort((a, b) => b.pct - a.pct);
    } else {
      breakdown.push({ name: "Core Usage Rate", pct: 100, color: "bg-[#1B3A6B]" });
    }
    return breakdown;
  };

  // Top transactions generator per category
  const getTopTransactions = (bill: Bill) => {
    const matchedTx = getRealBillTransactions(bill, financeEntries);
    if (matchedTx.length > 0) {
      return [...matchedTx]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3)
        .map((t) => ({
          merchant: t.description,
          date: new Date(t.date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }),
          amount: `₹${t.amount.toLocaleString("en-IN")}`,
        }));
    } else {
      return [
        {
          merchant: "Standard service line item",
          date: new Date(bill.dueDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }),
          amount: `₹${bill.amount.toLocaleString("en-IN")}`,
        },
      ];
    }
  };

  // Click actions inside detail view
  const handleAddPaymentTask = async (bill: Bill) => {
    setTaskAddedFeedback(true);
    await onAddTask({
      title: `Pay bill statement: ${bill.payee}`,
      dueDate: bill.dueDate,
      category: "finance",
      priority: "high",
      amount: bill.amount
    });
    setTimeout(() => setTaskAddedFeedback(false), 2500);
  };

  const handleSetReminder = async (bill: Bill) => {
    setReminderAddedFeedback(true);
    await onAddTask({
      title: `Calendar Alert: Settle bill for ${bill.payee}`,
      dueDate: bill.dueDate,
      category: "finance",
      priority: "medium",
      amount: bill.amount,
    });
    setTimeout(() => setReminderAddedFeedback(false), 2500);
  };

  const handleSaveToLibrary = async (bill: Bill) => {
    setDocSavedFeedback(true);
    const cleanName = `statement_${bill.payee.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_june_2026.pdf`;
    await onAddDocument(
      cleanName,
      "342 KB",
      "pdf",
      bill.category === "credit-card" ? "Credit Card Bill" : "Utility",
      ["Bill", "Receipt", "Seeded"],
      `Scanned financial statement for ${bill.payee} showing total outstanding of ₹${bill.amount}`
    );
    setTimeout(() => setDocSavedFeedback(false), 2500);
  };

  return (
    <div className="space-y-6 relative">
      
      {/* Tallies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-5 shadow-sm text-left">
          <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">outstanding bills</div>
          <div className="text-2xl font-bold text-rose-600 flex items-center">
            <IndianRupee className="w-5 h-5 mr-0.5" />
            <span>{totalPendingAmount.toLocaleString("en-IN")}</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">from {pendingBills.length} pending statements</p>
        </div>

        <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between text-left">
          <div>
            <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">compliance status</div>
            <div className="text-sm font-bold text-slate-800">autopay configured</div>
            <p className="text-xs text-slate-400 mt-1">Jio & Electricity are linked to HDFC</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center px-4 py-2 text-xs font-bold text-white bg-[#1B3A6B] rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            add bill
          </button>
        </div>
      </div>

      {/* Bill Entry Form */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-white border-[0.5px] border-slate-200 rounded-xl p-5 space-y-4 shadow-sm text-left">
          <h3 className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider">add bill statement</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">payee name</label>
              <input
                type="text"
                required
                placeholder="e.g., bescom electricity, jio fibre, rent..."
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
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
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">due date</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border-[0.5px] border-slate-200 rounded-md focus:outline-none focus:border-[#1B3A6B]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border-[0.5px] border-slate-200 rounded-md focus:outline-none focus:border-[#1B3A6B]"
              >
                <option value="electricity">electricity (bescom/best)</option>
                <option value="rent">rent (house/flat/pg)</option>
                <option value="internet">internet & phone (jio/airtel)</option>
                <option value="credit-card">credit card</option>
                <option value="other">other utilities</option>
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
              save bill
            </button>
          </div>
        </form>
      )}

      {/* Bill Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Outstanding column */}
        <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-5 shadow-sm text-left">
          <h3 className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-4">unpaid statements</h3>
          <div className="space-y-3">
            {pendingBills.map((bill) => {
              const countdown = getCountdownText(bill.dueDate);
              return (
                <div
                  key={bill.id}
                  onClick={() => setSelectedBill(bill)}
                  className="p-4 border-[0.5px] border-slate-100 rounded-xl bg-slate-50/70 hover:bg-slate-100/60 hover:scale-[1.01] transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xs font-bold text-slate-800">{bill.payee}</h4>
                      <span className={`px-2 py-0.5 text-[8px] font-extrabold uppercase rounded border ${countdown.color}`}>
                        {countdown.text}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] text-slate-400 font-mono">due {bill.dueDate}</span>
                      <span className="px-2 py-0.5 text-[9px] bg-white text-slate-500 font-bold rounded-full uppercase tracking-wider border-[0.5px] border-slate-150">
                        {bill.category}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3" onClick={(e) => e.stopPropagation()}>
                    <span className="text-sm font-bold font-mono text-rose-600">
                      ₹{bill.amount.toLocaleString("en-IN")}
                    </span>
                    <button
                      onClick={() => onMarkPaid(bill.id)}
                      className="p-1.5 bg-[#0F766E] text-white rounded-lg hover:bg-teal-850 transition-colors focus:outline-none cursor-pointer"
                      title="Mark paid"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
            {pendingBills.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">all bills are paid! nice work.</p>
            )}
          </div>
        </div>

        {/* Paid Column */}
        <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-5 shadow-sm text-left">
          <h3 className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-4">settled statements</h3>
          <div className="space-y-3">
            {paidBills.map((bill) => (
              <div
                key={bill.id}
                onClick={() => setSelectedBill(bill)}
                className="p-4 border-[0.5px] border-slate-100 rounded-xl bg-slate-50/70 hover:bg-slate-100/60 hover:scale-[1.01] transition-all cursor-pointer flex items-center justify-between opacity-70"
              >
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 line-through">{bill.payee}</h4>
                  <span className="text-[10px] text-slate-400 block font-mono">settled successfully &bull; {bill.category}</span>
                </div>
                <span className="text-sm font-bold font-mono text-slate-500">
                  ₹{bill.amount.toLocaleString("en-IN")}
                </span>
              </div>
            ))}
            {paidBills.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">no bills settled in this cycle yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* INTERACTIVE BILL DETAIL SIDEBAR DRAWER */}
      {selectedBill && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end">
          {/* Backdrop closer click */}
          <div className="flex-1" onClick={() => setSelectedBill(null)} />

          {/* Drawer Body */}
          <div className="w-full max-w-md bg-white h-screen flex flex-col justify-between shadow-2xl relative animate-slide-in text-left">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="p-1 bg-[#1B3A6B]/10 text-[#1B3A6B] rounded-lg">
                    {selectedBill.category === "credit-card" ? (
                      <CreditCard className="w-4 h-4" />
                    ) : selectedBill.category === "electricity" ? (
                      <Zap className="w-4 h-4" />
                    ) : selectedBill.category === "internet" ? (
                      <Globe className="w-4 h-4" />
                    ) : (
                      <HelpCircle className="w-4 h-4" />
                    )}
                  </span>
                  <span className="text-[10px] bg-slate-200 text-slate-700 font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                    {selectedBill.category}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900">{selectedBill.payee}</h3>
              </div>
              <button
                onClick={() => setSelectedBill(null)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              
              {/* Dual Stat Blocks (Total vs Min) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Total Due</span>
                  <h4 className="text-lg font-bold text-slate-800 font-mono mt-0.5">₹{selectedBill.amount.toLocaleString("en-IN")}</h4>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Minimum Due</span>
                  <h4 className="text-lg font-bold text-slate-800 font-mono mt-0.5">
                    ₹{(selectedBill.category === "credit-card" ? selectedBill.amount * 0.05 : selectedBill.amount).toLocaleString("en-IN")}
                  </h4>
                </div>
              </div>

              {/* Due Countdown Alert Card */}
              <div className="p-3.5 bg-[#2BA8E0]/5 border border-[#2BA8E0]/15 rounded-xl flex items-center space-x-3 text-xs">
                <Clock className="w-4 h-4 text-[#1B3A6B] shrink-0" />
                <div className="flex-1 flex justify-between items-center">
                  <span className="font-semibold text-[#1B3A6B]">Compliance Deadline</span>
                  <span className="font-bold font-mono text-[#1B3A6B] bg-white border px-2 py-0.5 rounded shadow-sm text-[10px]">
                    {selectedBill.dueDate}
                  </span>
                </div>
              </div>

              {/* Spend Breakdown Visual Percentage bars */}
              <div className="space-y-3">
                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Statement breakdown</h5>
                <div className="space-y-2">
                  {getSpendBreakdown(selectedBill).map((item, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>{item.name}</span>
                        <span className="font-bold">{item.pct}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Transactions */}
              <div className="space-y-3">
                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">top invoice charges</h5>
                <div className="divide-y-[0.5px] divide-slate-100 border-[0.5px] border-slate-150 rounded-xl overflow-hidden bg-slate-50/50">
                  {getTopTransactions(selectedBill).map((tx, idx) => (
                    <div key={idx} className="p-3 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{tx.merchant}</p>
                        <p className="text-[10px] text-slate-400">{tx.date}</p>
                      </div>
                      <span className="font-mono font-bold text-slate-700">{tx.amount}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gemini compliance insight */}
              <div className="bg-gradient-to-tr from-[#1B3A6B]/5 to-indigo-50/30 border border-[#1B3A6B]/15 p-4 rounded-xl space-y-2">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-[#1B3A6B]">
                  <Sparkles className="w-4 h-4 text-[#2BA8E0]" />
                  <span>Finia AI Auditor</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-normal">
                  {loadingInsight ? (
                    <span className="italic text-slate-400">Auditing with Gemini...</span>
                  ) : (
                    aiInsight
                  )}
                </p>
              </div>

            </div>

            {/* Drawer Actions Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-2">
              
              <div className="grid grid-cols-2 gap-2">
                
                {/* Save to library */}
                <button
                  onClick={() => handleSaveToLibrary(selectedBill)}
                  className={`py-2.5 px-3 border rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    docSavedFeedback
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {docSavedFeedback ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Saved to Library!</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-3.5 h-3.5 text-slate-400" />
                      <span>Save to Library</span>
                    </>
                  )}
                </button>

                {/* Set reminder */}
                <button
                  onClick={() => handleSetReminder(selectedBill)}
                  className={`py-2.5 px-3 border rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    reminderAddedFeedback
                      ? "bg-purple-50 border-purple-300 text-purple-700"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {reminderAddedFeedback ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Reminder Scheduled!</span>
                    </>
                  ) : (
                    <>
                      <BellRing className="w-3.5 h-3.5 text-slate-400" />
                      <span>Set Calendar Alert</span>
                    </>
                  )}
                </button>

              </div>

              {/* Add payment task (Primary) */}
              <button
                onClick={() => handleAddPaymentTask(selectedBill)}
                className={`w-full py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  taskAddedFeedback
                    ? "bg-emerald-600 text-white shadow-md"
                    : "bg-[#1B3A6B] hover:bg-slate-800 text-white shadow-sm"
                }`}
              >
                {taskAddedFeedback ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Payment Task Added!</span>
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    <span>Create payment task</span>
                  </>
                )}
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
