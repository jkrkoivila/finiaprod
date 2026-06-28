import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Wallet,
  Receipt,
  Coins,
  FileText,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { ActiveView } from "../types";

interface ViewMeta {
  title: string;
  blurb: string;
  icon: LucideIcon;
  color: string;
}

const META: Record<ActiveView, ViewMeta> = {
  dashboard: {
    title: "Dashboard",
    blurb: "Your vitals — tasks, money due, savings, and health score — land here.",
    icon: LayoutDashboard,
    color: "#1b3a6b",
  },
  tasks: {
    title: "Tasks",
    blurb: "Deadlines and to-dos with natural-language quick-add.",
    icon: CheckSquare,
    color: "#2563eb",
  },
  calendar: {
    title: "Calendar",
    blurb: "A month view of your tasks, bills, and compliance dates.",
    icon: Calendar,
    color: "#2563eb",
  },
  finance: {
    title: "Finance",
    blurb: "Income vs expenses, subscriptions, and receivables.",
    icon: Wallet,
    color: "#0f766e",
  },
  bills: {
    title: "Bills",
    blurb: "Track and settle bills with duplicate detection.",
    icon: Receipt,
    color: "#0f766e",
  },
  tax: {
    title: "Tax",
    blurb: "Old vs new regime calculator for FY 2025-26.",
    icon: Coins,
    color: "#6d28d9",
  },
  documents: {
    title: "Documents",
    blurb: "Import statements and payslips with AI extraction.",
    icon: FileText,
    color: "#1b3a6b",
  },
  analytics: {
    title: "Analytics",
    blurb: "Spending trends and category breakdowns.",
    icon: BarChart3,
    color: "#1b3a6b",
  },
};

export default function PlaceholderView({ view }: { view: ActiveView }) {
  const meta = META[view];
  const Icon = meta.icon;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-[20px] font-medium text-navy">{meta.title}</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">{meta.blurb}</p>
      </div>

      {/* Skeleton cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl border-[0.5px] border-black/10 p-4 h-28 flex flex-col justify-between"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `${meta.color}14` }}
            >
              <Icon size={16} style={{ color: meta.color }} />
            </div>
            <div>
              <div className="h-2.5 w-2/3 rounded bg-slate-100 mb-2" />
              <div className="h-2 w-1/3 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>

      {/* Empty-state panel */}
      <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-6 min-h-[260px] flex flex-col items-center justify-center text-center">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
          style={{ background: `${meta.color}14` }}
        >
          <Icon size={22} style={{ color: meta.color }} />
        </div>
        <p className="text-[14px] font-medium text-navy">{meta.title} workspace</p>
        <p className="text-[12px] text-slate-500 mt-1 max-w-sm">
          This is a placeholder. Real data and features arrive in the next build —
          the shell, layout, and navigation are ready.
        </p>
      </div>
    </div>
  );
}
