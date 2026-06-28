import { Fragment, useMemo } from "react";
import {
  CheckSquare,
  Square,
  Wallet,
  Coins,
  Activity,
  Mail,
  CalendarClock,
  ArrowUpRight,
  Inbox,
  Flame,
  Landmark,
  type LucideIcon,
} from "lucide-react";
import { clusteredDeadlines, CRISIS_THRESHOLD } from "../lib/crisis";
import Sparkline from "./Sparkline";
import {
  addDays,
  buildAlerts,
  financialPulse,
  formatINR,
  healthBand,
  healthScore,
  moneyDueItems,
  moneyDueTotal,
  moneyDueTrend,
  priorityTasks,
  savedThisMonth,
  savedTrend,
  tasksDueToday,
  tasksTrend,
  urgencyOf,
  ymd,
  type AlertKind,
  type Urgency,
} from "../lib/dashboard";
import type { ActiveView, Task, TaskCategory } from "../types";
import type { FinanceData } from "../lib/useFinanceData";

interface DashboardViewProps {
  data: FinanceData;
  onToggleTask: (id: string, completed: boolean) => void;
  onNavigate: (view: ActiveView) => void;
  onOpenCrisis?: () => void;
  /** Open the "What's due" breakdown (the Money due card's drill-down). */
  onOpenDue?: () => void;
  /** Fixed "today" for deterministic previews; defaults to the real date. */
  today?: string;
}

const URGENCY_BORDER: Record<Urgency, string> = {
  urgent: "#E24B4A",
  soon: "#D97706",
  normal: "#2563EB",
  tax: "#6D28D9",
};

const CATEGORY_BADGE: Record<TaskCategory, { bg: string; fg: string }> = {
  tax: { bg: "#6D28D914", fg: "#6D28D9" },
  finance: { bg: "#0F766E14", fg: "#0F766E" },
  work: { bg: "#2563EB14", fg: "#2563EB" },
  personal: { bg: "#47556914", fg: "#475569" },
  general: { bg: "#47556914", fg: "#475569" },
};

const ALERT_STYLE: Record<AlertKind, { color: string; icon: LucideIcon }> = {
  finance: { color: "#D97706", icon: Wallet },
  tax: { color: "#6D28D9", icon: Coins },
  gmail: { color: "#2563EB", icon: Mail },
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function DashboardView({ data, onToggleTask, onNavigate, onOpenCrisis, onOpenDue, today }: DashboardViewProps) {
  const t = today ?? ymd(new Date());
  const { tasks, bills, transactions, subscriptions, receivables, paymentInstances, fixedDeposits, loading } = data;
  const crisisCount = useMemo(() => clusteredDeadlines(tasks, t).length, [tasks, t]);

  const v = useMemo(() => {
    const dueToday = tasksDueToday(tasks, t);
    // "Money due" = unpaid bills + upcoming recurring instances (shared source of truth
    // with the "What's due" breakdown, so the two can never disagree).
    const dueList = moneyDueItems(bills, paymentInstances || [], t, 7);
    const saved = savedThisMonth(transactions, t);
    const health = healthScore(tasks, bills, transactions, t);
    const pulse = financialPulse(bills, transactions, subscriptions, receivables, t, fixedDeposits || [], paymentInstances || []);
    const openTasks = tasks.filter((x) => !x.completed).length;
    const nearestDue = dueList[0]?.dueDate;
    return {
      dueTodayCount: dueToday.length,
      openTasks,
      moneyDue: moneyDueTotal(dueList),
      dueSoonCount: dueList.length,
      // True when any Money-due source exists, so the caption matches the value's scope.
      hasMoneyDueSource: bills.length > 0 || (paymentInstances?.length || 0) > 0,
      nearestDue,
      saved,
      health,
      pulse,
      priority: priorityTasks(tasks, t, 5),
      alerts: buildAlerts(tasks, bills, subscriptions, receivables, t, fixedDeposits || []),
      trends: {
        tasks: tasksTrend(tasks, t),
        money: moneyDueTrend(bills, t),
        saved: savedTrend(transactions, t),
      },
      hasAnyData:
        tasks.length + bills.length + transactions.length + subscriptions.length + receivables.length + (paymentInstances?.length || 0) + (fixedDeposits?.length || 0) > 0,
    };
  }, [tasks, bills, transactions, subscriptions, receivables, paymentInstances, fixedDeposits, t]);

  const monthName = MONTH_NAMES[Number(t.slice(5, 7)) - 1];

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      {crisisCount >= CRISIS_THRESHOLD && onOpenCrisis && (
        <button
          onClick={onOpenCrisis}
          className="w-full flex items-center gap-3 rounded-xl bg-crisis text-white px-4 py-3 text-left hover:bg-crisis/90 transition-colors"
        >
          <span className="relative flex items-center justify-center shrink-0">
            <span className="absolute w-5 h-5 rounded-full bg-white/40 animate-ping" />
            <Flame size={18} className="relative" />
          </span>
          <span className="text-[13px] font-medium">
            {crisisCount} deadlines clustered — Finia detected a crisis.
          </span>
          <span className="ml-auto text-[13px] font-medium inline-flex items-center gap-1">
            View crisis mode <ArrowUpRight size={15} />
          </span>
        </button>
      )}

      <div>
        <h1 className="text-[20px] font-medium text-navy">Dashboard</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">
          {v.hasAnyData
            ? "Your live snapshot across deadlines, money, and tax."
            : "No data yet — connect Gmail or add a task and your vitals fill in instantly."}
        </p>
      </div>

      {/* Vitals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <VitalCard
          label="Tasks today"
          color="#2563EB"
          value={String(v.dueTodayCount)}
          sub={
            tasks.length === 0
              ? "Add a task to get started"
              : v.dueTodayCount === 0
              ? "Nothing due today"
              : `${v.openTasks} open overall`
          }
          trend={v.trends.tasks}
        />
        <VitalCard
          label="Money due"
          color="#E24B4A"
          value={formatINR(v.moneyDue)}
          sub={
            !v.hasMoneyDueSource
              ? "No bills yet — sync Gmail"
              : v.moneyDue === 0
              ? "Nothing due in 7 days"
              : `Across ${v.dueSoonCount} item${v.dueSoonCount === 1 ? "" : "s"} by ${v.nearestDue}`
          }
          trend={v.trends.money}
          onClick={v.dueSoonCount > 0 ? onOpenDue : undefined}
        />
        <VitalCard
          label="Saved this month"
          color="#0F766E"
          value={formatINR(v.saved)}
          sub={
            transactions.length === 0
              ? "No income or spends logged"
              : `${monthName} · income minus expenses`
          }
          trend={v.trends.saved}
        />
        <VitalCard
          label="Health score"
          color="#6D28D9"
          value={v.health === null ? "—" : String(v.health)}
          valueSuffix={v.health === null ? undefined : "/100"}
          sub={v.health === null ? "Add data to see your score" : healthBand(v.health)}
          trend={[]}
        />
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Priority tasks */}
        <section className="bg-white rounded-xl border-[0.5px] border-black/10 p-4">
          <CardHeader title="Priority tasks" actionLabel="View all" onAction={() => onNavigate("tasks")} />
          {v.priority.length === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title="No open tasks"
              body="Add a task or sync Gmail to surface deadlines here."
              actionLabel="Add a task"
              onAction={() => onNavigate("tasks")}
            />
          ) : (
            <ul className="mt-3 space-y-2">
              {v.priority.map((task) => (
                <Fragment key={task.id}>
                  <PriorityRow task={task} today={t} onToggle={onToggleTask} />
                </Fragment>
              ))}
            </ul>
          )}
        </section>

        {/* Alerts */}
        <section className="bg-white rounded-xl border-[0.5px] border-black/10 p-4">
          <CardHeader title="Alerts" />
          <ul className="mt-3 space-y-2">
            {v.alerts.map((a) => {
              const style = ALERT_STYLE[a.kind];
              const Icon = style.icon;
              return (
                <li
                  key={a.id}
                  className="flex items-start gap-3 rounded-lg border-[0.5px] border-black/10 p-3"
                  style={{ background: `${style.color}0A` }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${style.color}1A` }}
                  >
                    <Icon size={16} style={{ color: style.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-navy">{a.title}</div>
                    <div className="text-[12px] text-slate-500 leading-relaxed">{a.description}</div>
                    <button
                      onClick={() => onNavigate(a.actionView)}
                      className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium hover:underline"
                      style={{ color: style.color }}
                    >
                      {a.actionLabel}
                      <ArrowUpRight size={13} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* Financial pulse */}
      <section className="bg-white rounded-xl border-[0.5px] border-black/10 p-4">
        <CardHeader title="Financial pulse" hint={`${monthName} so far`} />
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <PulseMetric label="Income" value={v.pulse.income} color="#0F766E" icon={ArrowUpRight} />
          <PulseMetric label="Spent" value={v.pulse.spent} color="#E24B4A" icon={Wallet} />
          <PulseMetric label="Saved" value={v.pulse.saved} color="#1B3A6B" icon={Activity} />
          <PulseMetric label="EMIs" value={v.pulse.emis} color="#1B3A6B" icon={CalendarClock} />
          <PulseMetric label="Subscriptions" value={v.pulse.subscriptions} color="#6D28D9" icon={Coins} />
          <PulseMetric label="To collect" value={v.pulse.toCollect} color="#2BA8E0" icon={Inbox} />
          <PulseMetric label="Investments" value={v.pulse.investments} color="#1B3A6B" icon={Landmark} />
        </div>
      </section>
    </div>
  );
}

// ── Sub-components ──

function VitalCard({
  label,
  color,
  value,
  valueSuffix,
  sub,
  trend,
  onClick,
}: {
  label: string;
  color: string;
  value: string;
  valueSuffix?: string;
  sub: string;
  trend: number[];
  onClick?: () => void;
}) {
  const cls =
    "bg-white rounded-xl border-[0.5px] border-black/10 p-4 flex flex-col text-left w-full" +
    (onClick ? " hover:border-navy/30 cursor-pointer transition-colors" : "");
  const inner = (
    <>
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color }}>
          {label}
        </span>
        <Sparkline data={trend} color={color} />
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-[26px] font-medium text-navy leading-none tabular-nums">{value}</span>
        {valueSuffix && <span className="text-[13px] text-slate-400">{valueSuffix}</span>}
      </div>
      <p className="mt-1.5 text-[12px] text-slate-500 flex items-center gap-1">
        {sub}
        {onClick && <ArrowUpRight size={12} className="text-slate-400" />}
      </p>
    </>
  );
  return onClick ? (
    <button onClick={onClick} className={cls}>{inner}</button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function PriorityRow({
  task,
  today,
  onToggle,
}: {
  task: Task;
  today: string;
  onToggle: (id: string, completed: boolean) => void;
}) {
  const urgency = urgencyOf(task, today);
  const badge = CATEGORY_BADGE[task.category];
  const dueLabel =
    task.dueDate === today
      ? task.dueTime
        ? `Today ${task.dueTime}`
        : "Today"
      : task.dueDate < today
      ? `Overdue · ${task.dueDate}`
      : task.dueDate === addDays(today, 1)
      ? `Tomorrow${task.dueTime ? " " + task.dueTime : ""}`
      : task.dueDate;

  return (
    <li
      className="flex items-center gap-3 rounded-lg border-[0.5px] border-black/10 bg-white pl-3 pr-3 py-2.5"
      style={{ borderLeft: `3px solid ${URGENCY_BORDER[urgency]}` }}
    >
      <button
        onClick={() => onToggle(task.id, task.completed)}
        aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
        className="text-slate-400 hover:text-navy transition-colors shrink-0"
      >
        {task.completed ? <CheckSquare size={18} className="text-finance" /> : <Square size={18} />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-navy truncate">{task.title}</div>
        <div className="text-[11px] text-slate-400">{dueLabel}</div>
      </div>
      <span
        className="text-[10px] font-medium px-2 py-0.5 rounded-full capitalize shrink-0"
        style={{ background: badge.bg, color: badge.fg }}
      >
        {task.category}
      </span>
    </li>
  );
}

function PulseMetric({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-lg border-[0.5px] border-black/10 p-3 bg-surface">
      <div className="flex items-center gap-1.5">
        <Icon size={13} style={{ color }} />
        <span className="text-[11px] text-slate-500">{label}</span>
      </div>
      <div className="mt-1 text-[15px] font-medium text-navy tabular-nums">{formatINR(value)}</div>
    </div>
  );
}

function CardHeader({
  title,
  hint,
  actionLabel,
  onAction,
}: {
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[14px] font-medium text-navy">{title}</h2>
        {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
      </div>
      {actionLabel && onAction && (
        <button onClick={onAction} className="text-[12px] font-medium text-pulse hover:underline">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="mt-3 flex flex-col items-center text-center py-8 px-4">
      <div className="w-10 h-10 rounded-lg bg-navy/5 flex items-center justify-center">
        <Icon size={18} className="text-navy/50" />
      </div>
      <p className="mt-3 text-[13px] font-medium text-navy">{title}</p>
      <p className="mt-1 text-[12px] text-slate-500 max-w-xs">{body}</p>
      <button
        onClick={onAction}
        className="mt-3 h-9 px-4 rounded-lg bg-navy text-white text-[12px] font-medium hover:bg-navy/90 transition-colors"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      <div className="h-6 w-40 rounded bg-slate-200/70" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border-[0.5px] border-black/10 p-4 h-28">
            <div className="h-3 w-20 rounded bg-slate-100" />
            <div className="mt-4 h-6 w-16 rounded bg-slate-100" />
            <div className="mt-3 h-2.5 w-24 rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="bg-white rounded-xl border-[0.5px] border-black/10 p-4 h-52" />
        ))}
      </div>
      <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4 h-28" />
    </div>
  );
}
