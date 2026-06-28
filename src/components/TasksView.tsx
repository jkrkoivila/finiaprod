import { Fragment, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Sparkles,
  Plus,
  CheckSquare,
  Square,
  Pencil,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { addDays, urgencyOf, ymd, type Urgency } from "../lib/dashboard";
import type { NewTask } from "../lib/taskMutations";
import type { Task, TaskCategory } from "../types";

interface TasksViewProps {
  tasks: Task[];
  loading: boolean;
  today?: string;
  onAdd: (data: NewTask) => void | Promise<void>;
  onUpdate: (id: string, patch: Partial<Task>) => void | Promise<void>;
  onToggle: (id: string, completed: boolean) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onQuickAdd: (text: string) => Promise<void>;
}

const CATEGORIES: TaskCategory[] = ["tax", "finance", "work", "personal", "general"];
const URGENCY_BORDER: Record<Urgency, string> = {
  urgent: "#E24B4A",
  soon: "#D97706",
  normal: "#2563EB",
  tax: "#6D28D9",
};
const CATEGORY_BADGE: Record<TaskCategory, { bg: string; fg: string }> = {
  tax: { bg: "#6D28D914", fg: "#6D28D9" },
  finance: { bg: "#0F766E14", fg: "#0F766E" },
  work: { bg: "#2563EB14", fg: "#2563EB" },
  personal: { bg: "#47556914", fg: "#475569" },
  general: { bg: "#47556914", fg: "#475569" },
};
const PRIORITY_DOT: Record<Task["priority"], string> = {
  high: "#E24B4A",
  medium: "#D97706",
  low: "#94A3B8",
};
const PRIORITY_WEIGHT: Record<Task["priority"], number> = { high: 0, medium: 1, low: 2 };

type StatusFilter = "all" | "active" | "done";
type SortBy = "due" | "priority";

const emptyForm = (today: string): NewTask => ({
  title: "",
  dueDate: today,
  dueTime: "",
  category: "general",
  priority: "medium",
});

export default function TasksView({
  tasks,
  loading,
  today,
  onAdd,
  onUpdate,
  onToggle,
  onDelete,
  onQuickAdd,
}: TasksViewProps) {
  const t = today ?? ymd(new Date());

  const [quick, setQuick] = useState("");
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickErr, setQuickErr] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NewTask>(emptyForm(t));

  const [status, setStatus] = useState<StatusFilter>("active");
  const [cat, setCat] = useState<TaskCategory | "all">("all");
  const [sortBy, setSortBy] = useState<SortBy>("due");

  const visible = useMemo(() => {
    let list = tasks.slice();
    if (status === "active") list = list.filter((x) => !x.completed);
    if (status === "done") list = list.filter((x) => x.completed);
    if (cat !== "all") list = list.filter((x) => x.category === cat);
    list.sort((a, b) => {
      if (sortBy === "priority" && a.priority !== b.priority) {
        return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
      }
      if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
      return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    });
    return list;
  }, [tasks, status, cat, sortBy]);

  const submitQuick = async (e: FormEvent) => {
    e.preventDefault();
    const text = quick.trim();
    if (!text || quickBusy) return;
    setQuickBusy(true);
    setQuickErr(null);
    try {
      await onQuickAdd(text);
      setQuick("");
    } catch (err) {
      setQuickErr((err as Error).message || "Could not add that task.");
    } finally {
      setQuickBusy(false);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm(t));
    setShowForm(true);
  };
  const openEdit = (task: Task) => {
    setEditingId(task.id);
    setForm({
      title: task.title,
      dueDate: task.dueDate,
      dueTime: task.dueTime ?? "",
      category: task.category,
      priority: task.priority,
    });
    setShowForm(true);
  };
  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.dueDate) return;
    const payload: NewTask = { ...form, title: form.title.trim(), dueTime: form.dueTime || undefined };
    if (editingId) await onUpdate(editingId, payload);
    else await onAdd(payload);
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm(t));
  };

  const activeCount = tasks.filter((x) => !x.completed).length;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-medium text-navy">Tasks</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            {tasks.length === 0
              ? "Type a task in plain English, or add one manually."
              : `${activeCount} open · ${tasks.length} total`}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-navy text-white text-[12px] font-medium hover:bg-navy/90 transition-colors shrink-0"
        >
          <Plus size={15} /> Add manually
        </button>
      </div>

      {/* Natural-language quick-add */}
      <form
        onSubmit={submitQuick}
        className="bg-white rounded-xl border-[0.5px] border-black/10 p-2 flex items-center gap-2"
      >
        <Sparkles size={16} className="text-pulse ml-1.5 shrink-0" />
        <input
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          placeholder="Try: pay HDFC card bill next Friday, high priority"
          className="flex-1 h-9 bg-transparent text-[13px] outline-none placeholder:text-slate-400"
        />
        <button
          type="submit"
          disabled={quickBusy || !quick.trim()}
          className="h-9 px-3.5 rounded-lg bg-pulse text-white text-[12px] font-medium flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none hover:bg-pulse/90 transition-colors shrink-0"
        >
          {quickBusy ? (
            <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          Add
        </button>
      </form>
      {quickErr && <p className="text-[12px] text-crisis -mt-2 px-1">{quickErr}</p>}

      {/* Manual add / edit form */}
      {showForm && (
        <form
          onSubmit={submitForm}
          className="bg-white rounded-xl border-[0.5px] border-black/10 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-medium text-navy">
              {editingId ? "Edit task" : "New task"}
            </h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-slate-400 hover:text-navy"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Task title"
            autoFocus
            className="w-full h-9 px-3 rounded-lg border-[0.5px] border-black/15 text-[13px] outline-none focus:border-navy"
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Field label="Due date">
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full h-9 px-2 rounded-lg border-[0.5px] border-black/15 text-[12px] outline-none focus:border-navy"
              />
            </Field>
            <Field label="Time (optional)">
              <input
                type="time"
                value={form.dueTime}
                onChange={(e) => setForm({ ...form, dueTime: e.target.value })}
                className="w-full h-9 px-2 rounded-lg border-[0.5px] border-black/15 text-[12px] outline-none focus:border-navy"
              />
            </Field>
            <Field label="Category">
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as TaskCategory })}
                className="w-full h-9 px-2 rounded-lg border-[0.5px] border-black/15 text-[12px] outline-none focus:border-navy capitalize"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as Task["priority"] })}
                className="w-full h-9 px-2 rounded-lg border-[0.5px] border-black/15 text-[12px] outline-none focus:border-navy capitalize"
              >
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="h-9 px-3 rounded-lg border-[0.5px] border-black/15 text-[12px] text-slate-600 hover:bg-surface"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!form.title.trim()}
              className="h-9 px-4 rounded-lg bg-navy text-white text-[12px] font-medium disabled:opacity-50 hover:bg-navy/90 transition-colors"
            >
              {editingId ? "Save changes" : "Add task"}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border-[0.5px] border-black/10 bg-white p-0.5">
          {(["active", "all", "done"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`h-7 px-3 rounded-md text-[12px] capitalize transition-colors ${
                status === s ? "bg-navy text-white font-medium" : "text-slate-500 hover:text-navy"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...CATEGORIES] as (TaskCategory | "all")[]).map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`h-7 px-2.5 rounded-full text-[11px] capitalize border-[0.5px] transition-colors ${
                cat === c
                  ? "border-navy bg-navy/5 text-navy font-medium"
                  : "border-black/10 text-slate-500 hover:text-navy"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="ml-auto h-7 px-2 rounded-lg border-[0.5px] border-black/10 bg-white text-[11px] text-slate-600 outline-none"
        >
          <option value="due">Sort: due soon</option>
          <option value="priority">Sort: priority</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-white border-[0.5px] border-black/10" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-8 flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-lg bg-navy/5 flex items-center justify-center">
            <CheckSquare size={18} className="text-navy/50" />
          </div>
          <p className="mt-3 text-[13px] font-medium text-navy">
            {tasks.length === 0 ? "No tasks yet" : "Nothing matches this filter"}
          </p>
          <p className="mt-1 text-[12px] text-slate-500 max-w-xs">
            {tasks.length === 0
              ? "Add one above in plain English, or sync Gmail to import deadlines."
              : "Try a different status or category."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((task) => (
            <Fragment key={task.id}>
              <TaskRow task={task} today={t} onToggle={onToggle} onEdit={openEdit} onDelete={onDelete} />
            </Fragment>
          ))}
        </ul>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function dueLabel(task: Task, today: string): string {
  if (task.dueDate < today) return `Overdue · ${task.dueDate}`;
  if (task.dueDate === today) return task.dueTime ? `Today ${task.dueTime}` : "Today";
  if (task.dueDate === addDays(today, 1)) return task.dueTime ? `Tomorrow ${task.dueTime}` : "Tomorrow";
  return task.dueTime ? `${task.dueDate} ${task.dueTime}` : task.dueDate;
}

function TaskRow({
  task,
  today,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  today: string;
  onToggle: (id: string, completed: boolean) => void | Promise<void>;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void | Promise<void>;
}) {
  const urgency = urgencyOf(task, today);
  const badge = CATEGORY_BADGE[task.category];
  const overdue = task.dueDate < today && !task.completed;

  return (
    <li
      className="group flex items-center gap-3 rounded-lg border-[0.5px] border-black/10 bg-white pl-3 pr-2 py-2.5"
      style={{ borderLeft: `3px solid ${task.completed ? "#CBD5E1" : URGENCY_BORDER[urgency]}` }}
    >
      <button
        onClick={() => onToggle(task.id, task.completed)}
        aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
        className="text-slate-400 hover:text-navy transition-colors shrink-0"
      >
        {task.completed ? <CheckSquare size={18} className="text-finance" /> : <Square size={18} />}
      </button>

      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: PRIORITY_DOT[task.priority] }}
        title={`${task.priority} priority`}
      />

      <div className="min-w-0 flex-1">
        <div
          className={`text-[13px] font-medium truncate ${
            task.completed ? "text-slate-400 line-through" : "text-navy"
          }`}
        >
          {task.title}
        </div>
        <div className={`text-[11px] ${overdue ? "text-crisis" : "text-slate-400"}`}>
          {dueLabel(task, today)}
        </div>
      </div>

      <span
        className="text-[10px] font-medium px-2 py-0.5 rounded-full capitalize shrink-0"
        style={{ background: badge.bg, color: badge.fg }}
      >
        {task.category}
      </span>

      <div className="flex items-center gap-0.5 shrink-0">
        <IconBtn icon={Pencil} label="Edit" onClick={() => onEdit(task)} />
        <IconBtn icon={Trash2} label="Delete" onClick={() => onDelete(task.id)} danger />
      </div>
    </li>
  );
}

function IconBtn({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 transition-colors ${
        danger ? "hover:bg-crisis/10 hover:text-crisis" : "hover:bg-surface hover:text-navy"
      }`}
    >
      <Icon size={15} />
    </button>
  );
}
