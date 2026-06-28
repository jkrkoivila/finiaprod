# Finia — Project Rules
 
## What this is
Finia is an AI-powered personal life OS for Indian users: manages
deadlines, money, and tax in one place via a conversational Gemini
agent. PWA, deployed on Firebase. Built for the Vibe2Ship hackathon.
 
## Tech stack (do not change without asking)
- React frontend, Node.js backend
- Gemini API — ALWAYS server-side, key in env GEMINI_API_KEY,
  NEVER exposed to client code
- Firebase Auth (Google sign-in only) + Firestore
- All Firestore data scoped to the signed-in user's UID
 
## Hard rules
- NEVER put hardcoded/mock/dummy data in components or useState
  defaults. Empty collections show ₹0 or —, never fake numbers.
- NEVER expose secrets (Gemini key, Firebase admin, OAuth secret)
  in client code.
- NEVER let a user grant themselves admin from the UI. Admin role
  is set manually in Firestore only.
- Bills are deduplicated by dedupeKey (issuer + last4 + statement
  month + totalDue), used as the Firestore doc ID.
- Encrypted bill PDFs are decrypted server-side IN MEMORY only;
  passwords never stored, only the per-bank format pattern.
- Every record derived from a document stores sourceDocumentId so
  deleting the file cascades and removes all its data.
- Never compute any total or vital from a document that is not fully
  imported. Partial data stays quarantined in 'needs review'.
- Respect admin feature flags from systemSettings/global everywhere.
 
## Brand
- Name: Finia. Tagline: Your AI for deadlines, money, and tax.
- Colors: Navy #1B3A6B, Pulse blue #2BA8E0 (accent only), Task blue
  #2563EB, Finance teal #0F766E, Tax purple #6D28D9, Crisis red
  #E24B4A, surface #F3F4F6.
- Logo: an ECG/pulse line in a navy rounded square, white dot at
  the highest peak.
- Font system-ui, weights 400/500 only, sentence case, flat design,
  0.5px borders, rounded corners 8-12px, no gradients or shadows.
 
## Tax
- FY 2025-26 (AY 2026-27). Slab values come from systemSettings so
  they can be updated without a code change.
 
## Verification
- After building any UI feature, test it in the browser and confirm
  it reads real Firestore data, not mocks.
- Confirm data persists across a page refresh.
