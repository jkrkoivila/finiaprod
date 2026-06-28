import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Minus, X, ChevronUp, Bot, Sparkles, AlertCircle } from "lucide-react";
import { ChatMessage, Task, Bill, FinanceEntry } from "../types";

interface ChatAgentProps {
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  tasks: Task[];
  bills: Bill[];
  financeEntries: FinanceEntry[];
  taxProfile: { grossIncome: number; deduction80C: number; deduction80D: number };
  onAddTask: (task: Omit<Task, "id" | "completed">) => Promise<void>;
  initialQuery: string | null;
  clearInitialQuery: () => void;
}

export default function ChatAgent({
  chatOpen,
  setChatOpen,
  tasks,
  bills,
  financeEntries,
  taxProfile,
  onAddTask,
  initialQuery,
  clearInitialQuery,
}: ChatAgentProps) {
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "init-1",
      sender: "agent",
      text: "hello! i am finia, your ai life assistant. i can help you compute taxes under the new vs old regimes, track your hdfc sips, check bills, or answer questions. what is on your mind?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, minimized, chatOpen]);

  // Hook for initialQuery triggered from Dashboard
  useEffect(() => {
    if (chatOpen && initialQuery) {
      handleSend(initialQuery);
      clearInitialQuery();
    }
  }, [chatOpen, initialQuery]);

  const handleSend = async (textToSend: string, isSystemMessage = false) => {
    if (!textToSend.trim()) return;

    // Only append user message to UI if it is not an internal system query
    if (!isSystemMessage) {
      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        sender: "user",
        text: textToSend.toLowerCase(),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, userMsg]);
    }

    setInput("");
    setLoading(true);

    try {
      // Collect message history formatted for Gemini on server
      const historyToSend = messages.map(msg => ({
        sender: msg.sender,
        text: msg.text
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          history: historyToSend.slice(-15), // Last 15 messages for multi-turn context
          context: {
            tasks,
            bills,
            transactions: financeEntries,
            taxProfile
          }
        }),
      });

      if (!response.body) {
        throw new Error("No response body stream found.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const agentMsgId = `msg-${Date.now()}-agent`;
      // Create empty placeholder message in UI to stream text into
      setMessages((prev) => [
        ...prev,
        {
          id: agentMsgId,
          sender: "agent",
          text: "",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }
      ]);

      let accumulatedText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") continue;

            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                throw new Error(data.error);
              }
              if (data.functionCall) {
                // Execute function calling locally
                await handleFunctionCall(data.functionCall, agentMsgId);
                return; // Stop SSE processing
              }
              if (data.text) {
                accumulatedText += data.text;
                setMessages((prev) =>
                  prev.map((m) => (m.id === agentMsgId ? { ...m, text: accumulatedText.toLowerCase() } : m))
                );
              }
            } catch (err) {
              console.error("SSE line parsing error: ", err);
            }
          }
        }
      }

    } catch (e: any) {
      console.error(e);
      const agentMsg: ChatMessage = {
        id: `msg-${Date.now()}-agent`,
        text: `sorry, i had a technical issue: ${e.message || "check your network connectivity or gemini api key setup."}`,
        sender: "agent",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, agentMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleFunctionCall = async (fn: { name: string; args: any }, agentMsgId: string) => {
    try {
      let confirmationText = "";
      if (fn.name === "create_task") {
        const { title, dueDate, priority, category } = fn.args;
        await onAddTask({
          title,
          dueDate,
          priority: priority as "high" | "medium" | "low",
          category: category as "tax" | "finance" | "personal" | "general"
        });
        confirmationText = `✅ i've successfully created the task: "${title}" due on ${dueDate} with ${priority} priority in the ${category} category!`;
      } else if (fn.name === "block_calendar_time") {
        const { taskTitle, date, startTime, endTime } = fn.args;
        await onAddTask({
          title: `[blocked] ${taskTitle} (${startTime} - ${endTime})`,
          dueDate: date,
          priority: "medium",
          category: "personal"
        });
        confirmationText = `📅 focus time blocked: "${taskTitle}" is scheduled on ${date} from ${startTime} to ${endTime}!`;
      } else if (fn.name === "set_reminder") {
        const { taskTitle, remindAt } = fn.args;
        const datePart = remindAt.split(" ")[0] || "2026-06-25";
        await onAddTask({
          title: `[reminder] ${taskTitle} at ${remindAt}`,
          dueDate: datePart,
          priority: "high",
          category: "personal"
        });
        confirmationText = `⏰ reminder set: i will alert you for "${taskTitle}" scheduled at ${remindAt}!`;
      } else if (fn.name === "get_financial_summary") {
        // Calculate financial summary from live context
        const totalIncome = financeEntries.filter(e => e.type === "income").reduce((sum, e) => sum + e.amount, 0);
        const totalExpenses = financeEntries.filter(e => e.type === "expense").reduce((sum, e) => sum + e.amount, 0);
        const netSavings = totalIncome - totalExpenses;
        const unpaidBills = bills.filter(b => !b.paid).reduce((sum, b) => sum + b.amount, 0);

        // Remove placeholder
        setMessages((prev) => prev.filter(m => m.id !== agentMsgId));
        
        // Push calculated summary to model as a hidden prompt so it explains it beautifully to the user
        const systemPrompt = `[System Context: Financial Summary is: Total Income: ₹${totalIncome.toLocaleString("en-IN")}, Total Expenses: ₹${totalExpenses.toLocaleString("en-IN")}, Net Savings: ₹${netSavings.toLocaleString("en-IN")}, Unpaid Bills: ₹${unpaidBills.toLocaleString("en-IN")}. Explain this concisely using ₹ and suggest any actions.]`;
        
        await handleSend(systemPrompt, true);
        return;
      }

      if (confirmationText) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentMsgId
              ? {
                  ...m,
                  text: confirmationText.toLowerCase(),
                }
              : m
          )
        );
      }
    } catch (err: any) {
      console.error("Failed to run function calling: ", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentMsgId
            ? {
                ...m,
                text: `error executing function ${fn.name}: ${err.message}`,
              }
            : m
        )
      );
    }
  };

  const handleSuggestion = (txt: string) => {
    handleSend(txt);
  };

  const suggestions = [
    "what are the new tax slabs?",
    "explain section 80c deductions",
    "when is the itr-1 deadline?",
  ];

  // Completely closed state
  if (!chatOpen) {
    return (
      <button
        onClick={() => {
          setChatOpen(true);
          setMinimized(false);
        }}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#1B3A6B] text-white flex items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-105 hover:bg-[#1B3A6B]/90 focus:outline-none z-50 shadow-lg"
        title="Chat with Finia"
        style={{ bottom: "1.5rem" }}
      >
        {/* Pulse Logo inside FAB */}
        <div className="w-9 h-9 flex items-center justify-center overflow-hidden">
          <svg viewBox="0 0 512 512" className="w-8 h-8 fill-none stroke-white">
            <path d="M 80 256 L 180 256 L 200 290 L 230 110 L 260 410 L 290 290 L 310 256 L 432 256" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="230" cy="110" r="32" fill="white" stroke="none" />
          </svg>
        </div>
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-20 md:bottom-6 right-6 bg-white border-[0.5px] border-slate-200 rounded-lg flex flex-col z-50 transition-all duration-300 ${
        minimized ? "h-14 w-80" : "h-[450px] w-96 max-w-[calc(100vw-2rem)]"
      }`}
      style={{ boxShadow: "0 10px 25px -5px rgba(27, 58, 107, 0.1)" }}
    >
      {/* Chat Header */}
      <div className="bg-[#1B3A6B] text-white px-4 py-3 rounded-t-lg flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center space-x-2">
          {/* Embedding logo inside chat title */}
          <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center overflow-hidden shrink-0 border-[0.5px] border-white/20">
            <svg viewBox="0 0 512 512" className="w-4 h-4 fill-none stroke-white">
              <path d="M 80 256 L 180 256 L 200 290 L 230 110 L 260 410 L 290 290 L 310 256 L 432 256" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="230" cy="110" r="34" fill="white" stroke="none" />
            </svg>
          </div>
          <div>
            <h4 className="text-xs font-medium capitalize">finia assistant</h4>
            {!minimized && <span className="text-[9px] text-[#2BA8E0] block font-mono">online</span>}
          </div>
        </div>

        <div className="flex items-center space-x-1.5 text-slate-300">
          <button
            onClick={() => setMinimized(!minimized)}
            className="p-1 hover:bg-white/10 rounded text-slate-300 hover:text-white transition-colors focus:outline-none"
            title={minimized ? "Restore window" : "Minimize window"}
          >
            {minimized ? <ChevronUp className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setChatOpen(false)}
            className="p-1 hover:bg-white/10 rounded text-slate-300 hover:text-white transition-colors focus:outline-none"
            title="Close assistant"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded body */}
      {!minimized && (
        <>
          {/* Scrollable messages log */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin bg-slate-50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 text-xs rounded-lg border-[0.5px] leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-[#2563EB]/10 text-slate-800 border-[#2563EB]/20 rounded-tr-none"
                      : "bg-white text-slate-700 border-slate-200 rounded-tl-none"
                  }`}
                >
                  <p className="whitespace-pre-line lowercase">{msg.text}</p>
                  <span className="text-[8px] text-slate-400 block text-right mt-1 font-mono">
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {/* Typing status indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border-[0.5px] border-slate-200 text-slate-500 rounded-lg rounded-tl-none px-3 py-2 text-xs flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
          </div>

          {/* Suggested chips panel */}
          {messages.length === 1 && !loading && (
            <div className="px-4 py-2 bg-slate-50 border-t-[0.5px] border-slate-100 flex flex-wrap gap-1.5 shrink-0">
              {suggestions.map((sug) => (
                <button
                  key={sug}
                  onClick={() => handleSuggestion(sug)}
                  className="px-2.5 py-1 text-[10px] bg-white border-[0.5px] border-slate-200 text-slate-600 rounded-full hover:border-slate-300 transition-colors text-left focus:outline-none cursor-pointer"
                >
                  {sug}
                </button>
              ))}
            </div>
          )}

          {/* Form input controls */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="p-3 border-t-[0.5px] border-slate-200 flex items-center space-x-2 bg-white rounded-b-lg shrink-0"
          >
            <input
              type="text"
              placeholder="ask me anything in sentence case..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="flex-1 px-3 py-2 text-xs bg-slate-50 border-[0.5px] border-slate-200 rounded-md focus:outline-none focus:border-[#1B3A6B] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2 bg-[#1B3A6B] text-white rounded-md hover:bg-slate-800 disabled:opacity-40 transition-all focus:outline-none cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
