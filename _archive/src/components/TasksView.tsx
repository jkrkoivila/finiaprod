import React, { useState } from "react";
import {
  CheckSquare,
  Square,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  Sparkles,
  ArrowUpDown,
  Edit2,
  Clock,
  X,
  Check,
  Tag
} from "lucide-react";
import { Task } from "../types";

interface TasksViewProps {
  tasks: Task[];
  onToggleComplete: (id: string) => void;
  onAddTask: (task: Omit<Task, "id" | "completed">) => void;
  onDeleteTask: (id: string) => void;
  onUpdateTask: (id: string, updated: Partial<Task>) => void;
}

export default function TasksView({
  tasks,
  onToggleComplete,
  onAddTask,
  onDeleteTask,
  onUpdateTask,
}: TasksViewProps) {
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "tax" | "finance" | "personal" | "work" | "general">("all");
  const [sortBy, setSortBy] = useState<"due_soon" | "due_late" | "priority_high" | "priority_low">("due_soon");

  // Standard task form state
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [category, setCategory] = useState<"tax" | "finance" | "personal" | "general" | "work">("general");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // Natural language quick add state
  const [naturalQuery, setNaturalQuery] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseNotice, setParseNotice] = useState<string | null>(null);

  // Handle Quick-Add submit to Gemini API
  const handleQuickAddParse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!naturalQuery.trim()) return;

    setParsing(true);
    setParseNotice(null);

    try {
      const response = await fetch("/api/parse-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: naturalQuery,
          today: "2026-06-25", // fixed context year/date
        }),
      });

      const parsed = await response.json();
      if (parsed.error) {
        throw new Error(parsed.error);
      }

      // Populate form
      setTitle(parsed.title || naturalQuery);
      setDueDate(parsed.dueDate || "2026-06-25");
      setPriority(parsed.priority || "medium");
      setCategory(parsed.category || "general");
      setDueTime(parsed.dueTime || "");

      // Open form
      setShowAddForm(true);
      setEditingTaskId(null);
      setParseNotice(`✨ Finia parsed "${naturalQuery}"! Review, customize, and save below.`);
      setNaturalQuery("");
    } catch (err: any) {
      console.error(err);
      setParseNotice(`⚠️ Parsing failed: ${err.message || "Using defaults"}. Please fill manually.`);
      // Fallback populate
      setTitle(naturalQuery);
      setDueDate("2026-06-25");
      setShowAddForm(true);
    } finally {
      setParsing(false);
    }
  };

  // Handle Save (Add or Update)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;

    const taskPayload = {
      title,
      dueDate,
      dueTime: dueTime || undefined,
      category,
      priority,
    };

    if (editingTaskId) {
      onUpdateTask(editingTaskId, taskPayload);
      setEditingTaskId(null);
    } else {
      onAddTask(taskPayload);
    }

    // Reset Form
    setTitle("");
    setDueDate("");
    setDueTime("");
    setCategory("general");
    setPriority("medium");
    setShowAddForm(false);
    setParseNotice(null);
  };

  // Set form in edit mode
  const handleEditClick = (task: Task) => {
    setEditingTaskId(task.id);
    setTitle(task.title);
    setDueDate(task.dueDate);
    setDueTime(task.dueTime || "");
    setCategory(task.category);
    setPriority(task.priority);
    setShowAddForm(true);
    setParseNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Reset form
  const handleCancel = () => {
    setTitle("");
    setDueDate("");
    setDueTime("");
    setCategory("general");
    setPriority("medium");
    setEditingTaskId(null);
    setShowAddForm(false);
    setParseNotice(null);
  };

  // Priority weight maps
  const priorityWeights = {
    high: 3,
    medium: 2,
    low: 1,
  };

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    const statusMatch =
      filter === "all" ||
      (filter === "pending" && !t.completed) ||
      (filter === "completed" && t.completed);
    const catMatch = categoryFilter === "all" || t.category === categoryFilter;
    return statusMatch && catMatch;
  });

  // Sort tasks
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (sortBy === "due_soon") {
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (sortBy === "due_late") {
      return b.dueDate.localeCompare(a.dueDate);
    }
    if (sortBy === "priority_high") {
      const diff = priorityWeights[b.priority] - priorityWeights[a.priority];
      if (diff !== 0) return diff;
      return a.dueDate.localeCompare(b.dueDate); // fallback to due soon
    }
    if (sortBy === "priority_low") {
      const diff = priorityWeights[a.priority] - priorityWeights[b.priority];
      if (diff !== 0) return diff;
      return a.dueDate.localeCompare(b.dueDate);
    }
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Natural Language Quick Add Widget */}
      <div className="bg-gradient-to-r from-[#1B3A6B]/5 to-[#2BA8E0]/10 border-[0.5px] border-[#1B3A6B]/20 rounded-xl p-5 shadow-sm">
        <div className="flex items-start space-x-3">
          <div className="p-2 bg-[#1B3A6B]/10 rounded-lg text-[#1B3A6B]">
            <Sparkles className="w-5 h-5 text-[#2BA8E0] animate-pulse" />
          </div>
          <div className="flex-1 space-y-2">
            <h4 className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider">
              Finia Intelligent Quick-Add
            </h4>
            <p className="text-xs text-slate-500">
              Type tasks in sentence case (e.g., "pay rent next Friday at 10am" or "file compliance forms immediately") and let Finia extract Title, Due Date, Time, Priority, and Category automatically.
            </p>
            <form onSubmit={handleQuickAddParse} className="flex gap-2 pt-2">
              <input
                type="text"
                value={naturalQuery}
                onChange={(e) => setNaturalQuery(e.target.value)}
                placeholder="e.g., mail quarterly budget report by Monday afternoon..."
                disabled={parsing}
                className="flex-1 px-3 py-2 text-xs bg-white border-[0.5px] border-slate-200 rounded-md focus:outline-none focus:border-[#1B3A6B] disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={parsing || !naturalQuery.trim()}
                className="px-4 py-2 bg-[#1B3A6B] text-white text-xs font-medium rounded-md hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center shrink-0 cursor-pointer"
              >
                {parsing ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                    parsing...
                  </>
                ) : (
                  "Parse"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Parse result notification */}
      {parseNotice && (
        <div className="bg-[#E0F2FE] border-[0.5px] border-[#38BDF8] text-slate-700 text-xs px-4 py-3 rounded-xl flex items-start justify-between">
          <p className="font-medium">{parseNotice}</p>
          <button onClick={() => setParseNotice(null)} className="text-slate-400 hover:text-slate-600 focus:outline-none">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Standard Task Form (Add/Edit) */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-white border-[0.5px] border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b-[0.5px] border-slate-100">
            <h3 className="text-sm font-bold text-[#1B3A6B] uppercase tracking-wider">
              {editingTaskId ? "✏️ Edit Task / Deadline" : "➕ Create New Task / Deadline"}
            </h3>
            <button
              type="button"
              onClick={handleCancel}
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">task title</label>
              <input
                type="text"
                required
                placeholder="e.g., file Form 16, pay electricity bill..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border-[0.5px] border-slate-200 rounded-md focus:outline-none focus:border-[#1B3A6B]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">due date</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border-[0.5px] border-slate-200 rounded-md focus:outline-none focus:border-[#1B3A6B]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">due time (optional)</label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border-[0.5px] border-slate-200 rounded-md focus:outline-none focus:border-[#1B3A6B]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border-[0.5px] border-slate-200 rounded-md focus:outline-none focus:border-[#1B3A6B]"
              >
                <option value="general">general</option>
                <option value="tax">tax & compliance</option>
                <option value="finance">finance & accounts</option>
                <option value="personal">personal</option>
                <option value="work">work</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border-[0.5px] border-slate-200 rounded-md focus:outline-none focus:border-[#1B3A6B]"
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-[#1B3A6B] rounded-lg hover:bg-slate-800 transition-colors cursor-pointer flex items-center"
            >
              <Check className="w-3.5 h-3.5 mr-1.5" />
              {editingTaskId ? "Update Task" : "Save Task"}
            </button>
          </div>
        </form>
      )}

      {/* Filter and sorting control toolbar */}
      <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {/* Status filters */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "all", label: "all tasks" },
              { id: "pending", label: "pending" },
              { id: "completed", label: "completed" }
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setFilter(st.id as any)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border-[0.5px] transition-all cursor-pointer ${
                  filter === st.id
                    ? "bg-[#1B3A6B] text-white border-[#1B3A6B]"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            {/* Sorting */}
            <div className="flex items-center space-x-1 w-full sm:w-auto">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1.5 text-xs bg-slate-50 border-[0.5px] border-slate-200 rounded-lg text-slate-600 focus:outline-none w-full sm:w-auto"
              >
                <option value="due_soon">Sort by: Due soonest</option>
                <option value="due_late">Sort by: Due latest</option>
                <option value="priority_high">Sort by: Priority (High to Low)</option>
                <option value="priority_low">Sort by: Priority (Low to High)</option>
              </select>
            </div>

            {/* Manual add trigger */}
            {!showAddForm && (
              <button
                onClick={() => {
                  setEditingTaskId(null);
                  setShowAddForm(true);
                }}
                className="flex items-center px-4 py-2 text-xs font-medium text-white bg-[#1B3A6B] rounded-lg hover:bg-slate-800 transition-all shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                add task
              </button>
            )}
          </div>
        </div>

        {/* Category filters */}
        <div className="flex items-center space-x-2 pt-3 border-t-[0.5px] border-slate-100 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs text-slate-400 whitespace-nowrap flex items-center">
            <Tag className="w-3 h-3 mr-1" />
            category:
          </span>
          {["all", "tax", "finance", "personal", "work", "general"].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat as any)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full border-[0.5px] transition-all whitespace-nowrap cursor-pointer ${
                categoryFilter === cat
                  ? "bg-slate-200 text-slate-800 border-slate-300"
                  : "bg-transparent text-slate-500 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {cat === "tax" ? "tax & compliance" : cat === "finance" ? "finance & accounts" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks listing container */}
      <div className="bg-white border-[0.5px] border-slate-200 rounded-xl divide-y-[0.5px] divide-slate-150 shadow-sm overflow-hidden">
        {sortedTasks.length > 0 ? (
          sortedTasks.map((task) => (
            <div key={task.id} className="p-4 flex items-center justify-between hover:bg-slate-50/80 transition-all group">
              <div className="flex items-center space-x-3.5 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => onToggleComplete(task.id)}
                  className="text-slate-400 hover:text-[#1B3A6B] transition-colors shrink-0 focus:outline-none cursor-pointer"
                >
                  {task.completed ? (
                    <CheckSquare className="w-5 h-5 text-[#0F766E]" />
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                </button>

                <div className="flex flex-col min-w-0">
                  <span className={`text-xs md:text-sm font-semibold transition-all ${task.completed ? "line-through text-slate-400" : "text-slate-800"}`}>
                    {task.title}
                  </span>

                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {/* Due Date & Time */}
                    <span className="flex items-center text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border-[0.5px] border-slate-200">
                      <Calendar className="w-3 h-3 mr-1 text-slate-400" />
                      {task.dueDate}
                      {task.dueTime && (
                        <>
                          <Clock className="w-3 h-3 ml-1.5 mr-1 text-slate-400" />
                          {task.dueTime}
                        </>
                      )}
                    </span>

                    {/* Category Badge */}
                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase tracking-wider ${
                      task.category === "tax"
                        ? "bg-purple-100 text-[#6D28D9] border-[0.5px] border-purple-200"
                        : task.category === "finance"
                        ? "bg-emerald-100 text-[#0F766E] border-[0.5px] border-emerald-200"
                        : task.category === "work"
                        ? "bg-amber-100 text-[#B45309] border-[0.5px] border-amber-200"
                        : task.category === "personal"
                        ? "bg-blue-100 text-blue-700 border-[0.5px] border-blue-200"
                        : "bg-slate-100 text-slate-600 border-[0.5px] border-slate-200"
                    }`}>
                      {task.category === "tax" ? "tax & compliance" : task.category === "finance" ? "finance & accounts" : task.category}
                    </span>

                    {/* Priority Badge */}
                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase tracking-wider ${
                      task.priority === "high"
                        ? "bg-rose-100 text-rose-600 border-[0.5px] border-rose-200"
                        : task.priority === "medium"
                        ? "bg-sky-100 text-sky-700 border-[0.5px] border-sky-200"
                        : "bg-slate-100 text-slate-500 border-[0.5px] border-slate-200"
                    }`}>
                      {task.priority} priority
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEditClick(task)}
                  className="p-1.5 text-slate-400 hover:text-[#1B3A6B] hover:bg-slate-100 rounded-md transition-all cursor-pointer"
                  title="Edit task"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDeleteTask(task.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
                  title="Delete task"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="p-12 text-center text-slate-400 bg-slate-50/50">
            <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm">no tasks found matching the filter criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
