import { useEffect, useRef, useState } from "react";
import { useSystemSettings } from "../lib/useSystemSettings";
import { useTaxProfile, saveTaxProfile, type TwoYearProfile } from "../lib/taxProfile";
import { useUserCollection } from "../lib/useUserCollection";
import { upsertTask } from "../lib/taskMutations";
import { ymd } from "../lib/dashboard";
import { computeFd } from "../lib/fd";
import TaxView from "./TaxView";
import Logo from "./Logo";
import type { FixedDeposit } from "../types";

export default function TaxScreen({ uid }: { uid: string }) {
  const { settings, source } = useSystemSettings();
  const loaded = useTaxProfile(uid);
  const { items: fds } = useUserCollection<FixedDeposit>("fixedDeposits", uid);

  // FD interest the user opted to track → Income from Other Sources; opted TDS → advance tax paid.
  const fdToday = ymd(new Date());
  const fdOtherIncome = fds
    .filter((f) => f.taxTracked && f.status !== "closed")
    .reduce((s, f) => s + computeFd(f, fdToday).annualInterest, 0);
  const fdTaxesPaid = fds
    .filter((f) => f.tdsTracked && f.status !== "closed")
    .reduce((s, f) => s + computeFd(f, fdToday).projectedTds, 0);

  const [profile, setProfile] = useState<TwoYearProfile | null>(null);
  const initialised = useRef(false);
  const saveTimer = useRef<number | undefined>(undefined);
  const [calendarAdded, setCalendarAdded] = useState(false);

  useEffect(() => {
    if (loaded && !initialised.current) {
      initialised.current = true;
      setProfile(loaded);
    }
  }, [loaded]);

  const onChange = (next: TwoYearProfile) => {
    setProfile(next);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveTaxProfile(uid, next).catch((e) => console.error("save tax profile:", e)), 800);
  };

  const onAddCalendarTasks = async () => {
    const cfg = settings.taxConfig;
    const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    const fy = slug(cfg.fyLabel || cfg.ayLabel);
    // Deterministic ids → calling the pre-loader twice never creates a second copy.
    const toAdd = [
      ...cfg.advanceTaxSchedule.map((s) => ({ id: `${uid}_advtax_${slug(s.label)}_${fy}`, title: `Advance tax: ${s.label} (${s.cumulativePct}%)`, dueDate: s.dueDate })),
      { id: `${uid}_itr_${slug(cfg.ayLabel)}`, title: `File ITR-1 (${cfg.ayLabel})`, dueDate: cfg.itrDeadline },
    ];
    try {
      for (const t of toAdd) await upsertTask(uid, t.id, { title: t.title, dueDate: t.dueDate, category: "tax", priority: "high" });
      setCalendarAdded(true);
    } catch (e) {
      console.error("add calendar tasks:", e);
    }
  };

  if (!profile) {
    return <div className="p-6 flex items-center gap-3 text-slate-400"><Logo size={28} /><span className="w-4 h-4 border-2 border-slate-300 border-t-navy rounded-full animate-spin" /></div>;
  }

  return (
    <TaxView
      configCurrent={settings.taxConfig}
      configPrev={settings.taxConfigPrev}
      configSource={source}
      profile={profile}
      otherIncome={fdOtherIncome}
      taxesPaid={fdTaxesPaid}
      onChange={onChange}
      onAddCalendarTasks={onAddCalendarTasks}
      calendarAdded={calendarAdded}
    />
  );
}
