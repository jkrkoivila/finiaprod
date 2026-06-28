import { useState } from "react";
import { useUserCollection } from "../lib/useUserCollection";
import { useSystemSettings } from "../lib/useSystemSettings";
import { useAuth } from "../lib/auth";
import { commitDocument } from "../lib/documents";
import { deleteDataOnly, deleteDocumentAndData, getDeletionSummary } from "../lib/documentService";
import { extractDocument } from "../lib/docApi";
import { runGmailSync } from "../lib/gmailSync";
import DocumentsView from "./DocumentsView";
import UpgradeModal from "./UpgradeModal";
import type { FiniaDocument } from "../types";

export default function DocumentsScreen({ uid }: { uid: string }) {
  const { items: documents, loading } = useUserCollection<FiniaDocument>("documents", uid);
  const { settings } = useSystemSettings();
  const { profile } = useAuth();
  const [limit, setLimit] = useState(false);

  const isPro = profile?.plan === "pro" || profile?.role === "admin";
  const maxDocs = settings.freeTier.maxDocuments;

  return (
    <>
      <DocumentsView
        documents={documents}
        loading={loading}
        extract={(file) => extractDocument(file)}
        commit={(draft) => {
          // Free-tier limit: block new documents past maxDocuments (Pro/admin bypass).
          if (!isPro && documents.length >= maxDocs) {
            setLimit(true);
            return Promise.reject(new Error(`Free plan limit of ${maxDocs} documents reached — upgrade to Pro.`));
          }
          return commitDocument(uid, draft);
        }}
        remove={(doc, mode) => (mode === "file" ? deleteDocumentAndData(uid, doc.id) : deleteDataOnly(uid, doc.id))}
        summary={(doc) => getDeletionSummary(uid, doc.id, true)}
        // The shared sync commits findings (incremental, deduped) and returns what it imported.
        syncGmail={() => runGmailSync(uid)}
      />
      {limit && (
        <UpgradeModal
          title="Free plan limit reached"
          message={`You've reached the free plan limit of ${maxDocs} documents. Upgrade to Pro to add more.`}
          onClose={() => setLimit(false)}
        />
      )}
    </>
  );
}
