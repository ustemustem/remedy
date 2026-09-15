# Slice 3d — Real generateReport orchestration

Date: 2026-09-16 · Branch: `claude/remaining-tasks-13dc05` · Phase 3, sub-task 3d

## Correction to the earlier read

`generateReport()` is NOT dead — `ReportLoader` calls it ([report-loader.tsx:125]),
awaits it behind the `MIN_VISIBLE_MS` floor + `CEILING_MS` timeout race, and already
has the error → "Try again" retry and 3 status stages. It just does a **fake delay**.
So the loader already "does real work" structurally; 3d makes that work real.

## Goal

Replace the fake `generateReport()` delay with real orchestration of the fast report
seams (summary + readout + fit) so the loader genuinely waits for them, and pass the
results into the report so it renders fully-loaded without re-fetching. Grounding
(slow web_search) stays progressive per-card. Verifiable under `LLM_MOCK`.

Deferred to the real-key session: per-token/tool **event streaming** mapped to
fine-grained stage text (needs real streaming events).

## Data

`ReportData = { summary: SummarySegment[]; readout: ReadoutSegment[]; fits: FitSignal[] }`
(add to `lib/types.ts`).

## Orchestration

`generateReport(graph: CanvasGraph): Promise<ReportData>` (`lib/mockAI.ts`) — derive
`needs`/`themes`/`stats`/`vent` from `graph.nodes`, then `Promise.all([
getUnderstoodSummary(needs, vent), getSessionReadout(stats, themes),
getFitSignals(vent, needs) ])`. Grounding NOT included (progressive). Signature
changes from `(): Promise<void>` to `(graph): Promise<ReportData>`.

## Loader

`ReportLoader` gains a `graph` prop and `onReady(data: ReportData)`; it calls
`generateReport(graph)` (existing await/timeout/retry unchanged) and, on resolve,
stashes the data in a ref so `finish()` (fired by the erase `animationend` or the
fallback timer) calls `onReady(data)`. Status stages + motion values unchanged
(locked). Error/timeout → existing "Try again" (retries `generateReport(graph)`).

## Threading the data

`page.tsx`: `reportData` state; `<ReportLoader graph={graph} onReady={handleReportReady} />`;
`handleReportReady(data)` sets `reportData` + `step="dashboard"`. Cleared to `null` on
reset / back-to-canvas / session-resume / new finalize (so the resume path self-fetches).
`<DashboardScreen reportData={reportData} .../>` → `<PrescriptionReport preloaded={reportData} />`.

## Components: preloaded-or-fetch (backward compatible)

Each takes an optional preloaded value; present → use it (no fetch, no mini-loader);
absent → self-fetch as today (session-resume path). Pattern:
`const data = preloaded ?? fetched;` + the fetch effect early-returns when `preloaded`.

- `UnderstoodSummary` — optional `preloaded?: SummarySegment[]`.
- `SessionSummarySection` — optional `preloaded?: ReadoutSegment[]`.
- `PrescriptionReport` — `preloaded?: ReportData | null`; uses `preloaded.fits` for
  fit (skip the fit fetch), passes `preloaded.summary` / `preloaded.readout` down.
  Grounding effect is unchanged (always runs; progressive).

## Cross-cutting

- Resume path (sidebar → finalized session) never has preloaded data → components
  self-fetch exactly as today. This must keep working.
- No fabricated data. `zod/v4` unaffected. Locale default `"en"`.

## Verification

- `tsc` + `lint` + vitest (unchanged suites stay green).
- Live `LLM_MOCK`: finalize → loader waits for the real fast seams → report appears
  with summary/readout/fit already populated (no per-section mini-loaders), grounding
  fills in per-card. Resume a finalized session → still self-fetches (mini-loaders
  show). Existing Playwright E2E stays green.
- Deferred: real event-streaming stage text (real-key).
