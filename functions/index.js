/**
 * Finia scheduled reminders → FCM push.
 *
 * Runs every morning (08:00 Asia/Kolkata). For each user with a stored FCM token
 * and a reminder lead time, it finds their dated items (tasks, bills, recurring
 * payment instances) that are due TODAY or exactly `leadDays` ahead, and sends one
 * grouped push to their phone. Tapping it opens Finia's calendar.
 *
 * The phone's Google Calendar app is the *other* reminder path — Finia writes events
 * there with popup reminders during "Sync to Google". This function is the in-app path.
 *
 * Deploy: see CALENDAR_SETUP.md. Requires the named Firestore DB + the default GCP
 * service account (no extra secrets — Admin SDK uses application-default creds).
 */
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";

const DATABASE_ID = "ai-studio-0e625a14-b1ac-4ee9-a947-782072cf06bc";

initializeApp();
const db = getFirestore(DATABASE_ID);

const pad = (n) => String(n).padStart(2, "0");
function ymd(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Items due on `dates` for a given user, across the three dated collections.
async function dueItemsForUser(uid, dates) {
  const out = [];
  const pushRows = (snap, label, titleField, isDone) => {
    snap.forEach((doc) => {
      const d = doc.data();
      if (isDone(d)) return; // already done/paid
      if (dates.includes(d.dueDate)) out.push({ label, title: d[titleField] || label, date: d.dueDate });
    });
  };

  const [tasks, bills, instances, fds, fdSched] = await Promise.all([
    db.collection("tasks").where("userId", "==", uid).get(),
    db.collection("bills").where("userId", "==", uid).get(),
    db.collection("paymentInstances").where("userId", "==", uid).get(),
    db.collection("fixedDeposits").where("userId", "==", uid).get(),
    db.collection("fdIncomeSchedule").where("userId", "==", uid).get(),
  ]);
  // Tax deadlines (advance tax, ITR) are stored as tasks, so they're covered here.
  pushRows(tasks, "Task", "title", (d) => !!d.completed);
  pushRows(bills, "Bill", "payee", (d) => !!d.paid);
  pushRows(instances, "Payment", "title", (d) => d.status === "paid" || d.status === "skipped");

  // FD maturities + non-cumulative payout dates.
  const inr = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
  fds.forEach((doc) => {
    const d = doc.data();
    if (d.status === "active" && dates.includes(d.maturityDate)) {
      out.push({ label: "FD matures", title: `${d.bank} ${inr(d.principal)}`, date: d.maturityDate });
    }
  });
  fdSched.forEach((doc) => {
    const d = doc.data();
    if (d.status === "upcoming" && dates.includes(d.date)) {
      out.push({ label: "FD payout", title: inr(d.amount), date: d.date });
    }
  });

  return out;
}

export const sendDueReminders = onSchedule(
  { schedule: "every day 08:00", timeZone: "Asia/Kolkata", region: "asia-south1" },
  async () => {
    const today = new Date();
    const tokens = await db.collection("fcmTokens").get();
    let sent = 0;

    for (const tokenDoc of tokens.docs) {
      const uid = tokenDoc.id;
      const { token } = tokenDoc.data();
      if (!token) continue;

      // Single source of truth for reminder timing: the user's setting (days),
      // the same value the Google Calendar sync reads. Falls back to the token's
      // stored leadDays, then 3.
      const userSnap = await db.collection("users").doc(uid).get();
      const prefLead = userSnap.data()?.prefs?.notifications?.reminderLeadDays;
      const leadDays = Number(prefLead ?? tokenDoc.data().leadDays ?? 3);

      // Reminder days: same-day + leadDays ahead.
      const lead = new Date(today);
      lead.setDate(lead.getDate() + Number(leadDays));
      const dates = [ymd(today), ymd(lead)];

      const items = await dueItemsForUser(uid, dates);
      if (items.length === 0) continue;

      const dueToday = items.filter((i) => i.date === ymd(today)).length;
      const title =
        items.length === 1
          ? `${items[0].label} due: ${items[0].title}`
          : `${items.length} items need attention`;
      const body =
        dueToday > 0
          ? `${dueToday} due today, ${items.length - dueToday} coming up in ${leadDays} days.`
          : `Due in ${leadDays} days: ${items.map((i) => i.title).slice(0, 3).join(", ")}.`;

      try {
        await getMessaging().send({
          token,
          notification: { title, body },
          data: { url: "/calendar", tag: "finia-due" },
          webpush: { fcmOptions: { link: "/calendar" } },
        });
        sent++;
      } catch (err) {
        logger.warn(`FCM send failed for ${uid}`, err?.message);
        // Stale/unregistered token → remove so we stop trying.
        if (err?.code === "messaging/registration-token-not-registered") {
          await tokenDoc.ref.delete().catch(() => {});
        }
      }
    }

    logger.info(`sendDueReminders: pushed ${sent} reminder(s).`);
  }
);
