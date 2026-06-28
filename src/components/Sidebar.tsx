import { useState } from "react";
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Wallet,
  Receipt,
  Coins,
  FileText,
  BarChart3,
  LogOut,
  Settings as SettingsIcon,
  ShieldCheck,
  Landmark,
  type LucideIcon,
} from "lucide-react";
import Logo from "./Logo";
import type { FeatureFlags } from "../lib/settings";
import { navigate } from "../lib/router";
import { ActiveView } from "../types";

interface NavItem {
  id?: ActiveView; // a top-level view
  path?: string; // OR a standalone route (e.g. /fixed-deposits)
  label: string;
  icon: LucideIcon;
  flag?: keyof FeatureFlags; // gate by a feature flag
}

const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "tasks", label: "Tasks", icon: CheckSquare },
      { id: "calendar", label: "Calendar", icon: Calendar },
    ],
  },
  {
    title: "Money",
    items: [
      { id: "finance", label: "Finance", icon: Wallet },
      { id: "bills", label: "Bills", icon: Receipt },
      { path: "/fixed-deposits", label: "Fixed Deposits", icon: Landmark, flag: "finance" },
      { id: "tax", label: "Tax", icon: Coins },
    ],
  },
  {
    title: "Library",
    items: [
      { id: "documents", label: "Documents", icon: FileText },
      { id: "analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
];

interface SidebarProps {
  activeView: ActiveView | null;
  setView: (view: ActiveView) => void;
  collapsed: boolean;
  name: string;
  email: string;
  photo: string;
  plan: string;
  flags: FeatureFlags;
  isAdmin: boolean;
  onOpenSettings: () => void;
  onOpenAdmin: () => void;
  onSignOut: () => void;
}

// Which nav items are gated by a feature flag.
const FLAG_FOR: Partial<Record<ActiveView, keyof FeatureFlags>> = {
  finance: "finance", tax: "tax", documents: "documents",
};

function initials(name: string, email: string): string {
  const source = name.trim() || email.trim();
  if (!source) return "U";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function Sidebar({
  activeView,
  setView,
  collapsed,
  name,
  email,
  photo,
  plan,
  flags,
  isAdmin,
  onOpenSettings,
  onOpenAdmin,
  onSignOut,
}: SidebarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const visibleGroups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => {
      const f = i.flag ?? (i.id ? FLAG_FOR[i.id] : undefined);
      return !f || flags[f];
    }),
  })).filter((g) => g.items.length > 0);
  return (
    <aside
      className="hidden md:flex flex-col h-screen bg-navy text-white shrink-0 border-r-[0.5px] border-white/10 transition-[width] duration-200 ease-in-out"
      style={{ width: collapsed ? 52 : 240 }}
    >
      {/* Brand header */}
      <div
        className={`h-16 flex items-center border-b-[0.5px] border-white/10 ${
          collapsed ? "justify-center" : "px-4 gap-3"
        }`}
      >
        <Logo size={collapsed ? 32 : 34} />
        {!collapsed && (
          <div className="leading-tight min-w-0">
            <div className="text-[15px] font-medium">Finia</div>
            <div className="text-[10px] text-white/55">AI life assistant</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-none py-4">
        {visibleGroups.map((group) => (
          <div key={group.title} className={`mb-5 ${collapsed ? "px-2" : "px-3"}`}>
            {!collapsed && (
              <div className="px-2 mb-2 text-[10px] uppercase tracking-wider text-white/40 font-medium">
                {group.title}
              </div>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = !!item.id && activeView === item.id;
                return (
                  <div key={item.id ?? item.path} className="relative group">
                    <button
                      onClick={() => (item.path ? navigate(item.path) : item.id && setView(item.id))}
                      aria-label={item.label}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center rounded-lg text-[13px] transition-colors ${
                        collapsed
                          ? "justify-center h-10 w-10 mx-auto"
                          : "w-full gap-3 px-3 py-2.5"
                      } ${
                        active
                          ? "bg-white/10 text-white font-medium"
                          : "text-white/65 hover:bg-white/5 hover:text-white font-normal"
                      }`}
                    >
                      <Icon
                        size={18}
                        strokeWidth={2}
                        className={active ? "text-pulse" : ""}
                      />
                      {!collapsed && <span>{item.label}</span>}
                    </button>

                    {/* Hover tooltip when collapsed */}
                    {collapsed && (
                      <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 whitespace-nowrap rounded-md bg-navy border-[0.5px] border-white/15 px-2 py-1 text-[11px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Avatar menu */}
      <div className={`relative border-t-[0.5px] border-white/10 ${collapsed ? "py-3 flex justify-center" : "p-3"}`}>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className={`absolute z-50 bg-white rounded-lg border-[0.5px] border-black/10 py-1 w-44 ${collapsed ? "left-full bottom-2 ml-2" : "left-3 right-3 bottom-full mb-2"}`}>
              <MenuItem icon={SettingsIcon} label="Settings" onClick={() => { setMenuOpen(false); onOpenSettings(); }} />
              {isAdmin && <MenuItem icon={ShieldCheck} label="Admin panel" onClick={() => { setMenuOpen(false); onOpenAdmin(); }} accent />}
              <MenuItem icon={LogOut} label="Sign out" onClick={() => { setMenuOpen(false); onSignOut(); }} />
            </div>
          </>
        )}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className={`flex items-center rounded-lg hover:bg-white/5 transition-colors ${collapsed ? "" : "w-full gap-3 px-1 py-1"}`}
          aria-label="Account menu"
        >
          <div className="w-9 h-9 rounded-full overflow-hidden border-[0.5px] border-white/20 flex items-center justify-center bg-pulse/20 shrink-0">
            {photo ? <img src={photo} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : <span className="text-[11px] font-medium text-white">{initials(name, email)}</span>}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1 text-left">
              <div className="text-[12px] font-medium truncate flex items-center gap-1.5">{name || "You"}{isAdmin && <ShieldCheck size={11} className="text-pulse" />}</div>
              <div className="text-[10px] text-white/45 truncate capitalize">{plan} plan</div>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}

function MenuItem({ icon: Icon, label, onClick, accent }: { icon: LucideIcon; label: string; onClick: () => void; accent?: boolean }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-surface transition-colors ${accent ? "text-tax" : "text-slate-700"}`}>
      <Icon size={14} /> {label}
    </button>
  );
}
