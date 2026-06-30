#!/usr/bin/env node
/**
 * Post-deploy smoke test for Finia's AI backend.
 *
 * Verifies the deployed (or local) server is up, reports which Gemini backend
 * it resolved, and exercises one real AI endpoint end-to-end. Exits non-zero on
 * any failure so it can gate a deploy / run in CI.
 *
 * Usage:
 *   node scripts/smoke-test.mjs [baseUrl]
 *   npm run smoke -- https://finiaapp--gen-lang-client-0144814356.asia-southeast1.hosted.app
 *   SMOKE_URL=http://localhost:3000 npm run smoke
 *
 * Needs Node 18+ (global fetch). No dependencies.
 */

const BASE = (process.argv[2] || process.env.SMOKE_URL ||
  "https://finiaapp--gen-lang-client-0144814356.asia-southeast1.hosted.app").replace(/\/+$/, "");

const TIMEOUT_MS = 30_000;
let failures = 0;

const c = { gray: "\x1b[90m", green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m", bold: "\x1b[1m", reset: "\x1b[0m" };
const pass = (m) => console.log(`${c.green}✓${c.reset} ${m}`);
const fail = (m) => { failures++; console.log(`${c.red}✗ ${m}${c.reset}`); };
const info = (m) => console.log(`${c.gray}  ${m}${c.reset}`);

function withTimeout(promise, ms, label) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(t), label };
}

// ── 1. Health ─────────────────────────────────────────────────────────────
async function checkHealth() {
  console.log(`${c.bold}1. /api/health${c.reset}`);
  const t = withTimeout(null, TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/api/health`, { signal: t.signal });
    t.done();
    if (!res.ok) return fail(`health returned HTTP ${res.status}`);
    const body = await res.json();
    if (body.status !== "ok") return fail(`status was "${body.status}"`);
    pass(`server up — backend=${c.bold}${body.backend}${c.reset}, gemini=${body.gemini}`);
    if (!body.gemini) fail("gemini is false — no usable AI credentials (calls will fall back)");
    else if (body.backend === "none") fail("backend resolved to none");
    else if (body.backend !== "vertex") info(`note: backend is "${body.backend}" (expected "vertex" in production)`);
    return body;
  } catch (e) {
    t.done();
    return fail(`health unreachable: ${e.name === "AbortError" ? "timed out" : e.message}`);
  }
}

// ── 2. A non-streaming AI endpoint (parse-task) ─────────────────────────────
async function checkParseTask() {
  console.log(`${c.bold}2. /api/parse-task${c.reset}`);
  const t = withTimeout(null, TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/api/parse-task`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "pay electricity bill 2400 next monday", today: new Date().toISOString().slice(0, 10) }),
      signal: t.signal,
    });
    t.done();
    if (!res.ok) return fail(`parse-task returned HTTP ${res.status}`);
    const body = await res.json();
    if (!body.title || !body.dueDate) return fail(`missing title/dueDate: ${JSON.stringify(body)}`);
    pass(`parsed → "${body.title}" · ${body.dueDate} · ${body.category}/${body.priority}`);
  } catch (e) {
    t.done();
    fail(`parse-task failed: ${e.name === "AbortError" ? "timed out" : e.message}`);
  }
}

// ── 3. The streaming chat endpoint (SSE) ────────────────────────────────────
async function checkChat() {
  console.log(`${c.bold}3. /api/chat (SSE)${c.reset}`);
  const t = withTimeout(null, TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "in one short sentence, what can you help me with?" }] }],
        context: { tasks: [], bills: [], summary: {} },
      }),
      signal: t.signal,
    });
    if (!res.ok) { t.done(); return fail(`chat returned HTTP ${res.status}`); }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "", text = "", streamErr = null, sawFnCall = false;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (!raw) continue;
        let payload;
        try { payload = JSON.parse(raw); } catch { continue; }
        if (payload === "[DONE]") { /* stream end */ }
        else if (payload?.error) streamErr = payload.error;
        else if (payload?.functionCall) sawFnCall = true;
        else if (payload?.text) text += payload.text;
      }
    }
    t.done();
    if (streamErr) return fail(`chat streamed an error: "${streamErr}"`);
    if (sawFnCall) return pass("chat responded with a function call (valid agent behaviour)");
    if (!text.trim()) return fail("chat produced no text");
    pass(`chat replied: "${text.trim().slice(0, 80)}${text.length > 80 ? "…" : ""}"`);
  } catch (e) {
    t.done();
    fail(`chat failed: ${e.name === "AbortError" ? "timed out" : e.message}`);
  }
}

// ── Run ─────────────────────────────────────────────────────────────────────
console.log(`\n${c.bold}Finia smoke test${c.reset} → ${c.yellow}${BASE}${c.reset}\n`);
await checkHealth();
await checkParseTask();
await checkChat();

console.log("");
if (failures === 0) {
  console.log(`${c.green}${c.bold}PASS${c.reset} — all checks green.`);
  process.exit(0);
} else {
  console.log(`${c.red}${c.bold}FAIL${c.reset} — ${failures} check(s) failed.`);
  process.exit(1);
}
