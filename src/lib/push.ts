import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { doc, setDoc } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import { db } from "./firebase";

// Public web-push VAPID key from Firebase console → Cloud Messaging → Web Push certificates.
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export type PushState = "unsupported" | "no-key" | "denied" | "enabled" | "error";

/**
 * Registers the device for FCM push and stores the token under fcmTokens/{uid}
 * so the scheduled Cloud Function (functions/index.js) can deliver due reminders.
 * Returns the resulting state for the Settings UI. No-ops gracefully when push
 * isn't supported, the VAPID key is missing, or permission is denied.
 */
export async function enablePush(uid: string, leadDays = 3): Promise<PushState> {
  try {
    if (!(await isSupported())) return "unsupported";
    if (!VAPID_KEY) return "no-key";

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";

    // Register the messaging SW at its own scope (coexists with the PWA sw.js).
    const qs = new URLSearchParams(firebaseConfig as Record<string, string>).toString();
    const reg = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${qs}`, {
      scope: "/firebase-cloud-messaging-push-scope",
    });

    const app = getApps()[0] || initializeApp(firebaseConfig);
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return "error";

    await setDoc(
      doc(db, "fcmTokens", uid),
      { token, leadDays, platform: navigator.userAgent, updatedAt: Date.now() },
      { merge: true }
    );

    // Foreground messages don't auto-display — show them ourselves.
    onMessage(messaging, (payload) => {
      const n = payload.notification;
      if (n && Notification.permission === "granted") {
        new Notification(n.title || "Finia reminder", { body: n.body, icon: "/icon-192.png" });
      }
    });

    return "enabled";
  } catch (e) {
    console.error("enablePush:", e);
    return "error";
  }
}
