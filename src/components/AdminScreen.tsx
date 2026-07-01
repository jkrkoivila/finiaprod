import { useCallback, useEffect, useRef, useState } from "react";
import {
  useAllUsers, adminStats, countCollection, suspendUser, resetOnboarding, changePlan, deleteUserDoc, updateSystemSettings,
} from "../lib/adminApi";
import { useSystemSettings } from "../lib/useSystemSettings";
import AdminPanel from "./AdminPanel";
import Logo from "./Logo";
import type { AdminUser } from "../lib/adminApi";
import type { AppSettings } from "../lib/settings";

// ── Inline toast ────────────────────────────────────────────────────────────
interface ToastItem { id: number; message: string; isError: boolean }

function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const show = useCallback((message: string, isError = false) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, isError }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, show, dismiss };
}

function ToastStack({ toasts, dismiss }: { toasts: ToastItem[]; dismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto max-w-sm px-4 py-3 rounded-xl border-[0.5px] text-[13px] font-medium shadow-md cursor-pointer transition-all
            ${t.isError
              ? "bg-crisis text-white border-crisis/50"
              : "bg-navy text-white border-navy/50"}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ── Pending action key (prevents double-clicks and shows spinners) ───────────
type PendingKey = string | null; // e.g. "suspend:uid123" | "plan:uid123" | "reset:uid123" | "delete:uid123"

// ── AdminScreen ──────────────────────────────────────────────────────────────
export default function AdminScreen({ onExit }: { onExit: () => void }) {
  const { users, loading, error } = useAllUsers();
  const { settings } = useSystemSettings();
  const [counts, setCounts] = useState({ tasks: 0, bills: 0 });
  const [pending, setPending] = useState<PendingKey>(null);
  const { toasts, show: showToast, dismiss } = useToast();

  useEffect(() => {
    Promise.all([countCollection("tasks"), countCollection("bills")]).then(([t, b]) => setCounts({ tasks: t, bills: b }));
  }, []);

  // Wraps any admin API call:
  // 1. Sets a pending key so the triggering button disables + shows a spinner
  // 2. Awaits the write — NO optimistic local state update
  // 3. On error: shows a destructive toast with error.code + error.message
  // 4. Clears pending whether success or failure (onSnapshot drives the UI)
  const run = useCallback(
    async (key: string, fn: () => Promise<void>, successMsg?: string) => {
      if (pending) return; // guard against double-clicks across different buttons
      setPending(key);
      try {
        await fn();
        if (successMsg) showToast(successMsg, false);
      } catch (err: any) {
        const code: string = err?.code ?? "";
        const msg: string = err?.message ?? "Unknown error";
        const friendly = code === "permission-denied"
          ? `Permission denied (${code}): ${msg}`
          : `Error${code ? ` [${code}]` : ""}: ${msg}`;
        showToast(friendly, true);
      } finally {
        setPending(null);
      }
    },
    [pending, showToast]
  );

  const handleSuspend = useCallback(
    (user: AdminUser, suspended: boolean) =>
      run(
        `suspend:${user.uid}`,
        () => suspendUser(user, suspended),
        suspended ? "User suspended." : "User unsuspended."
      ),
    [run]
  );

  const handleResetOnboarding = useCallback(
    (uid: string) =>
      run(
        `reset:${uid}`,
        () => resetOnboarding(uid),
        "Onboarding reset."
      ),
    [run]
  );

  const handleChangePlan = useCallback(
    (uid: string, plan: string) =>
      run(
        `plan:${uid}`,
        () => changePlan(uid, plan),
        `Plan changed to ${plan}.`
      ),
    [run]
  );

  const handleDeleteUser = useCallback(
    (user: AdminUser) =>
      run(
        `delete:${user.uid}`,
        () => deleteUserDoc(user),
        "User deleted."
      ),
    [run]
  );

  const handleUpdateSettings = useCallback(
    (patch: Partial<AppSettings>) =>
      run(
        "settings",
        () => updateSystemSettings(patch)
      ),
    [run]
  );

  if (loading) {
    return <div className="p-6 flex items-center gap-3 text-slate-400"><Logo size={28} /><span className="w-4 h-4 border-2 border-slate-300 border-t-navy rounded-full animate-spin" /></div>;
  }
  if (error) {
    return <div className="p-6 text-[13px] text-crisis">Couldn't load users: {error}. (This page requires an admin role.)</div>;
  }

  return (
    <>
      <AdminPanel
        users={users}
        stats={adminStats(users, Date.now())}
        taskCount={counts.tasks}
        billCount={counts.bills}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onSuspend={handleSuspend}
        onResetOnboarding={handleResetOnboarding}
        onChangePlan={handleChangePlan}
        onDeleteUser={handleDeleteUser}
        onExit={onExit}
        pendingKey={pending}
      />
      <ToastStack toasts={toasts} dismiss={dismiss} />
    </>
  );
}
