import { Fragment } from "react";
import { ArrowLeft, Receipt, Repeat, ChevronRight } from "lucide-react";
import { useFinanceData } from "../lib/useFinanceData";
import { formatINR, moneyDueItems, moneyDueTotal, ymd } from "../lib/dashboard";
import { navigate } from "../lib/router";

/**
 * "What's due" — the source-of-truth breakdown behind the dashboard Money due vital.
 * Reads the SAME bills + paymentInstances (via moneyDueItems) the vital sums, so the
 * total here always equals the card. Every row is navigable to its detail.
 */
export default function WhatsDueScreen({ uid, onBack }: { uid: string; onBack: () => void }) {
  const data = useFinanceData(uid);
  const today = ymd(new Date());
  const items = moneyDueItems(data.bills, data.paymentInstances, today, 7);
  const total = moneyDueTotal(items);

  const openItem = (kind: "bill" | "instance", recurringId?: string) => {
    if (kind === "bill") navigate("/bills");
    else navigate(recurringId ? `/recurring?open=${encodeURIComponent(recurringId)}` : "/recurring");
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-navy">
        <ArrowLeft size={14} /> Dashboard
      </button>

      <div className="bg-navy text-white rounded-xl p-4">
        <div className="text-[12px] text-white/70">Money due · next 7 days</div>
        <div className="text-[24px] font-medium tabular-nums mt-0.5">{formatINR(total)}</div>
        <div className="text-[12px] text-white/60 mt-1">
          {items.length === 0 ? "Nothing due" : `Across ${items.length} item${items.length === 1 ? "" : "s"}`}
        </div>
      </div>

      {data.loading ? (
        <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-6 text-[13px] text-slate-500">Loading…</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-8 text-center">
          <p className="text-[13px] font-medium text-navy">Nothing due in the next 7 days</p>
          <p className="mt-1 text-[12px] text-slate-500">Bills and recurring payments coming up will appear here.</p>
        </div>
      ) : (
        <ul className="bg-white rounded-xl border-[0.5px] border-black/10 divide-y divide-black/5 overflow-hidden">
          {items.map((it) => {
            const Icon = it.kind === "bill" ? Receipt : Repeat;
            return (
              <Fragment key={`${it.kind}-${it.id}`}>
                <li>
                  <button
                    onClick={() => openItem(it.kind, it.recurringId)}
                    className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-finance/10 flex items-center justify-center shrink-0">
                      <Icon size={16} className="text-finance" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-navy truncate">{it.title}</div>
                      <div className="text-[11px] text-slate-400">
                        {it.kind === "bill" ? "Bill" : "Recurring payment"} · due {it.dueDate}
                      </div>
                    </div>
                    <span className="text-[13px] font-medium text-navy tabular-nums shrink-0">{formatINR(it.amount)}</span>
                    <ChevronRight size={16} className="text-slate-300 shrink-0" />
                  </button>
                </li>
              </Fragment>
            );
          })}
        </ul>
      )}
    </div>
  );
}
