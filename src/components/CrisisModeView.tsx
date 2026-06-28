import { Flame, X, Zap, Clock, Check, CalendarClock, ArrowRight } from "lucide-react";
import Logo from "./Logo";
import { ACTION_MINUTES, type Bucket, type Triage } from "../lib/crisis";
import { addDays } from "../lib/dashboard";
import type { Task } from "../types";

interface CrisisModeViewProps {
  clustered: Task[];
  triage: Triage | null;
  loading: boolean;
  today: string;
  resolved: Record<string, string>; // taskId -> "block" | "defer" | "drop" | "keep"
  onBlockTime: (t: Task) => void;
  onDefer: (t: Task) => void;
  onDrop: (t: Task) => void;
  onKeep: (t: Task) => void;
  onExit: () => void;
}

const BUCKETS: { id: Bucket; label: string; color: string; blurb: string }[] = [
  { id: "do_now", label: "Do now", color: "#E24B4A", blurb: "Critical — handle immediately" },
  { id: "defer", label: "Defer", color: "#6366F1", blurb: "Can wait without penalty" },
  { id: "drop", label: "Drop", color: "#22C55E", blurb: "Low impact — let it go" },
];

function dueLabel(t: Task, today: string): string {
  if (t.dueDate < today) return `Overdue · ${t.dueDate}`;
  if (t.dueDate === today) return t.dueTime ? `Today ${t.dueTime}` : "Today";
  if (t.dueDate === addDays(today, 1)) return t.dueTime ? `Tomorrow ${t.dueTime}` : "Tomorrow";
  return t.dueDate;
}

function formatMins(m: number): string {
  if (m <= 0) return "0m";
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}

export default function CrisisModeView({
  clustered,
  triage,
  loading,
  today,
  resolved,
  onBlockTime,
  onDefer,
  onDrop,
  onKeep,
  onExit,
}: CrisisModeViewProps) {
  const bucketOf = (t: Task): Bucket => triage?.classifications[t.id]?.bucket ?? "defer";
  const reasonOf = (t: Task): string => triage?.classifications[t.id]?.reason ?? "";

  const resolvedCount = Object.keys(resolved).length;
  const minutesSaved = Object.values(resolved).reduce((s, a) => s + (ACTION_MINUTES[a] ?? 0), 0);

  const primaryFor = (bucket: Bucket, t: Task) => {
    if (bucket === "do_now") return { label: "Block time now", icon: Zap, run: () => onBlockTime(t) };
    if (bucket === "defer") return { label: "Defer 1 week", icon: CalendarClock, run: () => onDefer(t) };
    return { label: "Drop it", icon: Check, run: () => onDrop(t) };
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1B1B2E] text-white overflow-y-auto scrollbar-thin flex flex-col">
      {/* Red header */}
      <div className="bg-[#E24B4A] px-4 sm:px-6 py-3 flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
          <Flame size={20} className="text-white animate-pulse" />
        </div>
        <div className="min-w-0">
          <div className="text-[15px] font-medium leading-tight">Crisis mode</div>
          <div className="text-[12px] text-white/80 leading-tight">
            {clustered.length} deadline{clustered.length === 1 ? "" : "s"} within the next 48 hours
          </div>
        </div>
        <button
          onClick={onExit}
          aria-label="Exit crisis mode"
          className="ml-auto w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/15 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Triage reasoning */}
      <div className="px-4 sm:px-6 pt-5">
        <div className="max-w-5xl mx-auto rounded-xl bg-[#252539] border-[0.5px] border-white/10 p-4 flex items-start gap-3">
          <Logo size={32} withSquare={false} />
          <div className="min-w-0">
            <div className="text-[12px] font-medium text-pulse">Finia's triage</div>
            {loading ? (
              <div className="flex items-center gap-2 mt-1 text-[13px] text-white/60">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analysing your deadlines…
              </div>
            ) : (
              <p className="text-[13px] text-white/85 leading-relaxed mt-0.5">{triage?.reasoning}</p>
            )}
          </div>
        </div>
      </div>

      {/* Three buckets */}
      <div className="flex-1 px-4 sm:px-6 py-5">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
          {BUCKETS.map((b) => {
            const items = clustered.filter((t) => bucketOf(t) === b.id);
            return (
              <div key={b.id} className="flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: b.color }} />
                  <span className="text-[13px] font-medium" style={{ color: b.color }}>{b.label}</span>
                  <span className="text-[11px] text-white/40">{items.length}</span>
                </div>
                <div className="text-[11px] text-white/40 mb-3">{b.blurb}</div>

                <div className="space-y-2.5">
                  {items.length === 0 && (
                    <div className="text-[12px] text-white/30 rounded-lg border-[0.5px] border-dashed border-white/10 px-3 py-4 text-center">
                      Nothing here
                    </div>
                  )}
                  {items.map((t) => {
                    const done = resolved[t.id];
                    const primary = primaryFor(b.id, t);
                    const PrimaryIcon = primary.icon;
                    return (
                      <div
                        key={t.id}
                        className={`rounded-xl bg-[#252539] border-[0.5px] p-3 transition-opacity ${done ? "opacity-50" : ""}`}
                        style={{ borderColor: `${b.color}55` }}
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: b.color }} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-medium text-white">{t.title}</div>
                            <div className="text-[11px] text-white/45">{dueLabel(t, today)} · {t.category}</div>
                          </div>
                        </div>
                        {reasonOf(t) && (
                          <p className="mt-2 text-[12px] text-white/65 leading-relaxed">{reasonOf(t)}</p>
                        )}

                        {done ? (
                          <div className="mt-3 flex items-center gap-1.5 text-[12px]" style={{ color: b.color }}>
                            <Check size={14} /> {done === "keep" ? "Kept" : done === "block" ? "Time blocked" : done === "defer" ? "Deferred 1 week" : "Dropped"}
                          </div>
                        ) : (
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              onClick={primary.run}
                              className="h-8 px-3 rounded-lg text-[12px] font-medium text-white flex items-center gap-1.5 transition-opacity hover:opacity-90"
                              style={{ background: b.color }}
                            >
                              <PrimaryIcon size={13} /> {primary.label}
                            </button>
                            <button
                              onClick={() => onKeep(t)}
                              className="h-8 px-3 rounded-lg text-[12px] text-white/60 border-[0.5px] border-white/15 hover:bg-white/5 transition-colors"
                            >
                              Keep as is
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-[#15151f] border-t-[0.5px] border-white/10 px-4 sm:px-6 py-3 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2 text-[12px] text-white/70">
          <Clock size={15} className="text-pulse" />
          Est. time saved <span className="text-white font-medium tabular-nums">{formatMins(minutesSaved)}</span>
        </div>
        <div className="text-[12px] text-white/70">
          Crisis score <span className="text-white font-medium tabular-nums">{resolvedCount}/{clustered.length} resolved</span>
        </div>
        <button
          onClick={onExit}
          className="ml-auto h-9 px-4 rounded-lg bg-[#fff] text-[#1B1B2E] text-[13px] font-medium flex items-center gap-1.5 hover:bg-white/90 transition-colors"
        >
          Exit crisis mode <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
