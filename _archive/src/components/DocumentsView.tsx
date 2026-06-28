import React, { useState, useRef } from "react";
import { 
  FileText, UploadCloud, Shield, Check, Trash2, Calendar, File, 
  AlertCircle, Tag, Sparkles, Filter, Loader2, Bookmark
} from "lucide-react";

import { Document } from "../types";

interface DocumentsViewProps {
  files?: Document[];
  onAddDocument?: (
    name: string,
    size: string,
    type: string,
    category?: string,
    tags?: string[],
    summary?: string
  ) => void;
  onDeleteDocument?: (id: string) => void;
}

export default function DocumentsView({
  files: filesProp,
  onAddDocument,
  onDeleteDocument,
}: DocumentsViewProps) {
  const [localFiles, setLocalFiles] = useState<Document[]>([
    {
      id: "doc-1",
      userId: "local-user",
      fileName: "form_16_assessment_year_2026.pdf",
      fileType: "Tax Document",
      storageUrl: "https://example.com/form_16_assessment_year_2026.pdf",
      uploadedAt: "2026-06-15T12:00:00Z",
      status: "imported",
      extractedData: {
        summary: "official income tax proof and salary break-up statement for ay 2026-27."
      },
      confidenceFlags: {},
      size: "2.4 MB",
      tags: ["fy25-26", "itr", "form 16"]
    },
    {
      id: "doc-2",
      userId: "local-user",
      fileName: "lic_premium_receipt_fy25_26.pdf",
      fileType: "Insurance",
      storageUrl: "https://example.com/lic_premium_receipt_fy25_26.pdf",
      uploadedAt: "2026-06-18T12:00:00Z",
      status: "imported",
      extractedData: {
        summary: "lic premium payment receipt eligible for tax deduction under section 80c."
      },
      confidenceFlags: {},
      size: "820 KB",
      tags: ["lic", "life cover", "80c"]
    },
  ]);

  const files = filesProp !== undefined ? filesProp : localFiles;

  const [dragActive, setDragActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = [
    "all",
    "Payslip",
    "Tax Document",
    "Insurance",
    "Loan",
    "Investment",
    "Credit Card Bill",
    "Utility"
  ];

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUploadedFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUploadedFiles(e.target.files);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleUploadedFiles = async (fileList: FileList) => {
    setAnalyzing(true);
    try {
      for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        const sizeStr = f.size > 1024 * 1024 
          ? `${(f.size / (1024 * 1024)).toFixed(1)} MB` 
          : `${(f.size / 1024).toFixed(0)} KB`;
        const name = f.name.toLowerCase();
        const type = f.name.split(".").pop() || "unknown";

        // Convert file to base64
        const fileBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64String = (reader.result as string).split(",")[1];
            resolve(base64String);
          };
          reader.onerror = reject;
          reader.readAsDataURL(f);
        });

        // Call Gemini Auto-Categorize API on server
        const response = await fetch("/api/document/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileBase64,
            mimeType: f.type || "application/pdf",
            fileName: f.name
          })
        });

        if (!response.ok) {
          throw new Error("Failed to auto-categorize document.");
        }

        const data = await response.json();

        if (onAddDocument) {
          onAddDocument(name, sizeStr, type, data.category, data.tags, data.summary);
        } else {
          const newFile: Document = {
            id: `doc-${Date.now()}-${i}`,
            userId: "local-user",
            fileName: name,
            fileType: data.category || "General",
            storageUrl: `https://example.com/demo/${name}`,
            uploadedAt: new Date().toISOString(),
            status: "imported",
            extractedData: {
              summary: data.summary || "financial statement processed by finia intelligence."
            },
            confidenceFlags: {},
            size: sizeStr,
            tags: data.tags || []
          };
          setLocalFiles((prev) => [newFile, ...prev]);
        }
      }
    } catch (error) {
      console.error("Document analysis error: ", error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = (id: string) => {
    if (onDeleteDocument) {
      onDeleteDocument(id);
    } else {
      setLocalFiles((prev) => prev.filter((f) => f.id !== id));
    }
  };

  // Filter files list based on active tab
  const filteredFiles = activeCategoryFilter === "all"
    ? files
    : files.filter(f => {
        const cat = f.fileType || (f as any).category || "";
        return cat.toLowerCase() === activeCategoryFilter.toLowerCase();
      });

  return (
    <div className="space-y-6">
      {/* Overview Block */}
      <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div>
            <h3 className="text-sm font-medium text-[#1B3A6B] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#2BA8E0] animate-pulse" />
              compliance document lockers
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              upload pan, form 16, payslips, or premium receipts. finia's vision engine will auto-categorize, extract meta, and tag items for quick tax season retrieval.
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs font-medium text-[#0F766E]">
            <Shield className="w-4 h-4 shrink-0" />
            <span>encrypted client-side sandbox</span>
          </div>
        </div>
      </div>

      {/* Drag & Drop uploader area */}
      <div 
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`border-dashed border-2 rounded-xl p-8 text-center flex flex-col items-center justify-center transition-all relative overflow-hidden ${
          dragActive 
            ? "border-[#1B3A6B] bg-slate-50/50 shadow-inner" 
            : "border-slate-300 bg-white hover:border-slate-400"
        }`}
      >
        {analyzing ? (
          <div className="py-6 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-10 h-10 text-[#2BA8E0] animate-spin" />
            <div>
              <p className="text-sm font-semibold text-slate-700 animate-pulse">scanning with document intelligence...</p>
              <p className="text-xs text-slate-400 mt-1">reading text, analyzing financial sections, and tags</p>
            </div>
          </div>
        ) : (
          <>
            <UploadCloud className="w-10 h-10 text-slate-400 mb-3" />
            <p className="text-sm font-medium text-slate-700">drag & drop files here to upload</p>
            <p className="text-xs text-slate-400 mt-1 mb-4">pdf, jpeg, png up to 10mb</p>
            
            <input 
              ref={fileInputRef}
              type="file" 
              multiple
              onChange={handleFileInput}
              className="hidden" 
            />
            <button
              type="button"
              onClick={onButtonClick}
              className="px-4 py-2 text-xs font-medium text-white bg-[#1B3A6B] rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              choose files manually
            </button>
          </>
        )}
      </div>

      {/* Categories Filter Tabs */}
      <div className="flex items-center space-x-2 pb-1 overflow-x-auto scrollbar-none border-b border-slate-100">
        <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1">Filter by:</span>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategoryFilter(cat)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-all whitespace-nowrap capitalize ${
              activeCategoryFilter === cat
                ? "bg-[#1B3A6B] text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Uploaded Documents List */}
      <div className="bg-white border-[0.5px] border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 border-b-[0.5px] border-slate-200 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            {activeCategoryFilter === "all" ? "stored documents" : `${activeCategoryFilter} collection`}
          </span>
          <span className="text-[10px] font-mono text-slate-400">{filteredFiles.length} file(s)</span>
        </div>
        
        <div className="divide-y-[0.5px] divide-slate-150">
          {filteredFiles.map((file) => (
            <div key={file.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between hover:bg-slate-50 transition-colors gap-4">
              <div className="flex items-start space-x-3.5 min-w-0">
                <div className="p-2.5 bg-slate-100 text-slate-500 rounded-xl shrink-0">
                  <File className="w-5 h-5 text-[#1B3A6B]" />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-slate-800 truncate pr-2">{file.fileName || (file as any).name}</h4>
                    {(file.fileType || (file as any).category) && (
                      <span className="text-[9px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100/50 rounded-full flex items-center gap-1 uppercase tracking-wider shrink-0">
                        <Bookmark className="w-2.5 h-2.5" />
                        {file.fileType || (file as any).category}
                      </span>
                    )}
                  </div>
                  
                  {(file.extractedData?.summary || (file as any).summary) && (
                    <p className="text-xs text-slate-500 leading-normal">{file.extractedData?.summary || (file as any).summary}</p>
                  )}

                  <div className="flex items-center space-x-2.5 mt-2 flex-wrap gap-y-1.5">
                    <span className="text-xs text-slate-400 font-mono">{file.size}</span>
                    <span className="text-xs text-slate-300">•</span>
                    <span className="text-xs text-slate-400 font-mono">uploaded {(file.uploadedAt || (file as any).uploadDate || "").split("T")[0]}</span>
                    
                    {file.tags && file.tags.length > 0 && (
                      <>
                        <span className="text-xs text-slate-300">•</span>
                        <div className="flex items-center gap-1 flex-wrap">
                          <Tag className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                          {file.tags.map((tag, idx) => (
                            <span key={idx} className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-mono">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDelete(file.id)}
                className="self-end md:self-center text-slate-400 hover:text-[#E24B4A] p-2 rounded-lg hover:bg-red-50 transition-colors shrink-0"
                title="Delete document"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {filteredFiles.length === 0 && (
            <div className="p-12 text-center text-slate-400 bg-white">
              <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm">no documents logged under "{activeCategoryFilter}" yet.</p>
              <p className="text-xs text-slate-400 mt-1">upload files in this category to track investments and income proofs.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
