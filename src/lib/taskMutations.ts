import { addDoc, collection, deleteDoc, deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { Task } from "../types";

export interface NewTask {
  title: string;
  dueDate: string;
  dueTime?: string;
  category: Task["category"];
  priority: Task["priority"];
}

export async function addTask(uid: string, data: NewTask): Promise<void> {
  await addDoc(collection(db, "tasks"), {
    userId: uid,
    title: data.title,
    dueDate: data.dueDate,
    ...(data.dueTime ? { dueTime: data.dueTime } : {}),
    category: data.category,
    priority: data.priority,
    completed: false,
    createdAt: serverTimestamp(),
  });
}

/**
 * Create a task with a DETERMINISTIC id (e.g. "advance_tax_Q1_FY2025-26"), only if
 * it doesn't already exist — so re-running a pre-loader/extractor never duplicates
 * it, and a user-completed copy is never resurrected.
 */
export async function upsertTask(uid: string, id: string, data: NewTask): Promise<void> {
  const ref = doc(db, "tasks", id);
  if ((await getDoc(ref)).exists()) return; // already created — leave it (and its completed state) alone
  await setDoc(ref, {
    userId: uid,
    title: data.title,
    dueDate: data.dueDate,
    ...(data.dueTime ? { dueTime: data.dueTime } : {}),
    category: data.category,
    priority: data.priority,
    completed: false,
    createdAt: serverTimestamp(),
  });
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<void> {
  // Firestore rejects `undefined` values, so strip them. An optional field that
  // was cleared (e.g. dueTime) is removed with deleteField() instead.
  const clean: Record<string, unknown> = { isManuallyEdited: true };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) {
      if (k === "dueTime") clean[k] = deleteField();
    } else {
      clean[k] = v;
    }
  }
  await updateDoc(doc(db, "tasks", id), clean);
}

export async function toggleTask(id: string, completed: boolean): Promise<void> {
  await updateDoc(doc(db, "tasks", id), { completed: !completed });
}

export async function deleteTask(id: string): Promise<void> {
  await deleteDoc(doc(db, "tasks", id));
}
