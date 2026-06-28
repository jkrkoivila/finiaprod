import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Live, per-user view of a single collection. Default is an EMPTY array —
 * never seeded with mock data. Scoped by `userId == uid`.
 */
export function useUserCollection<T>(name: string, uid: string | undefined) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, name), where("userId", "==", uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as T[]);
        setLoading(false);
      },
      (err) => {
        console.error(`Snapshot error for ${name}:`, err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [name, uid]);

  return { items, loading };
}
