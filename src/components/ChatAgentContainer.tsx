import { useFinanceData } from "../lib/useFinanceData";
import { useAuth } from "../lib/auth";
import ChatAgent from "./ChatAgent";
import type { ChatState } from "../types";

/** Supplies live Firestore context (tasks, bills, transactions) to the agent. */
export default function ChatAgentContainer({
  uid,
  state,
  setState,
}: {
  uid: string;
  state: ChatState;
  setState: (s: ChatState) => void;
}) {
  const { tasks, bills, transactions } = useFinanceData(uid);
  const { profile } = useAuth();
  return (
    <ChatAgent
      state={state}
      setState={setState}
      uid={uid}
      demoMode={!!profile?.demoMode}
      tasks={tasks}
      bills={bills}
      transactions={transactions}
    />
  );
}
