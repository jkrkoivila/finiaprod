import { useMemo, useState, type ReactNode } from "react";
import { Users, LayoutDashboard, SlidersHorizontal, Search, Trash2, RotateCcw, Ban, ArrowLeftRight, ShieldCheck, Crown } from "lucide-react";
import { formatINR } from "../lib/dashboard";
import { FEATURE_LABELS, FEATURE_KEYS, type AppSettings, type FeatureKey, type FeatureState } from "../lib/settings";
import type { AdminStats, AdminUser } from "../lib/adminApi";

interface AdminPanelProps {
  users: AdminUser[];
  stats: AdminStats;
  taskCount: number;
  billCount: number;
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void | Promise<void>;
  onSuspend: (user: AdminUser, suspended: boolean) => void | Promise<void>;
  onResetOnboarding: (uid: string) => void | Promise<void>;
  onChangePlan: (uid: string, plan: string) => void | Promise<void>;
  onDeleteUser: (user: AdminUser) => void | Promise<void>;
  onExit: () => void;
}

type Tab = "dashboard" | "users" | "settings";
const fmtDate = (ts: any) => (ts?.toDate ? ts.toDate().toLocaleDateString("en-IN") : ts?.seconds ? new Date(ts.seconds * 1000).toLocaleDateString("en-IN") : "—");

export default function AdminPanel(props: AdminPanelProps) {
  const [tab, setTab] = useState<Tab>("dashboard");
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-tax" />
          <h1 className="text-[20px] font-medium text-navy">Admin</h1>
        </div>
        <button onClick={props.onExit} className="h-8 px-3 rounded-lg border-[0.5px] border-black/15 text-[12px] text-slate-600 hover:bg-surface">Back to app</button>
      </div>

      <div className="flex rounded-lg border-[0.5px] border-black/10 bg-white p-0.5 w-fit">
        {([
          { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
          { id: "users", label: "Users", icon: Users },
          { id: "settings", label: "System settings", icon: SlidersHorizontal },
        ] as { id: Tab; label: string; icon: any }[]).map((t) => {
          const Icon = t.icon;
          return <button key={t.id} onClick={() => setTab(t.id)} className={`h-8 px-3 rounded-md text-[12px] font-medium flex items-center gap-1.5 ${tab === t.id ? "bg-navy text-white" : "text-slate-500 hover:text-navy"}`}><Icon size={14} /> {t.label}</button>;
        })}
      </div>

      {tab === "dashboard" && <Dashboard {...props} />}
      {tab === "users" && <UsersTab {...props} />}
      {tab === "settings" && <SettingsTab settings={props.settings} onUpdate={props.onUpdateSettings} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1.5 text-[22px] font-medium text-navy tabular-nums">{value}</div>
    </div>
  );
}

function Dashboard({ stats, taskCount, billCount }: AdminPanelProps) {
  const max = Math.max(1, ...stats.signups.map((s) => s.count));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total users" value={stats.total} />
        <Stat label="Active this week" value={stats.activeThisWeek} />
        <Stat label="New signups (7d)" value={stats.newThisWeek} />
        <Stat label="Onboarded" value={`${stats.total ? Math.round((stats.onboarded / stats.total) * 100) : 0}%`} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Stat label="Total tasks" value={taskCount} />
        <Stat label="Total bills" value={billCount} />
      </div>
      <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4">
        <h2 className="text-[13px] font-medium text-navy mb-3">Signups over time</h2>
        <div className="flex items-end gap-3 h-32">
          {stats.signups.map((s) => (
            <div key={s.label} className="flex-1 flex flex-col items-center justify-end h-full">
              <span className="text-[11px] text-slate-500 mb-1 tabular-nums">{s.count}</span>
              <div className="w-full rounded-t-md bg-navy" style={{ height: `${Math.max(4, (s.count / max) * 100)}%` }} />
              <span className="text-[10px] text-slate-400 mt-1.5">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function UsersTab({ users, onSuspend, onResetOnboarding, onChangePlan, onDeleteUser }: AdminPanelProps) {
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<AdminUser | null>(null);
  const filtered = useMemo(() => {
    const t = q.toLowerCase();
    return users.filter((u) => !t || (u.name || "").toLowerCase().includes(t) || (u.email || "").toLowerCase().includes(t));
  }, [users, q]);

  return (
    <div className="space-y-3">
      <div className="relative w-full sm:w-80">
        <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…" className="w-full h-9 pl-8 pr-3 rounded-lg border-[0.5px] border-black/15 text-[13px] outline-none focus:border-navy" />
      </div>
      <div className="bg-white rounded-xl border-[0.5px] border-black/10 overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-slate-400 border-b-[0.5px] border-black/10">
              <th className="font-normal px-3 py-2">User</th><th className="font-normal px-3 py-2">Signup</th><th className="font-normal px-3 py-2">Last active</th>
              <th className="font-normal px-3 py-2">Onboarded</th><th className="font-normal px-3 py-2">Plan</th><th className="font-normal px-3 py-2">Role</th><th className="font-normal px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.uid} className={`border-b-[0.5px] border-black/5 ${u.suspended ? "opacity-50" : ""}`}>
                <td className="px-3 py-2"><div className="text-navy font-medium flex items-center gap-1.5">{u.name || "—"}{u.isDefaultAdmin && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-tax/10 text-tax inline-flex items-center gap-0.5"><ShieldCheck size={10} /> Protected</span>}{u.suspended && <span className="text-[10px] text-crisis">suspended</span>}</div><div className="text-slate-400">{u.email}</div></td>
                <td className="px-3 py-2 text-slate-500">{fmtDate(u.createdAt)}</td>
                <td className="px-3 py-2 text-slate-500">{fmtDate(u.lastActive)}</td>
                <td className="px-3 py-2">{u.onboarded ? <span className="text-finance">Yes</span> : <span className="text-slate-400">No</span>}</td>
                <td className="px-3 py-2 capitalize">{u.plan || "free"}</td>
                <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${u.role === "admin" ? "bg-tax/10 text-tax" : "bg-slate-100 text-slate-500"}`}>{u.role || "user"}</span></td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    {/* Default admin: Suspend + Delete are hidden (protected). */}
                    {!u.isDefaultAdmin && <IconBtn title={u.suspended ? "Unsuspend" : "Suspend"} onClick={() => onSuspend(u, !u.suspended)}><Ban size={14} /></IconBtn>}
                    <IconBtn title="Reset onboarding" onClick={() => onResetOnboarding(u.uid)}><RotateCcw size={14} /></IconBtn>
                    <IconBtn title="Toggle plan" onClick={() => onChangePlan(u.uid, (u.plan || "free") === "free" ? "pro" : "free")}><ArrowLeftRight size={14} /></IconBtn>
                    {!u.isDefaultAdmin && <IconBtn title="Delete" danger onClick={() => setConfirm(u)}><Trash2 size={14} /></IconBtn>}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">No users.</td></tr>}
          </tbody>
        </table>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/30" onClick={() => setConfirm(null)}>
          <div className="w-full max-w-sm bg-white rounded-xl border-[0.5px] border-black/10 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-[14px] font-medium text-navy">Delete {confirm.name || confirm.email}?</div>
            <p className="text-[12px] text-slate-500 mt-1">This removes their profile document. This can't be undone.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setConfirm(null)} className="h-9 px-3 rounded-lg border-[0.5px] border-black/15 text-[12px] text-slate-600 hover:bg-surface">Cancel</button>
              <button onClick={() => { onDeleteUser(confirm); setConfirm(null); }} className="h-9 px-3 rounded-lg bg-crisis text-white text-[12px] font-medium hover:bg-crisis/90">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, title, onClick, danger }: { children: ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return <button title={title} onClick={onClick} className={`w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 ${danger ? "hover:bg-crisis/10 hover:text-crisis" : "hover:bg-surface hover:text-navy"}`}>{children}</button>;
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${on ? "bg-finance" : "bg-slate-300"}`} role="switch" aria-checked={on}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${on ? "left-4" : "left-0.5"}`} />
    </button>
  );
}

const STATE_BADGE: Record<FeatureState, { label: string; cls: string }> = {
  everyone: { label: "Everyone", cls: "bg-finance/10 text-finance" },
  pro: { label: "Pro only", cls: "bg-[#D97706]/10 text-[#D97706]" },
  nobody: { label: "Nobody", cls: "bg-crisis/10 text-crisis" },
};

function SettingsTab({ settings, onUpdate }: { settings: AppSettings; onUpdate: (p: Partial<AppSettings>) => void | Promise<void> }) {
  const setState = (k: FeatureKey, v: FeatureState) => onUpdate({ featureAccess: { ...settings.featureAccess, [k]: v } });
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4">
        <h2 className="text-[13px] font-medium text-navy mb-1">Feature access</h2>
        <p className="text-[11px] text-slate-400 mb-3">Per feature: <b>Everyone</b> (all users), <b>Pro only</b> (paid users see it; free users get an upgrade prompt), or <b>Nobody</b> (off for all). The Admin panel is always admin-only.</p>
        <div className="space-y-2">
          {FEATURE_KEYS.map((k) => {
            const state = settings.featureAccess[k];
            const badge = STATE_BADGE[state];
            return (
              <div key={k} className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-navy flex-1">{FEATURE_LABELS[k]}</span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${badge.cls}`}>
                  {state === "pro" && <Crown size={10} />}{badge.label}
                </span>
                <select value={state} onChange={(e) => setState(k, e.target.value as FeatureState)} className="h-8 px-2 rounded-lg border-[0.5px] border-black/15 text-[12px] outline-none focus:border-navy">
                  <option value="everyone">Everyone</option>
                  <option value="pro">Pro only</option>
                  <option value="nobody">Nobody</option>
                </select>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 opacity-60">
          <span className="text-[13px] text-navy flex-1">Admin panel</span>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-tax/10 text-tax inline-flex items-center gap-1"><ShieldCheck size={10} /> Admin only</span>
          <span className="text-[11px] text-slate-400 w-[88px] text-center">locked</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4 grid grid-cols-2 gap-3">
        <Field label="Default plan"><select value={settings.defaultPlan} onChange={(e) => onUpdate({ defaultPlan: e.target.value as any })} className="h-9 px-2 rounded-lg border-[0.5px] border-black/15 text-[12px] outline-none focus:border-navy"><option value="free">free</option><option value="pro">pro</option></select></Field>
        <Field label="Gmail sync frequency"><select value={settings.gmailSyncFrequency} onChange={(e) => onUpdate({ gmailSyncFrequency: e.target.value as any })} className="h-9 px-2 rounded-lg border-[0.5px] border-black/15 text-[12px] outline-none focus:border-navy"><option value="manual">manual</option><option value="daily">daily</option><option value="realtime">realtime</option></select></Field>
        <Field label="Free tier · max tasks"><NumInput value={settings.freeTier.maxTasks} onChange={(v) => onUpdate({ freeTier: { ...settings.freeTier, maxTasks: v } })} /></Field>
        <Field label="Free tier · max bills"><NumInput value={settings.freeTier.maxBills} onChange={(v) => onUpdate({ freeTier: { ...settings.freeTier, maxBills: v } })} /></Field>
        <Field label="Free tier · max documents"><NumInput value={settings.freeTier.maxDocuments} onChange={(v) => onUpdate({ freeTier: { ...settings.freeTier, maxDocuments: v } })} /></Field>
      </div>

      <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4 space-y-3">
        <div className="flex items-center justify-between"><span className="text-[13px] font-medium text-navy">Maintenance mode</span><Toggle on={settings.maintenanceMode} onClick={() => onUpdate({ maintenanceMode: !settings.maintenanceMode })} /></div>
        <div className="flex items-center justify-between"><span className="text-[13px] font-medium text-navy">Announcement banner</span><Toggle on={settings.announcement.enabled} onClick={() => onUpdate({ announcement: { ...settings.announcement, enabled: !settings.announcement.enabled } })} /></div>
        <input value={settings.announcement.message} onChange={(e) => onUpdate({ announcement: { ...settings.announcement, message: e.target.value } })} placeholder="Announcement message…" className="w-full h-9 px-3 rounded-lg border-[0.5px] border-black/15 text-[13px] outline-none focus:border-navy" />
        <p className="text-[11px] text-slate-400">Tax FY {settings.taxConfig.fyLabel} and slab values are edited in the <code className="text-tax">taxConfig</code> field of this same document.</p>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>{children}</label>;
}
function NumInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return <input type="number" min={0} value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} className="h-9 px-2 rounded-lg border-[0.5px] border-black/15 text-[12px] tabular-nums outline-none focus:border-navy" />;
}

export { Toggle };
