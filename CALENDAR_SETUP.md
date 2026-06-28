# Calendar — reminders & Google Calendar sync setup

The unified calendar (Month / Week / Agenda) works with **zero setup** — it reads and
merges your existing tasks, bills, recurring payment instances, and tax dates live.

The two phone-reminder paths need one-time enablement:

## 1. Google Calendar sync (works today, no deploy)

The **"Sync to Google"** button on the Calendar pushes your dated Finia items into your
Google Calendar as events with a popup reminder `N` days before + a same-day nudge.
Your phone's Calendar app then notifies you. The Google event id is stored in Firestore
(`calendarSync/{uid}`) so re-syncing **updates** events instead of duplicating them.

One-time: in **Google Cloud Console → APIs & Services → Library**, enable the
**Google Calendar API** for this project. (The OAuth `calendar` scope is already requested
at sign-in.) Then `firebase deploy --only firestore:rules` to publish the new
`calendarSync` / `fcmTokens` rules.

## 2. FCM push reminders (needs Cloud Functions deploy)

A scheduled Cloud Function (`functions/index.js`) runs every morning at 08:00 IST, finds
each user's items due today or `leadDays` ahead, and sends a grouped push to their phone.

Steps:

1. **VAPID key** — Firebase console → Project settings → **Cloud Messaging** →
   *Web Push certificates* → Generate key pair. Add to `.env.local`:
   ```
   VITE_FIREBASE_VAPID_KEY=<the public key>
   ```
   Rebuild the client. (Until this is set, the Settings "Enable on this device" button
   shows "Push not configured yet" and does nothing — no crash.)

2. **Register your device** — Settings → Notifications → **Enable on this device**.
   This stores your FCM token + lead time in `fcmTokens/{uid}`.

3. **Deploy the function**:
   ```
   cd functions && npm install && cd ..
   firebase deploy --only functions --project gen-lang-client-0144814356
   ```
   (Requires the Blaze plan. The function uses the named Firestore DB and the default
   service account — no extra secrets.)

4. **Test now without waiting for 08:00** — in the Google Cloud console open
   **Cloud Scheduler**, find `firebase-schedule-sendDueReminders-asia-south1`, and click
   **Force run**. With a bill due in `leadDays` days, a push should reach your phone, and
   tapping it opens `/calendar`.

## End-to-end chain

Bill due in 5 days → appears on Finia calendar (automatic, teal dot) → "Sync to Google"
writes a Google Calendar event with a 3-day-before popup → the scheduled function also
sends an FCM push 3 days before → both your Google Calendar app and Finia notify your phone.
