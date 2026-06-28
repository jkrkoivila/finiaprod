import React, { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { ShieldCheck, Mail, AlertCircle, Info, LogIn } from "lucide-react";

interface SignInProps {
  onSignInSuccess?: () => void;
}

export default function SignIn({ onSignInSuccess }: SignInProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      if (onSignInSuccess) {
        onSignInSuccess();
      }
    } catch (err: any) {
      console.error("Google Sign-In Error: ", err);
      // Friendly, non-intrusive error parsing
      if (err.code === "auth/popup-blocked") {
        setError("Sign-in popup was blocked by your browser. Please allow popups for this site and try again.");
      } else if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-in popup was closed before completing. Please try again.");
      } else {
        setError(err.message || "An error occurred during sign-in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-gradient-to-br from-[#0B1528] via-[#112240] to-[#1B3A6B] text-white p-4">
      <div className="w-full max-w-md p-8 bg-[#112240]/80 backdrop-blur-md rounded-2xl border-[0.5px] border-slate-700/50 shadow-2xl flex flex-col items-center">
        
        {/* Finia Premium Vector Logo */}
        <div className="mb-6 relative flex items-center justify-center">
          <div className="absolute w-20 h-20 bg-[#2BA8E0]/10 rounded-full blur-xl animate-pulse" />
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#1B3A6B] to-[#2BA8E0] p-[1.5px] relative z-10 flex items-center justify-center shadow-lg">
            <div className="w-full h-full bg-[#112240] rounded-2xl flex items-center justify-center">
              <span className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-[#2BA8E0] to-[#6D28D9] font-mono">
                F
              </span>
            </div>
          </div>
        </div>

        {/* Brand & Heading */}
        <h1 className="text-2xl font-bold tracking-tight text-center bg-clip-text text-transparent bg-gradient-to-r from-white to-[#2BA8E0] mb-1">
          Welcome to Finia
        </h1>
        <p className="text-xs text-slate-400 text-center mb-8 max-w-xs">
          Your intelligent life assistant managing deadlines, wealth, and tax compliance.
        </p>

        {/* Error Alert Box */}
        {error && (
          <div className="w-full mb-6 p-3 bg-red-950/40 border-[0.5px] border-red-500/30 text-red-200 rounded-lg flex items-start space-x-2 text-xs">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Continue with Google Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full h-12 px-6 rounded-xl bg-white hover:bg-slate-100 text-slate-800 text-sm font-semibold flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus:outline-none"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-slate-800 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              {/* Custom High-Quality Google G Icon */}
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

        {/* Read-Only Privacy Notice */}
        <div className="mt-8 flex items-start space-x-2 text-[11px] text-slate-400 max-w-[280px]">
          <Mail className="w-3.5 h-3.5 text-[#2BA8E0] shrink-0 mt-0.5" />
          <span className="leading-normal">
            Read-only Gmail access. We never send emails or make payments.
          </span>
        </div>

        {/* Secure badge */}
        <div className="mt-6 pt-4 border-t border-slate-800/60 w-full flex items-center justify-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-widest font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>secure banking grade sandbox</span>
        </div>
      </div>
    </div>
  );
}
