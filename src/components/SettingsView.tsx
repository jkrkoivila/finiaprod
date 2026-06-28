import { useState, type ReactNode } from "react";
import { User, Mail, Bell, Wallet, Coins, Palette, ShieldAlert, ShieldCheck, Download, Trash2, Plus, X } from "lucide-react";
import { Toggle } from "./AdminPanel";
import type { FeatureFlags } from "../lib/settings";
import { applyTheme, type ThemePref } from "../lib/theme";

export interface UserPrefs {
  notifications: { push: boolean; emailDigest: boolean; reminders: boolean; crisisAlerts: boolean; reminderLeadDays: number };
  finance: { savingsGoal: number; billPasswordFormats: Record<string, string> };
  appearance: { theme: ThemePref; sidebarCollapsed: boolean };
}

export const DEFAULT_PREFS: UserPrefs = {
  notifications: { push: true, emailDigest: true, reminders: true, crisisAlerts: true, reminderLeadDays: 3 },
  finance: { savingsGoal: 0, billPasswordFormats: {} },
  appearance: { theme: "light", sidebarCollapsed: false },
};

interface SettingsViewProps {
  name: string;
  email: string;
  plan: string;
  role: string;
  prefs: UserPrefs;
  flags: FeatureFlags;
  isAdmin: boolean;
  onUpdate: (patch: { name?: string; prefs?: UserPrefs }) => void | Promise<void>;
  onExport: () => void | Promise<void>;
  onDeleteFinancial: () => void | Promise<void>;
  onDeleteAccount: () => void | Promise<void>;
  onOpenAdmin: () => void;
  onOpenTax: () => void;
  onExit: () => void;
  onEnablePush?: () => Promise<string>;
  onResetGmail?: () => void | Promise<void>;
  demoMode?: boolean;
  onToggleDemo?: (v: boolean) => void | Promise<void>;
}

const PUSH_MSG: Record<string, string> = {
  enabled: "Enabled on this device ✓",
  denied: "Blocked — allow notifications in your browser",
  unsupported: "Not supported on this browser",
  "no-key": "Push not configured yet (admin setup pending)",
  error: "Couldn't enable — try again",
};

export default function SettingsView(props: SettingsViewProps) {
  const [prefs, setPrefs] = useState<UserPrefs>(props.prefs);
  const [name, setName] = useState(props.name);
  const [confirm, setConfirm] = useState<null | "financial" | "account" | "gmail">(null);
  const [bank, setBank] = useState("");
  const [fmt, setFmt] = useState("");
  const [pushState, setPushState] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  const save = (next: UserPrefs) => { setPrefs(next); props.onUpdate({ prefs: next }); };
  const setN = (k: keyof UserPrefs["notifications"], v: any) => save({ ...prefs, notifications: { ...prefs.notifications, [k]: v } });

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[20px] font-medium text-navy">Settings</h1>
        <button onClick={props.onExit} className="h-8 px-3 rounded-lg border-[0.5px] border-black/15 text-[12px] text-slate-600 hover:bg-surface">Back to app</button>
      </div>

      {props.isAdmin && (
        <button onClick={props.onOpenAdmin} className="w-full flex items-center gap-2 rounded-xl border-[0.5px] border-tax/30 bg-tax/5 px-4 py-3 text-[13px] font-medium text-tax">
          <ShieldCheck size={16} /> Open admin panel <span className="ml-auto text-[12px]">→</span>
        </button>
      )}

      <Section icon={User} title="Profile">
        <Row label="Name"><input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== props.name && props.onUpdate({ name })} className="h-9 px-2 rounded-lg border-[0.5px] border-black/15 text-[13px] outline-none focus:border-navy" /></Row>
        <Row label="Email"><span className="text-[13px] text-slate-500">{props.email}</span></Row>
        <Row label="Plan"><span className="text-[12px] px-2 py-0.5 rounded-full bg-navy/5 text-navy capitalize">{props.plan}</span></Row>
        <Row label="Role"><span className={`text-[12px] px-2 py-0.5 rounded-full capitalize ${props.role === "admin" ? "bg-tax/10 text-tax" : "bg-slate-100 text-slate-500"}`}>{props.role}</span></Row>
      </Section>

      {props.flags.gmailSync && (
        <Section icon={Mail} title="Connected accounts">
          <Row label="Google"><span className="text-[13px] text-finance">Connected</span></Row>
          <Row label="Gmail (read-only)"><span className="text-[13px] text-slate-500">Granted via sign-in</span></Row>
          <Row label="Calendar"><span className="text-[13px] text-slate-500">Granted via sign-in</span></Row>
          {props.onResetGmail && (
            <Row label="Gmail sync">
              <button onClick={() => setConfirm("gmail")} className="h-8 px-3 rounded-lg border-[0.5px] border-black/15 text-[12px] font-medium text-navy hover:bg-surface">
                Re-sync from last 90 days
              </button>
            </Row>
          )}
        </Section>
      )}

      <Section icon={Bell} title="Notifications">
        <Row label="Push notifications"><Toggle on={prefs.notifications.push} onClick={() => setN("push", !prefs.notifications.push)} /></Row>
        {props.onEnablePush && (
          <Row label="Phone reminders">
            <div className="flex items-center gap-2">
              {pushState && <span className={`text-[11px] ${pushState === "enabled" ? "text-finance" : "text-slate-500"}`}>{PUSH_MSG[pushState] || pushState}</span>}
              <button
                disabled={pushBusy}
                onClick={async () => { setPushBusy(true); setPushState(await props.onEnablePush!()); setPushBusy(false); }}
                className="h-8 px-3 rounded-lg bg-navy text-white text-[12px] font-medium hover:opacity-90 disabled:opacity-60"
              >{pushBusy ? "Enabling…" : "Enable on this device"}</button>
            </div>
          </Row>
        )}
        <Row label="Email digest"><Toggle on={prefs.notifications.emailDigest} onClick={() => setN("emailDigest", !prefs.notifications.emailDigest)} /></Row>
        <Row label="Task reminders"><Toggle on={prefs.notifications.reminders} onClick={() => setN("reminders", !prefs.notifications.reminders)} /></Row>
        {props.flags.crisis && <Row label="Crisis alerts"><Toggle on={prefs.notifications.crisisAlerts} onClick={() => setN("crisisAlerts", !prefs.notifications.crisisAlerts)} /></Row>}
        <Row label="Reminder lead time">
          <select value={prefs.notifications.reminderLeadDays} onChange={(e) => setN("reminderLeadDays", Number(e.target.value))} className="h-9 px-2 rounded-lg border-[0.5px] border-black/15 text-[12px] outline-none focus:border-navy">
            {[1, 2, 3, 5, 7].map((d) => <option key={d} value={d}>{d} day{d > 1 ? "s" : ""} before</option>)}
          </select>
        </Row>
      </Section>

      {props.flags.finance && (
        <Section icon={Wallet} title="Finance preferences">
          <Row label="Monthly savings goal (₹)"><input type="number" min={0} value={prefs.finance.savingsGoal || ""} onChange={(e) => save({ ...prefs, finance: { ...prefs.finance, savingsGoal: Number(e.target.value) || 0 } })} className="h-9 px-2 rounded-lg border-[0.5px] border-black/15 text-[13px] tabular-nums outline-none focus:border-navy" /></Row>
          <div>
            <div className="text-[12px] text-slate-500 mb-1.5">Per-bank bill password formats</div>
            {Object.entries(prefs.finance.billPasswordFormats).map(([b, f]) => (
              <div key={b} className="flex items-center gap-2 mb-1.5 text-[12px]">
                <span className="text-navy font-medium w-28 truncate">{b}</span>
                <span className="text-slate-500 flex-1 font-mono">{f}</span>
                <button onClick={() => { const next = { ...prefs.finance.billPasswordFormats }; delete next[b]; save({ ...prefs, finance: { ...prefs.finance, billPasswordFormats: next } }); }} className="text-slate-400 hover:text-crisis"><X size={14} /></button>
              </div>
            ))}
            <div className="flex items-center gap-2 mt-1">
              <input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Bank" className="shrink-0 box-border h-8 px-2 rounded-lg border-[0.5px] border-black/15 text-[12px] w-28 outline-none focus:border-navy" />
              <input value={fmt} onChange={(e) => setFmt(e.target.value)} placeholder="e.g. NAME+DDMM" className="flex-1 min-w-0 box-border h-8 px-2 rounded-lg border-[0.5px] border-black/15 text-[12px] outline-none focus:border-navy" />
              <button onClick={() => { if (bank.trim() && fmt.trim()) { save({ ...prefs, finance: { ...prefs.finance, billPasswordFormats: { ...prefs.finance.billPasswordFormats, [bank.trim()]: fmt.trim() } } }); setBank(""); setFmt(""); } }} className="shrink-0 box-border h-8 w-8 rounded-lg bg-navy text-white flex items-center justify-center"><Plus size={14} /></button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Only the format pattern is stored — never the password itself.</p>
          </div>
        </Section>
      )}

      {props.flags.tax && (
        <Section icon={Coins} title="Tax profile">
          <Row label="Income & deductions"><button onClick={props.onOpenTax} className="text-[12px] font-medium text-tax hover:underline">Open tax module →</button></Row>
        </Section>
      )}

      <Section icon={Palette} title="Appearance">
        <Row label="Theme">
          <select
            value={prefs.appearance.theme}
            onChange={(e) => {
              const theme = e.target.value as ThemePref;
              applyTheme(theme); // apply instantly, no refresh
              save({ ...prefs, appearance: { ...prefs.appearance, theme } });
            }}
            className="h-9 px-2 rounded-lg border-[0.5px] border-black/15 text-[12px] outline-none focus:border-navy"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </Row>
        <Row label="Sidebar default"><Toggle on={prefs.appearance.sidebarCollapsed} onClick={() => save({ ...prefs, appearance: { ...prefs.appearance, sidebarCollapsed: !prefs.appearance.sidebarCollapsed } })} /></Row>
        {props.onToggleDemo && (
          <Row label="Demo mode (read-only — agent can't make changes)"><Toggle on={!!props.demoMode} onClick={() => props.onToggleDemo!(!props.demoMode)} /></Row>
        )}
      </Section>

      <Section icon={ShieldAlert} title="Privacy & data">
        <button onClick={props.onExport} className="w-full h-10 rounded-lg border-[0.5px] border-black/15 text-[13px] font-medium text-navy hover:bg-surface flex items-center justify-center gap-2"><Download size={15} /> Export all my data (JSON)</button>
        <button onClick={() => setConfirm("financial")} className="w-full h-10 rounded-lg border-[0.5px] border-[#D97706]/30 text-[13px] font-medium text-[#D97706] hover:bg-[#D97706]/10 flex items-center justify-center gap-2"><Trash2 size={15} /> Delete financial data</button>
        <button onClick={() => setConfirm("account")} className="w-full h-10 rounded-lg border-[0.5px] border-crisis/30 text-[13px] font-medium text-crisis hover:bg-crisis/10 flex items-center justify-center gap-2"><Trash2 size={15} /> Delete my account</button>
      </Section>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/30" onClick={() => setConfirm(null)}>
          <div className="w-full max-w-sm bg-white rounded-xl border-[0.5px] border-black/10 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-[14px] font-medium text-navy">{confirm === "financial" ? "Delete all financial data?" : confirm === "account" ? "Delete your account?" : "Re-sync Gmail?"}</div>
            <p className="text-[12px] text-slate-500 mt-1">{confirm === "financial" ? "Tasks, bills, transactions, subscriptions, receivables, and documents will be permanently removed." : confirm === "account" ? "Everything is deleted and you'll be signed out. This can't be undone." : "This will re-scan your Gmail from the last 90 days. Duplicate bills will be skipped automatically."}</p>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setConfirm(null)} className="h-9 px-3 rounded-lg border-[0.5px] border-black/15 text-[12px] text-slate-600 hover:bg-surface">Cancel</button>
              {confirm === "gmail" ? (
                <button onClick={() => { props.onResetGmail?.(); setConfirm(null); }} className="h-9 px-3 rounded-lg bg-navy text-white text-[12px] font-medium hover:bg-navy/90">Re-sync</button>
              ) : (
                <button onClick={() => { confirm === "financial" ? props.onDeleteFinancial() : props.onDeleteAccount(); setConfirm(null); }} className="h-9 px-3 rounded-lg bg-crisis text-white text-[12px] font-medium hover:bg-crisis/90">Delete</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4">
      <div className="flex items-center gap-2 mb-3"><Icon size={15} className="text-navy/60" /><h2 className="text-[13px] font-medium text-navy">{title}</h2></div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}
function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-[13px] text-slate-600">{label}</span>{children}</div>;
}
