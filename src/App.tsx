import { useEffect, useState, type ReactNode } from "react";
import { Crown } from "lucide-react";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import MobileTabs from "./components/MobileTabs";
import ChatAgent from "./components/ChatAgent";
import ChatAgentContainer from "./components/ChatAgentContainer";
import PlaceholderView from "./components/PlaceholderView";
import DashboardScreen from "./components/DashboardScreen";
import DashboardView from "./components/DashboardView";
import TasksScreen from "./components/TasksScreen";
import TasksView from "./components/TasksView";
import BillsScreen from "./components/BillsScreen";
import BillsView from "./components/BillsView";
import CrisisModeScreen from "./components/CrisisModeScreen";
import CrisisModeView from "./components/CrisisModeView";
import TaxScreen from "./components/TaxScreen";
import TaxView from "./components/TaxView";
import DocumentsScreen from "./components/DocumentsScreen";
import DocumentsView from "./components/DocumentsView";
import FinanceScreen from "./components/FinanceScreen";
import FinanceView from "./components/FinanceView";
import CalendarScreen from "./components/CalendarScreen";
import CalendarView from "./components/CalendarView";
import { buildCalendarItems } from "./lib/calendar";
import RecurringScreen from "./components/RecurringScreen";
import RecurringView from "./components/RecurringView";
import WhatsDueScreen from "./components/WhatsDueScreen";
import FixedDepositsScreen from "./components/FixedDepositsScreen";
import AdminScreen from "./components/AdminScreen";
import AdminPanel from "./components/AdminPanel";
import SettingsScreen from "./components/SettingsScreen";
import SettingsView, { DEFAULT_PREFS } from "./components/SettingsView";
import { useSystemSettings } from "./lib/useSystemSettings";
import { DEFAULT_SETTINGS, FEATURE_LABELS, canAccess, resolveFlags, type FeatureKey } from "./lib/settings";
import { adminStats } from "./lib/adminApi";
import { DEFAULT_TAX_CONFIG_PREV } from "./lib/taxConfig";
import { DEFAULT_TAX_CONFIG } from "./lib/taxConfig";
import LandingPage from "./components/LandingPage";
import Onboarding from "./components/Onboarding";
import Logo from "./components/Logo";
import {
  PREVIEW_TODAY,
  PREVIEW_TASKS,
  PREVIEW_BILLS,
  PREVIEW_TX,
  PREVIEW_SUBS,
  PREVIEW_RECV,
} from "./dev/previewFixtures";
import { useAuth } from "./lib/auth";
import { completeOnboarding } from "./lib/userProfile";
import { applyTheme, storedThemePref, type ThemePref } from "./lib/theme";
import { runGmailSync, describeSync, RateLimitError } from "./lib/gmailSync";
import { useLocation, navigate } from "./lib/router";
import { ActiveView, ChatState } from "./types";

// The eight authenticated app routes (path segment === view id).
const APP_VIEWS: ActiveView[] = [
  "dashboard", "tasks", "calendar", "finance", "bills", "tax", "documents", "analytics",
];

function pathToView(path: string): ActiveView | null {
  const seg = path.replace(/^\/+/, "").split("/")[0];
  return (APP_VIEWS as string[]).includes(seg) ? (seg as ActiveView) : null;
}

// Optional preview flags (don't affect gating): ?collapsed=1&chat=open
const params =
  typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();

export default function App() {
  const { user, profile, loading, signOutUser } = useAuth();
  const path = useLocation();

  // Workspace-only UI state (hooks must run before any early return).
  const [collapsed, setCollapsed] = useState(params.get("collapsed") === "1");
  const [chatState, setChatState] = useState<ChatState>((params.get("chat") as ChatState) || "closed");
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [syncError, setSyncError] = useState(false);
  const { settings } = useSystemSettings();

  // Apply the user's theme (light / dark / system). Falls back to the last choice
  // saved in localStorage before the profile loads. "system" tracks the OS live.
  const themePref = ((profile?.prefs as any)?.appearance?.theme as ThemePref) || storedThemePref();
  useEffect(() => {
    applyTheme(themePref);
  }, [themePref]);

  // Auth is "ready" once Firebase has reported a state AND, if signed in, the
  // profile doc has loaded — so we never route on an unknown `onboarded` value.
  const authReady = !loading && (!user || profile !== null);

  // DEV-ONLY preview routes (no auth, no Firestore) for verifying empty and
  // populated states. Gated by import.meta.env.DEV → stripped from prod builds.
  if (import.meta.env.DEV && path.startsWith("/__preview/")) {
    const frame = (node: ReactNode) => <div className="min-h-screen bg-surface">{node}</div>;
    const noop = () => {};
    const emptyFinance = {
      tasks: [], bills: [], transactions: [], subscriptions: [], receivables: [], paymentInstances: [], fixedDeposits: [], loading: false,
    };
    const sampleFinance = {
      tasks: PREVIEW_TASKS, bills: PREVIEW_BILLS, transactions: PREVIEW_TX,
      subscriptions: PREVIEW_SUBS, receivables: PREVIEW_RECV, paymentInstances: [], fixedDeposits: [], loading: false,
    };

    if (path === "/__preview/dashboard-empty")
      return frame(<DashboardView data={emptyFinance} onToggleTask={noop} onNavigate={noop} />);
    if (path === "/__preview/dashboard-sample")
      return frame(
        <DashboardView data={sampleFinance} onToggleTask={noop} onNavigate={noop} onOpenCrisis={noop} today={PREVIEW_TODAY} />
      );
    if (path === "/__preview/tasks-empty")
      return frame(
        <TasksView
          tasks={[]} loading={false}
          onAdd={noop} onUpdate={noop} onToggle={noop} onDelete={noop}
          onQuickAdd={async () => {}}
        />
      );
    if (path === "/__preview/tasks-sample")
      return frame(
        <TasksView
          tasks={PREVIEW_TASKS} loading={false} today={PREVIEW_TODAY}
          onAdd={noop} onUpdate={noop} onToggle={noop} onDelete={noop}
          onQuickAdd={async () => {}}
        />
      );
    if (path === "/__preview/bills-empty")
      return frame(
        <BillsView
          bills={[]} transactions={[]} loading={false}
          onAddOrUpdate={noop} onSetPaid={noop} onDelete={noop} onCreatePaymentTask={noop} onSetReminder={noop} onSaveToLibrary={noop}
        />
      );
    if (path === "/__preview/bills-sample")
      return frame(
        <BillsView
          bills={PREVIEW_BILLS} transactions={PREVIEW_TX} loading={false} today={PREVIEW_TODAY}
          onAddOrUpdate={noop} onSetPaid={noop} onDelete={noop} onCreatePaymentTask={noop} onSetReminder={noop} onSaveToLibrary={noop}
        />
      );
    if (path === "/__preview/chat")
      return frame(
        <ChatAgent
          state="open"
          setState={noop}
          tasks={PREVIEW_TASKS}
          bills={PREVIEW_BILLS}
          transactions={PREVIEW_TX}
          today={PREVIEW_TODAY}
        />
      );
    if (path === "/__preview/admin") {
      const us: any[] = [
        { uid: "u1", name: "Aarti Sharma", email: "aarti@example.com", role: "admin", onboarded: true, plan: "pro", isDefaultAdmin: true, createdAt: { seconds: 1750000000 }, lastActive: { seconds: Math.floor(Date.now() / 1000) - 3600 } },
        { uid: "u2", name: "Rohan Mehta", email: "rohan@example.com", role: "user", onboarded: true, plan: "free", createdAt: { seconds: 1751000000 }, lastActive: { seconds: Math.floor(Date.now() / 1000) - 200000 } },
        { uid: "u3", name: "Priya Nair", email: "priya@example.com", role: "user", onboarded: false, plan: "free", suspended: true, createdAt: { seconds: 1751500000 }, lastActive: { seconds: 1751500000 } },
      ];
      return frame(<AdminPanel users={us} stats={adminStats(us, Date.now())} taskCount={42} billCount={17} settings={DEFAULT_SETTINGS} onUpdateSettings={noop} onSuspend={noop} onResetOnboarding={noop} onChangePlan={noop} onDeleteUser={noop} onExit={noop} />);
    }
    if (path === "/__preview/settings")
      return frame(
        <SettingsView name="Jay" email="jay@example.com" plan="free" role="user" prefs={DEFAULT_PREFS} flags={resolveFlags(DEFAULT_SETTINGS.featureAccess, "free", false)} isAdmin={false} onUpdate={noop} onExport={noop} onDeleteFinancial={noop} onDeleteAccount={noop} onOpenAdmin={noop} onOpenTax={noop} onExit={noop} onResetGmail={noop} />
      );
    if (path === "/__preview/finance")
      return frame(
        <FinanceView
          transactions={PREVIEW_TX}
          subscriptions={PREVIEW_SUBS}
          receivables={PREVIEW_RECV}
          today={PREVIEW_TODAY}
          onAddTransaction={noop}
          onAddSubscription={noop}
          onToggleSub={noop}
          onDeleteSub={noop}
          onCancelSub={noop}
          onAddReceivable={noop}
          onToggleReminded={noop}
          onDeleteReceivable={noop}
        />
      );
    if (path === "/__preview/calendar-empty")
      return frame(<CalendarView items={[]} today={PREVIEW_TODAY} onOpenItem={noop} onAddTask={noop} onSyncGmail={noop} />);
    if (path === "/__preview/calendar-sample") {
      const items = buildCalendarItems(
        { tasks: PREVIEW_TASKS, bills: PREVIEW_BILLS, paymentInstances: [
          { id: "i1", userId: "p", recurringPaymentId: "r1", title: "House rent", dueDate: "2026-06-05", plannedAmount: 15000, status: "upcoming" } as any,
          { id: "i2", userId: "p", recurringPaymentId: "r2", title: "Netflix", dueDate: "2026-06-20", plannedAmount: 649, status: "upcoming" } as any,
        ] },
        DEFAULT_TAX_CONFIG,
        PREVIEW_TODAY
      );
      return frame(<CalendarView items={items} today={PREVIEW_TODAY} onOpenItem={noop} onAddTask={noop} onSyncGmail={noop} onSyncGoogle={noop} lastSynced="3:42 PM" />);
    }
    if (path === "/__preview/recurring") {
      const tpls: any[] = [
        { id: "r1", userId: "p", title: "House rent", category: "rent", plannedAmount: 15000, frequency: "monthly", dueDay: 5, startDate: "2026-01-05", reminderLeadDays: 3, isActive: true, autoCreateTask: true },
        { id: "r2", userId: "p", title: "Netflix", category: "subscription", plannedAmount: 649, frequency: "monthly", dueDay: 20, startDate: "2026-01-20", reminderLeadDays: 2, isActive: true, autoCreateTask: true },
        { id: "r3", userId: "p", title: "Car loan EMI", category: "EMI", plannedAmount: 18500, frequency: "monthly", dueDay: 2, startDate: "2025-06-02", reminderLeadDays: 5, isActive: false, autoCreateTask: true },
      ];
      const insts: any[] = [
        { id: "i0", userId: "p", recurringPaymentId: "r1", dueDate: "2026-06-05", plannedAmount: 15000, actualAmount: 15500, status: "paid", paidDate: "2026-06-05", proofUrl: "https://example.com/proof.png", note: "late fee" },
        { id: "i1", userId: "p", recurringPaymentId: "r1", dueDate: "2026-07-05", plannedAmount: 15000, status: "upcoming" },
        { id: "i2", userId: "p", recurringPaymentId: "r1", dueDate: "2026-08-05", plannedAmount: 15000, status: "upcoming" },
        { id: "i3", userId: "p", recurringPaymentId: "r1", dueDate: "2026-09-05", plannedAmount: 15000, status: "upcoming" },
        { id: "i4", userId: "p", recurringPaymentId: "r2", dueDate: "2026-07-20", plannedAmount: 649, status: "upcoming" },
      ];
      const ok = async () => {};
      return frame(<RecurringView templates={tpls} instances={insts} today={PREVIEW_TODAY} onCreate={ok} onEdit={ok} onPause={ok} onDelete={ok} onMarkPaid={ok} onBack={noop} />);
    }
    if (path === "/__preview/tax")
      return frame(
        <TaxView
          configCurrent={DEFAULT_TAX_CONFIG}
          configPrev={DEFAULT_TAX_CONFIG_PREV}
          configSource="default"
          profile={{
            current: {
              grossSalary: 3817584,
              regime: "new",
              entries: [
                { id: "80CCD2", fields: { employerNps: 142065, basic: 1800000 } },
                { id: "80C", value: 150000 },
                { id: "80CCD1B", value: 49995 },
                { id: "80D", fields: { selfFamily: 25000 } },
                { id: "hra", fields: { hraReceived: 600000, basic: 1800000, rent: 720000, metro: true } },
              ],
            },
            previous: { grossSalary: 1500000, regime: "new", entries: [{ id: "80C", value: 150000 }] },
          }}
          onChange={noop}
          onAddCalendarTasks={noop}
          calendarAdded={false}
        />
      );
    if (path === "/__preview/documents") {
      const docs: any[] = [
        { id: "d1", userId: "p", type: "credit-card-bill", status: "imported", fileName: "hdfc_statement_jun.pdf", source: "upload", summary: "HDFC credit card · ₹18,400", extractedData: { issuer: "HDFC", last4: "7788", statementMonth: "2026-06", totalDue: 18400 } },
        { id: "d2", userId: "p", type: "payslip", status: "needs_review", fileName: "payslip_june.png", source: "upload", summary: "Acme Corp", missingRequired: ["grossSalary"], extractedData: { employer: "Acme Corp", month: "2026-06" } },
        { id: "d3", userId: "p", type: null, status: "uncategorized", fileName: "scan_004.jpg", source: "upload", extractedData: {} },
        { id: "d4", userId: "p", type: null, status: "unreadable", fileName: "blurry_photo.jpg", source: "upload", extractedData: {} },
        { id: "d5", userId: "p", type: "credit-card-bill", status: "locked", fileName: "icici_estatement.pdf", source: "upload", extractedData: {} },
      ];
      const ok = async () => {};
      return frame(
        <DocumentsView
          documents={docs}
          loading={false}
          extract={async () => { throw new Error("preview"); }}
          commit={async () => ({ id: "x", status: "imported", duplicate: false })}
          remove={ok}
          summary={async () => ({ counts: {}, total: 1, hasManualEdits: false, text: "This will remove the file and 1 bill." })}
          syncGmail={async () => ({ counts: { bills: 0, deadlines: 0, receipts: 0, subscriptions: 0 }, total: 0, duplicates: 0, findings: { bills: [], deadlines: [], receipts: [], subscriptions: [] } })}
        />
      );
    }
    if (path === "/__preview/crisis") {
      const clustered = PREVIEW_TASKS.filter((t) => !t.completed && t.dueDate <= "2026-06-28");
      const triage = {
        reasoning:
          "Finia spotted 3 deadlines bunched into the next 48 hours. Protect your time: clear the credit-card payment now to avoid interest, push the project deck to next week, and drop the low-impact insurance renewal reminder.",
        classifications: {
          t1: { bucket: "do_now" as const, reason: "Your HDFC card payment is due today — pay it now to dodge ₹500+ in late fees and interest." },
          t3: { bucket: "drop" as const, reason: "The bike insurance renewal is low urgency this week — skip it for now and revisit later." },
          t5: { bucket: "defer" as const, reason: "The project status deck can wait a week without any real consequence." },
        },
      };
      return (
        <CrisisModeView
          clustered={clustered}
          triage={triage}
          loading={false}
          today={PREVIEW_TODAY}
          resolved={{}}
          onBlockTime={noop}
          onDefer={noop}
          onDrop={noop}
          onKeep={noop}
          onExit={noop}
        />
      );
    }
  }

  if (!authReady) return <Splash />;

  // ─────────────────────────────────────────────────────────────────────
  // ROUTING + AUTH GATING  (this block is the whole gate)
  //
  //   logged out            → only "/" (landing); any other path → "/"
  //   logged in, !onboarded → forced to "/onboarding"
  //   logged in,  onboarded → "/" or "/onboarding" → "/dashboard";
  //                           "/<view>" renders that view; unknown → "/dashboard"
  // ─────────────────────────────────────────────────────────────────────

  // 1) Logged-out visitors only ever see the landing page.
  if (!user) {
    return path === "/" ? <LandingPage /> : <Redirect to="/" />;
  }

  // 2) Signed in but not onboarded → onboarding, nothing else.
  if (!profile?.onboarded) {
    return path === "/onboarding" ? (
      <Onboarding
        name={(profile?.name || user.displayName || "").split(" ")[0] || ""}
        onComplete={async () => {
          await completeOnboarding(user.uid);
          navigate("/dashboard");
        }}
      />
    ) : (
      <Redirect to="/onboarding" />
    );
  }

  // Maintenance mode locks everyone out except admins.
  if (settings.maintenanceMode && profile.role !== "admin") return <Maintenance message={settings.announcement.message} />;

  // 3) Onboarded: keep them out of public/onboarding routes.
  if (path === "/" || path === "/onboarding") return <Redirect to="/dashboard" />;

  // Per-user resolved feature flags (admin 3-state access × this user's plan/role).
  const isAdmin = profile.role === "admin";
  const plan = profile.plan ?? "free";
  const access = settings.featureAccess;
  const flags = resolveFlags(access, plan, isAdmin);
  // "ok" → show · "upgrade" → pro feature for a free user · "blocked" → nobody/not allowed
  const gate = (feature: FeatureKey): "ok" | "upgrade" | "blocked" => {
    if (canAccess(access[feature], plan, isAdmin)) return "ok";
    return access[feature] === "pro" ? "upgrade" : "blocked";
  };

  // Crisis mode — full-screen takeover (the one intentional exception to the sidebar layout).
  if (path === "/crisis") {
    if (gate("crisis") !== "ok") return <Redirect to="/dashboard" />;
    return <CrisisModeScreen uid={user.uid} onExit={() => navigate("/dashboard")} />;
  }

  // ── Choose the page content. EVERY authenticated page renders inside the
  //    persistent sidebar + topbar layout at the bottom. Redirects return early. ──
  const displayName = profile.name || user.displayName || "";
  const firstName = displayName.split(" ")[0] || "there";

  let activeView: ActiveView | null = null; // which sidebar item to highlight
  let content: ReactNode;

  if (path === "/admin") {
    if (!isAdmin) return <Redirect to="/dashboard" />;
    content = <AdminScreen onExit={() => navigate("/dashboard")} />;
  } else if (path === "/settings") {
    content = <SettingsScreen onExit={() => navigate("/dashboard")} onOpenAdmin={() => navigate("/admin")} onOpenTax={() => navigate("/tax")} />;
  } else if (path === "/recurring" || path === "/fixed-deposits") {
    const feature: FeatureKey = path === "/recurring" ? "recurring" : "fixedDeposits";
    const g = gate(feature);
    if (g === "blocked") return <Redirect to="/dashboard" />;
    activeView = "finance";
    content =
      g === "upgrade" ? (
        <UpgradePrompt feature={FEATURE_LABELS[feature]} onUpgrade={() => navigate("/settings")} />
      ) : path === "/recurring" ? (
        <RecurringScreen uid={user.uid} onBack={() => navigate("/finance")} />
      ) : (
        <FixedDepositsScreen uid={user.uid} onBack={() => navigate("/finance")} />
      );
  } else if (path === "/due") {
    content = <WhatsDueScreen uid={user.uid} onBack={() => navigate("/dashboard")} />;
  } else {
    const view = pathToView(path);
    if (!view) return <Redirect to="/dashboard" />;
    activeView = view;
    const featureForView: Partial<Record<ActiveView, FeatureKey>> = { finance: "finance", tax: "tax", documents: "documents" };
    const feat = featureForView[view];
    const g = feat ? gate(feat) : "ok";
    if (g === "blocked") return <Redirect to="/dashboard" />;
    content =
      g === "upgrade" && feat ? (
        <UpgradePrompt feature={FEATURE_LABELS[feat]} onUpgrade={() => navigate("/settings")} />
      ) : view === "dashboard" ? (
        <DashboardScreen uid={user.uid} onNavigate={(v) => navigate("/" + v)} onOpenCrisis={flags.crisis ? () => navigate("/crisis") : undefined} onOpenDue={() => navigate("/due")} />
      ) : view === "tasks" ? (
        <TasksScreen uid={user.uid} />
      ) : view === "bills" ? (
        <BillsScreen uid={user.uid} />
      ) : view === "tax" ? (
        <TaxScreen uid={user.uid} />
      ) : view === "documents" ? (
        <DocumentsScreen uid={user.uid} />
      ) : view === "finance" ? (
        <FinanceScreen uid={user.uid} onOpenRecurring={() => navigate("/recurring")} onOpenFDs={() => navigate("/fixed-deposits")} />
      ) : view === "calendar" ? (
        <CalendarScreen uid={user.uid} />
      ) : (
        <PlaceholderView view={view} />
      );
  }

  // Real Gmail sync (the same incremental, deduped function the Documents screen uses).
  const handleSync = async () => {
    if (syncing) return;
    if (!flags.gmailSync) { setSyncError(true); setSyncNote("Gmail sync is turned off"); return; }
    setSyncing(true);
    setSyncError(false);
    setSyncNote(null);
    try {
      const r = await runGmailSync(user.uid);
      setLastSynced(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      setSyncNote(describeSync(r.counts));
    } catch (e: any) {
      setSyncError(true);
      setSyncNote(e instanceof RateLimitError ? e.message : e?.message || "Sync failed — try again.");
    } finally {
      setSyncing(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    navigate("/"); // gating would redirect anyway; this is immediate.
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {settings.announcement.enabled && settings.announcement.message && (
        <div className="bg-navy text-white text-[12px] px-4 py-2 text-center shrink-0">{settings.announcement.message}</div>
      )}
      <div className="flex flex-1 overflow-hidden bg-surface text-slate-800">
      <Sidebar
        activeView={activeView}
        setView={(v) => navigate("/" + v)}
        collapsed={collapsed}
        name={displayName}
        email={profile.email || user.email || ""}
        photo={profile.photo || user.photoURL || ""}
        plan={plan}
        flags={flags}
        isAdmin={isAdmin}
        onOpenSettings={() => navigate("/settings")}
        onOpenAdmin={() => navigate("/admin")}
        onSignOut={handleSignOut}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          onToggleSidebar={() => setCollapsed((c) => !c)}
          uid={user.uid}
          name={firstName}
          lastSynced={lastSynced}
          syncing={syncing}
          note={syncNote}
          noteError={syncError}
          onSync={handleSync}
          onAddTask={() => navigate("/tasks")}
        />

        <main className="flex-1 overflow-y-auto scrollbar-thin pb-20 md:pb-0">{content}</main>
      </div>

      <MobileTabs
        activeView={activeView}
        setView={(v) => navigate("/" + v)}
        onOpenChat={() => setChatState("open")}
      />

      {flags.agent && <ChatAgentContainer uid={user.uid} state={chatState} setState={setChatState} />}
      </div>
    </div>
  );
}

/** Shown when a free user opens a Pro-only feature (instead of an error). */
function UpgradePrompt({ feature, onUpgrade }: { feature: string; onUpgrade: () => void }) {
  return (
    <div className="p-6 max-w-md mx-auto">
      <div className="mt-10 bg-white rounded-xl border-[0.5px] border-black/10 p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-[#D97706]/10 flex items-center justify-center mx-auto">
          <Crown size={22} className="text-[#D97706]" />
        </div>
        <h1 className="mt-3 text-[16px] font-medium text-navy">{feature} is a Pro feature</h1>
        <p className="mt-1 text-[13px] text-slate-500">This feature is available on the Pro plan. Upgrade to unlock {feature.toLowerCase()}.</p>
        <button onClick={onUpgrade} className="mt-4 h-9 px-4 rounded-lg bg-navy text-white text-[13px] font-medium hover:bg-navy/90">Upgrade to Pro</button>
      </div>
    </div>
  );
}

function Maintenance({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-surface text-center px-6">
      <Logo size={48} />
      <h1 className="text-[18px] font-medium text-navy">Finia is under maintenance</h1>
      <p className="text-[13px] text-slate-500 max-w-sm">{message || "We're making some improvements and will be back shortly. Thanks for your patience."}</p>
    </div>
  );
}

/** Renders a splash and redirects (in an effect, so protected content never paints). */
function Redirect({ to }: { to: string }) {
  useEffect(() => {
    navigate(to);
  }, [to]);
  return <Splash />;
}

function Splash() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-surface">
      <Logo size={48} />
      <span className="w-5 h-5 border-2 border-slate-300 border-t-navy rounded-full animate-spin" />
    </div>
  );
}
