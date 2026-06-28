import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { getGmailAccessToken, syncGmail as rawSyncGmail, type GmailFindings } from "./docApi";
import { commitDocument } from "./documents";
import { upsertTask } from "./taskMutations";
import { notifyEvent } from "./notifications";

const slug = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);

/**
 * The single, reusable Gmail sync the whole app calls (TopBar "Sync now" + the
 * Documents screen). It:
 *   1. Loads per-user sync state (historyId + processed message ids) from the profile.
 *   2. Rate-limits manual syncs (max 3/hour) BEFORE opening the OAuth popup.
 *   3. Calls the incremental server endpoint (90-day first sync, then historyId deltas).
 *   4. Commits findings — bills/receipts via commitDocument (dedupeKey backstop),
 *      deadlines as tasks, subscriptions as docs.
 *   5. Persists the new historyId, the processed-id set, and the sync timestamp.
 */

const RATE_LIMIT = 3; // manual syncs allowed per window
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const PROCESSED_CAP = 1000; // bound the stored processed-id set

export class RateLimitError extends Error {
  constructor(public minutes: number) {
    super(`Sync limit reached — try again in ${minutes} min.`);
    this.name = "RateLimitError";
  }
}

export interface SyncCounts {
  bills: number;
  deadlines: number;
  receipts: number;
  subscriptions: number;
}

export interface SyncResult {
  counts: SyncCounts;
  total: number;
  duplicates: number;
  paths?: Record<string, number>;
  log?: string[];
  findings: GmailFindings;
}

interface GmailSyncState {
  historyId?: string | null;
  processedIds?: string[];
  lastSyncedAt?: number;
  syncTimes?: number[];
}

/** "Found 2 bills, 1 deadline" — or "No new items found". */
export function describeSync(c: SyncCounts): string {
  const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? "" : "s"}`;
  const parts: string[] = [];
  if (c.bills) parts.push(plural(c.bills, "bill"));
  if (c.deadlines) parts.push(plural(c.deadlines, "deadline"));
  if (c.receipts) parts.push(plural(c.receipts, "receipt"));
  if (c.subscriptions) parts.push(plural(c.subscriptions, "subscription"));
  return parts.length ? `Found ${parts.join(", ")}` : "No new items found";
}

export async function runGmailSync(uid: string, now: number = Date.now()): Promise<SyncResult> {
  // Load state + enforce the rate limit BEFORE opening the OAuth popup, so a
  // spammed button can't trigger repeated consent prompts or fetches.
  const snap = await getDoc(doc(db, "users", uid));
  const data: any = snap.exists() ? snap.data() : {};
  const state: GmailSyncState = data.gmailSync || {};
  const recent = (state.syncTimes || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    const oldest = Math.min(...recent);
    const minutes = Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 60000));
    throw new RateLimitError(minutes);
  }
  const passwordFormats: Record<string, string> = data.prefs?.finance?.billPasswordFormats || {};

  const token = await getGmailAccessToken();
  const resp = await rawSyncGmail({
    accessToken: token,
    historyId: state.historyId || null,
    processedIds: state.processedIds || [],
    passwordFormats,
  });

  // ── Commit findings. dedupeKey (bill doc id) is the final no-duplicate backstop. ──
  const counts: SyncCounts = { bills: 0, deadlines: 0, receipts: 0, subscriptions: 0 };
  let duplicates = 0;

  for (const b of resp.bills || []) {
    const r = await commitDocument(uid, {
      type: "credit-card-bill",
      source: "gmail",
      fileName: `Gmail: ${b.issuer || "bill"}`,
      extracted: { issuer: b.issuer, last4: b.last4, statementMonth: b.statementMonth, totalDue: b.totalDue, minimumDue: b.minimumDue, dueDate: b.dueDate },
    });
    if (r.duplicate) duplicates++;
    else counts.bills++;
  }
  for (const r of resp.receipts || []) {
    const c = await commitDocument(uid, {
      type: "receipt",
      source: "gmail",
      fileName: `Gmail: ${r.merchant || "receipt"}`,
      extracted: { merchant: r.merchant, amount: r.amount, date: r.date, category: r.category },
    });
    if (c.duplicate) duplicates++;
    else counts.receipts++;
  }
  for (const d of resp.deadlines || []) {
    // Deterministic id → re-processing the same email (e.g. after a historyId reset) won't duplicate.
    await upsertTask(uid, `gmail_dl_${uid}_${slug(d.title)}_${d.dueDate}`, { title: d.title, dueDate: d.dueDate, priority: d.priority || "medium", category: d.category === "tax" ? "tax" : "finance" });
    counts.deadlines++;
  }
  for (const s of resp.subscriptions || []) {
    await setDoc(
      doc(db, "subscriptions", `gmail_sub_${uid}_${slug(s.name)}`),
      { userId: uid, name: s.name, amount: s.amount, frequency: s.frequency || "monthly", category: "other", active: true, createdAt: serverTimestamp() },
      { merge: true }
    );
    counts.subscriptions++;
  }

  // ── Persist bookkeeping (historyId checkpoint + processed-id set + rate-limit clock). ──
  const mergedProcessed = [...(state.processedIds || []), ...(resp.processedIds || [])];
  await setDoc(
    doc(db, "users", uid),
    {
      gmailSync: {
        historyId: resp.historyId || state.historyId || null,
        processedIds: mergedProcessed.slice(-PROCESSED_CAP),
        lastSyncedAt: now,
        syncTimes: [...recent, now].slice(-RATE_LIMIT),
      },
    },
    { merge: true }
  );

  const total = counts.bills + counts.deadlines + counts.receipts + counts.subscriptions;

  // In-app notification mirroring the result (the on-screen counterpart of FCM push).
  // Non-fatal: if the notifications rule isn't deployed yet, the sync itself still
  // succeeds — we never surface a permission error for this nice-to-have write.
  if (total > 0) {
    try {
      // Deduped per day so repeated syncs don't stack identical "Gmail sync" alerts.
      const day = new Date(now).toISOString().slice(0, 10);
      await notifyEvent(uid, { type: "gmail", title: "Gmail sync", body: describeSync(counts), link: "/documents" }, `gmail_sync_${uid}_${day}`);
    } catch (e) {
      console.warn("Notification write skipped (deploy firestore.rules for notifications):", e);
    }
  }

  return {
    counts,
    total,
    duplicates,
    paths: resp.paths,
    log: resp.log,
    findings: { bills: resp.bills || [], deadlines: resp.deadlines || [], receipts: resp.receipts || [], subscriptions: resp.subscriptions || [] },
  };
}
