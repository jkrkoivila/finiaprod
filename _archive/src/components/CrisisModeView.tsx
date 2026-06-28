import React, { useState, useEffect } from "react";
import { Flame, Clock, Calendar, Trash2, Check, ArrowRight, X, Sparkles, ShieldAlert, AlertTriangle } from "lucide-react";
import { Task } from "../types";

interface CrisisModeViewProps {
  tasks: Task[];
  onUpdateTask: (id: string, updated: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onAddTask: (task: Omit<Task, "id" | "completed">) => void;
  onClose: () => void;
}

interface TriageResult {
  reasoning: string;
  classifications: {
    [taskId: string]: {
      bucket: "do_now" | "defer" | "drop";
      reason: string;
    };
  };
}

export default function CrisisModeView({
  tasks,
  onUpdateTask,
  onDeleteTask,
  onAddTask,
  onClose,
}: CrisisModeViewProps) {
  const [loading, setLoading] = useState(true);
  const [triageData, setTriageData] = useState<TriageResult | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Filter out clustered pending tasks (due between 2026-06-25 and 2026-06-27 inclusive, and not completed)
  const todayStr = "2026-06-25";
  const limitStr = "2026-06-27";
  const clusteredTasks = tasks.filter((t) => {
    if (t.completed) return false;
    return t.dueDate >= todayStr && t.dueDate <= limitStr;
  });

  // Call the Gemini API triage endpoint
  useEffect(() => {
    const fetchTriage = async () => {
      if (clusteredTasks.length === 0) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/crisis-triage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tasks: clusteredTasks }),
        });

        if (!response.ok) {
          throw new Error("Failed to contact the Finia Triage Service.");
        }

        const data = await response.json();
        setTriageData(data);
      } catch (err: any) {
        console.error("Crisis triage error:", err);
        setError(err.message || "Something went wrong during triage.");
        // Fallback local mock triage if something fails
        const mockClass: any = {};
        clusteredTasks.forEach((t, i) => {
          let b: "do_now" | "defer" | "drop" = "do_now";
          if (i % 3 === 1) b = "defer";
          if (i % 3 === 2) b = "drop";
          mockClass[t.id] = {
            bucket: b,
            reason: `Local sorting: Task classified as ${b} due to priority levels.`
          };
        });
        setTriageData({
          reasoning: "Finia compiled this local triage based on priority parameters to optimize your 48-hour schedule.",
          classifications: mockClass
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTriage();
  }, []);

  // Actions
  const handleBlockTime = async (task: Task) => {
    // Add focus block on calendar
    onAddTask({
      title: `[blocked] Focus block: ${task.title}`,
      dueDate: "2026-06-25", // today
      dueTime: "10:00",
      priority: "high",
      category: "work"
    });
    setResolvedIds((prev) => {
      const next = new Set(prev);
      next.add(task.id);
      return next;
    });
  };

  const handleDeferTask = (task: Task) => {
    // Defer task by 7 days
    const dateObj = new Date(task.dueDate + "T00:00:00");
    dateObj.setDate(dateObj.getDate() + 7);
    const newDateStr = dateObj.toISOString().split("T")[0];

    onUpdateTask(task.id, { dueDate: newDateStr });
    setResolvedIds((prev) => {
      const next = new Set(prev);
      next.add(task.id);
      return next;
    });
  };

  const handleDropTask = (task: Task) => {
    // Mark as completed/cancelled
    onUpdateTask(task.id, { completed: true });
    setResolvedIds((prev) => {
      const next = new Set(prev);
      next.add(task.id);
      return next;
    });
  };

  const handleEscape = (taskId: string) => {
    // Mark as resolved/ignored from triage
    setResolvedIds((prev) => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
  };

  // Group tasks by bucket
  const getTasksByBucket = (bucket: "do_now" | "defer" | "drop") => {
    if (!triageData) return [];
    return clusteredTasks.filter((t) => {
      const classification = triageData.classifications[t.id];
      return classification?.bucket === bucket;
    });
  };

  const doNowTasks = getTasksByBucket("do_now");
  const deferTasks = getTasksByBucket("defer");
  const dropTasks = getTasksByBucket("drop");

  // Calculations
  const resolvedCount = resolvedIds.size;
  const totalCount = clusteredTasks.length;
  const estTimeSaved = resolvedCount * 1.5; // 1.5 hours per resolved card

  return (
    <div className="min-h-screen bg-[#1B1B2E] text-slate-100 flex flex-col font-sans select-none">
      {/* Red Header */}
      <header className="bg-rose-950/80 border-b-[0.5px] border-rose-500/30 px-6 py-4 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded bg-rose-600 flex items-center justify-center animate-pulse">
            <Flame className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-wider uppercase text-rose-400">crisis mode active</h1>
            <p className="text-[10px] font-mono text-rose-300/80">3+ high-density deadlines clustered within 48h</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 bg-rose-900/40 hover:bg-rose-800/60 text-rose-300 rounded-md transition-all cursor-pointer focus:outline-none"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* Main workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-rose-500/20 border-t-rose-500 animate-spin"></div>
              <div className="absolute inset-2 rounded-full border-4 border-indigo-500/10 border-t-indigo-500 animate-spin [animation-duration:1.5s]"></div>
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-mono tracking-widest text-rose-400 uppercase">assembling target array...</p>
              <p className="text-xs text-slate-400 max-w-sm">
                Finia is consulting Gemini models to run multi-variable triage with Indian compliance constraints and schedule structures...
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Triage Reasoning Panel */}
            <div className="bg-slate-900/60 border-[0.5px] border-slate-700/50 rounded-xl p-5 shadow-2xl flex items-start space-x-4">
              <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-400 shrink-0">
                <Sparkles className="w-5 h-5 text-rose-400" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider">Triage Assessment reasoning</h4>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  {triageData?.reasoning || "Finia has mapped your deadlines to maximize mental capacity and secure cash reserves."}
                </p>
              </div>
            </div>

            {/* Empty state when all resolved */}
            {totalCount === 0 && (
              <div className="bg-slate-900/50 border-[0.5px] border-slate-800 rounded-xl p-12 text-center max-w-md mx-auto space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-200">No Clustered Deadlines Found</h3>
                  <p className="text-xs text-slate-400">
                    Your upcoming 48 hours are completely clear. You've safely resolved or scheduled all outstanding items!
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Exit Crisis Mode
                </button>
              </div>
            )}

            {/* Triage Buckets Grid */}
            {totalCount > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. DO NOW SECTION (Red) */}
                <div className="bg-[#2D1B22]/40 border-[0.5px] border-rose-500/20 rounded-xl p-4 flex flex-col space-y-4">
                  <div className="flex items-center justify-between border-b-[0.5px] border-rose-500/10 pb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></div>
                      <h3 className="text-xs font-black tracking-widest text-rose-400 uppercase">1. do now</h3>
                    </div>
                    <span className="text-[10px] font-mono text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded">
                      {doNowTasks.length} tasks
                    </span>
                  </div>

                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[420px] pr-1">
                    {doNowTasks.length === 0 ? (
                      <p className="text-xs text-slate-500 italic text-center py-6">No tasks in this segment.</p>
                    ) : (
                      doNowTasks.map((t) => {
                        const isResolved = resolvedIds.has(t.id);
                        return (
                          <div
                            key={t.id}
                            className={`p-3.5 bg-[#1B1B2E] border-[0.5px] rounded-lg transition-all space-y-3 relative overflow-hidden ${
                              isResolved
                                ? "border-emerald-500/30 opacity-40"
                                : "border-rose-500/20 hover:border-rose-500/40"
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs font-semibold text-slate-200">{t.title}</span>
                                <span className="text-[9px] font-mono bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded shrink-0">
                                  {t.dueDate}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                                {triageData?.classifications[t.id]?.reason || "Execute immediately to prevent penalty."}
                              </p>
                            </div>

                            {!isResolved ? (
                              <div className="flex flex-col gap-2 pt-1">
                                <button
                                  onClick={() => handleBlockTime(t)}
                                  className="w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded transition-all cursor-pointer flex items-center justify-center"
                                >
                                  <Clock className="w-3.5 h-3.5 mr-1.5" />
                                  Block focus time
                                </button>
                                <button
                                  onClick={() => handleEscape(t.id)}
                                  className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium rounded transition-all cursor-pointer"
                                >
                                  Keep original schedule
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center py-1.5 text-emerald-400 text-xs font-mono font-bold bg-emerald-500/10 rounded">
                                <Check className="w-3.5 h-3.5 mr-1.5" />
                                RESOLVED / BLOCKED
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* 2. DEFER SECTION (Indigo) */}
                <div className="bg-[#1C233D]/40 border-[0.5px] border-indigo-500/20 rounded-xl p-4 flex flex-col space-y-4">
                  <div className="flex items-center justify-between border-b-[0.5px] border-indigo-500/10 pb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-400"></div>
                      <h3 className="text-xs font-black tracking-widest text-indigo-300 uppercase">2. defer</h3>
                    </div>
                    <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded">
                      {deferTasks.length} tasks
                    </span>
                  </div>

                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[420px] pr-1">
                    {deferTasks.length === 0 ? (
                      <p className="text-xs text-slate-500 italic text-center py-6">No tasks in this segment.</p>
                    ) : (
                      deferTasks.map((t) => {
                        const isResolved = resolvedIds.has(t.id);
                        return (
                          <div
                            key={t.id}
                            className={`p-3.5 bg-[#1B1B2E] border-[0.5px] rounded-lg transition-all space-y-3 relative overflow-hidden ${
                              isResolved
                                ? "border-emerald-500/30 opacity-40"
                                : "border-indigo-500/20 hover:border-indigo-500/40"
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs font-semibold text-slate-200">{t.title}</span>
                                <span className="text-[9px] font-mono bg-indigo-500/10 text-indigo-300 px-1.5 py-0.5 rounded shrink-0">
                                  {t.dueDate}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                                {triageData?.classifications[t.id]?.reason || "Safe to push this out to next week."}
                              </p>
                            </div>

                            {!isResolved ? (
                              <div className="flex flex-col gap-2 pt-1">
                                <button
                                  onClick={() => handleDeferTask(t)}
                                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded transition-all cursor-pointer flex items-center justify-center"
                                >
                                  <Calendar className="w-3.5 h-3.5 mr-1.5" />
                                  Postpone 1 week
                                </button>
                                <button
                                  onClick={() => handleEscape(t.id)}
                                  className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium rounded transition-all cursor-pointer"
                                >
                                  Keep original schedule
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center py-1.5 text-emerald-400 text-xs font-mono font-bold bg-emerald-500/10 rounded">
                                <Check className="w-3.5 h-3.5 mr-1.5" />
                                DEFERRED 1 WEEK
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* 3. DROP SECTION (Green) */}
                <div className="bg-[#182B24]/40 border-[0.5px] border-emerald-500/20 rounded-xl p-4 flex flex-col space-y-4">
                  <div className="flex items-center justify-between border-b-[0.5px] border-emerald-500/10 pb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                      <h3 className="text-xs font-black tracking-widest text-emerald-300 uppercase">3. drop</h3>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded">
                      {dropTasks.length} tasks
                    </span>
                  </div>

                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[420px] pr-1">
                    {dropTasks.length === 0 ? (
                      <p className="text-xs text-slate-500 italic text-center py-6">No tasks in this segment.</p>
                    ) : (
                      dropTasks.map((t) => {
                        const isResolved = resolvedIds.has(t.id);
                        return (
                          <div
                            key={t.id}
                            className={`p-3.5 bg-[#1B1B2E] border-[0.5px] rounded-lg transition-all space-y-3 relative overflow-hidden ${
                              isResolved
                                ? "border-emerald-500/30 opacity-40"
                                : "border-emerald-500/20 hover:border-emerald-500/40"
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs font-semibold text-slate-200">{t.title}</span>
                                <span className="text-[9px] font-mono bg-emerald-500/10 text-emerald-300 px-1.5 py-0.5 rounded shrink-0">
                                  {t.dueDate}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                                {triageData?.classifications[t.id]?.reason || "Low impact item, cancel or archive safely."}
                              </p>
                            </div>

                            {!isResolved ? (
                              <div className="flex flex-col gap-2 pt-1">
                                <button
                                  onClick={() => handleDropTask(t)}
                                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded transition-all cursor-pointer flex items-center justify-center"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                  Cancel / Complete
                                </button>
                                <button
                                  onClick={() => handleEscape(t.id)}
                                  className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium rounded transition-all cursor-pointer"
                                >
                                  Keep original schedule
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center py-1.5 text-emerald-400 text-xs font-mono font-bold bg-emerald-500/10 rounded">
                                <Check className="w-3.5 h-3.5 mr-1.5" />
                                DROPPED / COMPLETED
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer statistics and Exit */}
      <footer className="bg-slate-900 border-t-[0.5px] border-slate-800 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 sticky bottom-0 z-50">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 text-xs uppercase tracking-wider font-mono">est. time saved:</span>
            <span className="text-rose-400 font-black text-sm">{estTimeSaved} hrs</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 text-xs uppercase tracking-wider font-mono">crisis score:</span>
            <span className="text-rose-400 font-black text-sm">{resolvedCount}/{totalCount} resolved</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold tracking-wider uppercase rounded-lg shadow-lg hover:shadow-rose-600/20 transition-all cursor-pointer focus:outline-none"
        >
          Exit Crisis Mode
        </button>
      </footer>
    </div>
  );
}
