import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useFinanceData } from "../lib/useFinanceData";
import { useSystemSettings } from "../lib/useSystemSettings";
import { buildCalendarItems, type CalendarItem } from "../lib/calendar";
import { ymd } from "../lib/dashboard";
import { getCalendarAccessToken, syncToGoogleCalendar, syncableItems, type CalSyncPayloadItem } from "../lib/calendarApi";
import { navigate } from "../lib/router";
import { TYPE_LABEL } from "../lib/calendar";
import CalendarView from "./CalendarView";

const DEFAULT_LEAD_DAYS = 3;

export default function CalendarScreen({ uid }: { uid: string }) {
  const data = useFinanceData(uid);
  const { profile } = useAuth();
  const { settings } = useSystemSettings();
  const today = ymd(new Date());

  // Single source of truth for reminder timing: the user's setting (days).
  // Both the Google Calendar event reminder (below) and the FCM scheduler
  // (functions/index.js) read this same value. Falls back to 3 days.
  const reminderLeadDays = Number(profile?.prefs?.notifications?.reminderLeadDays ?? DEFAULT_LEAD_DAYS);

  // eventId map for Google Calendar de-dup: { [item.id]: googleEventId }
  const [eventMap, setEventMap] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, "calendarSync", uid),
      (snap) => setEventMap((snap.data()?.events as Record<string, string>) || {}),
      (err) => console.error("calendarSync snapshot:", err)
    );
  }, [uid]);

  const items = useMemo(
    () => buildCalendarItems({ tasks: data.tasks, bills: data.bills, paymentInstances: data.paymentInstances, fixedDeposits: data.fixedDeposits }, settings.taxConfig, today),
    [data.tasks, data.bills, data.paymentInstances, data.fixedDeposits, settings.taxConfig, today]
  );

  const onOpenItem = (item: CalendarItem) => {
    if (item.fdId) {
      navigate(`/fixed-deposits?open=${encodeURIComponent(item.fdId)}`);
      return;
    }
    if (item.type === "recurring") {
      // Deep-link to the specific payment's detail (works even if its template is missing).
      navigate(item.recurringId ? `/recurring?open=${encodeURIComponent(item.recurringId)}` : "/recurring");
      return;
    }
    navigate("/" + item.nav);
  };

  const onSyncGoogle = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const token = await getCalendarAccessToken();
      const payload: CalSyncPayloadItem[] = syncableItems(items).map((i) => ({
        key: i.id,
        title: `${TYPE_LABEL[i.type]}: ${i.title}`,
        date: i.date,
        time: i.time,
        description: i.amount != null ? `Finia · ₹${i.amount.toLocaleString("en-IN")}` : "Created by Finia",
        reminderLeadDays,
        eventId: eventMap[i.id] || null,
      }));
      const results = await syncToGoogleCalendar(token, payload);
      const next = { ...eventMap };
      for (const r of results) {
        if (r.action === "deleted") delete next[r.key];
        else if (r.eventId) next[r.key] = r.eventId;
      }
      await setDoc(doc(db, "calendarSync", uid), { events: next, updatedAt: Date.now() }, { merge: true });
      setEventMap(next);
      setLastSynced(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
    } catch (e: any) {
      setSyncError(e?.message || "Sync failed — check Google permissions and that the Calendar API is enabled.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <CalendarView
      items={items}
      today={today}
      loading={data.loading}
      syncing={syncing}
      lastSynced={lastSynced}
      syncError={syncError}
      onOpenItem={onOpenItem}
      onAddTask={() => navigate("/tasks")}
      onSyncGmail={() => navigate("/documents")}
      onSyncGoogle={onSyncGoogle}
    />
  );
}
