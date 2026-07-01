import { PanelLeft, RefreshCw, Plus } from "lucide-react";
import Logo from "./Logo";
import NotificationBell from "./NotificationBell";

interface TopBarProps {
  onToggleSidebar: () => void;
  uid: string;
  name: string;
  lastSynced: string | null;
  syncing: boolean;
  /** Result/error of the last sync (e.g. "Found 2 bills, 1 deadline"). */
  note?: string | null;
  noteError?: boolean;
  /**
   * Latest syncRun detail line: branch + scan count.
   * E.g. "first-90d · scanned 247 msgs" — surfaced under the sync note
   * so "no items found" is never ambiguous.
   */
  syncDetail?: string | null;
  onSync: () => void;
  onAddTask: () => void;
}

function timeGreeting(d: Date) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function TopBar({
  onToggleSidebar,
  uid,
  name,
  lastSynced,
  syncing,
  note,
  noteError,
  syncDetail,
  onSync,
  onAddTask,
}: TopBarProps) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Sub-label: show syncDetail when it's available and there's no error to take priority.
  const subLabel = syncing
    ? "Syncing…"
    : note
    ? noteError
      ? note
      : `${note}${lastSynced ? ` · ${lastSynced}` : ""}`
    : lastSynced
    ? `Last synced ${lastSynced}`
    : "Not synced yet";

  return (
    <header className="h-16 shrink-0 bg-white border-b-[0.5px] border-black/10 flex items-center justify-between gap-3 px-3 sm:px-5">
      {/* Left: collapse toggle + greeting */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          className="hidden md:flex w-9 h-9 items-center justify-center rounded-lg text-slate-500 hover:bg-surface hover:text-navy transition-colors"
        >
          <PanelLeft size={18} />
        </button>

        {/* Brand mark on mobile (sidebar is hidden there) */}
        <div className="md:hidden">
          <Logo size={32} />
        </div>

        <div className="leading-tight min-w-0">
          <div className="text-[15px] font-medium text-navy truncate">
            {timeGreeting(now)}, {name}
          </div>
          <div className="text-[11px] text-slate-500 truncate">{dateStr}</div>
        </div>
      </div>

      {/* Right: sync, add task, notifications */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={onSync}
          disabled={syncing}
          className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-lg border-[0.5px] border-black/10 hover:bg-surface transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <RefreshCw
            size={14}
            className={syncing ? "animate-spin text-pulse" : "text-slate-500"}
          />
          <span className="flex flex-col items-start leading-none">
            <span className="text-[12px] text-navy font-medium">Sync now</span>
            <span className={`text-[10px] mt-0.5 ${noteError ? "text-crisis" : "text-slate-400"}`}>
              {subLabel}
            </span>
            {/* Detail line: branch + scan count — only shown when not an error */}
            {!syncing && !noteError && syncDetail && (
              <span className="text-[9px] mt-0.5 text-slate-300 truncate max-w-[140px]">
                {syncDetail}
              </span>
            )}
          </span>
        </button>

        <button
          onClick={onAddTask}
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-navy text-white text-[12px] font-medium hover:bg-navy/90 transition-colors"
        >
          <Plus size={15} />
          <span className="hidden sm:inline">Add task</span>
        </button>

        <NotificationBell uid={uid} />
      </div>
    </header>
  );
}
