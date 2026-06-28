import { useAuth } from "../lib/auth";
import { useSystemSettings } from "../lib/useSystemSettings";
import { deleteAccount, deleteFinancialData, downloadJSON, exportData, resetGmailSync, updateUserDoc } from "../lib/accountApi";
import { resolveFlags } from "../lib/settings";
import { runGmailSync } from "../lib/gmailSync";
import { enablePush } from "../lib/push";
import SettingsView, { DEFAULT_PREFS, type UserPrefs } from "./SettingsView";

export default function SettingsScreen({ onExit, onOpenAdmin, onOpenTax }: { onExit: () => void; onOpenAdmin: () => void; onOpenTax: () => void }) {
  const { user, profile, signOutUser } = useAuth();
  const { settings } = useSystemSettings();
  if (!user || !profile) return null;

  const p = (profile.prefs || {}) as Partial<UserPrefs>;
  const prefs: UserPrefs = {
    notifications: { ...DEFAULT_PREFS.notifications, ...(p.notifications || {}) },
    finance: { ...DEFAULT_PREFS.finance, ...(p.finance || {}) },
    appearance: { ...DEFAULT_PREFS.appearance, ...(p.appearance || {}) },
  };

  return (
    <SettingsView
      name={profile.name || ""}
      email={profile.email || ""}
      plan={profile.plan || "free"}
      role={profile.role || "user"}
      prefs={prefs}
      flags={resolveFlags(settings.featureAccess, profile.plan || "free", profile.role === "admin")}
      isAdmin={profile.role === "admin"}
      onUpdate={(patch) => updateUserDoc(user.uid, patch)}
      onExport={async () => downloadJSON(await exportData(user.uid), `finia-export-${user.uid}.json`)}
      onDeleteFinancial={() => deleteFinancialData(user.uid)}
      onDeleteAccount={async () => { await deleteAccount(user.uid); await signOutUser(); }}
      onResetGmail={async () => { await resetGmailSync(user.uid); await runGmailSync(user.uid).catch(() => {}); }}
      demoMode={!!profile.demoMode}
      onToggleDemo={(v) => updateUserDoc(user.uid, { demoMode: v })}
      onOpenAdmin={onOpenAdmin}
      onOpenTax={onOpenTax}
      onExit={onExit}
      onEnablePush={() => enablePush(user.uid, prefs.notifications.reminderLeadDays)}
    />
  );
}
