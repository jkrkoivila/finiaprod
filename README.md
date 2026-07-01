# finia

**Your AI for deadlines, money, and tax.**

Finia is an AI-powered personal life operating system built for Indian students, professionals, and entrepreneurs. One conversational Gemini agent manages tasks, deadlines, credit card bills, fixed deposits, recurring payments, and tax planning — backed by server-side pipelines that extract, deduplicate, and act on financial data in the background.

Built for the **Vibe2Ship Hackathon · June 2026 · Problem Statement 1 — The Last-Minute Life Saver**

---

## Live application

**Deployed URL:** https://finiaapp--gen-lang-client-0144814356.asia-southeast1.hosted.app/

**Project description (Google Doc):** https://docs.google.com/document/d/1GHAna-95PltqdBNO3RA03ywjhARi9j-P890UWCWtnkI/edit?tab=t.0

> Both links must remain active throughout the evaluation period.

---

## The problem Finia solves

Students and professionals miss credit card due dates (paying ₹500–₹3,000 in avoidable late fees), choose the wrong tax regime (losing thousands per year), miss advance tax deadlines (1% per month interest penalty), and have their tasks, bills, and financial documents scattered across five separate apps with no single intelligence connecting them.

Finia fixes this in one conversation.

---

## Key features

### Conversational AI agent
- Natural language task and bill creation — "pay rent ₹15,000 on the 5th every month" creates a recurring payment, upcoming instances, calendar reminders, and a priority task in one turn
- Gemini 2.5 Flash with function calling — the agent creates tasks, books Google Calendar events, sets reminders, and queries financial summaries
- Multi-turn chat with live Firestore context injected into the system prompt on every request
- Graceful heuristic fallback for task parsing when no Gemini key is configured

### Automated Gmail extraction pipeline
- Incremental sync via Gmail `historyId` — only new messages fetched after the first sync
- 90-day window on first sync enforced by a Gmail-side query filter — old inboxes never trigger bulk AI calls
- Text-first PDF extraction (`pdf-parse`); Gemini's multimodal vision used only as a fallback for scanned documents
- Encrypted credit card PDF decryption in-memory, server-side — supports HDFC, SBI, ICICI, Axis, Kotak
- Per-run audit trail written to `users/{uid}/syncRuns` so the UI can report "Scanned 247 messages, 0 matched" instead of an ambiguous "no new items"

### Crisis mode
- Full-screen dark triage: Gemini classifies each clustered task as Do now, Defer, or Drop with a one-line reason
- Triage result cached by `crisisId` (hash of the sorted task cluster) — reopening is instant, Gemini is never called twice for the same cluster

### Tax intelligence (FY 2025-26 / AY 2026-27)
- Old vs new regime live calculator with correct slab application
- 80CCD(2) employer NPS correctly applied in the new regime — most calculators get this wrong
- Payslip and Form 16 auto-population via Gemini multimodal extraction
- Optional deduction picker — users add only what applies; required sub-fields surface on selection
- AI Tax Expert chat with the user's full income and deduction context
- Slab values read from `systemSettings/global` so they can be updated without a code change

### Fixed deposit intelligence
- Compound interest engine: quarterly (Indian bank default), monthly, half-yearly, annual, and simple interest
- Non-cumulative FDs generate periodic income entries in `fdIncomeSchedule` automatically — surfaced under Income
- Maturity reminders; auto-created decision task before maturity

### Finance module
- Automated credit card bill extraction with transaction-level spend breakdown
- Income vs expense dashboard with category trends
- Subscription tracker with unused-subscription detection
- Receivables tracker — who owes the user money, with reminders
- Recurring payments with planned vs actual capture and payment-proof attachment (Cloud Storage)

### Document library
- Per-type required-field validation — missing fields quarantine a document as needs-review, excluded from all totals
- Preview-before-save — every extracted field shown and editable before committing
- Cascade delete via `sourceDocumentId` — deleting a file removes all derived records

### Two-channel reminders
- Firebase Cloud Messaging push via Service Worker — fires when the app is closed
- Google Calendar events as a reliability fallback — uses the phone's native calendar app, which the OS guarantees will alert
- Reminder lead time comes from user settings — no hardcoded values

### Admin
- Admin panel with feature flags, free-tier limits, and tax config in `systemSettings/global`
- Admin role is set manually in Firestore only — it can never be granted from the UI

---

## Google technologies used

| Technology | How Finia uses it |
|---|---|
| **Gemini 2.5 Flash** | Orchestration agent, function calling, NL parsing, crisis triage, tax expert, bill insights, and multimodal payslip/PDF extraction |
| **Gmail API** | Incremental inbox sync, bill/deadline extraction, attachment download (read-only) |
| **Google Calendar API** | Bill reminders, FD maturity events, de-duplicated via stored `eventId` |
| **Firebase Authentication** | Google Sign-In, UID-scoped data partitioning |
| **Firebase Firestore** | Primary database (named DB), live `onSnapshot` subscriptions, deterministic deduplication keys |
| **Firebase App Hosting** | Hosts the full-stack Express app (built client + `/api/*` routes) |
| **Firebase Cloud Functions** | One scheduled function: the daily FCM reminder scan |
| **Firebase Cloud Messaging** | Browser push notifications via Service Worker |
| **Firebase Cloud Storage** | Payment-proof and document file attachments |
| **Cloud Scheduler** | Drives the daily 08:00 IST reminder function |
| **Google AI Studio (Antigravity)** | Project was bootstrapped and is deployed via Google's tooling |

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────┐
│                    React PWA (Frontend)                  │
│   Dashboard · Tasks · Finance · Tax · FDs · Calendar     │
│   Floating Finia agent · Dark mode · Mobile bottom tabs  │
└────────────────────┬────────────────────────────────────┘
                     │ same-origin /api/** calls
┌────────────────────▼────────────────────────────────────┐
│        Firebase App Hosting — Express server.ts          │
│        (npm run build → dist/server.cjs → npm start)     │
│                                                          │
│  /api/chat            Gemini · function calling (SSE)    │
│  /api/parse-task      NL → structured task (+ fallback)  │
│  /api/gmail/sync      historyId → filter → extract       │
│  /api/calendar/sync   Google Calendar create / update    │
│  /api/document/extract Gemini multimodal extraction      │
│  /api/payslip/analyse Payslip / Form 16 extraction       │
│  /api/credit-card/decrypt  in-memory PDF decrypt         │
│  /api/crisis-triage   Gemini triage + crisisId cache     │
│  /api/tax-ai-expert   Gemini with taxProfile context     │
│  /api/tax-saving-tips 80C/80D/NPS headroom tips          │
│  /api/bill-insight    Gemini spend analysis              │
└──────┬──────────────┬──────────────┬────────────────────┘
       │              │              │
┌──────▼──────┐ ┌─────▼──────┐ ┌───▼────────────────────┐
│  Firestore  │ │  Gmail API │ │  Google Calendar API    │
│  (all data) │ │  (read     │ │  (read + write)         │
│             │ │  only)     │ │                         │
└─────────────┘ └────────────┘ └─────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│   Cloud Function (functions/index.js) · daily 08:00 IST  │
│   scans dated items → Firebase Cloud Messaging push      │
└─────────────────────────────────────────────────────────┘
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 (Vite 6), Tailwind CSS v4, `lucide-react`, `motion` |
| Backend | Express 4 on Node.js — single `server.ts`, deployed on Firebase App Hosting |
| Scheduled jobs | One Firebase Cloud Function (`functions/index.js`) for the daily FCM scan |
| AI | Gemini 2.5 Flash via `@google/genai` (server-side only) |
| Database | Firebase Firestore — named DB, live `onSnapshot` |
| Auth | Firebase Authentication (Google Sign-In) |
| Storage | Firebase Cloud Storage (payment proofs, documents) |
| Push | Firebase Cloud Messaging + Service Worker |
| Scheduling | Firebase Cloud Scheduler |
| PDF | `pdf-parse` (text extraction + in-memory decryption) |
| Routing | Dependency-free History-API router (`src/lib/router.ts`) |
| PWA | Web App Manifest, Service Worker |
| Build | `vite build` + `esbuild` bundle of the server to `dist/server.cjs` |

---

## Running locally

### Prerequisites
- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`) — only needed to deploy rules and the scheduled function
- A Firebase project with Firestore, Auth, Storage, and App Hosting enabled
- Google Cloud project with the Gmail API and Calendar API enabled
- A Gemini API key from Google AI Studio (optional locally — features fall back gracefully without it)

### 1. Clone the repository

```bash
git clone https://github.com/jkrkoivila/finiaprod.git
cd finiaprod
```

### 2. Install dependencies

```bash
# App (client + server)
npm install

# Scheduled Cloud Function (only needed to deploy it)
cd functions && npm install && cd ..
```

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in the values:

```env
# Client (public — inlined into the browser bundle by Vite)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Server (NOT prefixed with VITE_, never sent to the client)
GEMINI_API_KEY=your_gemini_api_key
APP_URL=http://localhost:3000
```

> The Gemini key is read by `server.ts` at runtime. In production it is **not** committed —
> it is a Secret Manager secret named `gemini-key` (see `apphosting.yaml`).

### 4. Run locally

```bash
npm run dev
```

`npm run dev` runs `tsx server.ts`, which boots Express and mounts Vite in middleware
mode — a single process serves both the SPA and the `/api/*` routes.

Open `http://localhost:3000`

> Dev preview routes: with `npm run dev`, `/__preview/*` paths render individual screens
> against fixtures in `src/dev/previewFixtures.ts` (used by the screenshot/verification harness).

### 5. Deploy Firestore & Storage security rules

```bash
firebase login
firebase use your-project-id
firebase deploy --only firestore:rules,storage
```

> Firestore uses a **named database** (`firebase.json` → `firestore.database`). The same ID
> is hardcoded in `src/lib/firebase.ts` and `functions/index.js` so deploys and the client
> target the same DB.

### 6. Set up an admin account

After first sign-in, go to **Firestore Console → users → your document** and set:
```json
{ "role": "admin", "isDefaultAdmin": true }
```

### 7. Deploy the scheduled reminder function

```bash
firebase deploy --only functions
```

See `CALENDAR_SETUP.md` for the FCM / Calendar one-time setup details.

### 8. Deploy the app (App Hosting)

The full-stack app is deployed via **Firebase App Hosting**, which builds from the
connected GitHub repo (`apphosting.yaml`): it runs `npm run build`
(`vite build` + esbuild bundle to `dist/server.cjs`) and then `npm run start`
(`node dist/server.cjs`). Pushing to the tracked branch triggers a rollout.

---

## Project structure

```
finia/
├── server.ts              # Express API + Gemini integration (ALL backend /api routes)
├── apphosting.yaml        # Firebase App Hosting run config + env / gemini-key secret
├── firebase.json          # Firestore (named DB) + Storage rules + functions source
├── firestore.rules        # Security rules (default-deny + per-user ownership + admin)
├── storage.rules          # Cloud Storage rules
├── index.html             # PWA shell, manifest + theme-color + SW hooks
├── vite.config.ts         # Vite config (@ alias → project root)
├── functions/
│   └── index.js           # Scheduled Cloud Function — daily 08:00 IST FCM reminder scan
├── public/
│   ├── manifest.json      # PWA manifest
│   ├── sw.js              # App service worker (cache-first, bypasses /api/)
│   ├── firebase-messaging-sw.js  # FCM background message handler
│   └── logo.svg / icon-*.png
└── src/
    ├── main.tsx           # React root + service worker registration
    ├── App.tsx            # Auth, data loading, top-level routing
    ├── types.ts           # Shared TypeScript interfaces
    ├── index.css          # Tailwind + tweaks
    ├── dev/
    │   └── previewFixtures.ts   # DEV-only fixtures for /__preview/* routes
    ├── lib/               # Data layer + services (one concern per file)
    │   ├── firebase.ts    # Firebase init (named DB, auth scopes, storage)
    │   ├── router.ts      # Minimal History-API router
    │   ├── agent.ts / agentCore.ts        # Chat agent client + function-call mapping
    │   ├── gmailSync.ts   # Gmail sync client
    │   ├── calendarApi.ts # Google Calendar sync client
    │   ├── docApi.ts / documentService.ts # Doc extract + cascade delete
    │   ├── tax*.ts / fd*.ts / finance*.ts / recurring*.ts  # Domain logic + mutations
    │   ├── adminApi.ts / useSystemSettings.ts              # Admin + feature flags
    │   └── ...            # billKey, crisis, notifications, push, proofUpload, settings, ...
    └── components/        # <Name>Screen.tsx (route container) + <Name>View.tsx (presentational)
        ├── Dashboard / Tasks / Finance / Bills / Tax / Calendar
        ├── FixedDeposits / Recurring / Documents / CrisisMode / WhatsDue
        ├── Admin (AdminScreen + AdminPanel) / Settings
        ├── ChatAgent (+ Container) / NotificationBell / MobileTabs / Sidebar / TopBar
        └── SignIn / Onboarding / LandingPage / UpgradeModal / Logo / Sparkline
```

---

## Firestore data model

Named database: `firebase.json` → `firestore.database`. All per-user collections carry a
`userId` field and are read via live `onSnapshot` subscriptions.

| Collection | Purpose | Key fields |
|---|---|---|
| `users` | User profile + settings | role, plan, demoMode, isDefaultAdmin, prefs |
| `users/{uid}/syncRuns` | Gmail sync audit trail | scanned, matched, timestamp |
| `tasks` | All tasks (incl. tax deadlines) | title, dueDate, priority, category, sourceDocumentId |
| `bills` | Credit card bills | dedupeKey (doc ID), payee, amount, dueDate, paid |
| `transactions` | Income + expenses | description, amount, type, category, date, sourceDocumentId |
| `fixedDeposits` | FD records | principal, rate, compounding, maturityDate, status |
| `fdIncomeSchedule` | Non-cumulative FD payouts | fdId, date, amount, status |
| `recurringPayments` | Payment templates | title, plannedAmount, frequency, dueDay |
| `paymentInstances` | Recurring occurrences | recurringPaymentId, dueDate, actualAmount, proofUrl |
| `subscriptions` | Subscription tracker | name, amount, frequency, isUnused |
| `receivables` | Money owed to the user | debtor, amount, date, reminded |
| `documents` | Uploaded files | status, sourceDocumentId, extractedData |
| `notifications` | In-app alerts | sourceId, eventType, read |
| `crisisTriage` | Cached Gemini triage | crisisId, buckets, reasoning |
| `taxProfile/{uid}` | Tax inputs (one doc per user) | grossIncome, deductions, regime fields |
| `calendarSync/{uid}` | Finia-item → Google `eventId` map | per-item event IDs |
| `fcmTokens/{uid}` | Device push token + lead prefs | token, leadDays |
| `systemSettings/global` | Admin config | featureFlags, freeTierLimits, taxConfig |

---

## Deduplication design

Every collection that can receive duplicate data uses a **deterministic document ID** as the deduplication key. `setDoc` with `merge: true` means a second write to the same ID is a safe no-op rather than a duplicate record.

| Collection | Dedup key |
|---|---|
| bills | `uid_issuer_last4_statementMonth_totalDue` |
| paymentInstances | `recurringPaymentId_dueDate` |
| fdIncomeSchedule | `fdId_payoutDate` |
| notifications | `sourceId_eventType_Nd` |
| tasks (tax dates) | `advance_tax_Q1_FY2025-26`, `itr_deadline_AY2026-27` |
| crisisTriage | hash of sorted clustered taskIds |

---

## Security model

- **Default-deny** catch-all on all documents.
- Per-user ownership on every data collection (`userId == request.auth.uid`).
- `tasks` and `bills` additionally allow admin reads for dashboard aggregation.
- Admin role is read from the caller's own `users` doc and **can never be set from the client** —
  users cannot change their own `role`, and the protected default-admin account cannot be
  demoted, suspended, or deleted via a client write.
- The Gemini key lives only in the server runtime (Secret Manager `gemini-key`); the client
  bundle ships only the public Firebase web config.
- Encrypted bill PDFs are decrypted **in memory** on the server; passwords are never stored.

---

## Acknowledgements

Project planning, architecture decisions, feature design, and documentation were developed with the assistance of **Claude (Anthropic)** as an AI planning and ideation partner.

Bootstrapped on **Google AI Studio (Antigravity)** and deployed on **Google Cloud / Firebase**.

---

## Submission details

| Item | Value |
|---|---|
| Hackathon | Vibe2Ship · June 2026 |
| Problem Statement | PS1 — The Last-Minute Life Saver |
| Submitted by | Jayakrishnan Raveedran |
| Deployed URL | https://finiaapp--gen-lang-client-0144814356.asia-southeast1.hosted.app/ |
| Google Doc | https://docs.google.com/document/d/1GHAna-95PltqdBNO3RA03ywjhARi9j-P890UWCWtnkI/edit |
| Deadline | 29 June 2026 · 2:00 PM |
