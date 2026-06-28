import React, { useState, useEffect, useRef } from "react";
import {
  IndianRupee,
  ShieldCheck,
  HelpCircle,
  AlertCircle,
  Info,
  Calculator,
  FileText,
  Upload,
  Trash2,
  Sparkles,
  Send,
  ArrowRight,
  TrendingUp,
  Coins,
  Check,
  ChevronRight,
  BookOpen
} from "lucide-react";

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  type: string;
  uploadDate: string;
}

interface TaxViewProps {
  grossIncomeProp?: number;
  deduction80CProp?: number;
  deduction80DProp?: number;
  hraReceivedProp?: number;
  homeLoanInterestProp?: number;
  deduction80CCDProp?: number;
  deduction80EProp?: number;
  deduction80GProp?: number;
  onUpdateTaxProfile?: (gross: number, c80: number, d80: number, extra: any) => void;
  documents?: UploadedFile[];
  onAddDocument?: (name: string, size: string, type: string) => void;
  onDeleteDocument?: (id: string) => void;
}

interface TaxTip {
  section: string;
  headroom: number;
  advice: string;
  priority: string;
}

interface ChatMessage {
  id: string;
  sender: "user" | "agent";
  text: string;
  timestamp: string;
}

export default function TaxView({
  grossIncomeProp = 1200000,
  deduction80CProp = 150000,
  deduction80DProp = 25000,
  hraReceivedProp = 0,
  homeLoanInterestProp = 0,
  deduction80CCDProp = 0,
  deduction80EProp = 0,
  deduction80GProp = 0,
  onUpdateTaxProfile,
  documents = [],
  onAddDocument,
  onDeleteDocument
}: TaxViewProps) {
  // Tabs: calculator, payslip, documents, expert
  const [activeTab, setActiveTab] = useState<"calculator" | "payslip" | "documents" | "expert">("calculator");

  // Inputs
  const [grossIncome, setGrossIncome] = useState<number>(grossIncomeProp);
  const [deduction80C, setDeduction80C] = useState<number>(deduction80CProp);
  const [deduction80D, setDeduction80D] = useState<number>(deduction80DProp);
  const [hraReceived, setHraReceived] = useState<number>(hraReceivedProp);
  const [homeLoanInterest, setHomeLoanInterest] = useState<number>(homeLoanInterestProp);
  const [deduction80CCD, setDeduction80CCD] = useState<number>(deduction80CCDProp);
  const [deduction80E, setDeduction80E] = useState<number>(deduction80EProp);
  const [deduction80G, setDeduction80G] = useState<number>(deduction80GProp);

  // Exemption calculations for Old Regime
  const [rentPaidMonthly, setRentPaidMonthly] = useState<number>(0);
  const [cityType, setCityType] = useState<"metro" | "non-metro">("metro");

  // State for AI Tax recommendations
  const [taxTips, setTaxTips] = useState<TaxTip[]>([]);
  const [loadingTips, setLoadingTips] = useState<boolean>(false);
  const [tipsError, setTipsError] = useState<string | null>(null);

  // Sync state with props
  useEffect(() => {
    setGrossIncome(grossIncomeProp);
    setDeduction80C(deduction80CProp);
    setDeduction80D(deduction80DProp);
    setHraReceived(hraReceivedProp);
    setHomeLoanInterest(homeLoanInterestProp);
    setDeduction80CCD(deduction80CCDProp);
    setDeduction80E(deduction80EProp);
    setDeduction80G(deduction80GProp);
  }, [
    grossIncomeProp,
    deduction80CProp,
    deduction80DProp,
    hraReceivedProp,
    homeLoanInterestProp,
    deduction80CCDProp,
    deduction80EProp,
    deduction80GProp
  ]);

  // HRA Exemption Calculator for Old Regime
  const calculateHraExemption = () => {
    if (rentPaidMonthly <= 0 || hraReceived <= 0) return 0;
    // basic salary assumed as 50% of gross
    const basicSalary = grossIncome * 0.5;
    const rentPaidAnnual = rentPaidMonthly * 12;

    const limit1 = hraReceived;
    const limit2 = Math.max(0, rentPaidAnnual - basicSalary * 0.1);
    const limit3 = basicSalary * (cityType === "metro" ? 0.5 : 0.4);

    return Math.min(limit1, limit2, limit3);
  };

  const hraExemptionValue = calculateHraExemption();

  // Tax calculations
  const calculateOldRegime = () => {
    const standardDeduction = 50000;
    const capped80C = Math.min(deduction80C, 150000);
    const capped80D = Math.min(deduction80D, 25000);
    const capped80CCD = Math.min(deduction80CCD, 50000);
    const cappedHomeLoan = Math.min(homeLoanInterest, 200000); // Section 24b limit for self-occupied

    const totalDeductions =
      standardDeduction +
      hraExemptionValue +
      cappedHomeLoan +
      capped80C +
      capped80D +
      capped80CCD +
      deduction80E +
      deduction80G;

    const taxable = Math.max(0, grossIncome - totalDeductions);

    let tax = 0;
    if (taxable <= 250000) {
      tax = 0;
    } else if (taxable <= 500000) {
      tax = (taxable - 250000) * 0.05;
    } else if (taxable <= 1000000) {
      tax = 12500 + (taxable - 500000) * 0.20;
    } else {
      tax = 112500 + (taxable - 1000000) * 0.30;
    }

    // 87A rebate old regime: If taxable income <= 5L, tax is nil
    if (taxable <= 500000) {
      tax = 0;
    }

    const cess = tax * 0.04;
    const total = tax + cess;

    return {
      taxable,
      taxBeforeCess: tax,
      cess,
      total,
      deductionsBreakdown: {
        standardDeduction,
        hraExemptionValue,
        cappedHomeLoan,
        capped80C,
        capped80D,
        capped80CCD,
        deduction80E,
        deduction80G,
        total: totalDeductions
      }
    };
  };

  const calculateNewRegime = () => {
    const standardDeduction = 75000;
    const taxable = Math.max(0, grossIncome - standardDeduction);

    let tax = 0;
    // New Slabs for FY 2025-26:
    // 0-4L: Nil
    // 4-8L: 5% (max ₹20,000)
    // 8-12L: 10% (max ₹40,000)
    // 12-16L: 15% (max ₹60,000)
    // 16-20L: 20% (max ₹80,000)
    // 20-24L: 25% (max ₹1,00,000)
    // Above 24L: 30%
    if (taxable <= 400000) {
      tax = 0;
    } else if (taxable <= 800000) {
      tax = (taxable - 400000) * 0.05;
    } else if (taxable <= 1200000) {
      tax = 20000 + (taxable - 800000) * 0.10;
    } else if (taxable <= 1600000) {
      tax = 60000 + (taxable - 1200000) * 0.15;
    } else if (taxable <= 2000000) {
      tax = 120000 + (taxable - 1600000) * 0.20;
    } else if (taxable <= 2400000) {
      tax = 200000 + (taxable - 2000000) * 0.25;
    } else {
      tax = 300000 + (taxable - 2400000) * 0.30;
    }

    // 87A Rebate under New Regime: Taxable income up to 12L is tax-free
    if (taxable <= 1200000) {
      tax = 0;
    }

    const cess = tax * 0.04;
    const total = tax + cess;

    return { taxable, taxBeforeCess: tax, cess, total };
  };

  const oldRes = calculateOldRegime();
  const newRes = calculateNewRegime();

  const betterRegime = oldRes.total < newRes.total ? "Old Regime" : "New Regime";
  const exactSaving = Math.abs(oldRes.total - newRes.total);
  const totalTaxToPay = oldRes.total < newRes.total ? oldRes.total : newRes.total;
  const estimatedTDS = Math.round(totalTaxToPay / 12);

  // Advance Tax Schedule calculation based on final chosen regime tax
  const advanceTaxSchedule = [
    { deadline: "15 Jun 2026", percent: 15, amount: Math.round(totalTaxToPay * 0.15) },
    { deadline: "15 Sep 2026", percent: 45, amount: Math.round(totalTaxToPay * 0.45) },
    { deadline: "15 Dec 2026", percent: 75, amount: Math.round(totalTaxToPay * 0.75) },
    { deadline: "15 Mar 2027", percent: 100, amount: Math.round(totalTaxToPay * 1.00) }
  ];

  // Fetch AI-powered tax-saving suggestions
  const fetchTaxSavingTips = async () => {
    setLoadingTips(true);
    setTipsError(null);
    try {
      const response = await fetch("/api/tax-saving-tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grossIncome,
          deduction80C,
          deduction80D,
          deduction80CCD,
          deduction80E,
          deduction80G,
          hraReceived,
          homeLoanInterest
        })
      });
      const data = await response.json();
      if (data.tips) {
        setTaxTips(data.tips);
      } else if (data.error) {
        setTipsError(data.error);
      } else {
        setTipsError("No recommendations returned from the tax advisor.");
      }
    } catch (err: any) {
      console.error("Failed to load tax tips:", err);
      setTipsError("Unable to calculate tax saving headroom. Please ensure your Gemini API Key is configured in settings and active.");
    } finally {
      setLoadingTips(false);
    }
  };

  // Trigger tips calculation on tab mount if empty
  useEffect(() => {
    if (activeTab === "calculator" && taxTips.length === 0) {
      fetchTaxSavingTips();
    }
  }, [activeTab]);

  // Save current status to profile
  const handleSaveProfile = () => {
    if (onUpdateTaxProfile) {
      onUpdateTaxProfile(grossIncome, deduction80C, deduction80D, {
        hraReceived,
        homeLoanInterest,
        deduction80CCD,
        deduction80E,
        deduction80G
      });
    }
  };

  // Document Library specific states
  const [docCategory, setDocCategory] = useState<string>("80C Proof");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const name = file.name;
    const size = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
    const type = `${docCategory} • ${file.name.split(".").pop()?.toUpperCase()}`;

    if (onAddDocument) {
      onAddDocument(name, size, type);
    }
  };

  // AI Tax Expert Specific States
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "agent",
      text: "hello! i am your finia tax specialist. ask me anything about the Indian income tax act, HRA exemptions, Section 80C/80D planning, or whether old or new regime fits your salary package.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
  ]);
  const [chatInput, setChatInput] = useState<string>("");
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  const handleSendChat = async (textToSend: string) => {
    if (!textToSend.trim() || chatLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await fetch("/api/tax-ai-expert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          history: chatMessages.map((m) => ({ sender: m.sender, text: m.text })),
          context: {
            grossIncome,
            deduction80C,
            deduction80D,
            hraReceived,
            homeLoanInterest,
            deduction80CCD,
            deduction80E,
            deduction80G
          }
        })
      });

      if (!response.body) throw new Error("ReadableStream not supported");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let streamedResponse = "";

      const placeholderId = `ai-stream-${Date.now()}`;
      setChatMessages((prev) => [
        ...prev,
        {
          id: placeholderId,
          sender: "agent",
          text: "",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]);

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6).trim();
              if (dataStr === "[DONE]") break;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.text) {
                  streamedResponse += parsed.text;
                  setChatMessages((prev) =>
                    prev.map((m) => (m.id === placeholderId ? { ...m, text: streamedResponse } : m))
                  );
                }
              } catch (e) {
                // Ignore parse errors on partial streams
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("AI Expert Chat Failed:", err);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "agent",
          text: "sorry, i encountered an issue communicating with the AI service. please check your network connection.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Payslip components state
  const [monthlyBasic, setMonthlyBasic] = useState<number>(Math.round((grossIncome * 0.5) / 12));
  const [monthlyHRA, setMonthlyHRA] = useState<number>(Math.round(hraReceived / 12));
  const [monthlySpecialAllowance, setMonthlySpecialAllowance] = useState<number>(
    Math.round((grossIncome - (grossIncome * 0.5) - hraReceived) / 12)
  );
  const [monthlyEPF, setMonthlyEPF] = useState<number>(Math.round(deduction80C / 12));
  const [monthlyProfTax, setMonthlyProfTax] = useState<number>(200);

  const [payslipScanning, setPayslipScanning] = useState<boolean>(false);
  const [payslipSuccess, setPayslipSuccess] = useState<boolean>(false);
  const payslipInputRef = useRef<HTMLInputElement>(null);

  const handlePayslipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setPayslipScanning(true);
    setPayslipSuccess(false);
    try {
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base = (reader.result as string).split(",")[1];
          resolve(base);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await fetch("/api/payslip/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64,
          mimeType: file.type || "application/pdf"
        })
      });

      if (!response.ok) {
        throw new Error("Failed to scan payslip.");
      }

      const data = await response.json();
      
      setMonthlyBasic(Math.round(data.basic || 0));
      setMonthlyHRA(Math.round(data.hra || 0));
      setMonthlySpecialAllowance(Math.round(Math.max(0, (data.grossSalary || 0) - (data.basic || 0) - (data.hra || 0) - (data.da || 0))));
      setMonthlyEPF(Math.round(data.pfEmployee || 0));
      setMonthlyProfTax(200);

      setGrossIncome(Math.round(data.annualGrossSalary || (data.grossSalary * 12) || 0));
      setHraReceived(Math.round((data.hra || 0) * 12));
      setDeduction80C(Math.round(data.annualPFEmployee || (data.pfEmployee * 12) || 0));

      setPayslipSuccess(true);
    } catch (err) {
      console.error(err);
      alert("Error scanning payslip with Gemini. Please ensure it is a clear image or PDF.");
    } finally {
      setPayslipScanning(false);
    }
  };

  // Recompute payslip whenever main gross changes
  useEffect(() => {
    if (payslipSuccess) return; // Don't override if scanned
    setMonthlyBasic(Math.round((grossIncome * 0.5) / 12));
    setMonthlyHRA(Math.round(hraReceived / 12));
    setMonthlySpecialAllowance(Math.round(Math.max(0, (grossIncome - (grossIncome * 0.5) - hraReceived) / 12)));
  }, [grossIncome, hraReceived, payslipSuccess]);

  return (
    <div className="space-y-6">
      {/* Overview Block */}
      <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-[10px] bg-[#6D28D9]/10 text-[#6D28D9] px-2.5 py-0.5 rounded-full uppercase tracking-wider font-semibold">
              FY 2025-26 (AY 2026-27)
            </span>
            <h3 className="text-lg font-bold text-[#1B3A6B] mt-2">Tax Intelligence Workspace</h3>
            <p className="text-xs text-slate-500 mt-1">
              Verify compliance, plan tax-saving allocations, and find your optimal filing strategy.
            </p>
          </div>
          <div className="flex items-center space-x-2 bg-[#0F766E]/10 border-[0.5px] border-[#0F766E]/20 text-[#0F766E] px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 shrink-0 text-[#0F766E]" />
            <span>Finia Certified Draft Slabs</span>
          </div>
        </div>

        {/* Dynamic Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-t-[0.5px] border-slate-100 mt-5 pt-4">
          <button
            onClick={() => setActiveTab("calculator")}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors flex items-center space-x-1.5 ${
              activeTab === "calculator"
                ? "bg-[#1B3A6B] text-white"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Tax Slabs & Estimator</span>
          </button>
          <button
            onClick={() => setActiveTab("payslip")}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors flex items-center space-x-1.5 ${
              activeTab === "payslip"
                ? "bg-[#1B3A6B] text-white"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Payslip Analyser</span>
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors flex items-center space-x-1.5 ${
              activeTab === "documents"
                ? "bg-[#1B3A6B] text-white"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Document Library</span>
          </button>
          <button
            onClick={() => setActiveTab("expert")}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors flex items-center space-x-1.5 ${
              activeTab === "expert"
                ? "bg-[#1B3A6B] text-white"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Tax Expert</span>
          </button>
        </div>
      </div>

      {/* 1. Tax Calculator Panel */}
      {activeTab === "calculator" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Input fields panel */}
            <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-6 lg:col-span-1 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b-[0.5px] border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <Calculator className="w-4 h-4 text-[#1B3A6B]" />
                  <h4 className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider">Estimator Inputs</h4>
                </div>
                <button
                  onClick={handleSaveProfile}
                  className="text-[10px] text-teal-600 hover:text-teal-700 font-semibold uppercase tracking-wider"
                >
                  Save Profile
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Gross Annual Income (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 text-xs font-mono">₹</span>
                    <input
                      type="number"
                      value={grossIncome || ""}
                      onChange={(e) => setGrossIncome(Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-1.5 text-xs bg-slate-50 border-[0.5px] border-slate-200 rounded-lg focus:outline-none focus:border-[#6D28D9] font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Annual HRA Received (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 text-xs font-mono">₹</span>
                    <input
                      type="number"
                      value={hraReceived || ""}
                      onChange={(e) => setHraReceived(Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-1.5 text-xs bg-slate-50 border-[0.5px] border-slate-200 rounded-lg focus:outline-none focus:border-[#6D28D9] font-mono"
                    />
                  </div>
                </div>

                {/* HRA Calculator Mini Accordion for Old Regime */}
                {hraReceived > 0 && (
                  <div className="bg-slate-50 p-3 rounded-lg border-[0.5px] border-slate-200 space-y-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Info className="w-3 h-3 text-[#1B3A6B]" /> HRA Exemption Parameters (Old Regime)
                    </span>
                    <div>
                      <label className="block text-[9px] font-medium text-slate-500 uppercase mb-1">
                        Monthly Rent Paid (₹)
                      </label>
                      <input
                        type="number"
                        value={rentPaidMonthly || ""}
                        onChange={(e) => setRentPaidMonthly(Number(e.target.value))}
                        className="w-full px-2 py-1 text-xs bg-white border-[0.5px] border-slate-200 rounded focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCityType("metro")}
                        className={`flex-1 py-1 text-[9px] font-semibold rounded uppercase ${
                          cityType === "metro"
                            ? "bg-[#1B3A6B] text-white"
                            : "bg-white text-slate-500 border-[0.5px] border-slate-200"
                        }`}
                      >
                        Metro (50%)
                      </button>
                      <button
                        onClick={() => setCityType("non-metro")}
                        className={`flex-1 py-1 text-[9px] font-semibold rounded uppercase ${
                          cityType === "non-metro"
                            ? "bg-[#1B3A6B] text-white"
                            : "bg-white text-slate-500 border-[0.5px] border-slate-200"
                        }`}
                      >
                        Non-Metro (40%)
                      </button>
                    </div>
                    <div className="text-[9px] text-slate-500 flex justify-between pt-1">
                      <span>Exempt Portion:</span>
                      <span className="font-bold text-[#0F766E]">
                        ₹{hraExemptionValue.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Home Loan Interest paid (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 text-xs font-mono">₹</span>
                    <input
                      type="number"
                      value={homeLoanInterest || ""}
                      onChange={(e) => setHomeLoanInterest(Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-1.5 text-xs bg-slate-50 border-[0.5px] border-slate-200 rounded-lg focus:outline-none focus:border-[#6D28D9] font-mono"
                    />
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1">Capped at ₹2,00,000 under Section 24(b)</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Section 80C Deductions (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 text-xs font-mono">₹</span>
                    <input
                      type="number"
                      value={deduction80C || ""}
                      onChange={(e) => setDeduction80C(Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-1.5 text-xs bg-slate-50 border-[0.5px] border-slate-200 rounded-lg focus:outline-none focus:border-[#6D28D9] font-mono"
                    />
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1">PF, PPF, ELSS, Insurance Premium (Max ₹1.5L)</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Section 80D Health Premium (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 text-xs font-mono">₹</span>
                    <input
                      type="number"
                      value={deduction80D || ""}
                      onChange={(e) => setDeduction80D(Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-1.5 text-xs bg-slate-50 border-[0.5px] border-slate-200 rounded-lg focus:outline-none focus:border-[#6D28D9] font-mono"
                    />
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1">Self, family health premium (Max ₹25k)</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    NPS Sec 80CCD(1B) (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 text-xs font-mono">₹</span>
                    <input
                      type="number"
                      value={deduction80CCD || ""}
                      onChange={(e) => setDeduction80CCD(Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-1.5 text-xs bg-slate-50 border-[0.5px] border-slate-200 rounded-lg focus:outline-none focus:border-[#6D28D9] font-mono"
                    />
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1">Additional NPS contribution (Max ₹50K)</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      80E Education (₹)
                    </label>
                    <input
                      type="number"
                      value={deduction80E || ""}
                      onChange={(e) => setDeduction80E(Number(e.target.value))}
                      className="w-full px-2.5 py-1 text-xs bg-slate-50 border-[0.5px] border-slate-200 rounded-lg focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      80G Donations (₹)
                    </label>
                    <input
                      type="number"
                      value={deduction80G || ""}
                      onChange={(e) => setDeduction80G(Number(e.target.value))}
                      className="w-full px-2.5 py-1 text-xs bg-slate-50 border-[0.5px] border-slate-200 rounded-lg focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleSaveProfile}
                  className="w-full py-2 bg-[#1B3A6B] hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  Save Tax Profile
                </button>
              </div>
            </div>

            {/* Results side-by-side */}
            <div className="lg:col-span-2 space-y-6">
              {/* Regime Recommendation Banner */}
              <div className="bg-gradient-to-r from-teal-500/10 to-teal-600/10 border border-teal-500/20 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-teal-100 text-[#0F766E] rounded-lg">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-teal-900 uppercase tracking-wider">
                      Optimal Choice Detected
                    </h5>
                    <p className="text-sm font-bold text-[#0F766E] mt-0.5">
                      {betterRegime} is better for you!
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Rupee Savings</span>
                  <p className="text-lg font-mono font-bold text-teal-700">
                    ₹{exactSaving.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>

              {/* Side-by-Side computation table */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Old Regime Card */}
                <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-5 flex flex-col justify-between shadow-sm">
                  <div>
                    <div className="flex justify-between items-center pb-3 border-b-[0.5px] border-slate-100">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Old Tax Regime</h4>
                      <span className="text-[9px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full uppercase">
                        With Deductions
                      </span>
                    </div>

                    <div className="space-y-2.5 mt-4 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Gross Salary</span>
                        <span className="font-mono text-slate-700">₹{grossIncome.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Standard Deduction</span>
                        <span className="font-mono text-rose-500">- ₹50,000</span>
                      </div>
                      {hraExemptionValue > 0 && (
                        <div className="flex justify-between text-slate-400">
                          <span>Exempt HRA (Sec 10)</span>
                          <span className="font-mono text-rose-500">
                            - ₹{hraExemptionValue.toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}
                      {homeLoanInterest > 0 && (
                        <div className="flex justify-between text-slate-400">
                          <span>Home Loan (Sec 24b)</span>
                          <span className="font-mono text-rose-500">
                            - ₹{Math.min(homeLoanInterest, 200000).toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}
                      {deduction80C > 0 && (
                        <div className="flex justify-between text-slate-400">
                          <span>Section 80C</span>
                          <span className="font-mono text-rose-500">
                            - ₹{Math.min(deduction80C, 150000).toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}
                      {deduction80D > 0 && (
                        <div className="flex justify-between text-slate-400">
                          <span>Section 80D</span>
                          <span className="font-mono text-rose-500">
                            - ₹{Math.min(deduction80D, 25000).toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}
                      {deduction80CCD > 0 && (
                        <div className="flex justify-between text-slate-400">
                          <span>NPS Sec 80CCD(1B)</span>
                          <span className="font-mono text-rose-500">
                            - ₹{Math.min(deduction80CCD, 50000).toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}
                      {(deduction80E > 0 || deduction80G > 0) && (
                        <div className="flex justify-between text-slate-400">
                          <span>Other deductions</span>
                          <span className="font-mono text-rose-500">
                            - ₹{(deduction80E + deduction80G).toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between pt-2 border-t-[0.5px] border-slate-100 font-semibold text-slate-800">
                        <span>Taxable Income</span>
                        <span className="font-mono">₹{oldRes.taxable.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t-[0.5px] border-slate-100 space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Calculated Tax</span>
                      <span className="font-mono text-slate-700">₹{oldRes.taxBeforeCess.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Cess (4%)</span>
                      <span className="font-mono text-slate-700">₹{oldRes.cess.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 font-bold text-sm text-slate-800">
                      <span>Total Liability</span>
                      <span className="font-mono text-lg">₹{oldRes.total.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>

                {/* New Regime Card */}
                <div className="bg-white border-[0.5px] border-slate-300 rounded-xl p-5 flex flex-col justify-between relative shadow-sm ring-1 ring-teal-500/10">
                  <span className="absolute -top-2.5 right-4 text-[8px] bg-teal-600 text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow">
                    Recommended
                  </span>
                  <div>
                    <div className="flex justify-between items-center pb-3 border-b-[0.5px] border-slate-100">
                      <h4 className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">New Tax Regime</h4>
                      <span className="text-[9px] font-mono bg-teal-50 text-[#0F766E] px-2 py-0.5 rounded-full uppercase font-bold">
                        Default FY 25-26
                      </span>
                    </div>

                    <div className="space-y-2.5 mt-4 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Gross Salary</span>
                        <span className="font-mono text-slate-700">₹{grossIncome.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Standard Deduction</span>
                        <span className="font-mono text-rose-500">- ₹75,000</span>
                      </div>
                      <div className="flex justify-between text-slate-300 line-through">
                        <span>Exemptions & 80C/D</span>
                        <span className="font-mono">Nil (Not Allowed)</span>
                      </div>

                      <div className="flex justify-between pt-2 border-t-[0.5px] border-slate-100 font-semibold text-[#0F766E]">
                        <span>Taxable Income</span>
                        <span className="font-mono">₹{newRes.taxable.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t-[0.5px] border-slate-100 space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Calculated Tax</span>
                      <span className="font-mono text-slate-700">₹{newRes.taxBeforeCess.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Cess (4%)</span>
                      <span className="font-mono text-slate-700">₹{newRes.cess.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 font-bold text-sm text-[#0F766E]">
                      <span>Total Liability</span>
                      <span className="font-mono text-lg">₹{newRes.total.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly TDS & Advance Tax Card */}
              <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="flex justify-between items-center border-b-[0.5px] border-slate-100 pb-4">
                  <div>
                    <h4 className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider">
                      Tax Schedules & Cashflow Impact
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Based on your recommended filing choice ({betterRegime})
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] uppercase font-bold text-slate-400">Estimated Monthly TDS</span>
                    <p className="text-base font-mono font-bold text-slate-800">
                      ₹{estimatedTDS.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">
                    Advance Tax Schedule (FY 2025-26)
                  </span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {advanceTaxSchedule.map((sched, idx) => (
                      <div key={idx} className="bg-slate-50 rounded-lg p-3 border-[0.5px] border-slate-100 text-center">
                        <span className="text-[8px] text-slate-400 uppercase font-bold block">{sched.deadline}</span>
                        <span className="text-xs font-bold text-[#1B3A6B] mt-1 block">{sched.percent}% Due</span>
                        <span className="text-xs font-mono font-semibold text-slate-600 mt-1 block">
                          ₹{sched.amount.toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Gemini-Generated Tax-Saving Tips */}
              <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b-[0.5px] border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <h4 className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider">
                      AI Tax-Saving Optimizations
                    </h4>
                  </div>
                  <button
                    onClick={fetchTaxSavingTips}
                    disabled={loadingTips}
                    className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center space-x-1"
                  >
                    <span>{loadingTips ? "Analyzing..." : "Refresh Insights"}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {loadingTips ? (
                  <div className="py-8 text-center space-y-2">
                    <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-xs text-slate-400">Finia is calculating investment proofs and room limits...</p>
                  </div>
                ) : tipsError ? (
                  <div className="p-4 bg-purple-50/50 border border-purple-100 dark:border-purple-900/50 rounded-lg text-xs text-purple-700 dark:text-purple-300 flex flex-col items-center gap-2 text-center">
                    <span className="font-semibold text-purple-800 dark:text-purple-200">calculation headroom offline</span>
                    <p className="text-[11px] leading-relaxed text-purple-600 dark:text-purple-400">{tipsError}</p>
                    <button
                      onClick={fetchTaxSavingTips}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg mt-1 text-[10px] cursor-pointer"
                    >
                      try recalculating
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {taxTips.map((tip, idx) => (
                      <div key={idx} className="bg-slate-50 border-[0.5px] border-slate-200 rounded-lg p-4.5">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                tip.priority === "High"
                                  ? "bg-rose-50 text-rose-600 border border-rose-200"
                                  : tip.priority === "Medium"
                                  ? "bg-amber-50 text-amber-600 border border-amber-200"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {tip.priority} Priority
                            </span>
                            <span className="text-xs font-bold text-[#1B3A6B]">{tip.section}</span>
                          </div>
                          {tip.headroom > 0 && (
                            <span className="text-[10px] font-mono font-medium text-slate-500">
                              Unused: ₹{tip.headroom.toLocaleString("en-IN")}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">{tip.advice}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Slabs breakdown reference */}
          <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-5 shadow-sm">
            <h4 className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-4">
              FY 2025-26 New Regime Slabs Reference
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-center">
              {[
                { range: "Up to 4L", rate: "Nil" },
                { range: "4L - 8L", rate: "5%" },
                { range: "8L - 12L", rate: "10%" },
                { range: "12L - 16L", rate: "15%" },
                { range: "16L - 20L", rate: "20%" },
                { range: "20L - 24L", rate: "25%" }
              ].map((slab, i) => (
                <div key={i} className="bg-slate-50 rounded-lg p-2.5 border-[0.5px] border-slate-100">
                  <span className="text-[9px] text-slate-400 uppercase font-semibold">{slab.range}</span>
                  <div className="text-sm font-bold text-slate-700 mt-1">{slab.rate}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. Payslip Analyser Panel */}
      {activeTab === "payslip" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Form input */}
          <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-6 lg:col-span-1 space-y-4 shadow-sm">
            <div className="border-b-[0.5px] border-slate-100 pb-3">
              <h4 className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider">Payslip Components</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Input monthly breakdown to analyze deductions</p>
            </div>

            {/* Smart Payslip Vision Uploader */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#1B3A6B] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#2BA8E0]" />
                  AI vision scan
                </span>
                <span className="text-[8px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded">
                  Gemini-3.5
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-normal">
                Upload a PDF/Image of your payslip. Finia will auto-extract gross salary, basic, HRA, PF and TDS.
              </p>
              
              <input
                ref={payslipInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handlePayslipUpload}
                className="hidden"
              />
              
              {payslipScanning ? (
                <div className="flex items-center justify-center space-x-2 py-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                  <span className="animate-spin text-[#2BA8E0] text-sm">⏳</span>
                  <span className="text-xs font-semibold text-slate-600 animate-pulse">scanning payslip...</span>
                </div>
              ) : payslipSuccess ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center space-x-1.5 py-2 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-700">
                    <Check className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-semibold">Scan Complete & Auto-filled!</span>
                  </div>
                  <button
                    onClick={() => payslipInputRef.current?.click()}
                    className="w-full py-1.5 text-[10px] font-medium text-slate-600 hover:text-[#1B3A6B] border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors uppercase tracking-wider cursor-pointer"
                  >
                    scan another
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => payslipInputRef.current?.click()}
                  className="w-full py-2.5 border-[0.5px] border-slate-300 border-dashed rounded-lg flex items-center justify-center gap-2 hover:bg-slate-100 hover:border-slate-400 bg-white transition-all text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-slate-400" />
                  Upload Payslip (PDF/Image)
                </button>
              )}
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Monthly Basic Salary (₹)
                </label>
                <input
                  type="number"
                  value={monthlyBasic || ""}
                  onChange={(e) => setMonthlyBasic(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border-[0.5px] border-slate-200 rounded-lg focus:outline-none focus:border-[#1B3A6B] font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Monthly HRA Received (₹)
                </label>
                <input
                  type="number"
                  value={monthlyHRA || ""}
                  onChange={(e) => setMonthlyHRA(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border-[0.5px] border-slate-200 rounded-lg focus:outline-none focus:border-[#1B3A6B] font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Special Allowance / Others (₹)
                </label>
                <input
                  type="number"
                  value={monthlySpecialAllowance || ""}
                  onChange={(e) => setMonthlySpecialAllowance(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border-[0.5px] border-slate-200 rounded-lg focus:outline-none focus:border-[#1B3A6B] font-mono"
                />
              </div>

              <div className="border-t-[0.5px] border-slate-100 pt-4 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Provident Fund (EPF) Contribution (₹)
                  </label>
                  <input
                    type="number"
                    value={monthlyEPF || ""}
                    onChange={(e) => setMonthlyEPF(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border-[0.5px] border-slate-200 rounded-lg focus:outline-none focus:border-[#1B3A6B] font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Professional Tax (₹)
                  </label>
                  <input
                    type="number"
                    value={monthlyProfTax || ""}
                    onChange={(e) => setMonthlyProfTax(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border-[0.5px] border-slate-200 rounded-lg focus:outline-none focus:border-[#1B3A6B] font-mono"
                  />
                </div>
              </div>

              <button
                onClick={() => {
                  const annualGross = (monthlyBasic + monthlyHRA + monthlySpecialAllowance) * 12;
                  const annual80C = (monthlyEPF * 12);
                  setGrossIncome(annualGross);
                  setHraReceived(monthlyHRA * 12);
                  setDeduction80C(annual80C);
                  setActiveTab("calculator");
                }}
                className="w-full py-2 bg-[#0F766E] hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors uppercase tracking-wider"
              >
                Sync with Tax Calculator
              </button>
            </div>
          </div>

          {/* Graphical Breakdown Analysis */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-6 shadow-sm">
              <h4 className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider mb-4">
                Payslip Cashflow Breakdown
              </h4>

              {/* Total Monthly Salary Block */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-slate-50 rounded-xl border-[0.5px] border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Monthly Gross</span>
                  <p className="text-lg font-mono font-bold text-slate-800 mt-1">
                    ₹{(monthlyBasic + monthlyHRA + monthlySpecialAllowance).toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border-[0.5px] border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Monthly Retained (Take-Home)</span>
                  <p className="text-lg font-mono font-bold text-teal-600 mt-1">
                    ₹{((monthlyBasic + monthlyHRA + monthlySpecialAllowance) - monthlyEPF - monthlyProfTax).toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border-[0.5px] border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Monthly PF Savings</span>
                  <p className="text-lg font-mono font-bold text-[#1B3A6B] mt-1">
                    ₹{monthlyEPF.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>

              {/* Visual breakdown bar */}
              <div className="space-y-2 mb-6">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Percentage distribution</span>
                <div className="h-6 w-full bg-slate-100 rounded-full flex overflow-hidden shadow-inner">
                  {monthlyBasic > 0 && (
                    <div
                      style={{
                        width: `${(monthlyBasic / (monthlyBasic + monthlyHRA + monthlySpecialAllowance)) * 100}%`
                      }}
                      className="bg-blue-600 flex items-center justify-center text-[9px] text-white font-bold"
                    >
                      Basic
                    </div>
                  )}
                  {monthlyHRA > 0 && (
                    <div
                      style={{
                        width: `${(monthlyHRA / (monthlyBasic + monthlyHRA + monthlySpecialAllowance)) * 100}%`
                      }}
                      className="bg-teal-500 flex items-center justify-center text-[9px] text-white font-bold"
                    >
                      HRA
                    </div>
                  )}
                  {monthlySpecialAllowance > 0 && (
                    <div
                      style={{
                        width: `${(monthlySpecialAllowance / (monthlyBasic + monthlyHRA + monthlySpecialAllowance)) * 100}%`
                      }}
                      className="bg-[#6D28D9] flex items-center justify-center text-[9px] text-white font-bold"
                    >
                      Special
                    </div>
                  )}
                </div>
              </div>

              {/* Component descriptions */}
              <div className="space-y-4">
                <h5 className="text-xs font-bold text-slate-700 uppercase">Tax Implications</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border-[0.5px] border-slate-100 p-3.5 rounded-lg bg-slate-50 flex items-start space-x-3">
                    <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0"></div>
                    <div>
                      <span className="text-xs font-bold text-slate-800">Basic Salary</span>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        Fully taxable under all circumstances. Usually forms the base for PF computation (12% of basic).
                      </p>
                    </div>
                  </div>

                  <div className="border-[0.5px] border-slate-100 p-3.5 rounded-lg bg-slate-50 flex items-start space-x-3">
                    <div className="w-2 h-2 rounded-full bg-teal-500 mt-1.5 shrink-0"></div>
                    <div>
                      <span className="text-xs font-bold text-slate-800">HRA Allowance</span>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        Eligible for partial/full tax exemption under Section 10(13A) in Old Regime, subject to rent receipts. Fully taxable in New Regime.
                      </p>
                    </div>
                  </div>

                  <div className="border-[0.5px] border-slate-100 p-3.5 rounded-lg bg-slate-50 flex items-start space-x-3">
                    <div className="w-2 h-2 rounded-full bg-[#6D28D9] mt-1.5 shrink-0"></div>
                    <div>
                      <span className="text-xs font-bold text-slate-800">Special Allowance</span>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        Fully taxable monthly component with no available exemptions. Structured by employers to balance gross.
                      </p>
                    </div>
                  </div>

                  <div className="border-[0.5px] border-slate-100 p-3.5 rounded-lg bg-slate-50 flex items-start space-x-3">
                    <div className="w-2 h-2 rounded-full bg-[#1B3A6B] mt-1.5 shrink-0"></div>
                    <div>
                      <span className="text-xs font-bold text-slate-800">PF Savings (EPF)</span>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        Deducted from gross salary monthly. Eligible for tax benefits under Section 80C up to ₹1.5L annually (Old Regime only).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Document Library Panel */}
      {activeTab === "documents" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* File upload drawer */}
          <div className="bg-white border-[0.5px] border-slate-200 rounded-xl p-6 lg:col-span-1 space-y-4 shadow-sm">
            <div className="border-b-[0.5px] border-slate-100 pb-3">
              <h4 className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider">Upload Proofs</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Secure your tax receipts and Form 16 under draft folders</p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Tax Folder Category
                </label>
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border-[0.5px] border-slate-200 rounded-lg focus:outline-none"
                >
                  <option value="80C Proof">80C Proof (ELSS, PF receipts)</option>
                  <option value="80D Proof">80D Proof (Health Policy)</option>
                  <option value="Form 16">Form 16 (Salary Certificate)</option>
                  <option value="Rent Receipt">Rent Receipt / Landlord proof</option>
                  <option value="Home Loan Interest">Home Loan Sec 24b Certificate</option>
                  <option value="Other Proof">Other Exemption Proofs</option>
                </select>
              </div>

              {/* Drag drop area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-[1px] border-dashed border-slate-300 hover:border-[#1B3A6B] bg-slate-50 hover:bg-slate-100/50 rounded-xl p-6 text-center cursor-pointer transition-all space-y-2.5"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleDocumentUpload}
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg"
                />
                <Upload className="w-6 h-6 mx-auto text-slate-400" />
                <div>
                  <span className="text-xs font-semibold text-[#1B3A6B] block">Click to select files</span>
                  <span className="text-[10px] text-slate-400 mt-1 block">Supports PDF, PNG, JPG (Max 5MB)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Uploaded Files Table */}
          <div className="lg:col-span-2 bg-white border-[0.5px] border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center border-b-[0.5px] border-slate-100 pb-3 mb-4">
                <h4 className="text-xs font-bold text-[#1B3A6B] uppercase tracking-wider">Tax Vault Files</h4>
                <span className="text-[9px] font-mono bg-[#0F766E]/10 text-[#0F766E] px-2 py-0.5 rounded-full font-bold">
                  {documents.length} File(s)
                </span>
              </div>

              {documents.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <FileText className="w-8 h-8 mx-auto opacity-50" />
                  <p className="text-xs">No documents uploaded yet. Add Form 16 or medical bill receipts.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-[0.5px] border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="pb-2">File Name</th>
                        <th className="pb-2">Folder Category</th>
                        <th className="pb-2">Size</th>
                        <th className="pb-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-slate-100">
                      {documents.map((docItem) => (
                        <tr key={docItem.id} className="hover:bg-slate-50/50">
                          <td className="py-3 font-medium text-slate-800 flex items-center space-x-2">
                            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[150px]" title={docItem.name}>
                              {docItem.name}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className="text-[9px] font-bold bg-[#1B3A6B]/5 text-[#1B3A6B] px-2 py-0.5 rounded uppercase tracking-wider border border-[#1B3A6B]/10">
                              {docItem.type}
                            </span>
                          </td>
                          <td className="py-3 font-mono text-slate-500">{docItem.size}</td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => onDeleteDocument && onDeleteDocument(docItem.id)}
                              className="text-rose-500 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                              title="Delete proof"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs text-slate-500 flex items-start space-x-3 mt-6">
              <ShieldCheck className="w-5 h-5 text-[#0F766E] mt-0.5 shrink-0" />
              <div>
                <span className="font-bold text-slate-800 block">Bank-grade Secure Encryption</span>
                <p className="mt-1 leading-relaxed">
                  all uploaded investment proofs are fully encrypted client-side and saved to your secure personal sandbox. no tax details are ever sold or shared with any third parties.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. AI Tax Expert Panel */}
      {activeTab === "expert" && (
        <div className="bg-white border-[0.5px] border-slate-200 rounded-xl shadow-sm h-[550px] flex flex-col justify-between overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="bg-[#1B3A6B]/5 border-b border-slate-100 p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                F
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">Finia AI Tax Advisor</h4>
                <p className="text-[9px] text-[#0F766E] uppercase font-bold tracking-wider">Live Slabs Expert</p>
              </div>
            </div>
            <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full font-semibold">
              ● Online
            </span>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start space-x-3 max-w-[85%] ${
                  msg.sender === "user" ? "ml-auto flex-row-reverse space-x-reverse" : ""
                }`}
              >
                {msg.sender === "agent" && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-sm mt-0.5">
                    F
                  </div>
                )}
                <div>
                  <div
                    className={`rounded-2xl p-3.5 text-xs leading-relaxed shadow-sm ${
                      msg.sender === "user"
                        ? "bg-[#1B3A6B] text-white rounded-tr-none font-medium"
                        : "bg-white text-slate-700 border border-slate-150 rounded-tl-none"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  </div>
                  <span className="text-[8px] text-slate-400 mt-1 block px-1.5">{msg.timestamp}</span>
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex items-start space-x-3 max-w-[80%]">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-sm animate-pulse">
                  F
                </div>
                <div className="bg-white border border-slate-150 rounded-2xl rounded-tl-none p-3.5 text-xs shadow-sm flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100"></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Quick reply suggestions */}
          <div className="bg-white border-t border-slate-100 px-4 py-2 flex flex-wrap gap-1.5 shrink-0">
            {[
              "difference old vs new slabs?",
              "how to claim rent with no HRA?",
              "can I claim both HRA and home loan?",
              "when is advance tax deadline?"
            ].map((reply, i) => (
              <button
                key={i}
                onClick={() => handleSendChat(reply)}
                className="text-[10px] font-medium text-[#1B3A6B] hover:bg-slate-100 bg-slate-50 border-[0.5px] border-slate-200 px-3 py-1 rounded-full transition-all"
              >
                {reply}
              </button>
            ))}
          </div>

          {/* Input field */}
          <div className="bg-white border-t border-slate-100 p-4 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat(chatInput);
              }}
              className="flex items-center space-x-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about Sections, slabs, rent proofs, or TDS..."
                className="flex-1 px-4 py-2 bg-slate-50 border-[0.5px] border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#1B3A6B]"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="p-2 bg-[#1B3A6B] hover:bg-slate-800 disabled:opacity-40 text-white rounded-xl transition-all shadow-sm shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
