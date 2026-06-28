import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { type DerivedNotification, type NewNotification } from "./notificationsCore";

/**
 * In-app notifications — the on-screen counterpart of the FCM push reminders.
 * Stored in the per-user `notifications` collection so the TopBar bell reflects
 * genuine activity. Pure derivation logic lives in notificationsCore (testable);
 * this module holds the Firebase writers.
 */

// Re-export the pure helpers so callers have a single import surface.
export { computeDerivedNotifications, relativeTime } from "./notificationsCore";
export type { NewNotification, DerivedNotification } from "./notificationsCore";

/**
 * Event notification. When `dedupeId` is given, the notification uses it as the
 * doc id and is created only if one doesn't already exist (sourceId_eventType) —
 * so the same alert never stacks. Without it, a fresh doc is created each time.
 */
export async function notifyEvent(uid: string, n: NewNotification, dedupeId?: string): Promise<void> {
  const payload = { userId: uid, type: n.type, title: n.title, body: n.body, link: n.link ?? null, read: false, createdAt: serverTimestamp() };
  if (dedupeId) {
    const ref = doc(db, "notifications", dedupeId);
    if ((await getDoc(ref)).exists()) return; // already alerted — don't stack
    await setDoc(ref, payload);
    return;
  }
  await addDoc(collection(db, "notifications"), payload);
}

export async function markRead(id: string): Promise<void> {
  await updateDoc(doc(db, "notifications", id), { read: true });
}

export async function markAllRead(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const batch = writeBatch(db);
  ids.forEach((id) => batch.update(doc(db, "notifications", id), { read: true }));
  await batch.commit();
}

/** Write derived notifications (deterministic id => idempotent create). */
export async function writeDerived(uid: string, items: DerivedNotification[]): Promise<void> {
  for (const n of items) {
    await setDoc(doc(db, "notifications", n.id), {
      userId: uid, type: n.type, title: n.title, body: n.body, link: n.link ?? null,
      read: false, createdAt: serverTimestamp(),
    });
  }
}
