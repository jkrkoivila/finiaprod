import React, { useState, useEffect } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider, db } from "../lib/firebase";
import { collection, addDoc, setDoc, doc } from "firebase/firestore";
import {
  ShieldCheck,
  Mail,
  AlertCircle,
  Sparkles,
  Calendar,
  Lock,
  ArrowRight,
  Check,
  Bot,
  Bell,
  Activity,
  UserCheck,
  CreditCard,
  Tv,
  CheckCircle,
  FileText
} from "lucide-react";

interface OnboardingProps {
  user: any;
  onComplete: (demoMode: boolean) => void;
}

export default function Onboarding({ user, onComplete }: OnboardingProps) {
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skippedSeeding, setSkippedSeeding] = useState(false);

  // Scanning simulation states
  const [scanIndex, setScanIndex] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const [scannedItems, setScannedItems] = useState<Array<{ name: string; count: number; status: "scanning" | "done" }>>([
    { name: "Checking Gmail bills & invoices", count: 0, status: "scanning" },
    { name: "Reading regulatory tax deadlines", count: 0, status: "scanning" },
    { name: "Sourcing UPI & bank receipts", count: 0, status: "scanning" },
    { name: "Locating recurring subscriptions", count: 0, status: "scanning" },
  ]);

  // Wow moment items
  const foundItems = [
    {
      title: "HDFC Credit Card Statement",
      amount: "₹12,500",
      detail: "Due on June 30, 2026",
      source: "billing@hdfcbank.com",
      color: "border-l-[#1B3A6B] bg-slate-50/70",
      icon: <CreditCard className="w-4 h-4 text-[#1B3A6B]" />,
      badge: "Credit Card"
    },
    {
      title: "ITR-1 Filing Deadline",
      amount: "AY 2026-27",
      detail: "Due on July 31, 2026",
      source: "incometax.gov.in",
      color: "border-l-purple-500 bg-purple-50/40",
      icon: <FileText className="w-4 h-4 text-purple-600" />,
      badge: "Tax Deadline"
    },
    {
      title: "Swiggy Dinner Receipt",
      amount: "₹480",
      detail: "Paid on June 24, 2026",
      source: "noreply@swiggy.in",
      color: "border-l-teal-500 bg-teal-50/40",
      icon: <Check className="w-4 h-4 text-teal-600" />,
      badge: "UPI Expense"
    },
    {
      title: "Netflix Premium Renewal",
      amount: "₹649/mo",
      detail: "Next charge July 2, 2026",
      source: "info@netflix.com",
      color: "border-l-rose-500 bg-rose-50/40",
      icon: <Tv className="w-4 h-4 text-rose-600" />,
      badge: "Subscription"
    }
  ];

  // If the user is already authenticated but is on steps 1 or 2, jump directly to step 3 (permissions)
  useEffect(() => {
    if (user && step < 3) {
      setStep(3);
    }
  }, [user, step]);

  // Step 4 scan effect
  useEffect(() => {
    if (step !== 4) return;

    let progressTimer = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressTimer);
          // Auto-advance to Step 5
          setTimeout(() => setStep(5), 600);
          return 100;
        }
        return prev + 2;
      });
    }, 80);

    let itemTimer = setInterval(() => {
      setScanIndex((prevIndex) => {
        if (prevIndex >= 3) {
          clearInterval(itemTimer);
          return 3;
        }
        // Mark previous as done and current as scanning
        setScannedItems((prev) => {
          const updated = [...prev];
          updated[prevIndex] = {
            ...updated[prevIndex],
            status: "done",
            count: prevIndex === 0 ? 3 : prevIndex === 1 ? 2 : prevIndex === 2 ? 4 : 2
          };
          return updated;
        });
        return prevIndex + 1;
      });
    }, 1500);

    return () => {
      clearInterval(progressTimer);
      clearInterval(itemTimer);
    };
  }, [step]);

  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      // Let the useEffect move to Step 3 once auth completes
    } catch (err: any) {
      console.error("Google Sign-In Error: ", err);
      if (err.code === "auth/popup-blocked") {
        setError("Sign-in popup was blocked. Please enable popups.");
      } else if (err.code === "auth/popup-closed-by-user") {
        setError("Popup closed before completion. Please try again.");
      } else {
        setError(err.message || "An error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Seed user data from Step 5 "Add all to Finia"
  const handleAddAllToFinia = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const uid = user.uid;

      if (uid === "demo-user") {
        setSkippedSeeding(false);
        setStep(6);
        return;
      }

      // Ensure base user profile is set in Firestore
      await setDoc(doc(db, "users", uid), {
        uid,
        email: user.email || "",
        displayName: user.displayName || "",
        photoURL: user.photoURL || "",
        createdAt: new Date().toISOString()
      }, { merge: true });

      // Ensure base tax profile exists
      await setDoc(doc(db, "taxProfile", uid), {
        userId: uid,
        grossIncome: 0,
        deduction80C: 0,
        deduction80D: 0,
        hraReceived: 0,
        homeLoanInterest: 0,
        deduction80CCD: 0,
        deduction80E: 0,
        deduction80G: 0,
      }, { merge: true });

      setSkippedSeeding(false); // Flags that user wants to explore Demo Mode
      setStep(6);
    } catch (err) {
      console.error(err);
      alert("Error initializing profile: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Organic startup (skip seeding default data)
  const handleStartOrganic = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const uid = user.uid;

      if (uid === "demo-user") {
        setSkippedSeeding(true);
        setStep(6);
        return;
      }

      // Initialize basic empty user record and clean taxProfile, no mock items
      await setDoc(doc(db, "users", uid), {
        uid,
        email: user.email || "",
        displayName: user.displayName || "",
        photoURL: user.photoURL || "",
        createdAt: new Date().toISOString()
      }, { merge: true });

      await setDoc(doc(db, "taxProfile", uid), {
        userId: uid,
        grossIncome: 0,
        deduction80C: 0,
        deduction80D: 0,
        hraReceived: 0,
        homeLoanInterest: 0,
        deduction80CCD: 0,
        deduction80E: 0,
        deduction80G: 0,
      }, { merge: true });

      setSkippedSeeding(true);
      setStep(6);
    } catch (err) {
      console.error(err);
      alert("Error preparing environment: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col justify-between bg-gradient-to-br from-[#0B1528] via-[#112240] to-[#1B3A6B] text-white p-6 relative overflow-hidden font-sans">
      
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#2BA8E0]/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none" />

      {/* Top Header: Progress Bar */}
      <div className="max-w-md w-full mx-auto pt-4 relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <svg viewBox="0 0 512 512" className="w-5 h-5 fill-none stroke-[#2BA8E0]">
              <path d="M 80 256 L 180 256 L 200 290 L 230 110 L 260 410 L 290 290 L 310 256 L 432 256" strokeWidth="32" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="230" cy="110" r="32" fill="#2BA8E0" stroke="none" />
            </svg>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">finia onboarding</span>
          </div>
          <span className="text-xs font-mono text-slate-400">Step {step} of 6</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/30">
          <div
            className="h-full bg-gradient-to-r from-[#2BA8E0] to-purple-500 transition-all duration-300 rounded-full"
            style={{ width: `${(step / 6) * 100}%` }}
          />
        </div>
      </div>

      {/* STEP 1: SPLASH */}
      {step === 1 && (
        <div className="max-w-md w-full mx-auto my-auto relative z-10 flex flex-col items-center text-center space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#1B3A6B] to-[#2BA8E0] p-[2px] flex items-center justify-center shadow-2xl relative">
            <div className="absolute inset-0 bg-[#2BA8E0]/20 rounded-3xl blur-md animate-pulse" />
            <div className="w-full h-full bg-[#112240] rounded-[22px] flex items-center justify-center relative">
              <span className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-[#2BA8E0] to-purple-400 font-mono">
                F
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold tracking-tight">Finia</h2>
            <p className="text-sm text-[#2BA8E0] font-semibold uppercase tracking-widest">intelligent companion</p>
          </div>

          <p className="text-sm text-slate-300 max-w-xs leading-relaxed">
            Manage bills, track regulatory tax compliance deadlines, file tax structures, and optimize cashflow with real-time AI assistance.
          </p>

          <button
            onClick={() => setStep(2)}
            className="w-full h-12 bg-gradient-to-r from-[#2BA8E0] to-purple-600 hover:opacity-90 active:scale-[0.98] rounded-xl text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
          >
            <span>Get started — it's free</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* STEP 2: SIGN-IN */}
      {step === 2 && (
        <div className="max-w-md w-full mx-auto my-auto relative z-10 bg-[#112240]/80 backdrop-blur-md p-8 rounded-2xl border border-slate-700/50 shadow-2xl flex flex-col items-center">
          <div className="mb-6 relative flex items-center justify-center">
            <div className="absolute w-20 h-20 bg-[#2BA8E0]/10 rounded-full blur-xl animate-pulse" />
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#1B3A6B] to-[#2BA8E0] p-[1px] flex items-center justify-center shadow-lg relative">
              <div className="w-full h-full bg-[#112240] rounded-[14px] flex items-center justify-center">
                <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-[#2BA8E0] to-[#6D28D9] font-mono">
                  F
                </span>
              </div>
            </div>
          </div>

          <h3 className="text-xl font-extrabold tracking-tight text-center mb-1 bg-clip-text text-transparent bg-gradient-to-r from-white to-[#2BA8E0]">
            Create your account
          </h3>
          <p className="text-xs text-slate-400 text-center mb-6 max-w-xs leading-relaxed">
            Connect securely with Google to feed compliance structures and calendar schedules inside Finia.
          </p>

          {error && (
            <div className="w-full mb-4 p-3 bg-red-950/40 border border-red-500/30 text-red-200 rounded-lg flex items-start space-x-2 text-xs">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full h-12 rounded-xl bg-white hover:bg-slate-100 text-slate-800 text-sm font-semibold flex items-center justify-center gap-3 shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus:outline-none cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-slate-800 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          <button
            onClick={() => onComplete(true)}
            className="w-full mt-3 h-11 border border-slate-700 hover:bg-slate-800/40 text-slate-300 text-xs font-semibold rounded-xl transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center"
          >
            Explore guest Sandbox Mode
          </button>

          <div className="mt-6 flex items-start space-x-2 text-[10px] text-slate-400 max-w-[260px]">
            <Mail className="w-3.5 h-3.5 text-[#2BA8E0] shrink-0 mt-0.5" />
            <span className="leading-normal text-left">
              Read-only Gmail access. We never send emails, access folders or make payments.
            </span>
          </div>
        </div>
      )}

      {/* STEP 3: PERMISSIONS EXPLANATION */}
      {step === 3 && (
        <div className="max-w-md w-full mx-auto my-auto relative z-10 bg-[#112240]/80 backdrop-blur-md p-6 rounded-2xl border border-slate-700/50 shadow-2xl space-y-5">
          <div className="text-center">
            <h3 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#2BA8E0]">
              Let's configure security
            </h3>
            <p className="text-xs text-slate-400 mt-1">Review the access scopes Finia uses to automate your life</p>
          </div>

          <div className="space-y-3">
            {/* Card 1: Gmail */}
            <div className="bg-slate-800/40 border border-slate-700/40 p-3 rounded-xl flex items-start space-x-3">
              <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="text-left space-y-0.5">
                <h5 className="text-xs font-bold text-slate-200">Gmail Scan (Read-Only)</h5>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Scans recent inbox headers for credit card statements, bills, and payment receipts. We never send emails.
                </p>
              </div>
            </div>

            {/* Card 2: Calendar */}
            <div className="bg-slate-800/40 border border-slate-700/40 p-3 rounded-xl flex items-start space-x-3">
              <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="text-left space-y-0.5">
                <h5 className="text-xs font-bold text-slate-200">Google Calendar Sync</h5>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Fills active tax deadlines and payment reminders directly in your calendar. You approve every invite.
                </p>
              </div>
            </div>

            {/* Card 3: Decryption */}
            <div className="bg-slate-800/40 border border-slate-700/40 p-3 rounded-xl flex items-start space-x-3">
              <div className="p-2 bg-[#2BA8E0]/10 text-[#2BA8E0] rounded-lg shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div className="text-left space-y-0.5">
                <h5 className="text-xs font-bold text-slate-200">In-Memory Decryption</h5>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Safely opens password-protected statements completely in memory. Passwords or raw files are never stored.
                </p>
              </div>
            </div>
          </div>

          {/* Shield Note */}
          <div className="bg-emerald-950/20 border border-emerald-500/20 px-3.5 py-2.5 rounded-lg flex items-center gap-2 text-emerald-400 text-xs">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span className="font-semibold text-[10px] uppercase tracking-wider">Your data never leaves Google Cloud.</span>
          </div>

          <button
            onClick={() => setStep(4)}
            className="w-full py-3 bg-[#2BA8E0] hover:bg-opacity-90 text-[#112240] font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Grant permissions & start scan</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* STEP 4: SCANNING SCREEN */}
      {step === 4 && (
        <div className="max-w-md w-full mx-auto my-auto relative z-10 flex flex-col items-center space-y-8">
          <div className="relative">
            <div className="w-24 h-24 rounded-full border border-slate-800 bg-slate-900/60 flex items-center justify-center">
              <svg viewBox="0 0 512 512" className="w-12 h-12 fill-none stroke-[#2BA8E0] animate-spin">
                <path d="M 80 256 L 180 256 L 200 290 L 230 110 L 260 410 L 290 290 L 310 256 L 432 256" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="230" cy="110" r="32" fill="#2BA8E0" stroke="none" />
              </svg>
            </div>
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-purple-500"></span>
            </span>
          </div>

          <div className="text-center space-y-1">
            <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#2BA8E0]">
              Scanning accounts...
            </h3>
            <p className="text-xs text-slate-400">Finia is fetching and reading billing metadata & deadlines</p>
          </div>

          {/* Item Checklist */}
          <div className="w-full space-y-2.5">
            {scannedItems.map((item, idx) => {
              const isScanning = idx === scanIndex;
              const isDone = idx < scanIndex;
              return (
                <div
                  key={idx}
                  className={`p-3 border rounded-xl flex justify-between items-center transition-all ${
                    isDone
                      ? "border-emerald-500/30 bg-emerald-950/10 text-slate-300"
                      : isScanning
                      ? "border-[#2BA8E0]/40 bg-[#2BA8E0]/5 text-white scale-[1.01]"
                      : "border-slate-800 bg-slate-900/40 text-slate-500"
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    {isDone ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : isScanning ? (
                      <div className="w-3.5 h-3.5 border-2 border-[#2BA8E0] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full bg-slate-800" />
                    )}
                    <span className="text-xs font-medium">{item.name}</span>
                  </div>
                  <span className="text-xs font-mono font-bold">
                    {isDone ? `Found ${item.count}` : isScanning ? "reading..." : "pending"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Bottom Progress */}
          <div className="w-full text-center space-y-1">
            <div className="text-[10px] font-mono text-slate-500">progress: {scanProgress}%</div>
            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-[#2BA8E0]" style={{ width: `${scanProgress}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: WOW MOMENT */}
      {step === 5 && (
        <div className="max-w-lg w-full mx-auto my-auto relative z-10 bg-[#112240]/80 backdrop-blur-md p-6 rounded-2xl border border-slate-700/50 shadow-2xl space-y-5">
          <div className="text-center">
            <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded uppercase tracking-wider font-mono">
              Wow! Look what we found
            </span>
            <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#2BA8E0] mt-2">
              Found 11 Outstanding Items
            </h3>
            <p className="text-xs text-slate-400 mt-1">Review the top statements & deadlines Finia will auto-import for you</p>
          </div>

          {/* Cards list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {foundItems.map((item, idx) => (
              <div key={idx} className={`p-4 rounded-xl border-l-4 border-[0.5px] border-slate-800 text-left flex justify-between items-start ${item.color}`}>
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center space-x-1.5">
                    {item.icon}
                    <span className="text-[10px] font-bold text-[#112240] uppercase tracking-wider truncate">{item.badge}</span>
                  </div>
                  <h5 className="text-xs font-bold text-slate-800 truncate">{item.title}</h5>
                  <h6 className="text-sm font-extrabold text-slate-900 font-mono">{item.amount}</h6>
                  <p className="text-[9px] text-slate-500 font-medium">{item.detail}</p>
                </div>
                <div className="text-[9px] font-mono font-bold bg-slate-200/60 text-[#112240] px-1.5 py-0.5 rounded truncate max-w-[90px]" title={item.source}>
                  {item.source}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-800/40 p-3 rounded-xl flex items-center gap-2.5 text-xs text-slate-300">
            <Bot className="w-4 h-4 text-[#2BA8E0] shrink-0" />
            <span className="text-[11px] leading-normal text-left">
              Importing these items will directly seed your active workspace dashboard. You'll never start on an empty slate.
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleAddAllToFinia}
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-[#2BA8E0] to-purple-600 hover:opacity-90 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>seeding firestore...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Add all to Finia &rarr;</span>
                </>
              )}
            </button>
            
            <button
              onClick={handleStartOrganic}
              disabled={loading}
              className="w-full py-2.5 bg-transparent border border-slate-700/60 hover:bg-slate-800/30 text-slate-300 font-bold text-[11px] uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              <span>Skip Seeding — Start Organic (₹0 Balance)</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: READY SCREEN */}
      {step === 6 && (
        <div className="max-w-md w-full mx-auto my-auto relative z-10 bg-[#112240]/80 backdrop-blur-md p-6 rounded-2xl border border-slate-700/50 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20 relative">
            <Check className="w-8 h-8" />
            <div className="absolute inset-0 bg-emerald-400/20 rounded-full blur-sm animate-ping" />
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-[#2BA8E0]">
              You are all set!
            </h3>
            <p className="text-xs text-slate-400">Your intelligent financial companion is prepped and active</p>
          </div>

          {/* Stats blocks */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-800/40 border border-slate-700/30 p-3.5 rounded-xl space-y-1">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Items Seeded</span>
              <h4 className="text-xl font-bold text-emerald-400 font-mono">{skippedSeeding ? "0" : "11"}</h4>
            </div>
            <div className="bg-slate-800/40 border border-slate-700/30 p-3.5 rounded-xl space-y-1">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Bills Logged</span>
              <h4 className="text-xl font-bold text-[#2BA8E0] font-mono">{skippedSeeding ? "0" : "4"}</h4>
            </div>
            <div className="bg-slate-800/40 border border-slate-700/30 p-3.5 rounded-xl space-y-1">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Deadlines Set</span>
              <h4 className="text-xl font-bold text-purple-400 font-mono">{skippedSeeding ? "0" : "3"}</h4>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed text-center px-2">
            {skippedSeeding 
              ? "All details are ready. Open your clean workspace to manage tasks, payments, and document analyses." 
              : "Your workspace will open in sandbox Demo Mode. You can toggle back to your organic clean database profile anytime from the top bar."}
          </p>

          <button
            onClick={() => onComplete(!skippedSeeding)}
            className="w-full py-3.5 bg-gradient-to-r from-[#2BA8E0] to-purple-600 hover:opacity-90 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg"
          >
            <span>Open my dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bottom Footer Credits */}
      <div className="max-w-md w-full mx-auto pb-4 relative z-10 pt-6 border-t border-slate-800/40 flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-widest font-mono">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          SECURE SANDBOX
        </span>
        <span>POWERED BY GEMINI AI</span>
      </div>
    </div>
  );
}
