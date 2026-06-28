import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";
import type { Bill, FixedDeposit, Receivable, Subscription, Task, Transaction } from "../types";
import type { PaymentInstance } from "./recurring";

export interface FinanceData {
  tasks: Task[];
  bills: Bill[];
  transactions: Transaction[];
  subscriptions: Subscription[];
  receivables: Receivable[];
  paymentInstances: PaymentInstance[];
  fixedDeposits: FixedDeposit[];
  loading: boolean;
}

const COLLECTIONS = ["tasks", "bills", "transactions", "subscriptions", "receivables", "paymentInstances", "fixedDeposits"] as const;
type CollName = (typeof COLLECTIONS)[number];

/**
 * Live, per-user view of every collection the dashboard needs.
 * Defaults are EMPTY arrays — never seeded with mock data. Each collection is
 * scoped by `userId == uid` and kept in sync with onSnapshot. `loading` stays
 * true until every collection has delivered its first snapshot.
 */
export function useFinanceData(uid: string | undefined): FinanceData {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [paymentInstances, setPaymentInstances] = useState<PaymentInstance[]>([]);
  const [fixedDeposits, setFixedDeposits] = useState<FixedDeposit[]>([]);
  const [loaded, setLoaded] = useState<Record<CollName, boolean>>({
    tasks: false, bills: false, transactions: false, subscriptions: false, receivables: false, paymentInstances: false, fixedDeposits: false,
  });

  useEffect(() => {
    if (!uid) return;

    const setters: Record<CollName, (rows: any[]) => void> = {
      tasks: setTasks as (r: any[]) => void,
      bills: setBills as (r: any[]) => void,
      transactions: setTransactions as (r: any[]) => void,
      subscriptions: setSubscriptions as (r: any[]) => void,
      receivables: setReceivables as (r: any[]) => void,
      paymentInstances: setPaymentInstances as (r: any[]) => void,
      fixedDeposits: setFixedDeposits as (r: any[]) => void,
    };

    const markLoaded = (name: CollName) =>
      setLoaded((prev) => (prev[name] ? prev : { ...prev, [name]: true }));

    const unsubs = COLLECTIONS.map((name) => {
      const q = query(collection(db, name), where("userId", "==", uid));
      return onSnapshot(
        q,
        (snap) => {
          setters[name](snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          markLoaded(name);
        },
        (err) => {
          console.error(`Snapshot error for ${name}:`, err);
          markLoaded(name); // don't hang the UI on a permission/network error
        }
      );
    });

    return () => unsubs.forEach((u) => u());
  }, [uid]);

  const loading = !COLLECTIONS.every((c) => loaded[c]);
  return { tasks, bills, transactions, subscriptions, receivables, paymentInstances, fixedDeposits, loading };
}
