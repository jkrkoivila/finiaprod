import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { Triage } from "./crisis";
import type { Task } from "../types";

// Cache key = the cluster's composition. If any task leaves/joins the cluster
// (status change → different membership), the id changes → cache miss → recompute.
function hashIds(taskIds: string[]): string {
  const s = [...taskIds].sort().join("|");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
export function crisisIdFor(uid: string, taskIds: string[]): string {
  return `${uid}_${hashIds(taskIds)}`;
}

/** Cached triage for this exact cluster, or null. Avoids re-calling Gemini on re-open. */
export async function getCachedTriage(crisisId: string): Promise<Triage | null> {
  const snap = await getDoc(doc(db, "crisisTriage", crisisId));
  return snap.exists() ? ((snap.data() as any).triage as Triage) : null;
}
export async function saveTriage(uid: string, crisisId: string, triage: Triage): Promise<void> {
  await setDoc(doc(db, "crisisTriage", crisisId), { userId: uid, triage, createdAt: serverTimestamp() });
}

/** Ask the server (Gemini function calling, with heuristic fallback) to triage the cluster. */
export async function fetchTriage(tasks: Task[], today: string): Promise<Triage> {
  const res = await fetch("/api/crisis-triage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      today,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate,
        dueTime: t.dueTime,
        priority: t.priority,
        category: t.category,
      })),
    }),
  });
  if (!res.ok) throw new Error("Triage request failed.");
  return res.json();
}
