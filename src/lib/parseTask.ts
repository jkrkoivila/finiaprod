import type { NewTask } from "./taskMutations";

/**
 * Send a natural-language task to the server, which parses it with Gemini
 * (server-side; key never reaches the client) and returns structured fields.
 * The server falls back to a heuristic parse when no Gemini key is configured.
 */
export async function parseTask(query: string, today: string): Promise<NewTask> {
  const res = await fetch("/api/parse-task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, today }),
  });
  if (!res.ok) throw new Error("Could not parse that — try rephrasing.");
  const d = await res.json();
  return {
    title: d.title || query,
    dueDate: d.dueDate || today,
    dueTime: d.dueTime || undefined,
    priority: d.priority || "medium",
    category: d.category || "general",
  };
}
