# Finia — Project Context

> Auto-generated codebase analysis. Finia is an AI-powered personal life OS for
> Indian users (deadlines, money, tax), built as a PWA for the Vibe2Ship
> hackathon. Migrated from Google AI Studio. This document maps what **actually
> exists** vs what is **stubbed/mocked/missing** as of the current code state.

---

## 1. Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React 19 + TypeScript | Single-page app, no router library (manual `ActiveView` state switch) |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) | Brand tokens applied inline; flat design |
| Icons / animation | `lucide-react`, `motion` (Framer Motion) | |
| Build | Vite 6 | `@` alias → project root |
| Backend | Node.js + Express 4 | Single file `server.ts` (~915 lines) |
| AI | `@google/genai` v2, model `gemini-2.5-flash` | **Server-side only.** Key from `process.env.GEMINI_API_KEY` |
| Auth | Firebase Auth — Google sign-in only | Scopes: `gmail.readonly`, `calendar` |
| Database | Cloud Firestore (named DB `ai-studio-0e625a14-...`) | Web SDK on the client |
| PDF parsing | `pdf-parse` | Used server-side for encrypted statement decryption |
| Deploy | Firebase (`firebase.json` → Firestore rules only) | Server bundled via esbuild to `dist/server.cjs` |

**Run model:** `npm run dev` runs `tsx server.ts`, which boots Express and mounts
Vite in middleware mode (single process serves both API and SPA on port 3000).
Production: `vite build` + esbuild bundle, served via `npm start`.

### Environment variables
- `GEMINI_API_KEY` — required for all AI features; absent → graceful fallbacks.
- `APP_URL` — self-referential host URL.
- `DISABLE_HMR` — AI Studio sets this to disable file watching.

---

## 2. Project structure

```
finia/
├── server.ts                 # Express API + Gemini integration (all backend)
├── firebase.json             # Firestore config (rules only — no hosting/storage block)
├── firestore.rules           # Security rules (INCOMPLETE — see §4)
├── index.html                # PWA shell, manifest + theme-color + SW hooks
├── public/
│   ├── manifest.json         # PWA manifest (logo.svg as icon)
│   ├── sw.js                 # Service worker (cache-first, bypasses /api/)
│   └── logo.svg              # ECG/pulse navy logo
├── src/
│   ├── main.tsx              # React root + service worker registration
│   ├── App.tsx               # (~1542 lines) Auth, data loading, all handlers, routing
│   ├── types.ts              # Shared TS interfaces
│   ├── index.css             # Tailwind + scrollbar tweaks
│   ├── lib/
│   │   ├── firebase.ts       # Firebase init (config hardcoded — see note §4)
│   │   └── documentService.ts# Cascade delete + deletion summary by sourceDocumentId
│   └── components/
│       ├── SignIn.tsx        # Google sign-in screen (no marketing landing page)
│       ├── Onboarding.tsx    # 6-step onboarding flow
│       ├── Sidebar.tsx       # Desktop nav (8 views)
│       ├── TopBar.tsx        # Header
│       ├── MobileTabs.tsx    # Mobile bottom nav
│       ├── DashboardView.tsx # 4 vitals, financial pulse, Gmail/PDF hub
│       ├── TasksView.tsx     # Task CRUD + NL quick-add
│       ├── CalendarView.tsx  # June 2026 month grid
│       ├── FinanceView.tsx   # Cashbook, category MoM, subscriptions, receivables
│       ├── BillsView.tsx     # Bill list + detail drawer + AI insight
│       ├── TaxView.tsx       # Calculator, payslip analyser, doc library, AI expert
│       ├── DocumentsView.tsx # Upload + Gemini auto-categorize
│       ├── AnalyticsView.tsx # Expense category charts
│       └── CrisisModeView.tsx# Full-screen deadline triage
```

There is **no separate admin or settings module, and no router**. Navigation is a
single `useState<ActiveView>` in `App.tsx`. `App.tsx` is a god-component holding
all Firestore listeners, all mutation handlers, and demo-mode mirrors.

---

## 3. Firestore collections (as used in code)

All real collections are scoped by `userId == auth.uid` and read via `onSnapshot`
real-time listeners in `App.tsx` (skipped entirely when demo mode is on).

| Collection | Doc ID | Fields (from code/types) | Scoped | Has security rule? |
|---|---|---|---|---|
| `users/{uid}` | uid | profile fields, photoURL (seeded on first login) | ✅ | ✅ |
| `tasks` | auto | `userId, title, dueDate, dueTime?, category, completed, priority, amount?, sourceDocumentId?, isManuallyEdited?` | ✅ | ✅ |
| `transactions` | auto | `userId, description, amount, type(income/expense), category, date, sourceDocumentId?, isManuallyEdited?` | ✅ | ✅ |
| `bills` | auto (⚠ should be `dedupeKey`) | `userId, payee, amount, dueDate, paid, category, sourceDocumentId?, isManuallyEdited?` | ✅ | ✅ |
| `documents` | auto | `userId, fileName, fileType, storageUrl, uploadedAt, status, extractedData, confidenceFlags, size?, tags?` | ✅ | ✅ |
| `taxProfile/{uid}` | uid | `userId, grossIncome, deduction80C/80D/80CCD/80E/80G, hraReceived, homeLoanInterest` | ✅ | ✅ |
| `subscriptions` | auto | `userId, name, amount, frequency, category, lastUsedDays, active, isUnused` | ✅ | ❌ **MISSING — default-deny** |
| `receivables` | auto | `userId, debtor, amount, date, description, reminded` | ✅ | ❌ **MISSING — default-deny** |
| `payslips` | auto | referenced only in `documentService` cascade delete | ✅ | ❌ **MISSING** |
| `deductions` | auto | referenced only in `documentService` cascade delete | ✅ | ❌ **MISSING** |
| `systemSettings/global` | — | admin feature flags + tax slabs (per AGENTS.md) | — | ❌ **NOT IMPLEMENTED ANYWHERE** |

> ⚠ **Critical mismatch:** `subscriptions` and `receivables` are read/written by
> `App.tsx` but have **no `firestore.rules` entry**, so the default-deny catch-all
> blocks them in production. They appear to work only because the demo path is
> exercised, or rules aren't enforced locally.

### Status enum for documents
`imported | needs_review | uncategorized | unreadable | locked | data_removed`
— defined in types, but `DocumentsView` currently marks every upload `imported`
(quarantine not enforced).

---

## 4. External integrations

### Gemini (server-side, `gemini-2.5-flash`)
All AI runs through Express endpoints in `server.ts`; the client never sees the key.
Every endpoint has a graceful fallback when `GEMINI_API_KEY` is unset.

| Endpoint | Purpose | Mechanism |
|---|---|---|
| `POST /api/chat` | Finia agent chat | Streaming SSE + **function calling** (`create_task`, `block_calendar_time`, `set_reminder`, `get_financial_summary`). Live Firestore context injected into system prompt. |
| `POST /api/parse-task` | NL → structured task | JSON response mode |
| `POST /api/tax-saving-tips` | 80C/80D/NPS headroom tips | JSON; hardcoded fallback tips |
| `POST /api/tax-ai-expert` | Tax expert chat | Streaming SSE (no function calling) |
| `POST /api/crisis-triage` | Classify tasks do_now/defer/drop | Function calling (`classify_tasks`, mode ANY); index-based fallback |
| `POST /api/gmail/sync` | Read-only Gmail scan → bills/deadlines/receipts/subscriptions | Calls Gmail REST with access token, feeds bodies to Gemini |
| `POST /api/credit-card/decrypt` | Decrypt password-protected statement PDF **in memory** | `pdf-parse` with password → Gemini extraction. Password never stored. |
| `POST /api/payslip/analyse` | Payslip OCR | **Gemini Vision** (inlineData image/PDF) |
| `POST /api/document/categorize` | Auto-tag uploaded doc | Gemini Vision → `{category, tags, summary}` |
| `POST /api/bill-insight` | AI bill auditor note | Text generation; hardcoded fallback per category |
| `GET /api/sync` | Sync status stub | Static success JSON |

**Function-call execution is client-side** (`ChatAgent.tsx`): the model returns a
function call over SSE, the client maps it to `onAddTask`/local calc. `block_calendar_time`
and `set_reminder` are **simulated as tasks** (prefixed `[blocked]` / `[reminder]`),
not written to a real Google Calendar.

### Gmail
- Scope `gmail.readonly` requested at sign-in. Access token passed to `/api/gmail/sync`.
- Read-only: queries finance-related subjects, extracts up to 12 messages, Gemini parses.

### Google Calendar
- Scope `calendar` is requested at sign-in, but **no Calendar API call exists**.
  Calendar "blocking" only creates a local task. `CalendarView` is a static month grid.

### Firebase
- Auth (Google) ✅ and Firestore ✅ initialized in `src/lib/firebase.ts`.
- **Firebase Storage is NOT initialized.** Document `storageUrl` is a fake
  `https://example.com/demo/<name>` — no real file upload/storage exists.
- Firebase web config is **hardcoded** in `firebase.ts` (apiKey etc.). This is
  normal for Firebase web (not a secret), but worth flagging vs the "no secrets in
  client" rule — it is a public config, not a secret.

---

## 5. Demo / guest mode (significant)

A full **demo (guest sandbox) mode** exists in `App.tsx`, toggled via
`localStorage.finia_demo_mode` and the onboarding "Explore Sandbox" path.

- Sets a synthetic user `{uid:"demo-user", email:"demo@finia.ai"}` — bypasses real auth.
- **All Firestore listeners are skipped** (`if (!user || isDemoMode) return`).
- Hardcoded demo data lives in `App.tsx` (~lines 145–288): demo tasks, finance
  entries, bills, documents, subscriptions, receivables, and a tax profile
  (gross ₹12,00,000 etc.). All CRUD mutates local state instead of Firestore.

This is the primary place "mock data" lives. It is intentional for demos, but it
is the main thing to scrutinize against the "no dummy data" project rule — the
demo arrays are dummy data, just gated behind a flag.

---

## 6. Hardcoded / mock data inventory (vs "no dummy data" rule)

| Location | What | Verdict |
|---|---|---|
| `App.tsx` demo arrays | Full fake dataset | Intentional (demo mode), but is dummy data |
| `DashboardView.tsx` `todayStr = "2026-06-25"` | Hardcoded "today" | Determinism hack; should be `new Date()` |
| `FinanceView.tsx` MoM months `"2026-06"/"2026-05"` | Hardcoded compare window | Not dynamic |
| `CrisisModeView.tsx` date range `2026-06-25..27` | Hardcoded crisis window | Trigger not real |
| `CalendarView.tsx` | 2 hardcoded compliance events | Static |
| `DocumentsView.tsx` `localFiles` | 2 seeded files (Form 16, LIC) + fake `storageUrl` | **Violates rule** |
| `Sidebar.tsx` footer | Hardcoded `JK / jkkoivila / Pro account` | **Violates rule** (ignores real user) |
| `TaxView.tsx` / `server.ts` | Default gross ₹12L, deductions; tax slabs inline | Slabs should come from `systemSettings` |

---

## 7. PWA
- `manifest.json` ✅ (standalone, theme-color, logo icons).
- `sw.js` ✅ registered in `main.tsx`; cache-first, bypasses `/api/`.
- Installable ✅. **No `beforeinstallprompt` custom install UI.**
- Icons are a single `logo.svg` reused at all sizes (no raster 192/512 PNGs).

---

## 8. Security rules summary (`firestore.rules`)
- Default-deny catch-all ✅.
- Per-user ownership enforced on `users, tasks, bills, transactions, documents, taxProfile` ✅.
- **Missing rules** for `subscriptions, receivables, payslips, deductions, systemSettings`
  → those reads/writes are blocked by default-deny in production.
- No admin-role rule, no `systemSettings` rule (admin/feature-flags unimplemented).

---

## 9. Known gaps vs AGENTS.md hard rules
1. **`dedupeKey`** — not implemented. Bills use auto IDs; no dedup logic exists.
2. **`systemSettings`** — not implemented. Tax slabs are hardcoded in `TaxView.tsx`;
   no admin feature flags read anywhere.
3. **Admin panel / role** — does not exist.
4. **needs-review quarantine** — status enum exists; not enforced (`DocumentsView`
   marks all `imported`).
5. **Firebase Storage / real file storage** — not wired; `storageUrl` is fake.
6. **Real Google Calendar** — scope requested but no Calendar API integration.
7. **No public landing page** — app goes straight to onboarding/sign-in.
8. **Hardcoded user identity** in `Sidebar.tsx` and seeded files in `DocumentsView.tsx`.
9. **Crisis auto-trigger** (3+ deadlines in 48h) — not automatic; manual view with a
   hardcoded date window.
