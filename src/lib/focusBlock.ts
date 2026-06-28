import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { getCalendarAccessToken, syncToGoogleCalendar } from "./calendarApi";

/**
 * Create a real Google Calendar "[Focus]" event for a blocked time slot, so it
 * fires a phone reminder (in addition to the local task the caller creates).
 * Stores the returned eventId in calendarSync/{uid} so a later full sync updates
 * (PATCH) rather than duplicating. Best-effort: returns false if Google access
 * can't be obtained (e.g. popup blocked) — the local task still stands.
 */
export async function blockFocusEvent(uid: string, taskTitle: string, date: string, startTime?: string): Promise<boolean> {
  const key = `focus-${date}-${startTime || "all"}-${taskTitle}`.slice(0, 120);
  const token = await getCalendarAccessToken();

  // Reuse a stored eventId for this slot if present (idempotent → PATCH not POST).
  const syncRef = doc(db, "calendarSync", uid);
  const events = ((await getDoc(syncRef)).data()?.events as Record<string, string>) || {};

  const results = await syncToGoogleCalendar(token, [
    {
      key,
      title: `[Focus] ${taskTitle}`,
      date,
      time: startTime,
      description: "Focus block created by Finia",
      reminderLeadDays: 0,
      eventId: events[key] || null,
    },
  ]);

  const r = results[0];
  if (r?.eventId) {
    await setDoc(syncRef, { events: { ...events, [key]: r.eventId }, updatedAt: Date.now() }, { merge: true }).catch(() => {});
    return true;
  }
  return false;
}
