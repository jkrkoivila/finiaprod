import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import type { CalendarItem } from "./calendar";

/** Re-runs the Google popup to mint a fresh OAuth token (calendar scope is already requested at sign-in). */
export async function getCalendarAccessToken(): Promise<string> {
  const result = await signInWithPopup(auth, googleProvider);
  const cred = GoogleAuthProvider.credentialFromResult(result);
  if (!cred?.accessToken) throw new Error("Couldn't get Google Calendar access — please allow it and retry.");
  return cred.accessToken;
}

export interface CalSyncPayloadItem {
  key: string;          // stable Finia id (item.id) — used for de-dup
  title: string;
  date: string;         // YYYY-MM-DD (all-day) or start date for timed
  time?: string;        // HH:MM → makes it a timed event
  description?: string;
  reminderLeadDays: number;
  eventId?: string | null; // existing Google event to update instead of create
  deleted?: boolean;       // tombstone → delete the Google event
}

export interface CalSyncResult {
  key: string;
  eventId: string | null; // null when deleted
  action: "created" | "updated" | "deleted" | "skipped" | "error";
  error?: string;
}

/** Two-way push: writes Finia items into the user's Google Calendar. Returns the eventId per item to store back. */
export async function syncToGoogleCalendar(accessToken: string, items: CalSyncPayloadItem[]): Promise<CalSyncResult[]> {
  const res = await fetch("/api/calendar/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken, items }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || "Google Calendar sync failed.");
  }
  const data = await res.json();
  return data.results as CalSyncResult[];
}

/** Which calendar item types we push to Google (dated commitments, not informational tax markers we can't action). */
export function syncableItems(items: CalendarItem[]): CalendarItem[] {
  return items.filter((i) => !i.done && (i.type === "bill" || i.type === "recurring" || i.type === "tax" || i.type === "focus" || i.type === "reminder" || i.type === "task"));
}
