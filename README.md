# Remedy — Prototype

Clickable prototype: chat entry → AI-annotated canvas → verified dashboard.
No real backend, LLM calls, or persistence — see `docs/` for the full build brief
(`docs/BUILD_BRIEF.md`, `docs/CanvasRx_TASKS.md`, `docs/CanvasRx_DESIGN_GUIDELINES.md`,
`docs/CanvasRx_PRD_EXCERPT.md`). The product was originally scoped under the working
name "CanvasRx" — those doc filenames are kept as-is for traceability to the original
spec; the shipped brand name is now **Remedy** (see `public/logo.svg`).

## Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The whole flow lives on a single
page (`app/page.tsx`) driven by one `step: 'chat' | 'canvas' | 'dashboard'` state
variable — there's no routing, and a refresh resets to `'chat'`.

## Where the mock AI lives

All AI behavior is faked in [`lib/mockAI.ts`](lib/mockAI.ts) with an artificial
500–1500ms delay. These three functions are the seams for real LLM integration later:

- **`getInitialCanvas(chatText)`** — currently returns a canned Source node plus a
  fixed set of suggestion/counter-argument pairs (one rendered as an A/B/C option
  set). Swap for an LLM call that extracts entities/sentiment from `chatText` and
  drafts the same shape of response (PRD Section 7 sourcing/vector DB work plugs in
  here).
- **`getNodeResponse(node, commentText)`** — currently appends a canned revision to
  whatever was commented on. Swap for an LLM call that reads the node's ancestor
  chain plus the new comment and drafts the next revision.
- **`getOptionResponse(node, selectedOptionId)`** — currently returns a canned
  recommendation + counter-argument pair rooted at the picked option (mirrors
  `getInitialCanvas`'s branching pattern one level deeper, so picking an option opens
  up a new choice rather than dead-ending). Swap for an LLM call that branches using
  the same context.

`MAX_BRANCH_DEPTH` (default 4) caps revision depth; beyond it, `getNodeResponse`
returns a clarifying-question node instead of another branch, matching PRD 6.3
Acceptance Criterion 13.

## Known prototype limitations

Intentionally out of scope for this pass (see `docs/CanvasRx_TASKS.md` → "Explicitly
Not in This Pass"): real LLM/vector DB calls, auth, persistence, multi-session
history, sponsorship ranking governance logic, localization, and a WCAG AA pass.
