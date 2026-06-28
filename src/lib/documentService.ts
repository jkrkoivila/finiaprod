import { collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

// Collections whose records may be derived from a document (each stores sourceDocumentId).
const DERIVED_COLLECTIONS = ["bills", "transactions", "tasks"] as const;

/**
 * Fetch a user's records derived from a given document. We filter by userId
 * (security-rules friendly, single-field index) then by sourceDocumentId
 * client-side — avoids a composite index.
 */
async function derivedDocs(uid: string, collName: string, documentId: string) {
  const q = query(collection(db, collName), where("userId", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.filter((d) => (d.data() as any).sourceDocumentId === documentId);
}

export interface DeletionSummary {
  counts: Record<string, number>;
  total: number;
  hasManualEdits: boolean;
  text: string;
}

/** Preview what a cascade delete will remove, warning if anything was hand-edited. */
export async function getDeletionSummary(uid: string, documentId: string, deleteFile: boolean): Promise<DeletionSummary> {
  const counts: Record<string, number> = {};
  let hasManualEdits = false;
  let total = 0;

  for (const coll of DERIVED_COLLECTIONS) {
    const docs = await derivedDocs(uid, coll, documentId);
    counts[coll] = docs.length;
    total += docs.length;
    if (docs.some((d) => (d.data() as any).isManuallyEdited === true)) hasManualEdits = true;
  }

  const parts: string[] = [];
  if (deleteFile) parts.push("the file");
  for (const coll of DERIVED_COLLECTIONS) {
    if (counts[coll] > 0) parts.push(`${counts[coll]} ${coll === "transactions" ? "transaction" : coll.slice(0, -1)}${counts[coll] === 1 ? "" : "s"}`);
  }
  let list = "nothing";
  if (parts.length === 1) list = parts[0];
  else if (parts.length === 2) list = `${parts[0]} and ${parts[1]}`;
  else if (parts.length > 2) list = `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;

  let text = `This will remove ${list}.`;
  if (hasManualEdits) text += " Some records include your manual edits.";

  return { counts, total, hasManualEdits, text };
}

/** Delete the document file AND every derived record (atomic batch). */
export async function deleteDocumentAndData(uid: string, documentId: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, "documents", documentId));
  for (const coll of DERIVED_COLLECTIONS) {
    const docs = await derivedDocs(uid, coll, documentId);
    docs.forEach((d) => batch.delete(doc(db, coll, d.id)));
  }
  await batch.commit();
}

/** Remove derived records but keep the file; mark the document 'data_removed'. */
export async function deleteDataOnly(uid: string, documentId: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, "documents", documentId), { status: "data_removed" });
  for (const coll of DERIVED_COLLECTIONS) {
    const docs = await derivedDocs(uid, coll, documentId);
    docs.forEach((d) => batch.delete(doc(db, coll, d.id)));
  }
  await batch.commit();
}
