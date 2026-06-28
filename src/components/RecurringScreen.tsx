import { useEffect, useRef, useState } from "react";
import { useUserCollection } from "../lib/useUserCollection";
import {
  createRecurringPayment, editTemplate, pauseTemplate, deleteTemplate, markInstancePaid, backfillTemplate, ensureInstances,
} from "../lib/recurringMutations";
import { uploadProof } from "../lib/proofUpload";
import { recurringGroups } from "../lib/recurring";
import RecurringView from "./RecurringView";
import type { PaymentInstance, RecurringPayment } from "../lib/recurring";

export default function RecurringScreen({ uid, onBack }: { uid: string; onBack: () => void }) {
  const { items: realTemplatesRaw, loading: loadingT } = useUserCollection<RecurringPayment>("recurringPayments", uid);
  const { items: instancesRaw, loading: loadingI } = useUserCollection<PaymentInstance>("paymentInstances", uid);

  // Optimistic delete: hide ids immediately; the prune effects drop them once the
  // Firestore snapshot confirms (so a deleted item can't reappear), and the catch
  // in handleDelete restores them on failure.
  const [removedTemplates, setRemovedTemplates] = useState<Set<string>>(new Set());
  const [removedInstances, setRemovedInstances] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const present = new Set(realTemplatesRaw.map((t) => t.id));
    setRemovedTemplates((s) => {
      const next = new Set([...s].filter((id) => present.has(id)));
      return next.size === s.size ? s : next;
    });
  }, [realTemplatesRaw]);
  useEffect(() => {
    const present = new Set(instancesRaw.map((i) => i.id));
    setRemovedInstances((s) => {
      const next = new Set([...s].filter((id) => present.has(id)));
      return next.size === s.size ? s : next;
    });
  }, [instancesRaw]);

  const realTemplates = realTemplatesRaw.filter((t) => !removedTemplates.has(t.id));
  const instances = instancesRaw.filter((i) => !removedInstances.has(i.id));

  // Repair: any active template with zero instances → generate its next few now,
  // so it shows up in the dashboard Money due / EMIs immediately.
  const repairing = useRef(false);
  useEffect(() => {
    if (loadingT || loadingI || repairing.current) return;
    const withInstances = new Set(instancesRaw.map((i) => i.recurringPaymentId));
    const missing = realTemplatesRaw.filter((t) => t.isActive && !withInstances.has(t.id));
    if (!missing.length) return;
    repairing.current = true;
    Promise.all(missing.map((t) => ensureInstances(uid, t).catch(() => {}))).finally(() => { repairing.current = false; });
  }, [uid, loadingT, loadingI, realTemplatesRaw, instancesRaw]);

  // Render real templates AND orphaned instances (whose template was deleted) so the
  // Finance view reflects the same paymentInstances the calendar + Money due read.
  const { templates, orphanedIds } = recurringGroups(realTemplates, instances);
  const loading = loadingT || loadingI;

  // Deep-link target from the calendar / Money due breakdown (?open=<recurringPaymentId>).
  const initialDetailId =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("open") || undefined : undefined;

  const handleDelete = async (id: string, deleteUnpaid: boolean) => {
    setError(null);
    const unpaidIds = deleteUnpaid
      ? instancesRaw.filter((i) => i.recurringPaymentId === id && i.status !== "paid" && i.status !== "skipped").map((i) => i.id)
      : [];
    // Optimistic hide.
    setRemovedTemplates((s) => new Set(s).add(id));
    if (unpaidIds.length) setRemovedInstances((s) => { const n = new Set(s); unpaidIds.forEach((x) => n.add(x)); return n; });
    try {
      await deleteTemplate(uid, id, deleteUnpaid);
    } catch (e) {
      // Restore on failure.
      setRemovedTemplates((s) => { const n = new Set(s); n.delete(id); return n; });
      setRemovedInstances((s) => { const n = new Set(s); unpaidIds.forEach((x) => n.delete(x)); return n; });
      setError("Couldn't delete — please try again.");
    }
  };

  const handleBackfill = async (template: RecurringPayment) => {
    setError(null);
    try {
      await backfillTemplate(uid, template);
    } catch (e) {
      setError("Couldn't create the template — please try again.");
    }
  };

  return (
    <RecurringView
      templates={templates}
      instances={instances}
      orphanedIds={orphanedIds}
      initialDetailId={initialDetailId}
      loading={loading}
      error={error}
      onCreate={async (data) => {
        await createRecurringPayment(uid, data);
      }}
      onEdit={(id, patch, scope) => editTemplate(uid, id, patch, scope)}
      onPause={(id, isActive) => pauseTemplate(id, isActive)}
      onDelete={handleDelete}
      onBackfill={handleBackfill}
      onMarkPaid={async (instance, template, record, file) => {
        let proofUrl: string | null = null;
        if (file) {
          try {
            proofUrl = await uploadProof(uid, instance.id, file);
          } catch (e) {
            // Don't record the payment with a missing proof — surface the failure
            // so the user can retry instead of silently dropping their receipt.
            console.error("Proof upload failed:", e);
            throw new Error("Couldn't upload proof — try again.");
          }
        }
        await markInstancePaid(uid, instance, template, { ...record, proofUrl });
      }}
      onBack={onBack}
    />
  );
}
