import { useState } from "react";
import {
  Mail,
  CalendarClock,
  Scale,
  Flame,
  FolderOpen,
  Sparkles,
  ArrowRight,
  Check,
  type LucideIcon,
} from "lucide-react";
import Logo from "./Logo";
import { useAuth } from "../lib/auth";

interface Advantage {
  icon: LucideIcon;
  title: string;
  body: string;
  color: string;
}

const ADVANTAGES: Advantage[] = [
  {
    icon: Mail,
    title: "Automatic Gmail bill detection",
    body: "Finia scans your inbox read-only and pulls out bills, due dates, and receipts — no manual entry.",
    color: "#0F766E",
  },
  {
    icon: CalendarClock,
    title: "An AI agent that books your calendar",
    body: "Ask Finia to create tasks, block focus time, and set reminders. It acts, not just chats.",
    color: "#2563EB",
  },
  {
    icon: Scale,
    title: "Old vs new tax regime, compared",
    body: "See which FY 2025-26 regime saves you more, with a payslip analyser and AI tax expert.",
    color: "#6D28D9",
  },
  {
    icon: Flame,
    title: "Crisis mode for clustered deadlines",
    body: "When several deadlines pile up, Finia triages them into do-now, defer, and drop.",
    color: "#E24B4A",
  },
  {
    icon: FolderOpen,
    title: "All your documents in one place",
    body: "Statements, payslips, and proofs — imported, categorised, and searchable in one library.",
    color: "#1B3A6B",
  },
  {
    icon: Sparkles,
    title: "Built on Google Gemini, free to use",
    body: "Powered by Gemini for extraction and reasoning. No subscription, no paywall.",
    color: "#2BA8E0",
  },
];

const STEPS = [
  { n: 1, title: "Sign in", body: "One tap with Google. No passwords, no setup forms." },
  { n: 2, title: "Connect Gmail", body: "Grant read-only access so Finia can find your bills and deadlines." },
  { n: 3, title: "Finia does the rest", body: "Your tasks, money, and tax show up organised — automatically." },
];

export default function LandingPage() {
  const { signInWithGoogle, error } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleAuth = async () => {
    setBusy(true);
    await signInWithGoogle();
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-surface text-slate-800">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-navy/95 backdrop-blur border-b-[0.5px] border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size={30} />
            <span className="text-white text-[15px] font-medium">Finia</span>
          </div>
          <button
            onClick={handleAuth}
            disabled={busy}
            className="h-9 px-4 rounded-lg text-[13px] font-medium text-white border-[0.5px] border-white/25 hover:bg-white/10 transition-colors disabled:opacity-60"
          >
            Sign in
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-navy text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 flex flex-col items-center text-center">
          <Logo size={56} />
          <h1 className="mt-6 text-[30px] sm:text-[40px] font-medium leading-tight max-w-3xl text-balance">
            Your AI for deadlines, money, and tax — all in one place
          </h1>
          <p className="mt-4 text-[15px] sm:text-[16px] text-white/70 max-w-xl leading-relaxed">
            Finia reads your bills from Gmail, tracks what you owe, compares tax
            regimes, and keeps every deadline in view. One assistant for your whole
            financial life.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={handleAuth}
              disabled={busy}
              className="h-11 px-6 rounded-lg bg-white text-navy text-[14px] font-medium flex items-center gap-2 hover:bg-white/90 transition-colors disabled:opacity-60"
            >
              {busy ? (
                <span className="w-4 h-4 border-2 border-navy/40 border-t-navy rounded-full animate-spin" />
              ) : (
                <GoogleG />
              )}
              Sign up free
            </button>
            <button
              onClick={handleAuth}
              disabled={busy}
              className="h-11 px-6 rounded-lg text-white text-[14px] font-medium border-[0.5px] border-white/25 hover:bg-white/10 transition-colors disabled:opacity-60"
            >
              Sign in
            </button>
          </div>
          {error && <p className="mt-4 text-[12px] text-rose-200">{error}</p>}
          <p className="mt-5 text-[12px] text-white/45">
            Free to use · Google sign-in · Read-only Gmail access
          </p>
        </div>
      </section>

      {/* Advantages */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-10">
          <h2 className="text-[22px] sm:text-[26px] font-medium text-navy text-balance">
            Everything your money needs, in one assistant
          </h2>
          <p className="mt-2 text-[14px] text-slate-500 max-w-xl mx-auto">
            Six things Finia does that you'd otherwise juggle across half a dozen apps.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ADVANTAGES.map((a) => {
            const Icon = a.icon;
            return (
              <div
                key={a.title}
                className="bg-white rounded-xl border-[0.5px] border-black/10 p-5"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: `${a.color}14` }}
                >
                  <Icon size={19} style={{ color: a.color }} />
                </div>
                <h3 className="text-[14px] font-medium text-navy">{a.title}</h3>
                <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed">{a.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white border-y-[0.5px] border-black/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-10">
            <h2 className="text-[22px] sm:text-[26px] font-medium text-navy">How it works</h2>
            <p className="mt-2 text-[14px] text-slate-500">Up and running in under a minute.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-xl border-[0.5px] border-black/10 p-5 bg-surface">
                <div className="w-8 h-8 rounded-full bg-navy text-white text-[13px] font-medium flex items-center justify-center">
                  {s.n}
                </div>
                <h3 className="mt-3 text-[14px] font-medium text-navy">{s.title}</h3>
                <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison strip */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="bg-navy rounded-2xl p-8 sm:p-10 text-white">
          <h2 className="text-[20px] sm:text-[24px] font-medium text-balance max-w-2xl">
            No other app does tasks, money, and tax together
          </h2>
          <p className="mt-2 text-[14px] text-white/65 max-w-2xl">
            You'd normally stitch together a to-do app, a budgeting app, and a tax tool.
            Finia is all three — and it's free.
          </p>
          <div className="mt-7 grid grid-cols-1 sm:grid-cols-4 gap-3">
            {[
              { label: "To-do apps", note: "Tasks only" },
              { label: "Budgeting apps", note: "Money only" },
              { label: "Tax tools", note: "Tax only" },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-lg border-[0.5px] border-white/15 bg-white/5 px-4 py-3"
              >
                <div className="text-[13px] font-medium text-white/90">{c.label}</div>
                <div className="text-[11px] text-white/50 mt-0.5">{c.note}</div>
              </div>
            ))}
            <div className="rounded-lg border-[0.5px] border-pulse/40 bg-pulse/15 px-4 py-3">
              <div className="text-[13px] font-medium text-white flex items-center gap-1.5">
                <Check size={14} className="text-pulse" /> Finia
              </div>
              <div className="text-[11px] text-pulse mt-0.5">All three · free</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <footer className="bg-navy text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 flex flex-col items-center text-center">
          <Logo size={44} />
          <h2 className="mt-5 text-[24px] sm:text-[28px] font-medium text-balance max-w-2xl">
            Start managing deadlines, money, and tax — free
          </h2>
          <button
            onClick={handleAuth}
            disabled={busy}
            className="mt-7 h-11 px-6 rounded-lg bg-white text-navy text-[14px] font-medium flex items-center gap-2 hover:bg-white/90 transition-colors disabled:opacity-60"
          >
            {busy ? (
              <span className="w-4 h-4 border-2 border-navy/40 border-t-navy rounded-full animate-spin" />
            ) : (
              <GoogleG />
            )}
            Sign up free
            <ArrowRight size={16} />
          </button>
          <p className="mt-10 text-[12px] text-white/40 border-t-[0.5px] border-white/10 pt-6 w-full">
            Finia · Your AI for deadlines, money, and tax · Powered by Google Gemini
          </p>
        </div>
      </footer>
    </div>
  );
}

function GoogleG() {
  return (
    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
