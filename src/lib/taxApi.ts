import type { TaxInputs } from "./tax";

export interface TaxTip {
  section: string;
  headroom: number;
  advice: string;
  priority: "High" | "Medium" | "Low";
}

export async function fetchTaxTips(inputs: TaxInputs): Promise<TaxTip[]> {
  const res = await fetch("/api/tax-saving-tips", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      d80C: inputs.d80C,
      d80D: inputs.d80D,
      d80CCD1B: inputs.d80CCD1B,
      hraReceived: inputs.hraReceived,
    }),
  });
  if (!res.ok) throw new Error("tips failed");
  const data = await res.json();
  return data.tips || [];
}

export interface PayslipData {
  grossSalary: number;
  basic: number;
  hra: number;
  da: number;
  pfEmployee: number;
  tds: number;
  netPay: number;
  annualGrossSalary: number;
  section80C?: number;
  section80CCD1B?: number;
  section80CCD2?: number;
  section80D?: number;
  professionalTax?: number;
  standardDeduction?: number;
  hraExemption?: number;
  regime?: "new" | "old";
}

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve({ base64: result.split(",")[1], mimeType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function analysePayslip(file: File): Promise<PayslipData> {
  const { base64, mimeType } = await fileToBase64(file);
  const res = await fetch("/api/payslip/analyse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileBase64: base64, mimeType }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Could not analyse payslip.");
  }
  return res.json();
}
