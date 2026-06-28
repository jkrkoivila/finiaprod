import React from "react";
import { IndianRupee, PieChart, TrendingUp, DollarSign, Wallet, ArrowRight } from "lucide-react";
import { FinanceEntry } from "../types";

interface AnalyticsViewProps {
  financeEntries: FinanceEntry[];
}

export default function AnalyticsView({ financeEntries }: AnalyticsViewProps) {
  const expenses = financeEntries.filter((e) => e.type === "expense");
  const totalExpense = expenses.reduce((acc, e) => acc + e.amount, 0);

  // Group by category
  const categoriesMap: { [key: string]: number } = {};
  expenses.forEach((e) => {
    categoriesMap[e.category] = (categoriesMap[e.category] || 0) + e.amount;
  });

  const categories = Object.keys(categoriesMap).map((cat) => ({
    name: cat,
    amount: categoriesMap[cat],
    percentage: totalExpense > 0 ? Math.round((categoriesMap[cat] / totalExpense) * 100) : 0,
  })).sort((a, b) => b.amount - a.amount);

  // Define colors matching brand
  const getCatColor = (cat: string) => {
    switch (cat.toLowerCase()) {
      case "investment": return "#0F766E"; // Finance teal
      case "utilities": return "#2563EB"; // Task blue
      case "rent": return "#1B3A6B"; // Navy
      case "lifestyle": return "#2BA8E0"; // Pulse blue
      default: return "#6D28D9"; // Tax purple
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview stats */}
      <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-6">
        <h3 className="text-sm font-medium text-[#1B3A6B] uppercase tracking-wider mb-2">monthly outflow analytics</h3>
        <p className="text-xs text-slate-500">breakdown of expenses and continuous savings targets.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Category breakdown lists */}
        <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-6 lg:col-span-1 space-y-4">
          <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">outflows by category</h4>
          <div className="space-y-4">
            {categories.map((cat) => (
              <div key={cat.name} className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-slate-700 capitalize">{cat.name}</span>
                  <span className="font-mono text-slate-500">{cat.percentage}% (₹{cat.amount.toLocaleString("en-IN")})</span>
                </div>
                {/* Custom flat progress bar */}
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full" 
                    style={{ 
                      width: `${cat.percentage}%`,
                      backgroundColor: getCatColor(cat.name)
                    }}
                  />
                </div>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-xs text-slate-400 py-4 text-center">no outflow entries recorded yet.</p>
            )}
          </div>
        </div>

        {/* Right Column: Visual custom SVG charts */}
        <div className="lg:col-span-2 bg-white border-[0.5px] border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-6">budget utilization (visualized)</h4>
            
            {/* Custom SVG Bar Chart */}
            <div className="relative h-48 w-full flex items-end justify-between space-x-4 border-b-[0.5px] border-slate-200 pb-2">
              {categories.map((cat, index) => {
                // Calculate height relative to max category amount
                const maxAmount = Math.max(...categories.map(c => c.amount), 1);
                const barHeightPercent = Math.max(10, Math.min(100, (cat.amount / maxAmount) * 100));

                return (
                  <div key={cat.name} className="flex-1 flex flex-col items-center justify-end h-full">
                    {/* Tooltip amount label */}
                    <span className="text-[10px] font-mono text-slate-500 mb-1">₹{cat.amount >= 1000 ? `${(cat.amount / 1000).toFixed(1)}k` : cat.amount}</span>
                    <div 
                      className="w-full rounded-t-sm transition-all duration-500"
                      style={{ 
                        height: `${barHeightPercent}%`,
                        backgroundColor: getCatColor(cat.name)
                      }}
                    />
                    <span className="text-[9px] text-slate-400 mt-2 whitespace-nowrap overflow-hidden text-ellipsis w-full text-center capitalize">{cat.name}</span>
                  </div>
                );
              })}
              {categories.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                  no category metrics to build graph.
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between text-xs text-slate-400 pt-4 border-t-[0.5px] border-slate-100">
            <span className="flex items-center">
              <TrendingUp className="w-4 h-4 text-[#0F766E] mr-1" />
              sip contributions make up {categories.find(c => c.name === "investment")?.percentage || 0}% of outflows.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
