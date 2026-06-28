import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";
import { ensureUserProfile, type UserProfile } from "./userProfile";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function friendlyAuthError(code: string, fallback: string): string {
  switch (code) {
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in popup. Allow popups for this site and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled before it finished. Try again.";
    case "auth/network-request-failed":
      return "Network error during sign-in. Check your connection and try again.";
    case "auth/unauthorized-domain":
      return "This domain isn't authorized for sign-in. Add it under Authentication → Settings → Authorized domains.";
    default:
      return fallback;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const profileUnsub = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      // Tear down any previous profile listener.
      if (profileUnsub.current) {
        profileUnsub.current();
        profileUnsub.current = null;
      }

      setUser(nextUser);

      if (nextUser) {
        try {
          await ensureUserProfile(nextUser);
        } catch (err) {
          console.error("Failed to write user profile:", err);
        }
        // Live-subscribe to the profile so admin/role/onboarded changes reflect immediately.
        profileUnsub.current = onSnapshot(
          doc(db, "users", nextUser.uid),
          (snap) => setProfile(snap.exists() ? (snap.data() as UserProfile) : null),
          (err) => console.error("Profile listener error:", err)
        );
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      unsub();
      if (profileUnsub.current) profileUnsub.current();
    };
  }, []);

  const signInWithGoogle = async () => {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      console.error("Google sign-in error:", e);
      setError(friendlyAuthError(e.code ?? "", e.message ?? "Could not sign in. Try again."));
    }
  };

  const signOutUser = async () => {
    setError(null);
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error("Sign-out error:", err);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, error, signInWithGoogle, signOutUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
