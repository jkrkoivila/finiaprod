import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useUserCollection } from "../lib/useUserCollection";
import { addTask, updateTask } from "../lib/taskMutations";
import { clusteredDeadlines, type Triage } from "../lib/crisis";
import { crisisIdFor, fetchTriage, getCachedTriage, saveTriage } from "../lib/crisisTriage";
import { blockFocusEvent } from "../lib/focusBlock";
import { addDays, ymd } from "../lib/dashboard";
import CrisisModeView from "./CrisisModeView";
import Logo from "./Logo";
import type { Task } from "../types";

export default function CrisisModeScreen({ uid, onExit }: { uid: string; onExit: () => void }) {
  const { items: tasks, loading } = useUserCollection<Task>("tasks", uid);
  const today = ymd(new Date());

  // Snapshot the cluster once (so resolved cards stay visible as we mutate tasks).
  const [clustered, setClustered] = useState<Task[] | null>(null);
  const [triage, setTriage] = useState<Triage | null>(null);
  const [triageLoading, setTriageLoading] = useState(true);
  const [resolved, setResolved] = useState<Record<string, string>>({});
  const snapped = useRef(false);

  useEffect(() => {
    if (snapped.current || loading) return;
    snapped.current = true;
    const c = clusteredDeadlines(tasks, today);
    setClustered(c);
    if (c.length === 0) {
      setTriageLoading(false);
      return;
    }
    // Cache by cluster composition: re-opening crisis mode with the same tasks
    // reads the cached triage instead of calling Gemini again.
    const crisisId = crisisIdFor(uid, c.map((t) => t.id));
    getCachedTriage(crisisId)
      .then(async (cached) => {
        if (cached) return cached;
        const fresh = await fetchTriage(c, today);
        await saveTriage(uid, crisisId, fresh).catch(() => {});
        return fresh;
      })
      .then(setTriage)
      .catch((e) => console.error("triage failed:", e))
      .finally(() => setTriageLoading(false));
  }, [uid, loading, tasks, today]);

  const mark = (id: string, action: string) => setResolved((r) => ({ ...r, [id]: action }));

  if (!clustered) {
    return (
      <div className="fixed inset-0 z-50 bg-[#1B1B2E] flex flex-col items-center justify-center gap-3 text-white">
        <Logo size={44} />
        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (clustered.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-[#1B1B2E] flex flex-col items-center justify-center gap-3 text-white px-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-[#22C55E]/20 flex items-center justify-center">
          <Check size={24} className="text-[#22C55E]" />
        </div>
        <div className="text-[16px] font-medium">No crisis right now</div>
        <p className="text-[13px] text-white/60 max-w-xs">
          You have fewer than three deadlines in the next 48 hours. Nice and calm.
        </p>
        <button onClick={onExit} className="mt-2 h-9 px-4 rounded-lg bg-white text-[#1B1B2E] text-[13px] font-medium">
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <CrisisModeView
      clustered={clustered}
      triage={triage}
      loading={triageLoading}
      today={today}
      resolved={resolved}
      onBlockTime={(t) => {
        addTask(uid, {
          title: `[Focus] ${t.title}`,
          dueDate: today,
          dueTime: t.dueTime || "10:00",
          category: "work",
          priority: "high",
        }).catch((e) => console.error(e));
        // Also create a real Google Calendar event (best-effort) for a phone reminder.
        blockFocusEvent(uid, t.title, today, t.dueTime || "10:00").catch(() => {});
        mark(t.id, "block");
      }}
      onDefer={(t) => {
        updateTask(t.id, { dueDate: addDays(t.dueDate, 7) }).catch((e) => console.error(e));
        mark(t.id, "defer");
      }}
      onDrop={(t) => {
        updateTask(t.id, { completed: true }).catch((e) => console.error(e));
        mark(t.id, "drop");
      }}
      onKeep={(t) => mark(t.id, "keep")}
      onExit={onExit}
    />
  );
}
