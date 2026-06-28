import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { AppSettings, DEFAULT_SETTINGS, mergeSettings } from "./settings";

/**
 * Reads `systemSettings/global` (admin-managed) and merges onto DEFAULT_SETTINGS,
 * so the app always has a complete config — feature flags, free-tier limits,
 * maintenance, announcement, and tax slabs — without a code change to update them.
 */
export function useSystemSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [source, setSource] = useState<"settings" | "default">("default");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "systemSettings", "global"),
      (snap) => {
        if (snap.exists()) {
          setSettings(mergeSettings(snap.data()));
          setSource("settings");
        } else {
          setSettings(DEFAULT_SETTINGS);
          setSource("default");
        }
        setLoading(false);
      },
      (err) => {
        console.error("systemSettings read failed:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  return { settings, taxConfig: settings.taxConfig, source, loading };
}
