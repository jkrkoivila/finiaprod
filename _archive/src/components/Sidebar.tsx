import React from "react";
import { 
  LayoutDashboard, CheckSquare, Calendar, Wallet, Receipt, 
  Coins, FileText, BarChart2, ChevronLeft, ChevronRight, User
} from "lucide-react";
import { ActiveView } from "../types";

interface SidebarProps {
  activeView: ActiveView;
  setView: (view: ActiveView) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export default function Sidebar({ activeView, setView, collapsed, setCollapsed }: SidebarProps) {
  
  const navGroups = [
    {
      title: "overview",
      items: [
        { id: "dashboard", label: "dashboard", icon: LayoutDashboard },
        { id: "tasks", label: "tasks", icon: CheckSquare },
        { id: "calendar", label: "calendar", icon: Calendar },
      ]
    },
    {
      title: "money",
      items: [
        { id: "finance", label: "finance", icon: Wallet },
        { id: "bills", label: "bills", icon: Receipt },
        { id: "tax", label: "tax", icon: Coins },
      ]
    },
    {
      title: "library",
      items: [
        { id: "documents", label: "documents", icon: FileText },
        { id: "analytics", label: "analytics", icon: BarChart2 },
      ]
    }
  ];

  return (
    <div 
      className="hidden md:flex flex-col h-screen bg-[#1B3A6B] text-white select-none transition-all duration-300 ease-in-out shrink-0 border-r-[0.5px] border-white/10"
      style={{ width: collapsed ? "64px" : "240px" }}
    >
      {/* Brand logo header */}
      <div className="p-4 border-b-[0.5px] border-white/10 flex items-center gap-3">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center p-1.5 shrink-0">
              <div className="w-full h-full bg-[#1B3A6B] rounded-lg flex items-center justify-center relative">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-4 h-4">
                  <path d="M2 12h3l2-5 4 10 3-5h3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="absolute top-1 right-1.5 w-1 h-1 bg-[#2BA8E0] rounded-full"></div>
              </div>
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight tracking-tight font-sans">finia.</h1>
              <p className="text-[10px] text-white/60 leading-none font-sans">ai life assistant</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-9 h-9 bg-white rounded-xl flex items-center justify-center p-1.5 shrink-0">
            <div className="w-full h-full bg-[#1B3A6B] rounded-lg flex items-center justify-center relative">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-4 h-4">
                <path d="M2 12h3l2-5 4 10 3-5h3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto pt-6 space-y-6 scrollbar-none">
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-1.5 px-3">
            {!collapsed && (
              <span className="text-[10px] text-white/40 font-semibold uppercase tracking-wider block px-2.5 mb-2">
                {group.title}
              </span>
            )}
            <div className="space-y-[2px]">
              {group.items.map((item) => {
                const IconComponent = item.icon;
                const isActive = activeView === item.id;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => setView(item.id as ActiveView)}
                    className={`w-full flex items-center space-x-3 px-3 py-2.5 text-xs font-medium rounded-lg transition-colors ${
                      isActive 
                        ? "bg-white/15 text-white" 
                        : "text-white/60 hover:bg-white/5 hover:text-white"
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <IconComponent className={`w-4 h-4 shrink-0 ${isActive ? "text-[#2BA8E0]" : ""}`} />
                    {!collapsed && <span className="capitalize">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Collapsed bottom Profile / avatar */}
      <div className="p-4 border-t-[0.5px] border-white/10">
        <div className="flex items-center gap-3 px-1 py-1">
          <div className="w-8 h-8 rounded-full bg-[#2BA8E0] flex items-center justify-center font-bold text-xs text-[#1B3A6B] shrink-0">
            JK
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white truncate">jkkoivila</p>
              <p className="text-[10px] text-white/40 font-mono truncate">Pro account</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
