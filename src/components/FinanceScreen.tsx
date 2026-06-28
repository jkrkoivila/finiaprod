import { useEffect, useRef } from "react";
import { useFinanceData } from "../lib/useFinanceData";
import {
  addTransaction, addSubscription, toggleSubscriptionActive, deleteSubscription, cancelSubscription,
  addReceivable, toggleReminded, deleteReceivable, refreshUnusedSubscriptions,
} from "../lib/financeMutations";
import { ymd } from "../lib/dashboard";
import FinanceView from "./FinanceView";

export default function FinanceScreen({ uid, onOpenRecurring, onOpenFDs }: { uid: string; onOpenRecurring: () => void; onOpenFDs: () => void }) {
  const { transactions, subscriptions, receivables, paymentInstances, loading } = useFinanceData(uid);
  const today = ymd(new Date());

  // Recompute "unused subscription" flags from the last 60 days of transactions.
  const refreshed = useRef(false);
  useEffect(() => {
    if (loading || refreshed.current || subscriptions.length === 0) return;
    refreshed.current = true;
    refreshUnusedSubscriptions(uid, subscriptions, transactions, today).catch(() => {});
  }, [uid, loading, subscriptions, transactions, today]);
  return (
    <FinanceView
      onOpenRecurring={onOpenRecurring}
      onOpenFDs={onOpenFDs}
      paymentInstances={paymentInstances}
      transactions={transactions}
      subscriptions={subscriptions}
      receivables={receivables}
      onAddTransaction={(t) => addTransaction(uid, t)}
      onAddSubscription={(s) => addSubscription(uid, s)}
      onToggleSub={(id, active) => toggleSubscriptionActive(id, active)}
      onDeleteSub={(id) => deleteSubscription(id)}
      onCancelSub={(sub) => cancelSubscription(uid, sub, today)}
      onAddReceivable={(r) => addReceivable(uid, r)}
      onToggleReminded={(id, reminded) => toggleReminded(id, reminded)}
      onDeleteReceivable={(id) => deleteReceivable(id)}
    />
  );
}
