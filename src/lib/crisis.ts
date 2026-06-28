import { addDays } from "./dashboard";
import type { Task } from "../types";

export type Bucket = "do_now" | "defer" | "drop";

export interface Classification {
  bucket: Bucket;
  reason: string;
}
export interface Triage {
  reasoning: string;
  classifications: Record<string, Classification>;
}

export const CRISIS_THRESHOLD = 3;

/**
 * Tasks whose deadline lands within the next ~48 hours (today + tomorrow) or
 * are already overdue — i.e. the cluster a crisis is built from.
 */
export function clusteredDeadlines(tasks: Task[], today: string): Task[] {
  const limit = addDays(today, 1); // today + tomorrow
  return tasks
    .filter((t) => !t.completed && t.dueDate <= limit)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
}

export function isCrisis(tasks: Task[], today: string): boolean {
  return clusteredDeadlines(tasks, today).length >= CRISIS_THRESHOLD;
}

/** Minutes saved per resolution action, for the "est. time saved" footer. */
export const ACTION_MINUTES: Record<string, number> = {
  block: 15,
  defer: 25,
  drop: 40,
  keep: 0,
};
