import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "./firebase";

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ base64: (r.result as string).split(",")[1], mimeType: file.type });
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export interface ExtractResult {
  type: string;
  fields: Record<string, any>;
  confidence?: Record<string, number>;
  summary?: string;
  tags?: string[];
}

export class ExtractError extends Error {
  constructor(message: string, public code: "needsKey" | "unreadable" | "other") {
    super(message);
  }
}

export async function extractDocument(file: File): Promise<ExtractResult> {
  const { base64, mimeType } = await fileToBase64(file);
  const res = await fetch("/api/document/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileBase64: base64, mimeType, fileName: file.name }),
  });
  if (res.ok) return res.json();
  const err = await res.json().catch(() => ({}));
  if (err.needsKey) throw new ExtractError(err.error || "Gemini key required", "needsKey");
  if (err.unreadable) throw new ExtractError(err.error || "Unreadable", "unreadable");
  throw new ExtractError(err.error || "Extraction failed", "other");
}

// ── Gmail ──
export async function getGmailAccessToken(): Promise<string> {
  const result = await signInWithPopup(auth, googleProvider);
  const cred = GoogleAuthProvider.credentialFromResult(result);
  if (!cred?.accessToken) throw new Error("Couldn't get Gmail access — please allow it and retry.");
  return cred.accessToken;
}

export interface GmailFindings {
  bills: any[];
  deadlines: any[];
  receipts: any[];
  subscriptions: any[];
}

export interface GmailSyncParams {
  accessToken: string;
  historyId?: string | null;
  processedIds?: string[];
  passwordFormats?: Record<string, string>;
}

export interface GmailSyncResponse extends GmailFindings {
  historyId: string;
  processedIds: string[];
  scanned?: number;
  processed?: number;
  truncated?: boolean;
  paths?: Record<string, number>;
  log?: string[];
}

export async function syncGmail(params: GmailSyncParams): Promise<GmailSyncResponse> {
  const res = await fetch("/api/gmail/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || "Gmail sync failed.");
  }
  return res.json();
}
