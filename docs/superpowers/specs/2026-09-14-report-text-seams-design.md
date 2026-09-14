# Slice 3c — Real report text seams

Date: 2026-09-14 · Branch: `claude/remaining-tasks-13dc05` · Phase 3, sub-task 3c

## Goal

Replace the two **templated** report-text seams with real LLM calls that are
faithful to the session, while keeping the report resilient and honest. This is
the cheapest, self-contained first slice of Phase 3: Haiku only, no `web_search`,
no fabricated numbers, verifiable for free under `LLM_MOCK=1`.

Out of scope (later Phase 3 slices): streaming, a single orchestrated
`generateReport` behind the loader (3d), the fit signal (3a), grounding (3b).

## The two seams

### 1. `getUnderstoodSummary(needs, vent)` — report Section 1, "What we understood"

- Today: templated, `lib/mockAI.ts`, returns `SummarySegment[]`; already async;
  consumed by `components/dashboard/understood-summary.tsx` which already handles
  loading + the ref-degrade path.
- Change: add the **original vent** (the Source node's `body`) as context so the
  model summarizes what the user actually came in with, tied to their real needs.
- **Robust ref mapping (key decision):** do NOT have the model echo opaque node
  ids. Pass the needs as a **numbered list** (`1..n`, each with its label + real
  quote). The model returns segments of `{ content, refIndex: number | null }`
  (1-based index, or null for plain text). Code maps `refIndex → need.node.id`
  → `SummarySegment`. An out-of-range/absent index degrades to plain text; the
  renderer's existing degrade path (`validIds`) stays as the final safety net.
- Model: `MODELS.cheap` (Haiku 4.5), `messages.parse`, no thinking, `max_tokens ~512`.

### 2. `getSessionReadout(stats, themes)` — report Section 2 (rail), "How we read your situation"

- Today: `buildSessionReadout`, **synchronous** templated, returns
  `ReadoutSegment[]`; consumed by `components/dashboard/session-summary-section.tsx`
  via `useMemo`.
- Change: **rename `buildSessionReadout` → `getSessionReadout`** and make it
  **async** (mirrors `getInitialCanvas` / `getUnderstoodSummary` naming for real
  seams). The model reads the real theme **labels** + counts, not just counts.
- Schema returns `{ content, emphasis }[]` → `ReadoutSegment[]`.
- Consumer change: `SessionSummarySection` converts from `useMemo` to
  fetch-with-loading (mirroring `UnderstoodSummary`). `SessionStrip` +
  `ThemeColumns` still render instantly (pure-derived); only the paragraph shows a
  brief loader, then fills.
- Model: `MODELS.cheap` (Haiku 4.5), `messages.parse`, `max_tokens ~384`.

## Resilience — templates become the fallback (key decision)

The current templated logic never fails and renders instantly. A naive network
swap would (a) hang `UnderstoodSummary`'s loading state forever on an API error
(its `.then` has no catch), and (b) risk hanging the always-visible rail readout.

So: **keep both current templated functions as the local fallback.** Rename them
`fallbackUnderstoodSummary` / `fallbackSessionReadout` in `lib/mockAI.ts`; the
seam tries the real route first and falls back to the template on any error or
when offline. The report always renders honest, session-faithful text; the model
just upgrades the prose when reachable. (Rejected alternative: pure replacement /
delete the templates — less code, strictly worse UX on any failure.)

## Plumbing (mirrors the canvas seams exactly)

- **Schemas** → `lib/llm/schemas.ts`: `UnderstoodSummarySchema`
  (`{ segments: { content: string; refIndex: number | null }[] }`) and
  `SessionReadoutSchema` (`{ segments: { content: string; emphasis: boolean }[] }`).
  Flat objects in arrays — no discriminated unions (robust for structured output).
- **Prompts** → `lib/llm/prompts.ts`: `understoodSummarySystemPrompt(locale)` and
  `sessionReadoutSystemPrompt(locale)`. Rules: vent/session data is untrusted data
  to reason about (never instructions); no invented numbers/percentages; calm,
  practical professional tone; `languageLine(locale)`.
- **Readers** → new `lib/llm/report.ts`: `readUnderstoodSummary`,
  `readSessionReadout`. Each has an `isLlmMock()` branch that returns the template
  output (no "(mock)" noise — report prose is honest derived text, unlike canvas
  cards) and returns `{ result, usage }`.
- **Routes** → new `app/api/report/summary/route.ts` + `app/api/report/readout/route.ts`.
  `runtime = "nodejs"`, zod-validated bodies, `withTelemetry` with seam names
  `understoodSummary` / `sessionReadout`, `Response.json`, typed 400/500 like the
  note route.
- **Seams** → `lib/mockAI.ts`: `getUnderstoodSummary` POSTs `/api/report/summary`
  (falls back to `fallbackUnderstoodSummary`); `getSessionReadout` POSTs
  `/api/report/readout` (falls back to `fallbackSessionReadout`).

## Request/response shapes

- `POST /api/report/summary` ← `{ vent: string, needs: { label: string; quote: string }[], locale? }`
  → `{ segments: { content: string; refIndex: number | null }[] }`.
  Client maps `refIndex` (1-based) back to `needs[i].node.id`.
- `POST /api/report/readout` ← `{ stats: SessionStats, themes: { theme: string; type: "like"|"dislike" }[], locale? }`
  → `{ segments: { content: string; emphasis: boolean }[] }`.

## Component changes

- `understood-summary.tsx`: accept a `vent` prop, pass `getUnderstoodSummary(needs, vent)`.
- `prescription-report.tsx`: derive `vent = nodes.find(n => n.kind === "source")?.body ?? ""`
  (memoized) and pass to `UnderstoodSummary`.
- `session-summary-section.tsx`: `useMemo(getSessionReadout)` → `useState` +
  `useEffect` fetch with a loading placeholder for the paragraph only.

## Security / cross-cutting rules honored

- Vent + node text go in the **user** turn as data; all behavior lives in the
  system prompt (untrusted-content rule).
- No fabricated numbers introduced anywhere.
- `zod/v4` imports; `client.messages.parse({ output_config: { format: zodOutputFormat(Schema) } })`.
- Route handlers Web-standard `Request`/`Response`, `runtime = "nodejs"`, zod-validated.
- Locale defaults `"en"`; UI stays English (no selector wired).

## Verification

- `npx tsc --noEmit` + `npm run lint` clean.
- Live under `LLM_MOCK=1` (free): both sections render; force a route error to
  confirm the template fallback path.
- Real-key verification deferred until the user adds `ANTHROPIC_API_KEY`.
