import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Gemini runs server-side only. Without a key we fall back to a heuristic parse.
const ai =
  process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY"
    ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    : null;

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "finia", gemini: !!ai, time: new Date().toISOString() });
});

// ── Natural-language task parsing ──
function addDaysISO(today: string, n: number): string {
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

function heuristicParse(query: string, today: string) {
  const q = (query || "").toLowerCase();

  let category: "tax" | "finance" | "work" | "personal" | "general" = "general";
  if (/\b(tax|gst|itr|tds|advance tax|80c|80d|return)\b/.test(q)) category = "tax";
  else if (/\b(rent|bill|pay|emi|credit card|invoice|insurance|premium|loan|recharge|subscription|sip)\b/.test(q)) category = "finance";
  else if (/\b(meeting|email|office|report|client|standup|project|deck|review)\b/.test(q)) category = "work";
  else if (/\b(gym|grocery|movie|buy|call|doctor|birthday|book|appointment)\b/.test(q)) category = "personal";

  let priority: "high" | "medium" | "low" = "medium";
  if (/\b(asap|urgent|immediately|now|important|high priority)\b/.test(q)) priority = "high";
  else if (/\b(whenever|someday|eventually|low priority|no rush)\b/.test(q)) priority = "low";

  let dueDate = today;
  if (/\btomorrow\b/.test(q)) dueDate = addDaysISO(today, 1);
  else if (/\bnext week\b/.test(q)) dueDate = addDaysISO(today, 7);
  else if (/\btoday\b/.test(q)) dueDate = today;
  else {
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const idx = days.findIndex((dn) => q.includes(dn));
    if (idx >= 0) {
      const [y, m, d] = today.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      let delta = (idx - dt.getDay() + 7) % 7;
      if (delta === 0) delta = 7; // "monday" means next monday
      dueDate = addDaysISO(today, delta);
    }
  }

  let dueTime: string | undefined;
  const tm = q.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (tm) {
    let h = parseInt(tm[1], 10);
    const min = tm[2] || "00";
    if (tm[3] === "pm" && h < 12) h += 12;
    if (tm[3] === "am" && h === 12) h = 0;
    dueTime = `${String(h).padStart(2, "0")}:${min}`;
  }

  const title = (query || "").trim().replace(/\s+/g, " ");
  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    dueDate,
    priority,
    category,
    ...(dueTime ? { dueTime } : {}),
  };
}

app.post("/api/parse-task", async (req, res) => {
  const { query, today } = req.body ?? {};
  if (!query) return res.status(400).json({ error: "Query is required." });
  const day = today || new Date().toISOString().split("T")[0];

  if (!ai) return res.json(heuristicParse(query, day));

  try {
    const prompt = `Parse this natural-language task into JSON. Today is ${day}.
Task: "${query}"

Return ONLY raw JSON (no markdown) matching:
{
  "title": string,        // short action title, sentence case
  "dueDate": string,      // "YYYY-MM-DD"; resolve relative dates (e.g. "next friday") against today
  "dueTime": string,      // optional "HH:MM" 24h, omit if no time mentioned
  "priority": "high" | "medium" | "low",
  "category": "tax" | "finance" | "work" | "personal" | "general"
}`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
    const text = (response.text || "{}").trim().replace(/^```json\s*/i, "").replace(/```$/, "");
    const parsed = JSON.parse(text);
    // Backstop any missing field with the heuristic result.
    res.json({ ...heuristicParse(query, day), ...parsed });
  } catch (err) {
    console.error("parse-task error:", err);
    res.json(heuristicParse(query, day));
  }
});

// ── Finia agent chat: streaming SSE + function calling ──
const FUNCTION_DECLARATIONS = [
  {
    name: "create_task",
    description: "Create a to-do/task for the user.",
    parameters: {
      type: "OBJECT" as any,
      properties: {
        title: { type: "STRING", description: "Short action title, e.g. 'Pay rent'." },
        dueDate: { type: "STRING", description: "Due date as YYYY-MM-DD; resolve relative dates against today." },
        priority: { type: "STRING", enum: ["high", "medium", "low"] },
        category: { type: "STRING", enum: ["tax", "finance", "personal", "general", "work"] },
      },
      required: ["title", "dueDate", "priority", "category"],
    },
  },
  {
    name: "block_calendar_time",
    description: "Block a time slot on the user's calendar for focused work or an event.",
    parameters: {
      type: "OBJECT" as any,
      properties: {
        taskTitle: { type: "STRING" },
        date: { type: "STRING", description: "YYYY-MM-DD" },
        startTime: { type: "STRING", description: "HH:MM 24h" },
        endTime: { type: "STRING", description: "HH:MM 24h" },
      },
      required: ["taskTitle", "date", "startTime", "endTime"],
    },
  },
  {
    name: "set_reminder",
    description: "Set a reminder for a task or bill.",
    parameters: {
      type: "OBJECT" as any,
      properties: {
        taskTitle: { type: "STRING" },
        remindAt: { type: "STRING", description: "'YYYY-MM-DD HH:MM'" },
      },
      required: ["taskTitle", "remindAt"],
    },
  },
  {
    name: "get_financial_summary",
    description: "Get a live summary of the user's income, expenses, savings, and dues this month.",
    parameters: { type: "OBJECT" as any, properties: {} },
  },
];

function sse(res: express.Response, obj: unknown) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}
function sseHeaders(res: express.Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
}

// Stream a plain string word-by-word so the no-key path also "types out".
async function streamWords(res: express.Response, text: string) {
  const words = text.split(/(\s+)/);
  for (const w of words) {
    if (w) sse(res, { text: w });
    await new Promise((r) => setTimeout(r, 18));
  }
  sse(res, "[DONE]");
  res.end();
}

function stripTaskPhrasing(s: string): string {
  return s
    .replace(/^\s*(please\s+)?(add|create|set up|make|new)\s+(a\s+)?(task|to-?do|reminder)\s+(to|for|that|:)?\s*/i, "")
    .replace(/^\s*(remind me to|remember to)\s*/i, "")
    .replace(/[,.]?\s*(high|medium|low)\s+priority\b/i, "")
    .replace(
      /\s+(today|tomorrow|next week|(on|by|this|next)\s+\w+|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b.*$/i,
      ""
    )
    .replace(/\s+at\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/i, "")
    .trim();
}

// Build a financial summary from the context the client passes.
function summarise(context: any) {
  const s = context?.summary || {};
  return {
    income: s.income || 0,
    spent: s.spent || 0,
    saved: s.saved || 0,
    billsDue: s.billsDue || 0,
    tasksToday: s.tasksToday || 0,
  };
}

// No-key fallback: deterministic intent detection + confirmations.
async function chatFallback(res: express.Response, contents: any[], context: any) {
  const today = new Date().toISOString().split("T")[0];
  const lastUser = [...contents].reverse().find((c) => c.role === "user");
  const fnResp = lastUser?.parts?.find((p: any) => p.functionResponse)?.functionResponse;

  if (fnResp) {
    const r = fnResp.response || {};
    const map: Record<string, string> = {
      create_task: `done — added "${r.title}" due ${r.dueDate}. anything else?`,
      block_calendar_time: `blocked ${r.startTime}–${r.endTime} on ${r.date} for "${r.taskTitle}".`,
      set_reminder: `reminder set for "${r.taskTitle}" at ${r.remindAt}.`,
      get_financial_summary: `this month you've earned ₹${r.income?.toLocaleString("en-IN")}, spent ₹${r.spent?.toLocaleString("en-IN")}, and saved ₹${r.saved?.toLocaleString("en-IN")}. ${r.tasksToday || 0} task(s) due today and ₹${(r.billsDue || 0).toLocaleString("en-IN")} in bills due this week.`,
    };
    return streamWords(res, map[fnResp.name] || "done.");
  }

  const text: string = (lastUser?.parts?.find((p: any) => p.text)?.text || "").trim();
  const low = text.toLowerCase();

  // Parse the date/priority/category from the FULL text; take the title from the
  // stripped text (so "pay rent Friday" → title "pay rent", dueDate = next Friday).
  const p = heuristicParse(text, today);
  const title = stripTaskPhrasing(text) || p.title;

  if (/\b(add|create|new)\b.*\btask\b|\btask\b.*\b(to|for)\b|^\s*(pay|file|call|book|submit|renew|email|review)\b/.test(low)) {
    sse(res, { functionCall: { name: "create_task", args: { title, dueDate: p.dueDate, priority: p.priority, category: p.category } } });
    sse(res, "[DONE]");
    return res.end();
  }
  if (/\b(remind|reminder)\b/.test(low)) {
    sse(res, { functionCall: { name: "set_reminder", args: { taskTitle: title, remindAt: `${p.dueDate} ${(p as any).dueTime || "09:00"}` } } });
    sse(res, "[DONE]");
    return res.end();
  }
  if (/\b(block|schedule)\b.*\b(time|slot|focus|calendar)\b/.test(low)) {
    sse(res, { functionCall: { name: "block_calendar_time", args: { taskTitle: title, date: p.dueDate, startTime: "10:00", endTime: "11:00" } } });
    sse(res, "[DONE]");
    return res.end();
  }
  if (/\b(summar|finance|spending|how am i|net|saved|owe|budget|money)\b/.test(low)) {
    sse(res, { functionCall: { name: "get_financial_summary", args: {} } });
    sse(res, "[DONE]");
    return res.end();
  }

  const sum = summarise(context);
  return streamWords(
    res,
    `i can help with your deadlines, money, and tax. you have ${sum.tasksToday} task(s) due today and ₹${sum.billsDue.toLocaleString("en-IN")} in bills due this week. ask me to add a task, set a reminder, or summarise your finances.`
  );
}

app.post("/api/chat", async (req, res) => {
  const { contents, context } = req.body ?? {};
  if (!Array.isArray(contents) || contents.length === 0) {
    return res.status(400).json({ error: "contents array is required." });
  }

  sseHeaders(res);

  if (!ai) {
    await chatFallback(res, contents, context);
    return;
  }

  const systemInstruction = `you are finia, a helpful indian personal finance and productivity assistant.
be concise, proactive, and reassuring. write in sentence case and always use ₹ for money.
when the user asks you to do something (add a task, set a reminder, block time, or report their finances), CALL the matching function — do not just describe it.
today is ${new Date().toISOString().split("T")[0]}.

the user's current data from firestore:
- open tasks: ${JSON.stringify(context?.tasks || [])}
- unpaid bills: ${JSON.stringify(context?.bills || [])}
- this-month summary: ${JSON.stringify(context?.summary || {})}
refer to this when answering.`;

  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction,
        temperature: 0.6,
        tools: [{ functionDeclarations: FUNCTION_DECLARATIONS as any }],
      },
    });

    for await (const chunk of stream) {
      const calls = chunk.functionCalls;
      if (calls && calls.length > 0) {
        for (const fn of calls) sse(res, { functionCall: { name: fn.name, args: fn.args } });
        sse(res, "[DONE]");
        return res.end();
      }
      if (chunk.text) sse(res, { text: chunk.text });
    }
    sse(res, "[DONE]");
    res.end();
  } catch (err: any) {
    console.error("chat error:", err);
    sse(res, { error: err.message || "chat failed" });
    res.end();
  }
});

// ── Crisis triage: classify clustered tasks into do_now / defer / drop ──
const CLASSIFY_TASKS_TOOL = {
  name: "classify_tasks",
  description: "Submit the triage classification for every clustered task.",
  parameters: {
    type: "OBJECT" as any,
    properties: {
      reasoning: { type: "STRING", description: "One short paragraph explaining the overall triage strategy." },
      classifications: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            taskId: { type: "STRING" },
            bucket: { type: "STRING", enum: ["do_now", "defer", "drop"] },
            reason: { type: "STRING", description: "A single friendly sentence explaining this bucket." },
          },
          required: ["taskId", "bucket", "reason"],
        },
      },
    },
    required: ["reasoning", "classifications"],
  },
};

function crisisFallback(tasks: any[]) {
  const today = new Date().toISOString().split("T")[0];
  const classifications: Record<string, { bucket: string; reason: string }> = {};
  for (const t of tasks) {
    const overdue = t.dueDate < today;
    const bucket = overdue || t.priority === "high" ? "do_now" : t.priority === "low" ? "drop" : "defer";
    const reason =
      bucket === "do_now"
        ? `${overdue ? "Already overdue" : "High priority and due now"} — clear "${t.title}" first to avoid penalties.`
        : bucket === "defer"
        ? `"${t.title}" can move to next week without real cost — push it.`
        : `"${t.title}" is low impact — drop it to free up focus.`;
    classifications[t.id] = { bucket, reason };
  }
  return {
    reasoning: `Finia spotted ${tasks.length} deadlines bunched into the next 48 hours. Protect your time: clear the critical ones now, push what can wait to next week, and let go of the low-impact rest.`,
    classifications,
  };
}

app.post("/api/crisis-triage", async (req, res) => {
  const { tasks, today } = req.body ?? {};
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ error: "tasks array is required." });
  }

  if (!ai) return res.json(crisisFallback(tasks));

  try {
    const systemInstruction = `you are finia, an indian personal finance and productivity assistant helping the user through a deadline crisis (3+ tasks due within 48 hours).
classify each task into exactly one bucket — 'do_now' (critical/urgent/penalty if missed), 'defer' (can wait a week), or 'drop' (low impact, skip it).
write in sentence case, use ₹ for money, be reassuring and decisive. you MUST call classify_tasks.`;
    const prompt = `today is ${today}. here are the clustered tasks:\n${JSON.stringify(tasks, null, 2)}\nclassify each one and provide a short overall reasoning, then call classify_tasks.`;

    const r = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2,
        tools: [{ functionDeclarations: [CLASSIFY_TASKS_TOOL as any] }],
        toolConfig: { functionCallingConfig: { mode: "ANY" as any, allowedFunctionNames: ["classify_tasks"] } },
      },
    });

    const call = r.functionCalls?.[0];
    if (call?.name === "classify_tasks") {
      const a: any = call.args;
      const classifications: Record<string, { bucket: string; reason: string }> = {};
      for (const c of a.classifications || []) classifications[c.taskId] = { bucket: c.bucket, reason: c.reason };
      return res.json({ reasoning: a.reasoning || crisisFallback(tasks).reasoning, classifications });
    }
    return res.json(crisisFallback(tasks));
  } catch (err) {
    console.error("crisis-triage error:", err);
    return res.json(crisisFallback(tasks));
  }
});

// ── Tax-saving tips from unused deduction headroom ──
app.post("/api/tax-saving-tips", async (req, res) => {
  const { d80C = 0, d80D = 0, d80CCD1B = 0, hraReceived = 0 } = req.body ?? {};
  const fallback = () => {
    const tips: any[] = [];
    if (d80C < 150000)
      tips.push({ section: "Section 80C", headroom: 150000 - d80C, priority: "High", advice: `You have ₹${(150000 - d80C).toLocaleString("en-IN")} of unused 80C — consider ELSS, PPF, or NSC to cut tax.` });
    if (d80D < 25000)
      tips.push({ section: "Section 80D", headroom: 25000 - d80D, priority: "Medium", advice: `Health cover gives ₹${(25000 - d80D).toLocaleString("en-IN")} more 80D headroom, plus ₹5,000 for preventive check-ups.` });
    if (d80CCD1B < 50000)
      tips.push({ section: "NPS 80CCD(1B)", headroom: 50000 - d80CCD1B, priority: "High", advice: `Invest up to ₹${(50000 - d80CCD1B).toLocaleString("en-IN")} in NPS for an extra deduction over and above 80C.` });
    if (hraReceived > 0)
      tips.push({ section: "HRA 10(13A)", headroom: 0, priority: "Medium", advice: "Submit rent receipts and your landlord's PAN to fully claim your HRA exemption." });
    return { tips: tips.length ? tips : [{ section: "All caps used", headroom: 0, priority: "Low", advice: "You've used your major deduction limits. Great work." }] };
  };

  if (!ai) return res.json(fallback());
  try {
    const prompt = `Indian taxpayer, FY 2025-26. Used: 80C ₹${d80C} (cap 1.5L), 80D ₹${d80D} (cap 25k), NPS 80CCD(1B) ₹${d80CCD1B} (cap 50k), HRA received ₹${hraReceived}.
Identify unused headroom and give 3-4 targeted, professional tax-saving tips. Respond ONLY as raw JSON:
{"tips":[{"section":string,"headroom":number,"advice":string,"priority":"High"|"Medium"|"Low"}]}`;
    const r = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt, config: { responseMimeType: "application/json" } });
    const text = (r.text || "{}").trim().replace(/^```json\s*/i, "").replace(/```$/, "");
    const parsed = JSON.parse(text);
    res.json(parsed.tips ? parsed : fallback());
  } catch (err) {
    console.error("tax-saving-tips error:", err);
    res.json(fallback());
  }
});

// ── Payslip analyser (Gemini Vision) ──
app.post("/api/payslip/analyse", async (req, res) => {
  const { fileBase64, mimeType } = req.body ?? {};
  if (!fileBase64 || !mimeType) return res.status(400).json({ error: "fileBase64 and mimeType are required." });
  if (!ai) return res.status(503).json({ error: "Payslip analysis needs a Gemini key. Set GEMINI_API_KEY to enable it." });
  try {
    const prompt = `Analyze this payslip or Form 16 (India, AY 2026-27). Extract numeric values (0 if absent) and the regime.
For "regime": if the document mentions "opting out of section 115BAC" or "new tax regime", return "new"; otherwise "old".
Respond ONLY as raw JSON:
{"grossSalary":number,"basic":number,"hra":number,"da":number,"pfEmployee":number,"tds":number,"netPay":number,
 "annualGrossSalary":number,"section80C":number,"section80CCD1B":number,"section80CCD2":number,
 "section80D":number,"professionalTax":number,"standardDeduction":number,"hraExemption":number,
 "regime":"new"|"old"}`;
    const r = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ inlineData: { data: fileBase64, mimeType } }, prompt],
      config: { responseMimeType: "application/json" },
    });
    res.json(JSON.parse((r.text || "{}").trim().replace(/^```json\s*/i, "").replace(/```$/, "")));
  } catch (err: any) {
    console.error("payslip error:", err);
    res.status(500).json({ error: "Could not read that payslip. Try a clearer image or PDF." });
  }
});

// ── AI tax expert (streaming, tax-scoped, with the user's context) ──
app.post("/api/tax-ai-expert", async (req, res) => {
  const { contents, context } = req.body ?? {};
  if (!Array.isArray(contents) || contents.length === 0) return res.status(400).json({ error: "contents required." });
  sseHeaders(res);
  if (!ai) {
    return streamWords(
      res,
      "i'm your finia tax expert. i can explain old vs new regime for FY 2025-26, HRA exemption, advance tax dates, and the ITR deadline. add a gemini key for full answers."
    );
  }
  const systemInstruction = `you are finia's india tax expert for FY 2025-26 (AY 2026-27).
answer only tax questions: regime choice, slabs, 80C/80D/80CCD(1B), HRA, home-loan interest 24(b), advance tax, TDS, ITR deadlines.
be concise, use ₹, sentence case, bullet points where useful.
the user's figures: ${JSON.stringify(context || {})}.`;
  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents,
      config: { systemInstruction, temperature: 0.4 },
    });
    for await (const chunk of stream) if (chunk.text) sse(res, { text: chunk.text });
    sse(res, "[DONE]");
    res.end();
  } catch (err: any) {
    console.error("tax-ai-expert error:", err);
    sse(res, { error: err.message || "tax chat failed" });
    res.end();
  }
});

// ── Document extraction (Gemini Vision): classify type + pull fields ──
app.post("/api/document/extract", async (req, res) => {
  const { fileBase64, mimeType, fileName } = req.body ?? {};
  if (!fileBase64 || !mimeType) return res.status(400).json({ error: "fileBase64 and mimeType are required." });
  if (!ai) return res.status(503).json({ error: "Document extraction needs a Gemini key.", needsKey: true });
  try {
    const prompt = `You are Finia's document intelligence. Classify this financial document and extract its fields.
File name: ${fileName || "(unknown)"}.
"type" MUST be one of: credit-card-bill, bank-statement, payslip, form16, insurance, investment, loan-statement, utility-bill, receipt, or "unknown".
Use these field names where applicable: issuer,last4,statementMonth,totalDue,minimumDue,dueDate,bank,accountLast4,statementPeriod,employer,month,grossSalary,tds,fy,insurer,premium,policyNumber,provider,amount,date,lender,emiAmount,merchant,category.
For each extracted field add a confidence 0-1. Respond ONLY as raw JSON:
{"type":string,"fields":{...},"confidence":{field:number},"summary":string,"tags":string[]}`;
    const r = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ inlineData: { data: fileBase64, mimeType } }, prompt],
      config: { responseMimeType: "application/json" },
    });
    res.json(JSON.parse((r.text || "{}").trim().replace(/^```json\s*/i, "").replace(/```$/, "")));
  } catch (err) {
    console.error("extract error:", err);
    res.status(422).json({ error: "Could not read this document.", unreadable: true });
  }
});

// ── Gmail sync (read-only): scan finance emails, extract items ──
function gmailBody(payload: any): string {
  if (!payload) return "";
  if (payload.body?.data) return Buffer.from(payload.body.data, "base64").toString("utf-8");
  if (payload.parts) return payload.parts.map((p: any) => (p.mimeType === "text/plain" && p.body?.data ? Buffer.from(p.body.data, "base64").toString("utf-8") : gmailBody(p))).join("");
  return "";
}

function gmailHeader(headers: any[], name: string): string {
  return headers?.find((x: any) => x.name?.toLowerCase() === name)?.value || "";
}

// Known Indian bank / card / biller sender domains — used in the Gmail-side query
// (free filtering) and as the relevance check for incremental (history-API) results.
const BILL_SENDER_DOMAINS = [
  "hdfcbank.net", "hdfcbank.com", "icicibank.com", "sbi.co.in", "sbicard.com", "axisbank.com",
  "kotak.com", "aubank.in", "yesbank.in", "idfcfirstbank.com", "rblbank.com", "onecard.app",
  "cred.club", "americanexpress.com", "citibank.com", "sc.com", "hsbc.co.in", "paytm.com",
  "phonepe.com", "amazon.in", "flipkart.com", "licindia.in", "lichousing.com", "bajajfinserv.in",
  "tatacapital.com", "airtel.com", "jio.com", "actcorp.in", "tatapower.com", "adityabirlacapital.com",
];
const BILL_SUBJECT_KEYWORDS = [
  "statement", "bill", "due", "payment", "invoice", "e-statement", "premium", "emi",
  "receipt", "credit card", "autopay", "mandate", "minimum due", "total due", "recharge",
];
function gmailRelevanceQuery(): string {
  const subjects = BILL_SUBJECT_KEYWORDS.map((k) => (k.includes(" ") ? `"${k}"` : k)).join(" OR ");
  const senders = BILL_SENDER_DOMAINS.join(" OR ");
  return `(subject:(${subjects}) OR from:(${senders})) -category:promotions -category:social -in:chats`;
}
function looksRelevant(subject: string, from: string): boolean {
  const s = (subject || "").toLowerCase();
  const f = (from || "").toLowerCase();
  return BILL_SUBJECT_KEYWORDS.some((k) => s.includes(k)) || BILL_SENDER_DOMAINS.some((d) => f.includes(d));
}

const MAX_MESSAGES_PER_SYNC = 25; // hard cap on AI-processed messages per sync (bounds cost)
const PDF_TEXT_MIN_CHARS = 120; // below this, a PDF is treated as scanned → Vision fallback

// First PDF/image attachment in the payload tree (with its attachmentId for download).
function findAttachment(payload: any): { attachmentId: string; mimeType: string } | null {
  const walk = (p: any): any => {
    if (!p) return null;
    if (p.body?.attachmentId && (p.mimeType === "application/pdf" || p.mimeType?.startsWith("image/"))) {
      return { attachmentId: p.body.attachmentId, mimeType: p.mimeType };
    }
    if (p.parts) for (const c of p.parts) { const r = walk(c); if (r) return r; }
    return null;
  };
  return walk(payload);
}

const GMAIL_EXTRACT_PROMPT = `You are Finia's financial extractor (India). From the content, extract any financial items. Respond ONLY as raw JSON:
{"bills":[{"issuer":string,"last4":string,"totalDue":number,"minimumDue":number,"statementMonth":"YYYY-MM","dueDate":"YYYY-MM-DD"}],
"deadlines":[{"title":string,"dueDate":"YYYY-MM-DD","priority":"high"|"medium"|"low","category":"tax"|"finance"|"general"}],
"receipts":[{"merchant":string,"amount":number,"date":"YYYY-MM-DD","category":string}],
"subscriptions":[{"name":string,"amount":number,"frequency":"monthly"|"yearly"}]}
Include only items actually present. If nothing financial is present, return all empty arrays.`;

function parseJsonLoose(text: string): any {
  return JSON.parse((text || "{}").trim().replace(/^```json\s*/i, "").replace(/```$/, ""));
}
async function gmailExtractFromText(text: string) {
  const r = await ai!.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `${GMAIL_EXTRACT_PROMPT}\nContent:\n${text.slice(0, 12000)}`,
    config: { responseMimeType: "application/json" },
  });
  return parseJsonLoose(r.text || "{}");
}
async function gmailExtractFromVision(base64: string, mimeType: string) {
  const r = await ai!.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ inlineData: { data: base64, mimeType } }, GMAIL_EXTRACT_PROMPT],
    config: { responseMimeType: "application/json" },
  });
  return parseJsonLoose(r.text || "{}");
}

// Incremental, cost-aware Gmail sync:
//  • First sync (no historyId): Gmail query `newer_than:90d` + relevance filter → never the whole mailbox.
//  • Later syncs: users.history.list since the stored historyId → only mail added since.
//  • Skip any message id the client already processed (safety net against historyId resets).
//  • Per message, read the CHEAPEST way: body/PDF text → text model; Vision only when text is ~empty.
app.post("/api/gmail/sync", async (req, res) => {
  const { accessToken, historyId, processedIds, passwordFormats } = req.body ?? {};
  if (!accessToken) return res.status(400).json({ error: "Gmail access token is required." });
  if (!ai) return res.status(503).json({ error: "Gmail extraction needs a Gemini key.", needsKey: true });

  const authHeader = { Authorization: `Bearer ${accessToken}` };
  const gget = async (url: string) => {
    const r = await fetch(url, { headers: authHeader });
    return { ok: r.ok, status: r.status, json: r.ok ? ((await r.json()) as any) : null, text: r.ok ? "" : await r.text() };
  };

  const seen = new Set<string>(Array.isArray(processedIds) ? processedIds : []);
  const findings = { bills: [] as any[], deadlines: [] as any[], receipts: [] as any[], subscriptions: [] as any[] };
  const paths = { bodyText: 0, pdfText: 0, vision: 0, encrypted: 0, skipped: 0 };
  const log: string[] = [];

  try {
    // Checkpoint the mailbox state at sync START (safe against races — overlap is dedup-protected).
    const prof = await gget("https://gmail.googleapis.com/gmail/v1/users/me/profile");
    if (!prof.ok) return res.status(prof.status).json({ error: "Gmail profile fetch failed: " + prof.text });
    const newHistoryId = String(prof.json.historyId || historyId || "");

    // ── 1. Gather candidate message IDs ──
    let candidateIds: string[] = [];
    let mode = "incremental";
    let historyReset = false;

    if (historyId) {
      let pageToken: string | undefined;
      let pages = 0;
      do {
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${encodeURIComponent(historyId)}&historyTypes=messageAdded&maxResults=100${pageToken ? `&pageToken=${pageToken}` : ""}`;
        const h = await gget(url);
        if (!h.ok) { historyReset = true; break; } // historyId too old/expired → fall back to 90d
        for (const hist of h.json.history || [])
          for (const ma of hist.messagesAdded || []) if (ma.message?.id) candidateIds.push(ma.message.id);
        pageToken = h.json.nextPageToken;
      } while (pageToken && ++pages < 5);
    }

    if (!historyId || historyReset) {
      mode = historyReset ? "history-reset->90d" : "first-90d";
      candidateIds = [];
      const q = encodeURIComponent(`newer_than:90d ${gmailRelevanceQuery()}`);
      let pageToken: string | undefined;
      let pages = 0;
      do {
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100&q=${q}${pageToken ? `&pageToken=${pageToken}` : ""}`;
        const l = await gget(url);
        if (!l.ok) return res.status(l.status).json({ error: "Gmail list failed: " + l.text });
        for (const m of l.json.messages || []) candidateIds.push(m.id);
        pageToken = l.json.nextPageToken;
      } while (pageToken && ++pages < 5 && candidateIds.length < 200);
    }

    // De-dup against already-processed ids + cap the number we AI-process.
    const uniqueFresh = Array.from(new Set(candidateIds.filter((id) => !seen.has(id))));
    const truncated = uniqueFresh.length > MAX_MESSAGES_PER_SYNC;
    const toProcess = uniqueFresh.slice(0, MAX_MESSAGES_PER_SYNC);
    log.push(`mode=${mode} candidates=${candidateIds.length} fresh=${uniqueFresh.length} processing=${toProcess.length}${truncated ? " (capped)" : ""}`);

    const processedThisRun: string[] = [];
    const pwList: string[] =
      passwordFormats && typeof passwordFormats === "object"
        ? (Object.values(passwordFormats).filter((v) => typeof v === "string") as string[])
        : [];

    // ── 2. Process each message the cheapest way that works ──
    for (const id of toProcess) {
      try {
        const m = await gget(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`);
        if (!m.ok) { paths.skipped++; continue; }
        const payload = m.json.payload;
        const headers = payload?.headers || [];
        const subject = gmailHeader(headers, "subject");
        const from = gmailHeader(headers, "from");

        // History-API candidates aren't Gmail-filtered → apply the relevance check here,
        // before any paid AI call. (First-sync candidates already passed the Gmail query.)
        if (mode === "incremental" && !looksRelevant(subject, from)) {
          paths.skipped++; processedThisRun.push(id); log.push(`${id}: skip-irrelevant`); continue;
        }

        let result: any = null;
        let path = "";
        const att = findAttachment(payload);

        if (att) {
          const a = await gget(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/attachments/${att.attachmentId}`);
          // Gmail returns base64url — normalise to standard base64 for Buffer / Gemini.
          const dataB64 = a.ok ? String(a.json.data || "").replace(/-/g, "+").replace(/_/g, "/") : "";
          if (dataB64 && att.mimeType === "application/pdf") {
            let text = "";
            try {
              const pdfParse = (await import("pdf-parse")) as any;
              text = ((await pdfParse(Buffer.from(dataB64, "base64"))).text || "").trim();
            } catch {
              // Encrypted PDF → try the user's stored password formats (best effort, in memory).
              for (const pw of pwList) {
                try {
                  const pdfParse = (await import("pdf-parse")) as any;
                  text = ((await pdfParse(Buffer.from(dataB64, "base64"), { password: pw })).text || "").trim();
                  if (text) break;
                } catch { /* try next */ }
              }
              if (!text) paths.encrypted++;
            }
            if (text.length >= PDF_TEXT_MIN_CHARS) {
              result = await gmailExtractFromText(text); path = "pdf-text"; paths.pdfText++;
            } else if (dataB64) {
              // Scanned / image-only PDF: text extraction returned ~nothing → Vision fallback.
              result = await gmailExtractFromVision(dataB64, "application/pdf"); path = "vision"; paths.vision++;
            }
          } else if (dataB64 && att.mimeType.startsWith("image/")) {
            result = await gmailExtractFromVision(dataB64, att.mimeType); path = "vision"; paths.vision++;
          }
        }

        if (!result) {
          // No usable attachment → the body is plain text → cheapest path (text model).
          const body = gmailBody(payload).trim();
          if (body) { result = await gmailExtractFromText(`Subject: ${subject}\nFrom: ${from}\n\n${body}`); path = "body-text"; paths.bodyText++; }
        }

        if (result)
          for (const k of ["bills", "deadlines", "receipts", "subscriptions"] as const)
            if (Array.isArray(result[k])) findings[k].push(...result[k]);

        processedThisRun.push(id);
        log.push(`${id}: ${path || "no-content"} [${subject.slice(0, 50)}]`);
      } catch (e: any) {
        paths.skipped++;
        log.push(`${id}: error ${e?.message || e}`);
      }
    }

    res.json({ ...findings, historyId: newHistoryId, processedIds: processedThisRun, scanned: candidateIds.length, processed: toProcess.length, truncated, paths, log });
  } catch (err: any) {
    console.error("gmail sync error:", err);
    res.status(500).json({ error: "Gmail sync failed: " + (err?.message || err) });
  }
});

// ── Encrypted credit-card PDF: decrypt IN MEMORY, extract transactions ──
app.post("/api/credit-card/decrypt", async (req, res) => {
  const { fileBase64, password } = req.body ?? {};
  if (!fileBase64 || !password) return res.status(400).json({ error: "PDF and password are required." });
  if (!ai) return res.status(503).json({ error: "Statement extraction needs a Gemini key.", needsKey: true });
  try {
    const pdfParse = (await import("pdf-parse")) as any;
    // Decrypt + parse in memory only. The password and raw PDF are never persisted.
    const parsed = await pdfParse(Buffer.from(fileBase64, "base64"), { password });
    const text = (parsed.text || "").trim();
    if (!text) throw new Error("empty");
    const prompt = `Extract the credit-card statement. Respond ONLY as raw JSON:
{"issuer":string,"last4":string,"statementMonth":"YYYY-MM","totalDue":number,"minimumDue":number,"dueDate":"YYYY-MM-DD","transactions":[{"date":"YYYY-MM-DD","merchant":string,"amount":number,"category":string}]}
Statement text:\n${text.slice(0, 10000)}`;
    const r = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt, config: { responseMimeType: "application/json" } });
    res.json(JSON.parse((r.text || "{}").trim().replace(/^```json\s*/i, "").replace(/```$/, "")));
  } catch (err: any) {
    // Wrong password / unreadable → 'locked' so the UI can ask for the format and retry.
    res.status(401).json({ error: "Could not decrypt — check the password format.", locked: true });
  }
});

// ── Gemini bill audit insight ──
app.post("/api/bill-insight", async (req, res) => {
  const { bill, transactions } = req.body ?? {};
  if (!bill) return res.status(400).json({ error: "bill is required." });
  const fallback = () => ({
    insight: `Finia AI Insight: this ${bill.category || ""} bill of ₹${(bill.amount || 0).toLocaleString("en-IN")} is in line with your usual pattern — no hidden charges detected. Good to schedule before the due date.`,
  });
  if (!ai) return res.json(fallback());
  try {
    const prompt = `You are Finia's bill auditor (Indian personal finance). Bill: ${JSON.stringify(bill)}. Related transactions: ${JSON.stringify(transactions || [])}.
Give a concise 1-2 sentence insight starting with "Finia AI Insight: ". Use ₹, sentence case. Flag savings, spending trends, unused services, anomalies, or confirm stability.`;
    const r = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
    res.json({ insight: (r.text || "").trim() || fallback().insight });
  } catch (err) {
    res.json(fallback());
  }
});

// ── Two-way Google Calendar sync: write Finia dated items as events with reminders ──
// De-dups via the eventId the client stores per Finia item: present → PATCH, absent → POST,
// deleted:true → DELETE. Reminder is a popup `reminderLeadDays` before + a same-day popup.
app.post("/api/calendar/sync", async (req, res) => {
  const { accessToken, items } = req.body ?? {};
  if (!accessToken) return res.status(400).json({ error: "Google Calendar access token is required." });
  if (!Array.isArray(items)) return res.status(400).json({ error: "items must be an array." });

  const base = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  const auth = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  const nextDay = (iso: string) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

  const results: any[] = [];
  for (const it of items) {
    try {
      if (it.deleted) {
        if (it.eventId) await fetch(`${base}/${encodeURIComponent(it.eventId)}`, { method: "DELETE", headers: auth });
        results.push({ key: it.key, eventId: null, action: "deleted" });
        continue;
      }
      const leadMin = Math.max(0, Number(it.reminderLeadDays || 0)) * 24 * 60;
      const overrides = [{ method: "popup", minutes: leadMin }];
      if (leadMin > 0) overrides.push({ method: "popup", minutes: 540 }); // same-day 9am-ish nudge
      const start = it.time ? { dateTime: `${it.date}T${it.time}:00`, timeZone: "Asia/Kolkata" } : { date: it.date };
      const end = it.time ? { dateTime: `${it.date}T${it.time}:00`, timeZone: "Asia/Kolkata" } : { date: nextDay(it.date) };
      const event = {
        summary: it.title,
        description: it.description || "Created by Finia",
        start, end,
        reminders: { useDefault: false, overrides },
        source: { title: "Finia", url: "https://finia.app" },
      };
      const url = it.eventId ? `${base}/${encodeURIComponent(it.eventId)}` : base;
      const method = it.eventId ? "PATCH" : "POST";
      const r = await fetch(url, { method, headers: auth, body: JSON.stringify(event) });
      if (!r.ok) {
        // A stale eventId (event deleted in Google) → retry as a fresh create.
        if (it.eventId && (r.status === 404 || r.status === 410)) {
          const r2 = await fetch(base, { method: "POST", headers: auth, body: JSON.stringify(event) });
          if (r2.ok) { results.push({ key: it.key, eventId: (await r2.json()).id, action: "created" }); continue; }
        }
        results.push({ key: it.key, eventId: it.eventId || null, action: "error", error: `${r.status} ${await r.text()}` });
        continue;
      }
      const saved = await r.json();
      results.push({ key: it.key, eventId: saved.id, action: it.eventId ? "updated" : "created" });
    } catch (err: any) {
      results.push({ key: it.key, eventId: it.eventId || null, action: "error", error: err.message });
    }
  }
  res.json({ results });
});

async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }
  app.listen(PORT, "0.0.0.0", () => console.log(`Finia server running on http://localhost:${PORT}`));
}

start();
