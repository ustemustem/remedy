# Report → Cotton Bond paper re-skin — version log

**Scope:** the finalize **report only** (`.report-scope` / `components/dashboard/*`). No app-wide
design-system change; the paper neutrals live only under `.report-scope`. The chat and canvas
screens are untouched.

**Approved:** 2026-09-08. Direction locked as a re-skin of the *existing* live report (layout A) —
every working feature, number, tooltip, interaction, and the evidence links are preserved. See the
crosswalk artifact `https://claude.ai/code/artifact/c02b43aa-017d-4911-95f8-091f83043677`.

## Owner requirements (2026-09-08)

1. **Exit poll → bottom of the report, inline.** It must not pop up as a modal on load.
2. **The user / app / solution recommendations (`EvidenceRow`: "Our recommendation" / "App
   suggestion" / "Company match") must never be removed** — a core building block. Keep them
   present and legible, not silently dropped.
3. **References/citations always clear and correct; correct language.** Honest sourcing only, no
   invented authority; UI copy in English, written plainly.
4. **Versioned change analysis + this log; confirm design-system conformance** for every edit.

## Design-system conformance reference (`app/globals.css` + `docs/CanvasRx_DESIGN_GUIDELINES.md`)

| Rule | Conformance in the paper skin |
|---|---|
| Fonts: Geist (body) + IBM Plex Mono (labels/headers/numeric) | Kept exactly — no new faces |
| Accents: `--primary #1F4838`, `--cta #CD5C1F` | Kept — the only saturated colors |
| Labels mono/upper/tracked; actions sentence-case | Kept — masthead/eyebrows mono, buttons sentence-case |
| Numeric = Plex Mono, tabular | Kept |
| Radius: control 6 / card 12 / surface 8 (locked in `page.tsx`) | Kept for controls/cards; the sheet uses a 3px paper edge (a document edge, not a card) — intentional |
| "Flat/matte, no drop shadow" (global) | `.report-scope` already departs via `report-card-surface`; the sheet keeps one soft, low shadow, scoped to the report only — documented departure, consistent with the report redesign |
| Warm paper neutrals (`#F4F2EB` sheet, `#DEDBD0` desk, white cards) | Off the global cool palette **on purpose**; declared only under `.report-scope`, never global |

## Version log

### v0 — baseline (current live report, layout A)
Screen header ("Verified prescription" + Back/Reset) · §01 understood-summary + need list ·
§02 hero + compact cards (match, stat row, evidence bars, View-evidence links, Sponsored) ·
rail (5 metrics + readout + theme columns) · footer (Export/Share) · ExitPoll (modal on mount).

### v1 — Cotton Bond paper skin (2026-09-08)

Report surface only; chat/canvas untouched. Verified in the running dev server
(`canvasrx-dev`; `.next` cleared once for the CSS token change — the documented Turbopack
gotcha). `eslint` clean on every touched file. `tsc` shows only pre-existing
missing-dependency errors (`@anthropic-ai/sdk`, `vitest` not installed in this worktree) —
none in the changed files.

| File | Change | Requirement / conformance |
|---|---|---|
| `app/globals.css` | Paper token layer + `.report-sheet` / `.report-letterhead` / `.report-tear` / `.report-notch` classes + a `@media print` flattening, all under `.report-scope`. Re-points `--card`→white, `--background`→desk, `--border`→warm hairline. | #4 — paper neutrals scoped to the report only |
| `app/page.tsx` | Passes the real `sessionId` to `DashboardScreen`. | #3 — REF is the real session id |
| `components/dashboard/dashboard-screen.tsx` | Cotton Bond sheet wrapper + letterhead (Rx · "Verified Prescription" · real REF · issued date · prescribed count) + footer control-number band; moved `ExitPoll` inline below the sheet. | #1 exit-poll placement; #3 honest values; mono labels / Plex Mono numeric / locked radii |
| `components/dashboard/exit-poll.tsx` | Modal `Dialog` (auto-open) → inline end-of-report section, with `active:scale-[0.97]` press feedback. | #1 — no modal on load |
| `components/dashboard/prescription-report.tsx` | Dashed tear-line + blended edge notches between §01 and §02. | paper language; content untouched |

**Preserved unchanged (verified in-browser):** understood-summary + ref↔row highlight ·
need rows (quote + path summary) · hero match / stat-row / **evidence bars** / tooltips ·
compact cards + **View-evidence** collapsibles · the **EvidenceRow** user/app/solution
recommendations ("Our recommendation" / "App suggestion" / "Company match") · Sponsored
badge · 5-metric session strip + readout + theme columns · Export / Share.

**Design-system conformance:** ✅ Geist + IBM Plex Mono · ✅ `--primary` / `--cta` the only
accents · ✅ mono-upper labels vs sentence-case actions · ✅ locked radii for controls/cards ·
⚠️ the soft sheet shadow + warm paper neutrals are a documented, report-scoped departure
(above), consistent with the report redesign's existing `report-card-surface` shadow.
