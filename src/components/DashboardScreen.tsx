import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useFinanceData } from "../lib/useFinanceData";
import DashboardView from "./DashboardView";
import type { ActiveView } from "../types";

/**
 * Container: binds the live Firestore data to the presentational dashboard and
 * writes task completion back to Firestore. No data is held in component state.
 */
export default function DashboardScreen({
  uid,
  onNavigate,
  onOpenCrisis,
  onOpenDue,
}: {
  uid: string;
  onNavigate: (view: ActiveView) => void;
  onOpenCrisis?: () => void;
  onOpenDue?: () => void;
}) {
  const data = useFinanceData(uid);

  const onToggleTask = (id: string, completed: boolean) => {
    updateDoc(doc(db, "tasks", id), { completed: !completed }).catch((err) =>
      console.error("Failed to toggle task:", err)
    );
  };

  return (
    <DashboardView data={data} onToggleTask={onToggleTask} onNavigate={onNavigate} onOpenCrisis={onOpenCrisis} onOpenDue={onOpenDue} />
  );
}
