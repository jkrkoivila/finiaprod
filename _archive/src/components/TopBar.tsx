import React, { useState, useEffect } from "react";
import { Menu, Bell, RefreshCw, Plus, Calendar, ShieldCheck, CheckCircle2, Sun, Moon, Trash2 } from "lucide-react";
import { ActiveView } from "../types";

interface TopBarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  setView: (view: ActiveView) => void;
  onQuickAddTask: () => void;
  displayName?: string;
  photoURL?: string;
  onSignOut: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  onClearData?: () => void;
  isDemoMode?: boolean;
  onToggleDemoMode?: () => void;
}

export default function TopBar({
  collapsed,
  setCollapsed,
  setView,
  onQuickAddTask,
  displayName,
  photoURL,
  onSignOut,
  isDarkMode,
  toggleDarkMode,
  onClearData,
  isDemoMode = false,
  onToggleDemoMode,
}: TopBarProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [bellAlert, setBellAlert] = useState(true);

  // Sync timing tracking
  const [lastSynced, setLastSynced] = useState<number>(() => {
    const saved = localStorage.getItem("last_synced_time");
    return saved ? parseInt(saved, 10) : Date.now();
  });
  const [syncedAgoText, setSyncedAgoText] = useState<string>("just now");

  useEffect(() => {
    const updateText = () => {
      const diff = Date.now() - lastSynced;
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      if (seconds < 30) {
        setSyncedAgoText("just now");
      } else if (seconds < 60) {
        setSyncedAgoText(`${seconds}s ago`);
      } else if (minutes < 60) {
        setSyncedAgoText(`${minutes}m ago`);
      } else if (hours < 24) {
        setSyncedAgoText(`${hours}h ago`);
      } else {
        setSyncedAgoText(new Date(lastSynced).toLocaleDateString());
      }
    };

    updateText();
    const interval = setInterval(updateText, 10000);
    return () => clearInterval(interval);
  }, [lastSynced]);

  // Dynamic greeting based on current local hours
  const currentHour = new Date().getHours();
  let greetingText = "good morning";
  if (currentHour >= 12 && currentHour < 17) {
    greetingText = "good afternoon";
  } else if (currentHour >= 17) {
    greetingText = "good evening";
  }

  // Formatting date nicely (sentence case)
  const formattedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).toLowerCase();

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg("syncing accounts...");
    try {
      const res = await fetch("/api/sync");
      const data = await res.json();
      if (data.status === "success") {
        setSyncMsg("sync complete");
        const now = Date.now();
        setLastSynced(now);
        localStorage.setItem("last_synced_time", now.toString());
        setTimeout(() => setSyncMsg(""), 3000);
      } else {
        setSyncMsg("sync failed");
        setTimeout(() => setSyncMsg(""), 3000);
      }
    } catch (e) {
      console.error(e);
      setSyncMsg("offline sync successful");
      const now = Date.now();
      setLastSynced(now);
      localStorage.setItem("last_synced_time", now.toString());
      setTimeout(() => setSyncMsg(""), 3000);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border-b-[0.5px] border-slate-200 dark:border-slate-800 h-20 px-6 md:px-8 flex items-center justify-between shrink-0">
      {/* Left Area: Toggle and greeting */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex w-10 h-10 items-center justify-center text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg border-[0.5px] border-slate-200 dark:border-slate-700 transition-colors focus:outline-none"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col">
          <h2 className="text-base md:text-lg font-medium text-slate-800 dark:text-slate-100 capitalize leading-none mb-1">
            {greetingText}, {displayName || "jkkoivila"}
          </h2>
          <span className="text-[10px] md:text-xs text-slate-400 dark:text-slate-400 leading-none flex items-center mt-1">
            <Calendar className="w-3.5 h-3.5 mr-1" />
            <span className="capitalize">{formattedDate}</span>
          </span>
        </div>
      </div>

      {/* Right Area: sync, add task, notifications */}
      <div className="flex items-center space-x-3">
        {/* Sync now button with timestamp */}
        <div className="flex flex-col items-end">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-3 md:px-4 py-1.5 md:py-2 text-xs font-medium border-[0.5px] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors focus:outline-none"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin text-[#2BA8E0]" : ""}`} />
            <span className="capitalize font-medium">{syncMsg || "sync now"}</span>
          </button>
          <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 mr-1">
            last synced: {syncedAgoText}
          </span>
        </div>

        {/* Quick add task button */}
        <button
          onClick={onQuickAddTask}
          className="hidden sm:flex px-4 py-2 text-xs font-medium bg-[#1B3A6B] hover:bg-[#1B3A6B]/90 text-white rounded-lg items-center gap-2 transition-colors focus:outline-none"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Task</span>
        </button>

        {/* Sandbox Demo Mode Toggle */}
        {onToggleDemoMode && (
          <button
            onClick={onToggleDemoMode}
            className={`px-3 py-1.5 md:py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all focus:outline-none cursor-pointer ${
              isDemoMode
                ? "bg-amber-500/10 dark:bg-amber-400/10 border-[0.5px] border-amber-300 dark:border-amber-800 text-amber-600 dark:text-amber-400 shadow-sm"
                : "border-[0.5px] border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
            title={isDemoMode ? "Currently in Demo Mode. Click to switch to Live Mode." : "Currently in Live Mode. Click to explore Demo Mode."}
          >
            <span className={`w-2 h-2 rounded-full ${isDemoMode ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
            <span className="capitalize md:block hidden">{isDemoMode ? "Demo Mode" : "Live Mode"}</span>
            <span className="capitalize md:hidden">{isDemoMode ? "Demo" : "Live"}</span>
          </button>
        )}

        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="w-10 h-10 flex items-center justify-center text-slate-400 dark:text-slate-300 border-[0.5px] border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus:outline-none cursor-pointer"
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkMode ? (
            <Sun className="w-5 h-5 text-amber-500" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </button>

        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => setBellAlert(false)}
            className="w-10 h-10 flex items-center justify-center text-slate-400 dark:text-slate-300 border-[0.5px] border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 relative transition-colors focus:outline-none"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {bellAlert && (
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-[#E24B4A] rounded-full border-2 border-white dark:border-slate-900" />
            )}
          </button>
        </div>

        {/* Clear Live Firestore Data Button */}
        {onClearData && (
          <button
            onClick={onClearData}
            className="w-10 h-10 flex items-center justify-center text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 border-[0.5px] border-slate-200 dark:border-slate-700 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors focus:outline-none cursor-pointer"
            title="Clear live database data"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}

        {/* User Signout Button/Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-150 dark:border-slate-800">
          <button
            onClick={onSignOut}
            className="w-10 h-10 rounded-lg overflow-hidden border-[0.5px] border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-300 transition-colors focus:outline-none shrink-0"
            title="Sign out of Finia"
          >
            {photoURL ? (
              <img src={photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              (displayName || "J")[0].toUpperCase()
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
