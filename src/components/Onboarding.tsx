import { useState } from "react";
import { Mail, CalendarClock, Coins, ArrowRight } from "lucide-react";
import Logo from "./Logo";

interface OnboardingProps {
  name: string;
  onComplete: () => Promise<void> | void;
}

const HIGHLIGHTS = [
  { icon: Mail, title: "Connect Gmail", body: "Read-only — Finia finds bills, due dates, and receipts for you." },
  { icon: CalendarClock, title: "Let the agent act", body: "Create tasks, block focus time, and set reminders by just asking." },
  { icon: Coins, title: "See your tax picture", body: "Old vs new regime compared for FY 2025-26, from your real numbers." },
];

/**
 * First-run onboarding. Minimal for now — completing it sets `onboarded: true`
 * and the router sends the user on to the dashboard. (Full multi-step tour TBD.)
 */
export default function Onboarding({ name, onComplete }: OnboardingProps) {
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    setBusy(true);
    await onComplete();
    // Parent navigates to /dashboard once the profile flag is written.
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg bg-white rounded-xl border-[0.5px] border-black/10 p-8">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <div>
            <div className="text-[16px] font-medium text-navy">
              Welcome{name ? `, ${name}` : ""}
            </div>
            <div className="text-[12px] text-slate-500">Let's set up your assistant.</div>
          </div>
        </div>

        <div className="mt-7 space-y-3">
          {HIGHLIGHTS.map((h) => {
            const Icon = h.icon;
            return (
              <div key={h.title} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-navy/5 flex items-center justify-center shrink-0">
                  <Icon size={17} className="text-navy" />
                </div>
                <div>
                  <div className="text-[13px] font-medium text-navy">{h.title}</div>
                  <div className="text-[12px] text-slate-500 leading-relaxed">{h.body}</div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={finish}
          disabled={busy}
          className="mt-8 w-full h-11 rounded-lg bg-navy text-white text-[14px] font-medium flex items-center justify-center gap-2 hover:bg-navy/90 transition-colors disabled:opacity-60"
        >
          {busy ? (
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Continue to dashboard
              <ArrowRight size={16} />
            </>
          )}
        </button>
        <p className="mt-3 text-center text-[11px] text-slate-400">
          You can connect Gmail and complete your profile from inside the app.
        </p>
      </div>
    </div>
  );
}
