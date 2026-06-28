import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Web config comes from .env.local (VITE_FIREBASE_*). These values are public by
// design — Firebase security is enforced by Auth + Firestore rules, not by hiding them.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// This Finia project uses a NAMED Firestore database (created by AI Studio), not
// the (default) one. It must match the "database" field in firebase.json so that
// `firebase deploy --only firestore:rules` targets the same database.
const FIRESTORE_DATABASE_ID = "ai-studio-0e625a14-b1ac-4ee9-a947-782072cf06bc";

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Google is the only sign-in method.
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
// Scopes reserved for upcoming read-only Gmail + Calendar features (see AGENTS.md).
googleProvider.addScope("https://www.googleapis.com/auth/gmail.readonly");
googleProvider.addScope("https://www.googleapis.com/auth/calendar");

// Offline persistence: previously-loaded data stays available offline (multi-tab safe).
export const db = initializeFirestore(
  app,
  { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) },
  FIRESTORE_DATABASE_ID
);

// Cloud Storage — used for payment-proof attachments (and future document files).
export const storage = getStorage(app);
