import React from "react";
import { 
  LayoutDashboard, CheckSquare, Sparkles, Wallet, Coins 
} from "lucide-react";
import { ActiveView } from "../types";

interface MobileTabsProps {
  activeView: ActiveView;
  setView: (view: ActiveView) => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
}

export default function MobileTabs({ activeView, setView, chatOpen, setChatOpen }: MobileTabsProps) {
  
  const handleFiniaClick = () => {
    setChatOpen(!chatOpen);
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t-[0.5px] border-slate-200 h-16 px-4 flex items-center justify-between z-40 pb-safe shadow-lg">
      
      {/* Home / Dashboard Tab */}
      <button
        onClick={() => {
          setView("dashboard");
          setChatOpen(false);
        }}
        className={`flex-1 flex flex-col items-center justify-center space-y-1 h-full ${
          activeView === "dashboard" && !chatOpen ? "text-[#1B3A6B]" : "text-slate-400"
        }`}
      >
        <LayoutDashboard className="w-5 h-5" />
        <span className="text-[10px] font-medium capitalize">home</span>
      </button>

      {/* Tasks Tab */}
      <button
        onClick={() => {
          setView("tasks");
          setChatOpen(false);
        }}
        className={`flex-1 flex flex-col items-center justify-center space-y-1 h-full ${
          activeView === "tasks" && !chatOpen ? "text-[#2563EB]" : "text-slate-400"
        }`}
      >
        <CheckSquare className="w-5 h-5" />
        <span className="text-[10px] font-medium capitalize">tasks</span>
      </button>

      {/* Center Elevated Finia Tab */}
      <div className="flex-1 flex flex-col items-center justify-center h-full relative">
        <button
          onClick={handleFiniaClick}
          className={`absolute -top-5 w-12 h-12 rounded-full border-[0.5px] flex items-center justify-center transition-transform hover:scale-105 active:scale-95 focus:outline-none ${
            chatOpen 
              ? "bg-[#2BA8E0] text-white border-[#2BA8E0]" 
              : "bg-[#1B3A6B] text-white border-[#1B3A6B]"
          }`}
          style={{ boxShadow: "0 -2px 10px rgba(27, 58, 107, 0.15)" }}
        >
          {/* Embedding pulse line as miniature graphic inside center elevated button */}
          <svg viewBox="0 0 512 512" className="w-6 h-6 fill-none stroke-current">
            <path d="M 80 256 L 180 256 L 200 290 L 230 110 L 260 410 L 290 290 L 310 256 L 432 256" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="230" cy="110" r="30" fill="white" stroke="none" />
          </svg>
        </button>
        <span className="text-[10px] font-medium text-slate-400 mt-8 capitalize">finia</span>
      </div>

      {/* Finance Tab */}
      <button
        onClick={() => {
          setView("finance");
          setChatOpen(false);
        }}
        className={`flex-1 flex flex-col items-center justify-center space-y-1 h-full ${
          activeView === "finance" && !chatOpen ? "text-[#0F766E]" : "text-slate-400"
        }`}
      >
        <Wallet className="w-5 h-5" />
        <span className="text-[10px] font-medium capitalize">finance</span>
      </button>

      {/* Tax Tab */}
      <button
        onClick={() => {
          setView("tax");
          setChatOpen(false);
        }}
        className={`flex-1 flex flex-col items-center justify-center space-y-1 h-full ${
          activeView === "tax" && !chatOpen ? "text-[#6D28D9]" : "text-slate-400"
        }`}
      >
        <Coins className="w-5 h-5" />
        <span className="text-[10px] font-medium capitalize">tax</span>
      </button>

    </div>
  );
}
