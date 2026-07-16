# CanvasRx — Prototype Build Task List (for Claude Code)

Scope: clickable prototype, mock AI/data, no real backend/vector DB/LLM calls yet.
Stack: Next.js + Tailwind + shadcn/ui + React Flow (xyflow) for the canvas, client-side state only.
See README.md for how this relates to the PRD, and CanvasRx_DESIGN_GUIDELINES.md before writing UI code.

## Phase 0 — Project Setup
- [ ] Init Next.js app (App Router) + Tailwind + shadcn/ui (`--radius: 4px`, tokens from CanvasRx_DESIGN_GUIDELINES.md)
- [ ] Install `reactflow` (xyflow)
- [ ] Load fonts: IBM Plex Mono + Inter via `next/font/google`
- [ ] Create `mockAI.ts`: fake async functions with 500–1500ms artificial delay:
      - `getInitialCanvas(chatText)` — returns Source node + AI's first-pass proactive
        highlights/branches (suggestion + counter-argument node pairs, some with A/B/C options)
      - `getNodeResponse(nodeId, commentText)` — returns a new revision node (v2, v3, ...)
      - `getOptionResponse(nodeId, selectedOption)` — returns the branch for a picked A/B/C option
- [ ] Shared TypeScript types: `SourceNode`, `RecommendationNode`, `CounterArgNode`,
      `RevisionNode` (with `previousVersionId` for collapsed history), `OptionSet`
- [ ] **Single-page app, no routing.** One `step: 'chat' | 'canvas' | 'dashboard'`
      state variable drives which screen renders; no `/chat`, `/canvas`, `/dashboard`
      routes. Refreshing the page resets to `'chat'` — acceptable for this prototype
      pass since there's no persistence yet.

## Phase 1 — Chat Entry Screen
- [ ] One-shot chat input (`Textarea` + `Button`, NOT a persistent chat thread)
- [ ] Background: faint cold-orange grid texture per DESIGN_GUIDELINES Section 4
      (entry screen only — do not carry this texture into canvas/dashboard)
- [ ] On submit: call `mockAI.getInitialCanvas`, show loading state, then transition to canvas

## Phase 2 — Canvas: Source Node & Proactive AI
- [ ] React Flow canvas, pan/zoom, dashed "doctor's-note" edges (DESIGN_GUIDELINES Section 3)
- [ ] Source node renders the raw chat text
- [ ] On canvas load, AI has already highlighted key segments in the Source node and
      placed suggestion + counter-argument node pairs branching from them (from
      `getInitialCanvas` — no user action required first)
- [ ] Some branch points render as A/B/C option cards (`RadioGroup` of `Card`s) instead
      of a single suggestion — selecting one calls `mockAI.getOptionResponse`

## Phase 3 — Universal Node Interaction
- [ ] Any node (Source, suggestion, counter-argument, or revision) supports:
      select text → highlight → comment popup (`Popover` + `Textarea`)
- [ ] Submitting a comment calls `mockAI.getNodeResponse` → produces a new revision
      node (tagged v2, v3, ...), linked by edge; previous version collapses behind it
      (`Collapsible`, expandable, does not take canvas space by default)
- [ ] Cap total revisions/branch depth at a configurable limit (default 4); beyond that,
      AI returns a clarifying-question node instead of another branch
- [ ] Loading state on the node while "AI" responds
- [ ] Every recommendation/counter-argument/revision node has an explicit **"Seç"**
      (Select) action. Only nodes marked "Seç" count toward Finalize and flow to the
      dashboard — un-selected nodes stay on the canvas but never appear in Phase 4.
- [ ] "Finalize" button enabled once ≥1 node is marked "Seç"

## Phase 4 — Verification Dashboard (PRD 6.4)
- [ ] One card per **"Seç"-marked** node only (not every recommendation node that
      exists on the canvas): Match Score %, mocked peer-outcome bar chart, Retention %,
      Transparency Badge
- [ ] Transparency Badge uses the `stamp` Badge variant (DESIGN_GUIDELINES Section 3),
      rotated, Organic = `--primary` green / Sponsored = `--destructive` red
- [ ] Match Score shows factor breakdown in a `HoverCard`
- [ ] Peer-outcome chart caption states cohort size/definition (`Tooltip` for detail)
- [ ] Exit poll shown once, after dashboard loads

## Phase 5 — Wiring & Polish
- [ ] Wire the `step` state machine: `'chat'` → (on submit) → `'canvas'` → (on Finalize,
      requires ≥1 "Seç"-marked node) → `'dashboard'`
- [ ] "Reset session" action (clears mock state, sets `step` back to `'chat'`)
- [ ] Empty/error states for every mocked async call (seams for future real APIs)
- [ ] README note: which `mockAI.ts` functions are the seams for real LLM integration later

## Explicitly Not in This Pass
- Real LLM calls, vector DB, LinkedIn/expert data sourcing (PRD Section 7)
- Auth, persistence, multi-user, multi-session history
- Sponsorship ranking governance logic (PRD 6.5) — badge is visual only for now
- Localization, WCAG AA pass (NFR-6) — note as follow-up, don't block prototype on it
- Bidirectional chat-canvas sync — chat is one-shot entry only, not a persistent thread
