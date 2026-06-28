import { useEffect, useState } from "react";
import {
  useAllUsers, adminStats, countCollection, suspendUser, resetOnboarding, changePlan, deleteUserDoc, updateSystemSettings,
} from "../lib/adminApi";
import { useSystemSettings } from "../lib/useSystemSettings";
import AdminPanel from "./AdminPanel";
import Logo from "./Logo";

export default function AdminScreen({ onExit }: { onExit: () => void }) {
  const { users, loading, error } = useAllUsers();
  const { settings } = useSystemSettings();
  const [counts, setCounts] = useState({ tasks: 0, bills: 0 });

  useEffect(() => {
    Promise.all([countCollection("tasks"), countCollection("bills")]).then(([t, b]) => setCounts({ tasks: t, bills: b }));
  }, []);

  if (loading) {
    return <div className="p-6 flex items-center gap-3 text-slate-400"><Logo size={28} /><span className="w-4 h-4 border-2 border-slate-300 border-t-navy rounded-full animate-spin" /></div>;
  }
  if (error) {
    return <div className="p-6 text-[13px] text-crisis">Couldn't load users: {error}. (This page requires an admin role.)</div>;
  }

  return (
    <AdminPanel
      users={users}
      stats={adminStats(users, Date.now())}
      taskCount={counts.tasks}
      billCount={counts.bills}
      settings={settings}
      onUpdateSettings={updateSystemSettings}
      onSuspend={suspendUser}
      onResetOnboarding={resetOnboarding}
      onChangePlan={changePlan}
      onDeleteUser={deleteUserDoc}
      onExit={onExit}
    />
  );
}
