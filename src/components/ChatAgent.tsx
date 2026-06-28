import { Fragment, useMemo, useRef, useState, type FormEvent } from "react";
import { Minus, X, Send } from "lucide-react";
import Logo from "./Logo";
import { executeFunctionCall, streamChat, type FnCall } from "../lib/agent";
import { buildAgentContext, buildProactiveMessage, PROACTIVE_CHIPS } from "../lib/agentCore";
import { ymd } from "../lib/dashboard";
import type { Bill, ChatState, Task, Transaction } from "../types";

interface ChatAgentProps {
  state: ChatState;
  setState: (state: ChatState) => void;
  uid?: string;
  demoMode?: boolean;
  tasks: Task[];
  bills: Bill[];
  transactions: Transaction[];
  today?: string;
}

// Function calls that WRITE to Firestore (blocked in demo mode). Reads (get_financial_summary) run.
const WRITE_FUNCTIONS = new Set(["create_task", "block_calendar_time", "set_reminder"]);

interface Msg {
  id: number;
  sender: "user" | "agent";
  text: string;
  streaming?: boolean;
}

export default function ChatAgent({ state, setState, uid, demoMode, tasks, bills, transactions, today }: ChatAgentProps) {
  const t = today ?? ymd(new Date());
  const context = useMemo(() => buildAgentContext(tasks, bills, transactions, t), [tasks, bills, transactions, t]);
  const proactive = useMemo(() => buildProactiveMessage(tasks, bills, t), [tasks, bills, t]);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const contentsRef = useRef<any[]>([]);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const nextId = () => ++idRef.current;
  const update = (id: number, fn: (prev: string) => string) =>
    setMessages((m) => m.map((x) => (x.id === id ? { ...x, text: fn(x.text) } : x)));
  const setStreaming = (id: number, streaming: boolean) =>
    setMessages((m) => m.map((x) => (x.id === id ? { ...x, streaming } : x)));
  const scroll = () =>
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));

  async function runTurn(agentId: number) {
    let fnCall: FnCall | null = null;
    await streamChat(
      { contents: contentsRef.current, context },
      {
        onToken: (tok) => {
          update(agentId, (p) => p + tok);
          scroll();
        },
        onFunctionCall: (fc) => {
          fnCall = fc;
        },
      }
    );

    if (fnCall) {
      const call = fnCall as FnCall;
      contentsRef.current.push({ role: "model", parts: [{ functionCall: call }] });
      let response: Record<string, any>;
      if (demoMode && WRITE_FUNCTIONS.has(call.name)) {
        // Demo mode: reads still run, but writes are blocked with a clear message.
        response = { error: "You're in Demo Mode — I can see your data but can't make changes. Turn off Demo Mode in Settings to enable this." };
      } else {
        try {
          response = uid
            ? await executeFunctionCall(uid, call, context.summary)
            : { error: "Sign in to let me make changes." };
        } catch (err) {
          response = { error: (err as Error).message };
        }
      }
      contentsRef.current.push({ role: "user", parts: [{ functionResponse: { name: call.name, response } }] });
      // Stream the model's natural confirmation into the same bubble.
      await streamChat(
        { contents: contentsRef.current, context },
        { onToken: (tok) => { update(agentId, (p) => p + tok); scroll(); }, onFunctionCall: () => {} }
      );
    }
  }

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy) return;
    setInput("");
    const userId = nextId();
    const agentId = nextId();
    setMessages((m) => [...m, { id: userId, sender: "user", text: msg }, { id: agentId, sender: "agent", text: "", streaming: true }]);
    contentsRef.current.push({ role: "user", parts: [{ text: msg }] });
    setBusy(true);
    scroll();
    try {
      await runTurn(agentId);
    } catch (err) {
      update(agentId, () => `Sorry — ${(err as Error).message}`);
    } finally {
      setStreaming(agentId, false);
      setBusy(false);
      scroll();
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  // Collapsed → FAB
  if (state === "closed") {
    return (
      <button
        onClick={() => setState("open")}
        aria-label="Open Finia assistant"
        className="fixed z-40 right-5 bottom-20 md:bottom-6 w-14 h-14 rounded-full bg-navy border-[0.5px] border-white/10 flex items-center justify-center hover:bg-navy/90 transition-colors"
      >
        <Logo size={32} withSquare={false} />
        <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-pulse border-2 border-navy" />
      </button>
    );
  }

  const minimised = state === "minimised";

  return (
    <div
      className={`fixed z-40 right-5 bottom-20 md:bottom-6 w-[min(380px,calc(100vw-2.5rem))] bg-white rounded-xl border-[0.5px] border-black/10 overflow-hidden flex flex-col ${
        minimised ? "" : "h-[520px] max-h-[calc(100vh-7rem)]"
      }`}
    >
      {/* Header */}
      <div
        className="bg-navy text-white px-3 h-12 flex items-center justify-between shrink-0"
        onClick={() => minimised && setState("open")}
        style={{ cursor: minimised ? "pointer" : "default" }}
      >
        <div className="flex items-center gap-2">
          <Logo size={26} withSquare={false} />
          <div className="leading-none">
            <div className="text-[13px] font-medium">Finia</div>
            <div className="text-[10px] text-white/55 mt-0.5">AI life assistant</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setState(minimised ? "open" : "minimised"); }}
            aria-label={minimised ? "Expand" : "Minimise"}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
          >
            <Minus size={15} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setState("closed"); }}
            aria-label="Close"
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {!minimised && (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin bg-surface p-3 space-y-2.5">
            {/* Proactive opener */}
            <Bubble sender="agent" text={proactive} />
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {PROACTIVE_CHIPS.map((c) => (
                  <button
                    key={c}
                    onClick={() => send(c)}
                    className="text-[11px] px-2.5 py-1 rounded-full border-[0.5px] border-navy/20 text-navy bg-white hover:bg-navy/5 transition-colors"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m) => (
              <Fragment key={m.id}>
                {m.sender === "agent" && m.streaming && !m.text ? (
                  <TypingBubble />
                ) : (
                  <Bubble sender={m.sender} text={m.text} />
                )}
              </Fragment>
            ))}
          </div>

          <form onSubmit={onSubmit} className="shrink-0 border-t-[0.5px] border-black/10 p-2.5 flex items-center gap-2 bg-white">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Finia anything…"
              className="flex-1 h-9 px-3 rounded-lg bg-surface border-[0.5px] border-black/10 text-[13px] placeholder:text-slate-400 outline-none focus:border-navy"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="w-9 h-9 rounded-lg bg-navy text-white flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none hover:bg-navy/90 transition-colors"
            >
              <Send size={15} />
            </button>
          </form>
        </>
      )}
    </div>
  );
}

function Bubble({ sender, text }: { sender: "user" | "agent"; text: string }) {
  const isUser = sender === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] px-3 py-2 rounded-xl text-[13px] leading-relaxed whitespace-pre-wrap ${
          isUser ? "bg-navy text-white rounded-br-sm" : "bg-white border-[0.5px] border-black/10 text-slate-700 rounded-bl-sm"
        }`}
      >
        {text}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="px-3 py-2.5 rounded-xl bg-white border-[0.5px] border-black/10 flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
