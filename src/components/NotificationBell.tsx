import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Wallet, Coins, CheckSquare, Flame, Mail, Check, type LucideIcon } from "lucide-react";
import { useUserCollection } from "../lib/useUserCollection";
import { useFinanceData } from "../lib/useFinanceData";
import { useAuth } from "../lib/auth";
import { ymd } from "../lib/dashboard";
import { computeDerivedNotifications, markAllRead, markRead, relativeTime, writeDerived } from "../lib/notifications";
import { navigate } from "../lib/router";
import type { FiniaNotification, NotificationType } from "../types";

const STYLE: Record<NotificationType, { color: string; icon: LucideIcon }> = {
  finance: { color: "#D97706", icon: Wallet },
  tax: { color: "#6D28D9", icon: Coins },
  task: { color: "#2563EB", icon: CheckSquare },
  crisis: { color: "#E24B4A", icon: Flame },
  gmail: { color: "#2BA8E0", icon: Mail },
};

/** Presentational bell + dropdown — pure UI, driven entirely by props. */
export function NotificationView({
  items,
  onTap,
  onMarkAll,
  initialOpen = false,
}: {
  items: FiniaNotification[];
  onTap: (n: FiniaNotification) => void;
  onMarkAll: () => void;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const sorted = useMemo(
    () => [...items].sort((a, b) => (b.createdAt?.seconds || Infinity) - (a.createdAt?.seconds || Infinity)),
    [items]
  );
  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-surface hover:text-navy transition-colors"
      >
        <Bell size={18} />
        {unread > 1 ? (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-pulse text-white text-[10px] font-medium flex items-center justify-center tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : unread === 1 ? (
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-pulse" />
        ) : null}
      </button>

      {open && (
        <>
          {/* Click-outside catcher */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 z-50 w-[min(360px,calc(100vw-2rem))] bg-white rounded-xl border-[0.5px] border-black/10 overflow-hidden">
            <div className="flex items-center justify-between px-3 h-11 border-b-[0.5px] border-black/10">
              <span className="text-[13px] font-medium text-navy">Notifications</span>
              {unread > 0 && (
                <button onClick={onMarkAll} className="text-[11px] font-medium text-pulse hover:underline">
                  Mark all as read
                </button>
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
              {sorted.length === 0 ? (
                <div className="flex flex-col items-center text-center py-10 px-4">
                  <div className="w-10 h-10 rounded-lg bg-finance/10 flex items-center justify-center">
                    <Check size={18} className="text-finance" />
                  </div>
                  <p className="mt-3 text-[13px] font-medium text-navy">You're all caught up</p>
                  <p className="mt-1 text-[12px] text-slate-500">New bills, tasks, and alerts will show up here.</p>
                </div>
              ) : (
                <ul>
                  {sorted.map((n) => {
                    const s = STYLE[n.type] || STYLE.finance;
                    const Icon = s.icon;
                    return (
                      <Fragment key={n.id}>
                        <li>
                          <button
                            onClick={() => { setOpen(false); onTap(n); }}
                            className={`w-full text-left flex items-start gap-3 px-3 py-2.5 border-b-[0.5px] border-black/5 hover:bg-surface transition-colors ${n.read ? "" : "bg-pulse/5"}`}
                          >
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${s.color}1A` }}>
                              <Icon size={15} style={{ color: s.color }} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[12px] font-medium text-navy truncate flex-1">{n.title}</span>
                                {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-pulse shrink-0" />}
                              </div>
                              <div className="text-[12px] text-slate-500 leading-snug">{n.body}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">{relativeTime(n.createdAt?.seconds)}</div>
                            </div>
                          </button>
                        </li>
                      </Fragment>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Container: live notifications + idempotent derived generation from real data. */
export default function NotificationBell({ uid }: { uid: string }) {
  const { items } = useUserCollection<FiniaNotification>("notifications", uid);
  const { profile } = useAuth();
  const data = useFinanceData(uid);
  const today = ymd(new Date());
  const leadDays = Number((profile?.prefs as any)?.notifications?.reminderLeadDays ?? 3);

  // Generate derived notifications from real data. Idempotent: deterministic ids
  // mean an already-existing (even read) notification is never recreated.
  const writing = useRef(false);
  useEffect(() => {
    if (data.loading || writing.current) return;
    const existing = new Set<string>(items.map((n) => n.id));
    const toCreate = computeDerivedNotifications(
      { bills: data.bills, tasks: data.tasks, paymentInstances: data.paymentInstances },
      today,
      leadDays,
      existing
    );
    if (toCreate.length) {
      writing.current = true;
      // Non-fatal: a missing notifications rule shouldn't spam unhandled rejections.
      writeDerived(uid, toCreate)
        .catch((e) => console.warn("Notification write skipped (deploy firestore.rules for notifications):", e))
        .finally(() => { writing.current = false; });
    }
  }, [uid, data.loading, data.bills, data.tasks, data.paymentInstances, items, leadDays, today]);

  const onTap = async (n: FiniaNotification) => {
    if (!n.read) await markRead(n.id).catch(() => {});
    if (n.link) navigate(n.link);
  };
  const onMarkAll = () => markAllRead(items.filter((n) => !n.read).map((n) => n.id));

  return <NotificationView items={items} onTap={onTap} onMarkAll={onMarkAll} />;
}
