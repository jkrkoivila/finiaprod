import { useMemo, useState, Fragment } from "react";
import {
  type CalendarItem,
  type CalItemType,
  colorOf,
  groupByDate,
  monthMatrix,
  weekDates,
  WEEKDAY_LABELS,
  MONTH_LABELS,
  TYPE_COLOR,
  TYPE_LABEL,
} from "../lib/calendar";

type CalView = "month" | "week" | "agenda";

const LEGEND: CalItemType[] = ["task", "bill", "tax", "focus", "reminder"];

const fmtAmount = (n?: number) => (typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : "");

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${WEEKDAY_LABELS[(new Date(y, m - 1, d).getDay() + 6) % 7]}, ${d} ${MONTH_LABELS[m - 1].slice(0, 3)}`;
}

export interface CalendarViewProps {
  items: CalendarItem[];
  today: string;
  loading?: boolean;
  syncing?: boolean;
  lastSynced?: string | null;
  syncError?: string | null;
  onOpenItem: (item: CalendarItem) => void;
  onAddTask?: () => void;
  onSyncGmail?: () => void;
  onSyncGoogle?: () => void;
}

export default function CalendarView(props: CalendarViewProps) {
  const { items, today, loading, onOpenItem } = props;
  const [view, setView] = useState<CalView>("month");
  const [ty, tm] = useMemo(() => today.split("-").map(Number), [today]);
  const [anchor, setAnchor] = useState({ y: ty, m0: tm - 1 }); // month anchor
  const [selected, setSelected] = useState<string>(today);

  const byDate = useMemo(() => groupByDate(items), [items]);

  const shiftMonth = (delta: number) => {
    const d = new Date(anchor.y, anchor.m0 + delta, 1);
    setAnchor({ y: d.getFullYear(), m0: d.getMonth() });
  };
  const goToday = () => {
    setAnchor({ y: ty, m0: tm - 1 });
    setSelected(today);
  };

  const title =
    view === "agenda"
      ? "Upcoming"
      : view === "week"
        ? weekRangeLabel(selected)
        : `${MONTH_LABELS[anchor.m0]} ${anchor.y}`;

  const hasAny = items.length > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-[20px] font-semibold text-navy min-w-[150px]">{title}</h1>
          {view !== "agenda" && (
            <div className="flex items-center gap-1">
              <button onClick={() => (view === "week" ? shiftWeek(-1) : shiftMonth(-1))} className="w-8 h-8 grid place-items-center rounded-lg border-[0.5px] border-black/15 text-slate-600 hover:bg-black/5" aria-label="Previous">‹</button>
              <button onClick={() => (view === "week" ? shiftWeek(1) : shiftMonth(1))} className="w-8 h-8 grid place-items-center rounded-lg border-[0.5px] border-black/15 text-slate-600 hover:bg-black/5" aria-label="Next">›</button>
              <button onClick={goToday} className="h-8 px-3 rounded-lg border-[0.5px] border-black/15 text-[12px] text-slate-700 hover:bg-black/5">Today</button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border-[0.5px] border-black/15 overflow-hidden text-[12px]">
            {(["month", "week", "agenda"] as CalView[]).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`px-3 h-8 capitalize ${view === v ? "bg-navy text-white" : "text-slate-600 hover:bg-black/5"}`}>{v}</button>
            ))}
          </div>
          {props.onSyncGoogle && (
            <button onClick={props.onSyncGoogle} disabled={props.syncing} className="h-8 px-3 rounded-lg bg-pulse text-white text-[12px] font-medium hover:opacity-90 disabled:opacity-60">
              {props.syncing ? "Syncing…" : "Sync to Google"}
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4 text-[11px] text-slate-500">
        {LEGEND.map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: TYPE_COLOR[t] }} />
            {TYPE_LABEL[t]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-crisis" />Overdue</span>
        {props.syncError && <span className="text-crisis">{props.syncError}</span>}
        {props.lastSynced && !props.syncError && <span className="text-finance">Synced to Google · {props.lastSynced}</span>}
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400 text-[13px]">Loading your calendar…</div>
      ) : !hasAny ? (
        <EmptyState onAddTask={props.onAddTask} onSyncGmail={props.onSyncGmail} />
      ) : view === "agenda" ? (
        <Agenda items={items} today={today} onOpenItem={onOpenItem} />
      ) : view === "week" ? (
        <WeekGrid anchorISO={selected} byDate={byDate} today={today} onSelect={setSelected} onOpenItem={onOpenItem} selected={selected} />
      ) : (
        <>
          <MonthGrid anchor={anchor} byDate={byDate} today={today} selected={selected} onSelect={setSelected} />
          <DayPanel date={selected} items={byDate.get(selected) || []} today={today} onOpenItem={onOpenItem} />
        </>
      )}
    </div>
  );

  function shiftWeek(delta: number) {
    const [y, m, d] = selected.split("-").map(Number);
    const dt = new Date(y, m - 1, d + delta * 7);
    setSelected(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`);
  }
}

function weekRangeLabel(anchorISO: string): string {
  const w = weekDates(anchorISO);
  const a = w[0].split("-").map(Number);
  const b = w[6].split("-").map(Number);
  return `${a[2]} ${MONTH_LABELS[a[1] - 1].slice(0, 3)} – ${b[2]} ${MONTH_LABELS[b[1] - 1].slice(0, 3)}`;
}

function Dots({ items }: { items: CalendarItem[] }) {
  if (!items.length) return null;
  const shown = items.slice(0, 4);
  return (
    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
      {shown.map((it) => <span key={it.id} className="w-1.5 h-1.5 rounded-full" style={{ background: colorOf(it) }} />)}
      {items.length > 4 && <span className="text-[9px] leading-none text-slate-400">+{items.length - 4}</span>}
    </div>
  );
}

function MonthGrid({ anchor, byDate, today, selected, onSelect }: {
  anchor: { y: number; m0: number }; byDate: Map<string, CalendarItem[]>; today: string; selected: string; onSelect: (d: string) => void;
}) {
  const cells = monthMatrix(anchor.y, anchor.m0);
  return (
    <div className="rounded-xl border-[0.5px] border-black/15 bg-white overflow-hidden">
      <div className="grid grid-cols-7 border-b-[0.5px] border-black/10 bg-surface">
        {WEEKDAY_LABELS.map((w) => <div key={w} className="px-2 py-2 text-[11px] font-medium text-slate-500 text-center">{w}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((iso, i) => {
          if (!iso) return <div key={`b${i}`} className="min-h-[64px] md:min-h-[88px] border-[0.25px] border-black/5 bg-surface/40" />;
          const dayItems = byDate.get(iso) || [];
          const isToday = iso === today;
          const isSel = iso === selected;
          const day = Number(iso.split("-")[2]);
          const hasOverdue = dayItems.some((d) => d.overdue);
          return (
            <button key={iso} onClick={() => onSelect(iso)}
              className={`min-h-[64px] md:min-h-[88px] border-[0.25px] border-black/5 p-1.5 text-left align-top hover:bg-black/[0.03] ${isSel ? "ring-2 ring-inset ring-navy/40" : ""}`}>
              <div className="flex items-center justify-between">
                <span className={`text-[12px] grid place-items-center w-6 h-6 rounded-full ${isToday ? "bg-navy text-white font-semibold" : hasOverdue ? "text-crisis font-medium" : "text-slate-700"}`}>{day}</span>
                {dayItems.length > 1 && <span className="text-[10px] text-slate-400">{dayItems.length}</span>}
              </div>
              <Dots items={dayItems} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({ anchorISO, byDate, today, selected, onSelect, onOpenItem }: {
  anchorISO: string; byDate: Map<string, CalendarItem[]>; today: string; selected: string; onSelect: (d: string) => void; onOpenItem: (i: CalendarItem) => void;
}) {
  const days = weekDates(anchorISO);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
      {days.map((iso) => {
        const dayItems = byDate.get(iso) || [];
        const isToday = iso === today;
        return (
          <div key={iso} className={`rounded-xl border-[0.5px] bg-white p-2 min-h-[120px] ${isToday ? "border-navy/40" : "border-black/15"}`}>
            <button onClick={() => onSelect(iso)} className={`text-[11px] font-medium mb-1.5 ${isToday ? "text-navy" : "text-slate-500"}`}>{prettyDate(iso)}</button>
            <div className="flex flex-col gap-1">
              {dayItems.length === 0 && <span className="text-[11px] text-slate-300">—</span>}
              {dayItems.map((it) => <Fragment key={it.id}><ItemChip item={it} onOpenItem={onOpenItem} /></Fragment>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Agenda({ items, today, onOpenItem }: { items: CalendarItem[]; today: string; onOpenItem: (i: CalendarItem) => void }) {
  // Overdue (unfinished, past) first, then everything from today forward.
  const overdue = items.filter((i) => i.overdue);
  const upcoming = items.filter((i) => !i.overdue && i.date >= today);
  const groups = groupByDate(upcoming);
  const dates = [...groups.keys()].sort();
  return (
    <div className="flex flex-col gap-4">
      {overdue.length > 0 && (
        <div>
          <h3 className="text-[12px] font-semibold text-crisis mb-1.5 uppercase tracking-wide">Overdue</h3>
          <div className="flex flex-col gap-1">{overdue.map((it) => <Fragment key={it.id}><AgendaRow item={it} onOpenItem={onOpenItem} /></Fragment>)}</div>
        </div>
      )}
      {dates.length === 0 && overdue.length === 0 && <p className="text-[13px] text-slate-400 py-10 text-center">Nothing scheduled ahead.</p>}
      {dates.map((d) => (
        <div key={d}>
          <h3 className="text-[12px] font-semibold text-slate-500 mb-1.5">{d === today ? "Today" : prettyDate(d)}</h3>
          <div className="flex flex-col gap-1">{(groups.get(d) || []).map((it) => <Fragment key={it.id}><AgendaRow item={it} onOpenItem={onOpenItem} /></Fragment>)}</div>
        </div>
      ))}
    </div>
  );
}

function AgendaRow({ item, onOpenItem }: { item: CalendarItem; onOpenItem: (i: CalendarItem) => void }) {
  return (
    <button onClick={() => onOpenItem(item)} className="flex items-center gap-3 w-full text-left rounded-lg border-[0.5px] border-black/10 bg-white px-3 py-2 hover:bg-black/[0.03]">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colorOf(item) }} />
      <span className={`text-[13px] flex-1 truncate ${item.done ? "line-through text-slate-400" : "text-slate-800"}`}>{item.title}</span>
      {item.time && <span className="text-[11px] text-slate-400">{item.time}</span>}
      {item.amount != null && <span className="text-[12px] text-slate-600 tabular-nums">{fmtAmount(item.amount)}</span>}
      <span className="text-[10px] text-slate-400">{TYPE_LABEL[item.type]}</span>
    </button>
  );
}

function ItemChip({ item, onOpenItem }: { item: CalendarItem; onOpenItem: (i: CalendarItem) => void }) {
  return (
    <button onClick={() => onOpenItem(item)} className="flex items-center gap-1.5 w-full text-left rounded px-1.5 py-1 hover:bg-black/5">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: colorOf(item) }} />
      <span className={`text-[11px] truncate ${item.done ? "line-through text-slate-400" : "text-slate-700"}`}>{item.title}</span>
    </button>
  );
}

function DayPanel({ date, items, today, onOpenItem }: { date: string; items: CalendarItem[]; today: string; onOpenItem: (i: CalendarItem) => void }) {
  return (
    <div className="mt-4 rounded-xl border-[0.5px] border-black/15 bg-white p-4">
      <h3 className="text-[13px] font-semibold text-navy mb-2">{date === today ? "Today" : prettyDate(date)}</h3>
      {items.length === 0 ? (
        <p className="text-[12px] text-slate-400">No items on this day.</p>
      ) : (
        <div className="flex flex-col gap-1">{items.map((it) => <Fragment key={it.id}><AgendaRow item={it} onOpenItem={onOpenItem} /></Fragment>)}</div>
      )}
    </div>
  );
}

function EmptyState({ onAddTask, onSyncGmail }: { onAddTask?: () => void; onSyncGmail?: () => void }) {
  return (
    <div className="rounded-xl border-[0.5px] border-black/15 bg-white py-16 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-surface grid place-items-center mx-auto mb-3 text-navy text-[22px]">📅</div>
      <h2 className="text-[16px] font-semibold text-navy mb-1">Your calendar is clear</h2>
      <p className="text-[13px] text-slate-500 max-w-sm mx-auto mb-5">
        Once you add tasks, bills, or recurring payments — or import them from Gmail — they'll show up here automatically, color-coded by type.
      </p>
      <div className="flex items-center justify-center gap-2">
        {onAddTask && <button onClick={onAddTask} className="h-9 px-4 rounded-lg bg-navy text-white text-[13px] font-medium hover:opacity-90">Add a task</button>}
        {onSyncGmail && <button onClick={onSyncGmail} className="h-9 px-4 rounded-lg border-[0.5px] border-black/15 text-[13px] text-slate-700 hover:bg-black/5">Import from Gmail</button>}
      </div>
    </div>
  );
}
