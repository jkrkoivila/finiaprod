import { Fragment } from "react";
import { Home, CheckSquare, Wallet, Coins, type LucideIcon } from "lucide-react";
import Logo from "./Logo";
import { ActiveView } from "../types";

interface Tab {
  id: ActiveView;
  label: string;
  icon: LucideIcon;
}

const TABS: Tab[] = [
  { id: "dashboard", label: "Home", icon: Home },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  // center "Finia" button is rendered separately
  { id: "finance", label: "Finance", icon: Wallet },
  { id: "tax", label: "Tax", icon: Coins },
];

interface MobileTabsProps {
  activeView: ActiveView | null;
  setView: (view: ActiveView) => void;
  onOpenChat: () => void;
}

function TabButton({
  tab,
  active,
  onClick,
}: {
  tab: Tab;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = tab.icon;
  return (
    <button
      onClick={onClick}
      aria-label={tab.label}
      aria-current={active ? "page" : undefined}
      className="flex flex-col items-center justify-center gap-1 h-full"
    >
      <Icon
        size={20}
        strokeWidth={2}
        className={active ? "text-pulse" : "text-slate-400"}
      />
      <span
        className={`text-[10px] ${
          active ? "text-navy font-medium" : "text-slate-400 font-normal"
        }`}
      >
        {tab.label}
      </span>
    </button>
  );
}

export default function MobileTabs({ activeView, setView, onOpenChat }: MobileTabsProps) {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 h-16 bg-white border-t-[0.5px] border-black/10">
      <div className="grid grid-cols-5 h-full items-center">
        {TABS.slice(0, 2).map((t) => (
          <Fragment key={t.id}>
            <TabButton
              tab={t}
              active={activeView === t.id}
              onClick={() => setView(t.id)}
            />
          </Fragment>
        ))}

        {/* Center, elevated Finia button — raised with a surface-coloured ring
            instead of a shadow to stay within the flat brand */}
        <div className="flex justify-center">
          <button
            onClick={onOpenChat}
            aria-label="Open Finia assistant"
            className="-mt-7 w-14 h-14 rounded-full bg-navy border-4 border-surface flex items-center justify-center active:scale-95 transition-transform"
          >
            <Logo size={30} withSquare={false} />
          </button>
        </div>

        {TABS.slice(2).map((t) => (
          <Fragment key={t.id}>
            <TabButton
              tab={t}
              active={activeView === t.id}
              onClick={() => setView(t.id)}
            />
          </Fragment>
        ))}
      </div>
    </nav>
  );
}
