# Slice 3a — Fit signal (deriveFitSignal / getFitSignals)

Date: 2026-09-15 · Branch: `claude/remaining-tasks-13dc05` · Phase 3, sub-task 3a

## Goal

Give each report recommendation a real **fit signal**: one composite number
(0–100) = **coverage of the user's stated needs + model confidence**, shown with
a **two-part explanation** (Meaning C, locked). It re-activates the hero ranking
and replaces the retired, fabricated peer-data "Match" score. Sonnet 5, one
batched call, grounded in the session — no invented statistics.

Out of scope (later slices): grounding / real evidence (3b), retiring the dead
peer/evidence/retention code (3f), streamed `generateReport` orchestration (3d).

## What "fit" means (Meaning C)

- **Coverage** — how much of what the user *actually said* they need (their
  stated needs, derived from the Source node's own words) this recommendation
  addresses. Measured against their words, not an abstract ideal or peer data.
- **Confidence** — how sure the model is this recommendation is right/useful,
  independent of coverage.
- **Composite** — the headline fit number, a blend of the two.

## Data shape

```ts
// lib/types.ts
export interface FitSignal {
  score: number;          // composite 0–100, code-computed from the two parts
  coverageScore: number;  // 0–100
  coverageNote: string;   // one line explaining coverage
  confidenceScore: number;// 0–100
  confidenceNote: string; // one line explaining confidence
}
```

- **Composite is code-computed**: `score = Math.round((coverageScore + confidenceScore) / 2)`
  (50/50 blend, locked). This guarantees the headline number always equals its
  two bars — the model never does the arithmetic.
- Fit lives on **`DashboardNeed.fit?`** (report-derived), **never on
  `node.matchScore`** — the "no fabricated numbers on nodes" rule (3f) forbids
  reusing that field. `deriveDashboardNeeds` does NOT set it; the report attaches
  it after the async call.

## The seam (batched, one Sonnet call)

- Client seam `getFitSignals(vent, needs)` in `lib/mockAI.ts` → POSTs
  `/api/report/fit` with `{ vent, needs: [{label, body}] }` → returns
  `FitSignal[]` indexed to `needs` (one call scores all selected needs together,
  so scores are consistent and ranking is possible in one round-trip).
- Named `getFitSignals` (async `get*` seam convention) — this is the tasklist's
  "deriveFitSignal" (renamed to avoid clashing with the pure `derive*` graph
  functions).
- `computeCompositeFit(coverageScore, confidenceScore)` is a pure exported helper
  in `lib/report-segments.ts` (unit-tested), used by both the client mapper and
  the reader's mock branch.

## Ranking + async flow

- `deriveDashboardFeed` sort key changes `node.matchScore` → `need.fit?.score`
  (undefined sorts last; sponsored-exclusion + groupId dedup unchanged).
- `PrescriptionReport`: on mount, fire `getFitSignals(vent, needs)`. The
  **"Your prescription" section** shows a loading state (`AITextLoading`,
  "Scoring fit…") until it resolves; then attach fit → `needsWithFit` → rank →
  render hero/support/hidden. `UnderstoodSummary` / `NeedSummaryList` keep using
  plain `needs` (fit is scoped to the cards section).
- **Fallback = omission.** On any error/offline, no fit is attached: ranking
  falls back to stable order and cards render without a fit number. Fit needs the
  model's judgment; there is no honest deterministic fallback number, so we show
  none rather than a fake.

## The visual (dataviz)

Form: a **hero number + two magnitude bars** (not a chart). Composite is text
(foreground ink); Coverage/Confidence are two 0–100 magnitudes → horizontal bars
in a **single hue** (`--color-primary`, sequential — no CVD/validator step, which
is for multi-series identity). Marks mirror the existing `EvidenceBar` (thin
track, rounded fill, value at right).

Shared `FitMeter` component (`components/dashboard/fit-meter.tsx`), used by both
cards:
- **Composite number** in the card's left column — relabel "Match" → **"Fit"**,
  rewrite the tooltip to Meaning C. Size `--text-match` (hero) / `--text-kpi`
  (compact), as today.
- **Two bars**: `Covers your needs` and `Confidence`, each with its value.
- **Two notes** (coverage + confidence one-liners): shown in full on the **hero**;
  on the **compact** card the bars stay but the notes fold into the tooltip.

## Plumbing (mirrors the 3c seams)

- **Schema** → `lib/llm/schemas.ts`: `FitSignalSchema`
  (`{ fits: { coverageScore, coverageNote, confidenceScore, confidenceNote }[] }`,
  scores `z.number().int().min(0).max(100)`).
- **Prompt** → `lib/llm/prompts.ts`: `fitSignalSystemPrompt(locale)` — score each
  numbered need's coverage of the user's *stated* needs and the model's own
  confidence; the vent/needs are untrusted data; no invented statistics; notes
  are one calm sentence each.
- **Reader** → `lib/llm/report.ts`: `readFitSignals(input, locale)` — Sonnet
  (`MODELS.reasoning`), `messages.parse`, telemetry `usage`, an `isLlmMock()`
  branch returning deterministic mock fits (varied by index, notes marked
  "(mock)") so `LLM_MOCK` exercises ranking + bars.
- **Route** → `app/api/report/fit/route.ts` (`runtime="nodejs"`, zod-validated,
  `withTelemetry` seam `fitSignal`, `MODELS.reasoning`).
- **Seam** → `lib/mockAI.ts`: `getFitSignals` POSTs the route, maps each raw fit
  through `computeCompositeFit` into `FitSignal[]`; returns `[]` on error.

## Cross-cutting rules honored

- Vent + need text in the **user** turn as data; behavior in the system prompt.
- No fabricated numbers on nodes; fit is report-derived, omitted on failure.
- `zod/v4`; `client.messages.parse({ output_config: { format: zodOutputFormat(Schema) } })`.
- Route Web-standard `Request`/`Response`, `runtime="nodejs"`, zod-validated.
- Locale defaults `"en"`; UI English.

## Verification

- `npx tsc --noEmit` + `npm run lint` clean.
- Vitest: `computeCompositeFit` unit test (rounding, 50/50 blend, clamping) +
  the existing 28 stay green.
- Existing Playwright E2E stays green; a live `LLM_MOCK` check that cards rank by
  fit and show the meter, plus the fit-route-500 → omission fallback.
- Real-key (Sonnet) verification deferred until `ANTHROPIC_API_KEY` is added.
