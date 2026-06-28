import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { keyForBill } from "./billKey";
import { DOC_TYPES, documentDedupeKey, evaluateImport, type DocStatus, type DocType } from "./importCriteria";

export interface DocumentDraft {
  type: DocType | null;
  extracted: Record<string, any>;
  fileName: string;
  source: "upload" | "gmail";
  confidenceFlags?: Record<string, boolean>;
  storageUrl?: string | null;
  tags?: string[];
  summary?: string;
  /** Force a terminal status from the extraction step (overrides evaluation). */
  forcedStatus?: Extract<DocStatus, "unreadable" | "locked">;
  /** True when the user edited fields in the preview. */
  edited?: boolean;
}

export interface CommitResult {
  id: string;
  status: DocStatus;
  duplicate: boolean;
}

function newDocId(): string {
  return doc(collection(db, "documents")).id;
}

/** Create derived records (bills / transactions) carrying sourceDocumentId. */
async function deriveRecords(uid: string, documentId: string, type: DocType, x: Record<string, any>, edited: boolean) {
  const base = { userId: uid, sourceDocumentId: documentId, isManuallyEdited: !!edited };

  const writeBill = (id: string, bill: Record<string, any>) =>
    setDoc(doc(db, "bills", id), { ...base, paid: false, ...bill, updatedAt: serverTimestamp() }, { merge: true });

  if (type === "credit-card-bill") {
    const id = keyForBill({ payee: x.issuer, last4: x.last4, statementMonth: x.statementMonth, dueDate: x.dueDate || `${x.statementMonth}-28`, amount: x.totalDue });
    await writeBill(id, { payee: x.issuer, amount: x.totalDue, dueDate: x.dueDate || `${x.statementMonth}-28`, category: "credit-card", last4: x.last4, minimumDue: x.minimumDue, statementMonth: x.statementMonth, dedupeKey: id });
  } else if (type === "utility-bill") {
    const id = keyForBill({ payee: x.provider, dueDate: x.dueDate, amount: x.amount });
    await writeBill(id, { payee: x.provider, amount: x.amount, dueDate: x.dueDate, category: "other", dedupeKey: id });
  } else if (type === "loan-statement") {
    const id = keyForBill({ payee: x.lender, dueDate: x.dueDate, amount: x.emiAmount });
    await writeBill(id, { payee: x.lender, amount: x.emiAmount, dueDate: x.dueDate, category: "other", dedupeKey: id });
  } else if (type === "receipt") {
    await addDoc(collection(db, "transactions"), { ...base, description: x.merchant, amount: x.amount, type: "expense", category: x.category || "general", date: x.date });
  } else if (type === "bank-statement" && Array.isArray(x.transactions)) {
    for (const tx of x.transactions) {
      await addDoc(collection(db, "transactions"), {
        ...base, description: tx.merchant || tx.description || "transaction", amount: tx.amount,
        type: (tx.amount || 0) < 0 ? "income" : "expense", category: tx.category || "general", date: tx.date,
      });
    }
  }
}

/** Whether an importable document with this dedupe key already exists. */
export async function isDuplicate(documentId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, "documents", documentId));
  return snap.exists();
}

/**
 * Commit a document: decides status, prevents structural duplicates by using the
 * dedupe key as the doc id, and creates derived records only when 'imported'.
 */
export async function commitDocument(uid: string, draft: DocumentDraft): Promise<CommitResult> {
  // Terminal statuses from extraction (still save the file record).
  if (draft.forcedStatus) {
    const id = newDocId();
    await setDoc(doc(db, "documents", id), {
      userId: uid, type: draft.type ?? null, status: draft.forcedStatus, fileName: draft.fileName,
      source: draft.source, extractedData: draft.extracted || {}, storageUrl: draft.storageUrl ?? null,
      uploadedAt: serverTimestamp(),
    });
    return { id, status: draft.forcedStatus, duplicate: false };
  }

  const evalResult = evaluateImport(draft.type, draft.extracted);
  const status = evalResult.status;

  // Dedupe only makes sense for importable docs with a complete key.
  let id: string;
  let dedupeKey: string | null = null;
  if (status === "imported" && draft.type) {
    dedupeKey = documentDedupeKey(draft.type, draft.extracted);
    if (dedupeKey) {
      if (await isDuplicate(dedupeKey)) return { id: dedupeKey, status, duplicate: true };
      id = dedupeKey;
    } else {
      id = newDocId();
    }
  } else {
    id = newDocId();
  }

  await setDoc(doc(db, "documents", id), {
    userId: uid,
    type: draft.type ?? null,
    status,
    fileName: draft.fileName,
    source: draft.source,
    extractedData: draft.extracted || {},
    confidenceFlags: draft.confidenceFlags || {},
    missingRequired: evalResult.missingRequired,
    tags: draft.tags || [],
    summary: draft.summary || "",
    dedupeKey,
    storageUrl: draft.storageUrl ?? null,
    uploadedAt: serverTimestamp(),
  });

  if (status === "imported" && draft.type) {
    await deriveRecords(uid, id, draft.type, draft.extracted, !!draft.edited);
  }

  return { id, status, duplicate: false };
}

export const DOC_TYPE_OPTIONS = Object.values(DOC_TYPES).map((d) => ({ id: d.id, label: d.label }));
