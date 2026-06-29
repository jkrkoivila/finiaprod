# finia

**Your AI for deadlines, money, and tax.**

Finia is an AI-powered personal life operating system built for Indian students, professionals, and entrepreneurs. One conversational Gemini agent manages tasks, deadlines, credit card bills, fixed deposits, recurring payments, and tax planning — with autonomous Cloud Function pipelines that act in the background without the user having to ask.

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
- Natural language task and bill creation — "pay rent ₹15,000 on the 5th every month" creates a recurring payment, three upcoming instances, calendar reminders, and a priority task in one turn
- Gemini 2.0 Flash with function calling — agent creates tasks, books Google Calendar events, sets FCM reminders, and queries financial summaries autonomously
- Multi-turn memory with full conversation history and real Firestore context injected on every request

### Automated Gmail extraction pipeline
- Incremental sync via Gmail historyId — only new emails fetched after the first sync
- 90-day window on first sync enforced by Gmail-side query filter — old inboxes never trigger bulk AI calls
- Text-first PDF extraction (PyMuPDF); Gemini Vision used only as fallback for scanned documents
- Encrypted credit card PDF decryption in-memory, server-side — supports HDFC, SBI, ICICI, Axis, Kotak
- Full 12-step autonomous pipeline: Gmail fetch → relevance filter → decrypt → Gemini extract → validate → deduplicate → Firestore write → task created → Google Calendar event → FCM push → in-app notification

### Crisis mode
- Triggers automatically when 3+ tasks are due within 48 hours
- Full-screen dark triage: Gemini classifies each task as Do now, Defer, or Drop with a one-line reason
- Triage result cached by crisisId — reopening is instant, Gemini is never called twice for the same cluster
- No competitor product has this feature

### Tax intelligence (FY 2025-26 / AY 2026-27)
- Old vs new regime live calculator with correct slab application
- 80CCD(2) employer NPS correctly applied in the new regime — most calculators get this wrong
- Payslip and Form 16 auto-population via Gemini Vision — tested against a real AY 2026-27 Form 16
- Optional deduction picker — users add only what applies; required sub-fields surface on selection
- Two financial years side by side with year-over-year change
- AI Tax Expert chat with the user's full income and deduction context

### Fixed deposit intelligence
- Compound interest engine: quarterly (Indian bank default), monthly, half-yearly, annual, and simple interest
- Non-cumulative FDs generate monthly/quarterly income entries automatically — appears in Income this month
- Live accrual counter updating every few seconds in the FD detail view
- Maturity reminders at 30, 7, and 1 day; auto-created decision task 7 days before maturity
- Optional per-FD tax integration — FD interest added to Income from Other Sources only if the user opts in

### Finance module
- Automated credit card bill extraction with transaction-level spend breakdown
- Income vs expense dashboard with monthly waterfall and category trends
- Subscription tracker with unused-subscription detection
- Receivables tracker — who owes the user money, 7-day reminders, WhatsApp draft
- Recurring payments with planned vs actual capture and payment proof attachment

### Document library
- Per-type required-field validation — missing fields quarantine a document as needs-review, excluded from all totals
- Preview-before-save — every extracted field shown and editable before committing
- Cascade delete via sourceDocumentId — deleting a file removes all derived records atomically
- ITR readiness check — lists which proof documents are present and which are missing

### Two-channel reminders
- Firebase Cloud Messaging push via Service Worker — fires when the app is closed
- Google Calendar events as reliability fallback — uses the phone's native calendar app which the OS guarantees will alert
- Reminder lead time from user settings — no hardcoded values anywhere

---

## Google technologies used

| Technology | How Finia uses it |
|---|---|
| **Gemini 2.0 Flash** | Orchestration agent, function calling, NL parsing, crisis triage, tax expert, bill insights |
| **Gemini Vision** | Payslip extraction, Form 16 extraction, encrypted PDF parsing, camera receipt scanning |
| **Gmail API** | Incremental inbox sync, bill/deadline extraction, attachment download |
| **Google Calendar API** | Focus block booking, bill reminders, FD maturity events, PATCH via eventId |
| **Firebase Authentication** | Google Sign-In, UID-scoped data partitioning |
| **Firebase Firestore** | Primary database, live onSnapshot subscriptions, deterministic deduplication keys |
| **Firebase Cloud Functions** | All server-side logic — Gemini calls, Gmail pipeline, Calendar sync, FD scheduler |
| **Firebase Cloud Messaging** | Browser push notifications via Service Worker |
| **Firebase Hosting** | Static frontend, SPA rewrites, /api rewrite to Cloud Functions |
| **Cloud Scheduler** | Daily 08:00 IST reminder scan — bills, tasks, FDs, tax dates |
| **Google Cloud Deployment** | Built and deployed via Google AI Studio (Antigravity) |

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────┐
│                    React PWA (Frontend)                  │
│   Dashboard · Tasks · Finance · Tax · FDs · Calendar     │
│   Floating Finia agent · Dark mode · Mobile bottom tabs  │
└────────────────────┬────────────────────────────────────┘
                     │ /api/** rewrite
┌────────────────────▼────────────────────────────────────┐
│              Firebase Cloud Functions (Node.js)          │
│                                                          │
│  /api/chat          Gemini 2.0 Flash · function calling  │
│  /api/gmail/sync    historyId → filter → extract → write │
│  /api/calendar/*    GCal create / PATCH / delete         │
│  /api/payslip       Gemini Vision extraction             │
│  /api/crisis-triage Gemini triage + crisisId cache       │
│  /api/tax-ai-expert Gemini with taxProfile context       │
│  /api/bill-insight  Gemini spend analysis                │
│  scheduled/daily    FCM scan · FD payouts · reminders    │
└──────┬──────────────┬──────────────┬────────────────────┘
       │              │              │
┌──────▼──────┐ ┌─────▼──────┐ ┌───▼────────────────────┐
│  Firestore  │ │  Gmail API │ │  Google Calendar API    │
│  (all data) │ │  (read     │ │  (read + write)         │
│             │ │  only)     │ │                         │
└─────────────┘ └────────────┘ └─────────────────────────┘
       │
┌──────▼──────────────────────────────────────────────────┐
│              Firebase Cloud Messaging (FCM)              │
│      Service Worker → phone notification (2 channels)    │
└─────────────────────────────────────────────────────────┘
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 (Vite), Tailwind CSS |
| Backend | Node.js (Express) on Firebase Cloud Functions 2nd gen |
| AI | Gemini 2.0 Flash, Gemini Vision (Google AI Studio) |
| Database | Firebase Firestore (live onSnapshot) |
| Auth | Firebase Authentication (Google Sign-In) |
| Push | Firebase Cloud Messaging + Service Worker |
| Scheduling | Firebase Cloud Scheduler |
| PDF | PyMuPDF (text extraction + in-memory decryption) |
| Charts | Recharts |
| PWA | Web App Manifest, Service Worker |
| Deployment | Firebase Hosting + Cloud Functions |

---

## Running locally

### Prerequisites
- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools`)
- A Firebase project with Firestore, Auth, Functions, Hosting enabled
- Google Cloud project with Gmail API and Calendar API enabled
- Gemini API key from Google AI Studio

### 1. Clone the repository

```bash
git clone https://github.com/jkrkoivila/finiaprod.git
cd finia
```

### 2. Install dependencies

```bash
# Frontend
npm install

# Cloud Functions
cd functions && npm install && cd ..
```

### 3. Configure environment variables

Create `functions/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key
OAUTH_CLIENT_ID=your_google_oauth_client_id
OAUTH_CLIENT_SECRET=your_google_oauth_client_secret
```

Create `.env.local` in the project root:

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 4. Configure Firebase

```bash
firebase login
firebase use your-project-id
```

### 5. Deploy Firestore security rules

```bash
firebase deploy --only firestore:rules
```

### 6. Set up admin account

After first sign-in, go to **Firestore Console → users → your document** and set:
```json
{ "role": "admin", "isDefaultAdmin": true }
```

### 7. Run locally

```bash
# Start the frontend
npm run dev

# In a separate terminal — start the Functions emulator
firebase emulators:start --only functions
```

Open `http://localhost:5173`

### 8. Deploy to production

```bash
npm run build
firebase deploy
```

---

## Project structure

```
finia/
├── src/
│   ├── components/        # React components
│   │   ├── Dashboard/     # Vitals, financial pulse, alerts
│   │   ├── Agent/         # Floating Finia chat window
│   │   ├── Tasks/         # Task list, crisis mode
│   │   ├── Finance/       # Bills, recurring, FDs, receivables
│   │   ├── Tax/           # Calculator, payslip, tax expert
│   │   ├── Calendar/      # Unified calendar view
│   │   ├── Documents/     # Library, import, preview
│   │   └── Admin/         # Admin panel, system settings
│   ├── hooks/             # Firestore data hooks (onSnapshot)
│   ├── services/          # Client-side service layer
│   └── utils/             # Tax engine, FD calculator, formatters
├── functions/
│   ├── src/
│   │   ├── agent.ts       # Gemini chat + function calling
│   │   ├── gmail.ts       # Gmail sync pipeline
│   │   ├── calendar.ts    # Google Calendar integration
│   │   ├── payslip.ts     # Gemini Vision extraction
│   │   ├── crisis.ts      # Triage + cache
│   │   ├── fd.ts          # FD income scheduler
│   │   ├── recurring.ts   # Recurring payment engine
│   │   └── scheduler.ts   # Daily FCM reminder scan
│   └── index.ts           # Function exports
├── public/
│   ├── manifest.json      # PWA manifest (Finia pulse logo)
│   └── firebase-messaging-sw.js  # FCM Service Worker
├── firestore.rules        # Security rules
└── firebase.json          # Hosting + Functions config
```

---

## Firestore data model

| Collection | Purpose | Key fields |
|---|---|---|
| `users` | User profile + settings | role, plan, onboarded, demoMode, gmailHistoryId |
| `tasks` | All tasks | title, dueDate, priority, category, sourceDocumentId |
| `bills` | Credit card bills | dedupeKey (doc ID), issuer, totalDue, dueDate |
| `transactions` | Income + expenses | amount, category, sourceType, fdId |
| `fixedDeposits` | FD templates | principal, rate, compoundingFrequency, payoutType |
| `paymentInstances` | Recurring occurrences | recurringPaymentId, dueDate, actualAmount, proofUrl |
| `recurringPayments` | Payment templates | title, plannedAmount, frequency, dueDay |
| `documents` | Uploaded files | status, sourceDocumentId, extractedData |
| `notifications` | In-app alerts | sourceId, eventType (deterministic ID), read |
| `crisisTriage` | Cached Gemini triage | crisisId, buckets, reasoning |
| `systemSettings/global` | Admin feature flags | featureFlags, freeTierLimits, taxConfig |

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

## QC results

109 / 128 checks passing on the full QC audit (≈ 92% weighted).

Critical items resolved:
- Firestore security rules deployed
- No secrets in client bundle (verified by grep of built dist/)
- All Firestore reads/writes UID-scoped

Known Phase 2 items (not blocking submission):
- Dedicated 404 page
- Full dark mode console-error sweep on all authenticated routes
- PWA install verification on a physical Android device

---

## Acknowledgements

Project planning, architecture decisions, feature design, and documentation were developed with the assistance of **Claude (Anthropic)** as an AI planning and ideation partner.

Built on **Google AI Studio (Antigravity)** and deployed on **Google Cloud**.

---

## Submission details

| Item | Value |
|---|---|
| Hackathon | Vibe2Ship · June 2026 |
| Problem Statement | PS1 — The Last-Minute Life Saver |
| Submitted by | Jayakrishnan Raveedran |
| Deployed URL | `[paste here]` |
| Google Doc | `[paste here]` |
| Deadline | 29 June 2026 · 2:00 PM |
