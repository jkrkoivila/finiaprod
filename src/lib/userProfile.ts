import type { User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export interface UserProfile {
  name: string;
  email: string;
  photo: string;
  role: "user" | "admin";
  onboarded: boolean;
  tourCompleted: boolean;
  plan: "free" | "pro";
  demoMode?: boolean; // read-only demo: agent writes blocked
  isDefaultAdmin?: boolean; // protected account — cannot be suspended or deleted
  createdAt?: unknown; // Firestore Timestamp (serverTimestamp on create)
  lastActive?: unknown; // Firestore Timestamp (refreshed each session)
  suspended?: boolean;
  prefs?: Record<string, any>;
}

/**
 * Ensure a `users/{uid}` profile exists for the signed-in user.
 * - First sign-in: creates the document with safe defaults.
 * - Returning user: only refreshes `lastActive` (never touches role/plan/flags,
 *   so a user can't escalate their own role — that's admin-only, set in Firestore).
 *
 * Also ensures an empty `taxProfile/{uid}` document so the tax module has a home.
 */
export async function ensureUserProfile(user: User): Promise<void> {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const profile: UserProfile = {
      name: user.displayName ?? "",
      email: user.email ?? "",
      photo: user.photoURL ?? "",
      role: "user",
      onboarded: false,
      tourCompleted: false,
      plan: "free",
      demoMode: false,
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
    };
    await setDoc(ref, profile);
  } else {
    await setDoc(ref, { lastActive: serverTimestamp() }, { merge: true });
  }

  // Scaffold the per-user tax profile (keyed by uid) if it isn't there yet.
  const taxRef = doc(db, "taxProfile", user.uid);
  const taxSnap = await getDoc(taxRef);
  if (!taxSnap.exists()) {
    await setDoc(taxRef, {
      userId: user.uid,
      createdAt: serverTimestamp(),
    });
  }
}

/** Mark onboarding complete. Role is untouched, so this passes the users update rule. */
export async function completeOnboarding(uid: string): Promise<void> {
  await setDoc(doc(db, "users", uid), { onboarded: true }, { merge: true });
}
