import { useState } from "react";
import { useUserCollection } from "../lib/useUserCollection";
import { useSystemSettings } from "../lib/useSystemSettings";
import { useAuth } from "../lib/auth";
import { addTask, deleteTask, toggleTask, updateTask } from "../lib/taskMutations";
import { parseTask } from "../lib/parseTask";
import { ymd } from "../lib/dashboard";
import TasksView from "./TasksView";
import UpgradeModal from "./UpgradeModal";
import type { Task } from "../types";

/** Container: binds live Firestore tasks + CRUD + natural-language quick-add. */
export default function TasksScreen({ uid }: { uid: string }) {
  const { items: tasks, loading } = useUserCollection<Task>("tasks", uid);
  const { settings } = useSystemSettings();
  const { profile } = useAuth();
  const today = ymd(new Date());
  const [limit, setLimit] = useState(false);

  // Free-tier limit: Pro/admin bypass; free users blocked at maxTasks with an upgrade modal.
  const isPro = profile?.plan === "pro" || profile?.role === "admin";
  const maxTasks = settings.freeTier.maxTasks;
  const underLimit = () => {
    if (!isPro && tasks.length >= maxTasks) { setLimit(true); return false; }
    return true;
  };

  return (
    <>
      <TasksView
        tasks={tasks}
        loading={loading}
        today={today}
        onAdd={(data) => { if (underLimit()) return addTask(uid, data); }}
        onUpdate={(id, patch) => updateTask(id, patch)}
        onToggle={(id, completed) => toggleTask(id, completed)}
        onDelete={(id) => deleteTask(id)}
        onQuickAdd={async (text) => {
          if (!underLimit()) return;
          const parsed = await parseTask(text, today);
          await addTask(uid, parsed);
        }}
      />
      {limit && (
        <UpgradeModal
          title="Free plan limit reached"
          message={`You've reached the free plan limit of ${maxTasks} tasks. Upgrade to Pro to add more.`}
          onClose={() => setLimit(false)}
        />
      )}
    </>
  );
}
