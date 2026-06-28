import { useEffect, useRef } from "react";
import { useUserCollection } from "../lib/useUserCollection";
import { ymd } from "../lib/dashboard";
import {
  createFd, editFd, markMatured, markRenewed, closeFd, setFdTaxTracking, syncFdEvents,
} from "../lib/fdMutations";
import FixedDepositsView from "./FixedDepositsView";
import type { FdIncomeEntry, FixedDeposit } from "../types";

export default function FixedDepositsScreen({ uid, onBack }: { uid: string; onBack: () => void }) {
  const { items: fds, loading: loadingFds } = useUserCollection<FixedDeposit>("fixedDeposits", uid);
  const { items: schedule, loading: loadingSched } = useUserCollection<FdIncomeEntry>("fdIncomeSchedule", uid);
  const today = ymd(new Date());
  const loading = loadingFds || loadingSched;

  // On-load automation: book due payouts as income + auto-mature past-maturity FDs.
  // Idempotent (guarded by status), and only fired when there's actual work to do.
  const syncing = useRef(false);
  useEffect(() => {
    if (loading || syncing.current) return;
    const hasDuePayout = schedule.some((s) => s.status === "upcoming" && s.date <= today);
    const hasMatured = fds.some((f) => f.status === "active" && f.maturityDate < today);
    if (!hasDuePayout && !hasMatured) return;
    syncing.current = true;
    syncFdEvents(uid, fds, schedule, today).finally(() => { syncing.current = false; });
  }, [uid, loading, fds, schedule, today]);

  const initialDetailId =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("open") || undefined : undefined;

  return (
    <FixedDepositsView
      fds={fds}
      schedule={schedule}
      today={today}
      loading={loading}
      initialDetailId={initialDetailId}
      onCreate={async (data) => { await createFd(uid, data); }}
      onEdit={(fd, patch) => editFd(uid, fd, patch)}
      onMarkMatured={(fd) => markMatured(uid, fd)}
      onMarkRenewed={async (fd) => { await markRenewed(uid, fd); }}
      onClose={(fd) => closeFd(fd)}
      onSetTax={(fd, patch) => setFdTaxTracking(fd, patch)}
      onBack={onBack}
    />
  );
}
