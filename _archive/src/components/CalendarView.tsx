import React from "react";
import { ChevronLeft, ChevronRight, Calendar, Bell, AlertTriangle } from "lucide-react";
import { Task, Bill } from "../types";

interface CalendarViewProps {
  tasks: Task[];
  bills: Bill[];
}

export default function CalendarView({ tasks, bills }: CalendarViewProps) {
  // Let's draw a nice visual calendar grid for June 2026 (based on 2026 current year metadata)
  // June 2026 starts on a Monday (June 1st, 2026) and has 30 days.
  const daysInMonth = 30;
  const startDayOffset = 0; // Monday start
  const monthName = "june 2026";

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const leadingBlanks = Array.from({ length: startDayOffset }, (_, i) => null);

  const getDayEvents = (dayNum: number) => {
    const dateStr = `2026-06-${dayNum.toString().padStart(2, "0")}`;
    const dayTasks = tasks.filter((t) => t.dueDate === dateStr);
    const dayBills = bills.filter((b) => b.dueDate === dateStr);
    return { dayTasks, dayBills };
  };

  return (
    <div className="space-y-6">
      {/* Calendar layout card */}
      <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-6">
        {/* Header control */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-[#1B3A6B]" />
            <h3 className="text-sm font-medium text-[#1B3A6B] uppercase tracking-wider">{monthName}</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-1.5 rounded-lg border-[0.5px] border-slate-200 hover:bg-slate-50 transition-colors focus:outline-none">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <button className="p-1.5 rounded-lg border-[0.5px] border-slate-200 hover:bg-slate-50 transition-colors focus:outline-none">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>

        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">
          <span>mon</span>
          <span>tue</span>
          <span>wed</span>
          <span>thu</span>
          <span>fri</span>
          <span>sat</span>
          <span>sun</span>
        </div>

        {/* Grid of days */}
        <div className="grid grid-cols-7 gap-2">
          {leadingBlanks.map((_, index) => (
            <div key={`blank-${index}`} className="h-24 bg-slate-50 rounded-lg border-[0.5px] border-transparent" />
          ))}
          {days.map((day) => {
            const { dayTasks, dayBills } = getDayEvents(day);
            const hasEvents = dayTasks.length > 0 || dayBills.length > 0;
            const isToday = day === 25; // 2026-06-25 is current local date from metadata!

            return (
              <div
                key={`day-${day}`}
                className={`h-24 p-2 rounded-lg border-[0.5px] flex flex-col justify-between transition-all ${
                  isToday
                    ? "bg-[#2BA8E0]/10 border-[#2BA8E0]"
                    : "bg-white border-slate-100 hover:border-slate-300"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-medium ${isToday ? "text-[#2BA8E0] font-bold" : "text-slate-600"}`}>
                    {day}
                  </span>
                  {isToday && (
                    <span className="text-[9px] bg-[#2BA8E0] text-white px-1 py-0.5 rounded uppercase tracking-wider scale-90">
                      today
                    </span>
                  )}
                </div>

                {/* mini alerts inside cell */}
                <div className="space-y-1 overflow-hidden shrink-0">
                  {dayTasks.map((t) => (
                    <div
                      key={t.id}
                      className={`text-[9px] truncate px-1 rounded leading-tight ${
                        t.category === "tax"
                          ? "bg-[#6D28D9]/10 text-[#6D28D9]"
                          : "bg-[#2563EB]/10 text-[#2563EB]"
                      }`}
                      title={t.title}
                    >
                      {t.title}
                    </div>
                  ))}
                  {dayBills.map((b) => (
                    <div
                      key={b.id}
                      className="text-[9px] truncate px-1 bg-[#0F766E]/10 text-[#0F766E] leading-tight"
                      title={`Bill: ${b.payee}`}
                    >
                      ₹{b.amount} {b.payee}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Compliance highlight list */}
      <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-6">
        <h4 className="text-xs font-medium text-[#1B3A6B] uppercase tracking-wider mb-4">compliance & financial events calendar</h4>
        <div className="space-y-3">
          <div className="flex items-start space-x-3 p-3 bg-slate-50 border-[0.5px] border-slate-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-[#E24B4A] mt-0.5" />
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">june 15, 2026</span>
              <p className="text-sm text-slate-800">adv tax 1st installment due</p>
              <p className="text-xs text-slate-400 mt-1">15% of estimated net tax liability for fy 2026-27 is payable on or before this date.</p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-3 bg-slate-50 border-[0.5px] border-slate-200 rounded-lg">
            <Bell className="w-4 h-4 text-[#6D28D9] mt-0.5" />
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">july 31, 2026</span>
              <p className="text-sm text-slate-800">itr filing deadline for individuals</p>
              <p className="text-xs text-slate-400 mt-1">deadline for filing income tax return (itr) for fy 2025-26 without any late fee penalty.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
