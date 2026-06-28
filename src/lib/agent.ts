import { addTask } from "./taskMutations";
import { functionCallToTaskPayload, type AgentSummary, type FnCall } from "./agentCore";
import { blockFocusEvent } from "./focusBlock";

export type { FnCall } from "./agentCore";

/**
 * Execute a function call. Writes (create_task / block_calendar_time /
 * set_reminder) go to Firestore via the authed `addTask` mutation — the same
 * path the Tasks view uses, so they persist and survive a refresh.
 * block_calendar_time ALSO creates a real Google Calendar event (best-effort).
 * get_financial_summary is read-only and returns the computed summary.
 */
export async function executeFunctionCall(
  uid: string,
  call: FnCall,
  summary: AgentSummary
): Promise<Record<string, any>> {
  const payload = functionCallToTaskPayload(call);
  if (payload) {
    await addTask(uid, payload); // local task (always)
    if (call.name === "create_task") return { created: true, title: payload.title, dueDate: payload.dueDate };
    if (call.name === "block_calendar_time") {
      // Also push a real Google Calendar event so it fires a phone reminder.
      const calendarEvent = await blockFocusEvent(uid, call.args.taskTitle, call.args.date, call.args.startTime).catch(() => false);
      return { blocked: true, calendarEvent, taskTitle: call.args.taskTitle, date: call.args.date, startTime: call.args.startTime, endTime: call.args.endTime };
    }
    if (call.name === "set_reminder") return { reminderSet: true, taskTitle: call.args.taskTitle, remindAt: call.args.remindAt };
  }
  if (call.name === "get_financial_summary") return { ...summary };
  return { ok: true };
}

interface StreamHandlers {
  onToken: (text: string) => void;
  onFunctionCall: (call: FnCall) => void;
}

/** POST to an SSE chat endpoint and parse the stream token-by-token. */
export async function streamChat(
  body: { contents: any[]; context: unknown },
  { onToken, onFunctionCall }: StreamHandlers,
  url = "/api/chat"
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error(`Chat request failed (${res.status})`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() || "";
    for (const frame of frames) {
      const m = frame.match(/^data: ([\s\S]*)$/);
      if (!m) continue;
      const payload = m[1];
      if (payload === '"[DONE]"' || payload === "[DONE]") return;
      let evt: any;
      try {
        evt = JSON.parse(payload);
      } catch {
        continue;
      }
      if (evt === "[DONE]") return;
      if (evt.error) throw new Error(evt.error);
      if (evt.text) onToken(evt.text);
      if (evt.functionCall) onFunctionCall(evt.functionCall);
    }
  }
}
