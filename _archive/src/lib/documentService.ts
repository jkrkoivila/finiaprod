import { db } from "./firebase";
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc
} from "firebase/firestore";

const collectionsToCheck = ["bills", "transactions", "tasks", "payslips", "deductions"];

/**
 * Helper to query a collection for records matching a specific sourceDocumentId.
 */
async function getDocsBySourceDoc(collectionName: string, documentId: string) {
  const q = query(collection(db, collectionName), where("sourceDocumentId", "==", documentId));
  const snap = await getDocs(q);
  return snap.docs;
}

interface DemoData {
  bills: any[];
  transactions: any[];
  tasks: any[];
  payslips?: any[];
  deductions?: any[];
}

interface DeletionSummaryResult {
  summary: string;
  hasManualEdits: boolean;
  counts: Record<string, number>;
}

/**
 * Calculates a summary of the records that will be affected by a document deletion.
 */
export async function getDeletionSummary(
  documentId: string,
  deleteFile: boolean,
  isDemoMode: boolean,
  demoData?: DemoData
): Promise<DeletionSummaryResult> {
  const counts: Record<string, number> = {
    bills: 0,
    transactions: 0,
    tasks: 0,
    payslips: 0,
    deductions: 0
  };
  let hasManualEdits = false;

  if (isDemoMode) {
    const data = demoData || { bills: [], transactions: [], tasks: [], payslips: [], deductions: [] };
    
    const matchedBills = (data.bills || []).filter((b: any) => b.sourceDocumentId === documentId);
    counts.bills = matchedBills.length;
    if (matchedBills.some((b: any) => b.isManuallyEdited === true)) {
      hasManualEdits = true;
    }

    const matchedTx = (data.transactions || []).filter((t: any) => t.sourceDocumentId === documentId);
    counts.transactions = matchedTx.length;
    if (matchedTx.some((t: any) => t.isManuallyEdited === true)) {
      hasManualEdits = true;
    }

    const matchedTasks = (data.tasks || []).filter((t: any) => t.sourceDocumentId === documentId);
    counts.tasks = matchedTasks.length;
    if (matchedTasks.some((t: any) => t.isManuallyEdited === true)) {
      hasManualEdits = true;
    }

    const matchedPayslips = (data.payslips || []).filter((p: any) => p.sourceDocumentId === documentId);
    counts.payslips = matchedPayslips.length;
    if (matchedPayslips.some((p: any) => p.isManuallyEdited === true)) {
      hasManualEdits = true;
    }

    const matchedDeductions = (data.deductions || []).filter((d: any) => d.sourceDocumentId === documentId);
    counts.deductions = matchedDeductions.length;
    if (matchedDeductions.some((d: any) => d.isManuallyEdited === true)) {
      hasManualEdits = true;
    }
  } else {
    for (const colName of collectionsToCheck) {
      try {
        const docs = await getDocsBySourceDoc(colName, documentId);
        counts[colName] = docs.length;
        if (docs.some(docSnap => docSnap.data().isManuallyEdited === true)) {
          hasManualEdits = true;
        }
      } catch (err) {
        console.error(`Error querying collection ${colName} for document deletion summary:`, err);
      }
    }
  }

  const parts: string[] = [];
  if (deleteFile) {
    parts.push("the file");
  }
  if (counts.bills > 0) {
    parts.push(`${counts.bills} bill${counts.bills === 1 ? "" : "s"}`);
  }
  if (counts.transactions > 0) {
    parts.push(`${counts.transactions} transaction${counts.transactions === 1 ? "" : "s"}`);
  }
  if (counts.tasks > 0) {
    parts.push(`${counts.tasks} task${counts.tasks === 1 ? "" : "s"}`);
  }
  if (counts.payslips > 0) {
    parts.push(`${counts.payslips} payslip record${counts.payslips === 1 ? "" : "s"}`);
  }
  if (counts.deductions > 0) {
    parts.push(`${counts.deductions} deduction${counts.deductions === 1 ? "" : "s"}`);
  }

  let listStr = "";
  if (parts.length === 0) {
    listStr = deleteFile ? "the file" : "nothing";
  } else if (parts.length === 1) {
    listStr = parts[0];
  } else if (parts.length === 2) {
    listStr = `${parts[0]} and ${parts[1]}`;
  } else {
    listStr = `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
  }

  let summary = `This will delete ${listStr}.`;
  if (hasManualEdits) {
    summary = `This will delete ${listStr} including your manual edits.`;
  }

  return {
    summary,
    hasManualEdits,
    counts
  };
}

interface DemoActions {
  onDeleteDemoDoc?: (id: string) => void;
  onUpdateDemoDocStatus?: (id: string, status: string) => void;
  onDeleteDemoDerived?: (id: string) => void;
}

/**
 * atomic Firestore batched delete of document AND all derived records
 */
export async function deleteDocumentAndData(
  documentId: string,
  isDemoMode: boolean,
  demoActions?: DemoActions
): Promise<void> {
  if (isDemoMode) {
    if (demoActions?.onDeleteDemoDoc) {
      demoActions.onDeleteDemoDoc(documentId);
    }
    if (demoActions?.onDeleteDemoDerived) {
      demoActions.onDeleteDemoDerived(documentId);
    }
    return;
  }

  const batch = writeBatch(db);

  // 1. Delete document reference
  batch.delete(doc(db, "documents", documentId));

  // 2. Fetch and delete derived records
  for (const colName of collectionsToCheck) {
    const docs = await getDocsBySourceDoc(colName, documentId);
    docs.forEach((docSnap) => {
      batch.delete(doc(db, colName, docSnap.id));
    });
  }

  // 3. Commit atomic write
  await batch.commit();
}

/**
 * Removes derived records but keeps the document file, marking its status as "data_removed".
 */
export async function deleteDataOnly(
  documentId: string,
  isDemoMode: boolean,
  demoActions?: DemoActions
): Promise<void> {
  if (isDemoMode) {
    if (demoActions?.onUpdateDemoDocStatus) {
      demoActions.onUpdateDemoDocStatus(documentId, "data_removed");
    }
    if (demoActions?.onDeleteDemoDerived) {
      demoActions.onDeleteDemoDerived(documentId);
    }
    return;
  }

  const batch = writeBatch(db);

  // 1. Mark document status as "data_removed"
  batch.update(doc(db, "documents", documentId), { status: "data_removed" });

  // 2. Fetch and delete derived records
  for (const colName of collectionsToCheck) {
    const docs = await getDocsBySourceDoc(colName, documentId);
    docs.forEach((docSnap) => {
      batch.delete(doc(db, colName, docSnap.id));
    });
  }

  // 3. Commit atomic write
  await batch.commit();
}
