import { Fragment, useMemo, useRef, useState } from "react";
import {
  Upload, Mail, FileText, X, Check, AlertTriangle, Trash2, Loader2, FileWarning, Lock, HelpCircle, type LucideIcon,
} from "lucide-react";
import { formatINR } from "../lib/dashboard";
import { DOC_TYPES, evaluateImport, type DocStatus, type DocType } from "../lib/importCriteria";
import type { CommitResult, DocumentDraft } from "../lib/documents";
import type { DeletionSummary } from "../lib/documentService";
import type { ExtractResult, GmailFindings } from "../lib/docApi";
import type { SyncResult } from "../lib/gmailSync";
import type { FiniaDocument } from "../types";

interface DocumentsViewProps {
  documents: FiniaDocument[];
  loading: boolean;
  extract: (file: File) => Promise<ExtractResult>;
  commit: (draft: DocumentDraft, docId?: string) => Promise<CommitResult>;
  remove: (doc: FiniaDocument, mode: "file" | "data") => Promise<void>;
  summary: (doc: FiniaDocument) => Promise<DeletionSummary>;
  syncGmail: () => Promise<SyncResult>;
}

const STATUS_META: Record<DocStatus, { label: string; color: string; icon: LucideIcon }> = {
  imported: { label: "Imported", color: "#0F766E", icon: Check },
  needs_review: { label: "Needs review", color: "#D97706", icon: AlertTriangle },
  uncategorized: { label: "Uncategorized", color: "#475569", icon: HelpCircle },
  unreadable: { label: "Could not read", color: "#E24B4A", icon: FileWarning },
  locked: { label: "Locked", color: "#6D28D9", icon: Lock },
  data_removed: { label: "Data removed", color: "#94A3B8", icon: Trash2 },
};

interface Draft {
  docId?: string;
  type: DocType | null;
  extracted: Record<string, any>;
  confidenceFlags: Record<string, boolean>;
  fileName: string;
  source: "upload" | "gmail";
  edited: boolean;
}

export default function DocumentsView({ documents, loading, extract, commit, remove, summary, syncGmail }: DocumentsViewProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState<DocStatus | "all">("all");

  // Gmail
  const [gmail, setGmail] = useState<"idle" | "scanning" | "done" | "error">("idle");
  const [result, setResult] = useState<SyncResult | null>(null);

  // Delete modal
  const [delDoc, setDelDoc] = useState<FiniaDocument | null>(null);
  const [delSummary, setDelSummary] = useState<DeletionSummary | null>(null);

  const visible = useMemo(
    () => (filter === "all" ? documents : documents.filter((d) => d.status === filter)),
    [documents, filter]
  );

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy("Reading document…");
    setNotice(null);
    try {
      const r = await extract(file);
      const type = (DOC_TYPES as any)[r.type] ? (r.type as DocType) : null;
      const flags: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(r.confidence || {})) if ((v as number) < 0.7) flags[k] = true;
      setDraft({ type, extracted: r.fields || {}, confidenceFlags: flags, fileName: file.name, source: "upload", edited: false });
    } catch (e: any) {
      if (e.code === "unreadable") {
        await commit({ type: null, extracted: {}, fileName: file.name, source: "upload", forcedStatus: "unreadable" });
        setNotice(`Saved "${file.name}" but couldn't read it.`);
      } else if (e.code === "needsKey") {
        setNotice("Document extraction needs a Gemini key (GEMINI_API_KEY).");
      } else {
        setNotice(e.message || "Could not process that file.");
      }
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onConfirm = async () => {
    if (!draft) return;
    setBusy("Saving…");
    try {
      const res = await commit(
        { type: draft.type, extracted: draft.extracted, fileName: draft.fileName, source: draft.source, confidenceFlags: draft.confidenceFlags, edited: draft.edited },
        draft.docId
      );
      setNotice(res.duplicate ? "Already in Finia — skipped the duplicate." : res.status === "imported" ? "Imported and added to your modules." : "Saved.");
      setDraft(null);
    } finally {
      setBusy(null);
    }
  };

  const onSync = async () => {
    setGmail("scanning");
    setNotice(null);
    try {
      setResult(await syncGmail());
      setGmail("done");
    } catch (e: any) {
      setNotice(e.message || "Gmail sync failed.");
      setGmail("error");
    }
  };

  const openDelete = async (d: FiniaDocument) => {
    setDelDoc(d);
    setDelSummary(null);
    setDelSummary(await summary(d));
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[20px] font-medium text-navy">Documents</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Import from Gmail or upload — Finia extracts, verifies, and files everything.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onSync} disabled={gmail === "scanning"} className="h-9 px-3 rounded-lg border-[0.5px] border-black/15 text-[12px] font-medium text-navy flex items-center gap-1.5 hover:bg-surface transition-colors disabled:opacity-60">
            <Mail size={14} /> Sync Gmail
          </button>
          <button onClick={() => fileRef.current?.click()} className="h-9 px-3 rounded-lg bg-navy text-white text-[12px] font-medium flex items-center gap-1.5 hover:bg-navy/90 transition-colors">
            <Upload size={14} /> Upload
          </button>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      </div>

      {notice && <div className="text-[12px] text-navy bg-pulse/10 border-[0.5px] border-pulse/25 rounded-lg px-3 py-2">{notice}</div>}
      {busy && <div className="text-[12px] text-slate-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> {busy}</div>}

      {/* Gmail scanning + findings */}
      {gmail === "scanning" && (
        <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-6 flex flex-col items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span className="absolute w-10 h-10 rounded-full bg-pulse/20 animate-ping" />
            <Mail size={22} className="relative text-pulse" />
          </div>
          <div className="text-[13px] font-medium text-navy">Scanning your inbox…</div>
          <div className="text-[12px] text-slate-500">Finding bills, deadlines, receipts, and subscriptions</div>
        </div>
      )}
      {gmail === "done" && result && (
        <GmailFindingsPanel result={result} onClose={() => setGmail("idle")} />
      )}

      {/* Filter */}
      <div className="flex flex-wrap gap-1.5">
        {(["all", "imported", "needs_review", "uncategorized", "unreadable", "locked"] as (DocStatus | "all")[]).map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`h-7 px-2.5 rounded-full text-[11px] border-[0.5px] capitalize transition-colors ${filter === s ? "border-navy bg-navy/5 text-navy font-medium" : "border-black/10 text-slate-500 hover:text-navy"}`}>
            {s === "all" ? "All" : STATUS_META[s as DocStatus].label}
          </button>
        ))}
      </div>

      {/* Library */}
      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-lg bg-white border-[0.5px] border-black/10" />)}</div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-8 flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-lg bg-navy/5 flex items-center justify-center"><FileText size={18} className="text-navy/50" /></div>
          <p className="mt-3 text-[13px] font-medium text-navy">No documents yet</p>
          <p className="mt-1 text-[12px] text-slate-500 max-w-xs">Sync Gmail or upload a bill, payslip, or statement to get started.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((d) => {
            const meta = STATUS_META[d.status];
            const Icon = meta.icon;
            const def = d.type ? DOC_TYPES[d.type] : null;
            return (
              <Fragment key={d.id}>
                <li className="flex items-center gap-3 rounded-lg border-[0.5px] border-black/10 bg-white p-3">
                  <button onClick={() => setDraft({ docId: d.id, type: d.type, extracted: d.extractedData || {}, confidenceFlags: d.confidenceFlags || {}, fileName: d.fileName, source: d.source, edited: false })} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                    <div className="w-9 h-9 rounded-lg bg-navy/5 flex items-center justify-center shrink-0"><FileText size={17} className="text-navy/60" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-navy truncate">{d.fileName}</div>
                      <div className="text-[11px] text-slate-400 truncate">{def?.label || "Uncategorized"}{d.summary ? ` · ${d.summary}` : ""}</div>
                    </div>
                  </button>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0" style={{ background: `${meta.color}14`, color: meta.color }}>
                    <Icon size={11} /> {meta.label}
                  </span>
                  <button onClick={() => openDelete(d)} aria-label="Delete" className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-crisis/10 hover:text-crisis transition-colors shrink-0">
                    <Trash2 size={15} />
                  </button>
                </li>
              </Fragment>
            );
          })}
        </ul>
      )}

      {draft && <Preview draft={draft} setDraft={setDraft} onConfirm={onConfirm} onClose={() => setDraft(null)} busy={!!busy} />}
      {delDoc && <DeleteModal doc={delDoc} summary={delSummary} onClose={() => setDelDoc(null)} onDelete={async (mode) => { await remove(delDoc, mode); setDelDoc(null); setNotice("Deleted. Totals refreshed."); }} />}
    </div>
  );
}

// ── Preview before save ──
function Preview({ draft, setDraft, onConfirm, onClose, busy }: { draft: Draft; setDraft: (d: Draft) => void; onConfirm: () => void; onClose: () => void; busy: boolean }) {
  const def = draft.type ? DOC_TYPES[draft.type] : null;
  const ev = evaluateImport(draft.type, draft.extracted);
  const fields = def ? [...def.required, ...def.optional] : Object.keys(draft.extracted);

  const setField = (k: string, v: string) => {
    const flags = { ...draft.confidenceFlags };
    delete flags[k];
    setDraft({ ...draft, extracted: { ...draft.extracted, [k]: v }, confidenceFlags: flags, edited: true });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/30" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white rounded-xl border-[0.5px] border-black/10 overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 h-12 border-b-[0.5px] border-black/10">
          <div className="text-[13px] font-medium text-navy truncate">Verify before saving</div>
          <button onClick={onClose} className="text-slate-400 hover:text-navy" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 overflow-y-auto scrollbar-thin">
          {/* Source */}
          <div className="bg-surface p-4 border-r-[0.5px] border-black/10">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-2">Source document</div>
            <div className="aspect-[3/4] rounded-lg bg-white border-[0.5px] border-black/10 flex flex-col items-center justify-center text-center p-4">
              <FileText size={28} className="text-navy/30" />
              <div className="mt-2 text-[12px] font-medium text-navy break-all">{draft.fileName}</div>
              <div className="text-[11px] text-slate-400 mt-1">{def?.label || "Pick a type below"}</div>
            </div>
          </div>
          {/* Fields */}
          <div className="p-4 space-y-2.5">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-400">Document type</span>
              <select value={draft.type || ""} onChange={(e) => setDraft({ ...draft, type: (e.target.value || null) as DocType | null, edited: true })} className="h-9 px-2 rounded-lg border-[0.5px] border-black/15 text-[12px] outline-none focus:border-navy">
                <option value="">Uncategorized — pick a type</option>
                {Object.values(DOC_TYPES).map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </label>
            {ev.missingRequired.length > 0 && (
              <div className="text-[11px] text-[#D97706] bg-[#D97706]/10 border-[0.5px] border-[#D97706]/25 rounded-lg px-2.5 py-1.5">
                Missing required: {ev.missingRequired.join(", ")} — saved as needs-review, excluded from totals until filled.
              </div>
            )}
            {fields.map((f) => {
              const required = def?.required.includes(f);
              const flagged = draft.confidenceFlags[f];
              const missing = required && (draft.extracted[f] === undefined || draft.extracted[f] === "");
              return (
                <label key={f} className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wide flex items-center gap-1.5" style={{ color: missing ? "#E24B4A" : flagged ? "#D97706" : "#94a3b8" }}>
                    {f}{required && " *"}
                    {flagged && <span className="inline-flex items-center gap-0.5"><AlertTriangle size={10} /> please verify</span>}
                  </span>
                  <input
                    value={draft.extracted[f] ?? ""}
                    onChange={(e) => setField(f, e.target.value)}
                    className="h-9 px-2 rounded-lg border-[0.5px] text-[12px] outline-none focus:border-navy"
                    style={{ borderColor: missing ? "#E24B4A66" : flagged ? "#D9770666" : "var(--line)" }}
                  />
                </label>
              );
            })}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t-[0.5px] border-black/10">
          <span className="text-[11px] text-slate-400">{ev.status === "imported" ? "Ready to import" : ev.status === "needs_review" ? "Will save as needs-review" : "Pick a type to import"}</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="h-9 px-3 rounded-lg border-[0.5px] border-black/15 text-[12px] text-slate-600 hover:bg-surface">Cancel</button>
            <button onClick={onConfirm} disabled={busy} className="h-9 px-4 rounded-lg bg-navy text-white text-[12px] font-medium flex items-center gap-1.5 hover:bg-navy/90 disabled:opacity-60">
              <Check size={14} /> Confirm & save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GmailFindingsPanel({ result, onClose }: { result: SyncResult; onClose: () => void }) {
  const { findings, total, duplicates } = result;
  const groups: { kind: keyof GmailFindings; label: string }[] = [
    { kind: "bills", label: "Bills" }, { kind: "deadlines", label: "Deadlines" }, { kind: "receipts", label: "Receipts" }, { kind: "subscriptions", label: "Subscriptions" },
  ];
  return (
    <div className="bg-white rounded-xl border-[0.5px] border-black/10 p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[13px] font-medium text-navy">
          Imported {total} item{total === 1 ? "" : "s"} from Gmail
          {duplicates > 0 && <span className="text-slate-400 font-normal"> · {duplicates} already in Finia</span>}
        </h2>
        <button onClick={onClose} className="text-slate-400 hover:text-navy" aria-label="Dismiss"><X size={15} /></button>
      </div>
      {total === 0 ? (
        <p className="text-[12px] text-slate-500">No new financial items found in your recent emails.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {groups.map((g) => (findings[g.kind]?.length ? (
            <div key={g.kind}>
              <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">{g.label}</div>
              <ul className="space-y-1.5">
                {findings[g.kind].map((item: any, i: number) => (
                  <li key={i} className="flex items-center gap-2 rounded-lg border-[0.5px] border-black/10 px-2.5 py-1.5">
                    <Check size={13} className="text-finance shrink-0" />
                    <span className="text-[12px] text-navy truncate">{item.issuer || item.title || item.merchant || item.name}{item.amount || item.totalDue ? ` · ${formatINR(item.amount || item.totalDue)}` : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null))}
        </div>
      )}
    </div>
  );
}

function DeleteModal({ doc, summary, onClose, onDelete }: { doc: FiniaDocument; summary: DeletionSummary | null; onClose: () => void; onDelete: (mode: "file" | "data") => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/30" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-xl border-[0.5px] border-black/10 p-4" onClick={(e) => e.stopPropagation()}>
        <div className="text-[14px] font-medium text-navy">Delete "{doc.fileName}"?</div>
        <p className="text-[12px] text-slate-500 mt-1">{summary ? summary.text : "Checking what this affects…"}</p>
        {summary?.hasManualEdits && (
          <p className="text-[12px] text-crisis bg-crisis/5 border-[0.5px] border-crisis/20 rounded-lg px-2.5 py-1.5 mt-2 flex items-center gap-1.5"><AlertTriangle size={13} /> Some records include your manual edits.</p>
        )}
        <div className="flex flex-col gap-2 mt-4">
          <button onClick={() => onDelete("file")} className="h-9 px-3 rounded-lg bg-crisis text-white text-[12px] font-medium hover:bg-crisis/90">Delete file and its data</button>
          <button onClick={() => onDelete("data")} className="h-9 px-3 rounded-lg border-[0.5px] border-black/15 text-[12px] font-medium text-navy hover:bg-surface">Delete data only, keep file</button>
          <button onClick={onClose} className="h-9 px-3 rounded-lg text-[12px] text-slate-500 hover:bg-surface">Cancel</button>
        </div>
      </div>
    </div>
  );
}
