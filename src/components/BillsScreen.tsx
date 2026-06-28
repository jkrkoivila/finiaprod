import { useFinanceData } from "../lib/useFinanceData";
import { addOrUpdateBill, deleteBill, setBillPaid } from "../lib/billMutations";
import { addTask } from "../lib/taskMutations";
import { commitDocument } from "../lib/documents";
import { ymd } from "../lib/dashboard";
import BillsView from "./BillsView";
import type { Bill } from "../types";

/** Container: live Firestore bills + transactions, dedupe-aware writes. */
export default function BillsScreen({ uid }: { uid: string }) {
  const { bills, transactions, loading } = useFinanceData(uid);
  const today = ymd(new Date());

  const saveToLibrary = (bill: Bill) => {
    if (bill.category === "credit-card") {
      return commitDocument(uid, {
        type: "credit-card-bill",
        source: "upload",
        fileName: `${bill.payee} statement`,
        extracted: { issuer: bill.payee, last4: bill.last4, statementMonth: bill.statementMonth || bill.dueDate.slice(0, 7), totalDue: bill.amount, dueDate: bill.dueDate, minimumDue: bill.minimumDue },
      });
    }
    return commitDocument(uid, {
      type: "utility-bill",
      source: "upload",
      fileName: `${bill.payee} bill`,
      extracted: { provider: bill.payee, amount: bill.amount, dueDate: bill.dueDate },
    });
  };

  return (
    <BillsView
      bills={bills}
      transactions={transactions}
      loading={loading}
      today={today}
      onAddOrUpdate={async (data) => {
        await addOrUpdateBill(uid, data);
      }}
      onSetPaid={(id, paid) => setBillPaid(id, paid)}
      onDelete={(id) => deleteBill(id)}
      onCreatePaymentTask={(bill) => addTask(uid, { title: `Pay ${bill.payee} bill`, dueDate: bill.dueDate, category: "finance", priority: "high" })}
      onSetReminder={(bill) => addTask(uid, { title: `Reminder: pay ${bill.payee}`, dueDate: bill.dueDate, category: "finance", priority: "medium" })}
      onSaveToLibrary={(bill) => saveToLibrary(bill).then(() => undefined)}
    />
  );
}
