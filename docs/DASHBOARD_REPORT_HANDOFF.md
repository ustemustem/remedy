# Handoff Spec: Dashboard — "Verified Prescription" Report Screen

Generated from the current implementation (not a pre-build spec) — documents what's
actually built and shipped as of this pass. Supersedes the stale "Screen 3: Dashboard"
section in `docs/DESIGN_HANDOFF.md` (that section predates the KPI pass and the
declutter/polish pass below — do not use it as source of truth for this screen).

**Tech stack:** Next.js (Turbopack) + React 19 + Tailwind v4 + shadcn/ui (radix-nova
style) + a custom visx-based chart system (`components/charts/*`). No backend — every
number and sentence on this screen is either derived synchronously from real graph
state or produced by a mocked async "AI" call (`lib/mockAI.ts`), both noted per field
below.

**Entry point:** `components/dashboard/dashboard-screen.tsx`, rendered by `app/page.tsx`
when `step === 'dashboard'`. Reached via Finalize (canvas) or a `clarifying-question`
node's "View report" CTA. Terminal screen — the only way out is "Back to canvas" or
"Reset session" (the header buttons) or picking a different session from the sidebar.

---

## Overview

A read-only report synthesizing everything the user selected, liked/disliked, and
revised while working the canvas. Three numbered sections, top to bottom: **(01)** what
the app understood from the user's own words, **(02)** a behavioral read of how the
user actually used the canvas, **(03)** the resulting prescription with match/retention
scores and supporting evidence. Framed throughout as "here's what we took from what
*you* told us," not "here's what you did" — see Section 02's copy notes.

---

## Layout

- Outer: `components/dashboard/dashboard-screen.tsx` — `flex h-full flex-col`, header
  (`shrink-0`) + a single scrollable body region (`flex-1 overflow-y-auto`). The
  Session Sidebar (persistent app chrome, not part of this screen) has its own
  independent scroll region outside this one.
- Body: `mx-auto max-w-5xl px-4 pb-16` wrapping `<PrescriptionReport />`, followed by
  `<ExitPoll />` (mounts outside the `max-w-5xl` wrapper, its own centered dialog).
- No responsive breakpoint collapse below `lg:` other than Section 03's grid (see
  below) — this screen assumes desktop-ish width like the rest of the app's
  content-heavy screens.

### Header
- Left: `public/logo.svg` (28px tall) stacked above "Verified prescription"
  (`font-mono text-lg font-bold`).
- Right: "Back to canvas" (ghost button, `ArrowLeft` icon) + "Reset session" (ghost
  button, `RotateCcw` icon). Both plain navigation — no confirmation dialog on Reset.
- `border-b border-border px-4 py-2.5`.

### Section header pattern (all 3 sections)
Component: `SectionHead` (private, defined inline in `prescription-report.tsx`).

```
mb-4 mt-10 flex items-baseline justify-between
  01/02/03: font-mono text-xs font-bold text-primary, zero-padded via padStart(2,"0")
  Title: font-heading text-lg font-semibold text-foreground
  Hint (right-aligned, optional): text-[length:var(--text-label)] text-muted-foreground
```

`mt-10` (40px) above every section header, `mb-4` (16px) below it before content —
this is the screen's primary vertical rhythm; don't introduce a different inter-section
gap value elsewhere.

---

## Design Tokens Used

All from `app/globals.css`. This screen introduces no new tokens.

| Token | Value | Usage on this screen |
|---|---|---|
| `--color-card` | `hsl(140 6% 91%)` | Every card background (stat cards, prescription cards) |
| `--color-primary` | `#1F4838` | Section index numbers, id-codes, gauge active arc, "Organic" badge, liked-theme chips |
| `--color-destructive` | `hsl(8 51% 46%)` | "Sponsored" badge, disliked-theme chips |
| `--color-foreground` / `--color-muted-foreground` | — | Primary vs. secondary text throughout |
| `--color-border` | `hsl(100 4% 80%)` | Hairlines: `NeedSummaryList` row dividers, evidence disclosure top border, gauge track |
| `--color-chart-3` | — | Peer-outcome bar chart fill, sentiment line stroke |
| `--radius-card` | `6px` | All `Card` components (via `components/ui/card.tsx`) |
| `--card-px` | `16px` | Horizontal inset on every card's content AND on `NeedSummaryList`'s rows (see Alignment note below — this shared token is what keeps Section 01 and Section 03 left-aligned with each other) |
| `--text-label` | `11px` | The dominant "small text" size on this screen: quotes, meta lines, badge-adjacent captions, evidence headings |
| `--font-mono` (IBM Plex Mono) | — | Section index, id-codes, gauge value, evidence heading labels — anything in the "label/data" register |
| `--font-sans` (Inter) | — | Titles, body copy, summary paragraphs — anything in the "prose" register |

---

## Components

| Component | File | Props | Notes |
|---|---|---|---|
| `PrescriptionReport` | `prescription-report.tsx` | `{ nodes: CanvasNodeData[] }` | Orchestrator. Calls `deriveDashboardNeeds(nodes)` and `deriveThemeEntries(nodes)` (both `lib/graph.ts`, synchronous, pure). Renders the empty state or the 3 sections. |
| `UnderstoodSummary` | `understood-summary.tsx` | `{ needs: DashboardNeed[] }` | Section 01's synthesized paragraph. Self-contained async data fetch + own loading state (see States section). |
| `NeedSummaryList` | `need-summary-list.tsx` | `{ needs: DashboardNeed[] }` | Section 01's per-need detail rows. Plain list, **no card background** — this is deliberate declutter, don't reintroduce a `Card` wrapper here. |
| `SessionSummarySection` | `session-summary-section.tsx` | `{ nodes: CanvasNodeData[]; themes: ThemeEntry[] }` | Section 02 in full: stat row + themes trigger + sentence + sentiment chart. Owns its own async fetch/loading state. |
| `FeedbackStatCard` | `feedback-stat-card.tsx` | `{ likeCount: number; dislikeCount: number; className?: string }` | One of Section 02's 3 stat cards — the only one showing two numbers in one card. |
| `KpiStatCard` | `kpi-stat-card.tsx` | `{ label: string; value: number; className?: string }` | Generic single-number stat card (used twice in Section 02: "Paths explored", "Your input"). Wraps `ChartStatFlow` for the NumberFlow count-up. |
| `ThemesPopover` | `themes-popover.tsx` | `{ themes: ThemeEntry[] }` | Returns `null` when `themes.length === 0` — no empty-popover state exists. |
| `PrescriptionCard` | `prescription-card.tsx` | `{ need: DashboardNeed }` | Section 03's per-need card: title/badge, body, gauges, evidence disclosure. |
| `MiniGauge` | `mini-gauge.tsx` | `{ value: number; label: string }` | Hand-rolled SVG semicircle arc gauge — not a third-party chart component. 0–100 scale, clamped. |
| `EvidenceRow` | `evidence-row.tsx` | `{ examples: EvidenceExample[] }` | The 3-column narrative block inside a `PrescriptionCard`'s evidence disclosure. |
| `ExitPoll` | `exit-poll.tsx` | none | Self-contained dialog, no props — reads nothing from the report. |

### Data functions consumed (not components, but load-bearing)

| Function | File | Sync/Async | Returns |
|---|---|---|---|
| `deriveDashboardNeeds(nodes)` | `lib/graph.ts` | Sync | `DashboardNeed[]` — one entry per selected, non-superseded node: `{ node, category, quote, revisionCount, eliminated?, peerOutcome? }` |
| `deriveThemeEntries(nodes)` | `lib/graph.ts` | Sync | `ThemeEntry[]` — `{ theme, type: "like"|"dislike", nodeIds }`, deduped by theme+type |
| `deriveSessionStats(nodes)` | `lib/graph.ts` | Sync | `{ likeCount, dislikeCount, selectedCount, pathCount, optionPickCount, ownFramingCount, noteCount }` |
| `getUnderstoodSummary(needs)` | `lib/mockAI.ts` | **Async, ~500–1500ms mock delay** | `string` — Section 01's paragraph |
| `getSessionSummary(nodes, stats)` | `lib/mockAI.ts` | **Async, ~500–1500ms mock delay** | `{ sentence: string; timeline: SentimentPoint[] }` — Section 02's sentence + chart data |

---

## Section-by-Section Spec

### Section 01 — "What we understood"

**Hint copy:** "drawn from your own words"

**Layout:** `<div className="space-y-3">` containing `<UnderstoodSummary>` then
`<NeedSummaryList>`.

**Summary paragraph** (`UnderstoodSummary`):
- `text-sm text-foreground`, single paragraph, no truncation/character limit.
- Synthesized from real data: unique `category` values across `needs` + the first
  need's `quote` — see `getUnderstoodSummary` in `lib/mockAI.ts` for the exact
  template logic (1-need vs. multi-need phrasing branches).
- **This is a mocked LLM seam**, same pattern/rationale as `getSessionSummary` — not
  real summarization. Do not read the sentence content as a spec; read the function.

**Detail list** (`NeedSummaryList`): one row per need, `divide-y divide-border
border-t border-border`, each row `px-[var(--card-px)] py-3` (no card background —
see Design Tokens note on why this padding value matters here specifically).

Per row, two lines:
1. `flex flex-wrap items-center gap-x-2 gap-y-1`:
   - id-code (`node.id.split("-")[0]`, e.g. `"rec"`, `"branch"`) —
     `font-mono text-xs font-bold uppercase tracking-wide text-primary`
   - Title — `text-sm font-semibold text-foreground`, version suffix stripped
     (`.replace(/\s\(v\d+\)$/, "")`)
   - Category — `Badge variant="outline"`
   - Quote — `text-[length:var(--text-label)] italic text-foreground/70`, wrapped in
     curly quotes (`&ldquo;…&rdquo;`)
2. Meta line, own row, `mt-1 text-[length:var(--text-label)] text-muted-foreground`:
   `"{1|2} approach{es} explored/accepted directly · {N} revision{s}"` or
   `"· no revisions"` when `revisionCount === 0`.

**Why two lines, not one:** the quote (evidence) and the meta stat (a count) are
different information types and were previously sharing one visual weight/line —
splitting them and reducing the quote's opacity gives the row an actual read order
instead of one gray blur. If you're re-implementing, keep the two-line split.

### Section 02 — "How we read your situation"

**Hint copy:** "from your own feedback on the canvas"

**Layout:** `<div className="space-y-4">`, two children:

**1. Stat row + themes trigger** — `flex flex-wrap items-stretch gap-3`:
- `<FeedbackStatCard likeCount dislikeCount className="flex-1 basis-40" />`
- `<KpiStatCard label="Paths explored" value={stats.pathCount + stats.optionPickCount} className="flex-1 basis-40" />`
- `<KpiStatCard label="Your input" value={stats.selectedCount + stats.noteCount + stats.ownFramingCount} className="flex-1 basis-40" />`
- `<ThemesPopover themes={themes} />` — not a 4th stat, a `flex-shrink-0 self-center`
  pill trigger. Renders nothing when there are no themes (no liked/disliked nodes).

Exactly **3 stat cards, always** — this was deliberately consolidated down from an
earlier 7-stat-card version. Do not add a 4th grouped card without re-deriving the
grouping rationale (Feedback / Exploration / Your input — see
`docs/superpowers/specs/2026-08-06-reporting-screen-declutter-design.md`).

**2. Sentence + sentiment chart** (async, see States):
- `<p className="text-sm text-foreground">{summary.sentence}</p>`
- If `chartData.length > 0`: a `LineChart` (`aspectRatio="4 / 1"`) plotting
  `SentimentPoint[]` mapped to `{date, tone: -1|0|1, label}` — one point per revision
  that had a user note attached. **Zero points is a valid, silent state** — the chart
  section renders nothing at all if `chartData.length === 0` (e.g. a session with no
  revisions), only the sentence shows.

### Section 03 — "Your prescription"

**Hint copy:** "ranked by match, per need"

**Layout:** `grid grid-cols-1 gap-3 lg:grid-cols-2` of `PrescriptionCard`s, one per
need (same `needs` array as Section 01 — same id-codes, so a reader can trace a
Section 03 card back to its Section 01 row by matching the id-code text).

**This section is a merge** of what used to be two separate sections ("Your
prescription" + "Why this should work") — the peer-outcome chart and evidence blocks
now live *inside* each card's collapsible disclosure rather than in a separate section
below. Don't split them back out without re-checking the spec doc above.

**Per card** (`Card className="py-4"`, `CardContent className="space-y-2 px-[var(--card-px)]"`):

1. **Header row** — `flex items-center gap-2`: id-code (same styling as Section 01's,
   see above) + title (`b`, `text-sm`) + transparency badge:
   - `node.transparency === "sponsored"` → `Badge variant="destructive"`, text
     "Sponsored"
   - otherwise → `Badge variant="default"`, text "Organic"
2. **Body** — `node.body`, `text-[length:var(--text-label)] text-muted-foreground`.
3. **Gauges** — `flex gap-4 pt-1`, only rendered if at least one of `matchScore` /
   `retentionRate` is non-null. **Each gauge is independently conditional** — a card
   with only one of the two fields renders exactly one gauge, not an empty second
   slot. See Component spec below for exact gauge geometry.
4. **Evidence disclosure** (`Collapsible`, only rendered if `peerOutcome` or
   `evidenceExamples` exists — see States/Edge cases):
   - Trigger: `"View evidence"`, `ChevronRight` icon that rotates 90° on open
     (`group-data-[state=open]:rotate-90`), `border-t border-border pt-2` separating
     it from the gauges above.
   - Content (`space-y-2 pt-2`):
     - If `peerOutcome`: `n={cohortSize}` badge (right-aligned) → `BarChart`
       (`aspectRatio="3 / 1"`, one bar per `peerOutcome.bars[]` entry, labeled
       `"Cohort {n}"`) → cohort definition caption.
     - If `evidenceExamples`: `<EvidenceRow examples={...} />`.
     - Either, both, or (per the outer conditional) at least one of these two is
       always present when the disclosure itself renders.

### `MiniGauge` — exact geometry

Hand-rolled SVG, not a chart-library component. If reimplementing on another stack,
match these values — they were deliberately enlarged from an earlier pass where the
gauge was too small to read (`RADIUS=28`, 13px text) to the current values after
explicit design feedback:

```
Container: 140px wide, flex-col, centered
SVG: 120×70 viewBox "0 0 120 70"
Arc path (both track and value): "M 14 58 A 46 46 0 0 1 106 58"  (RADIUS=46)
Track stroke: var(--color-border), width 8, round cap
Value stroke: var(--color-primary), width 8, round cap,
  strokeDasharray = π×46, strokeDashoffset = π×46 × (1 - clamped/100)
Value text: centered at (60, 48), font-mono, 24px, weight 700, var(--color-foreground)
Label: below the SVG, text-[length:var(--text-label)] text-muted-foreground
```

Value is clamped `Math.max(0, Math.min(100, value))` before use — **no `NaN` guard**;
a `NaN` input renders `"NaN%"` and an invalid `strokeDashoffset`. Not currently
possible from any real call site (both `matchScore`/`retentionRate` are typed
`number | undefined` and mock-sourced), but flag this if a real backend starts
feeding this component.

---

## States and Interactions

| Element | State | Behavior |
|---|---|---|
| `UnderstoodSummary` | Loading | `AITextLoading` component cycling `["Reading what you wrote…", "Summarizing…"]` at 700ms intervals, `text-sm text-muted-foreground` — replaces the paragraph entirely until the mock fetch resolves |
| `UnderstoodSummary` / `SessionSummarySection` | `nodes`/`needs` reference changes (session switch) | Both components detect the prop identity change mid-render (`if (x !== tracked) { setTracked(x); setSummary(null); }`) and re-enter their loading state — this is intentional, not a bug, and is how switching sessions in the sidebar correctly re-triggers the mock summary fetch |
| `ThemesPopover` trigger | Click | Opens a Radix `Popover`, `transform-origin` anchored to the trigger (not viewport-centered) — standard shadcn popover animation, no custom motion added |
| Evidence disclosure trigger | Click | Radix `Collapsible` toggle. **No open/close transition currently applied** — content appears/disappears instantly. (Flagged in review as a candidate improvement; not yet implemented — see Known Gaps below.) |
| `ExitPoll` dialog | Mount | Opens automatically and exactly once per dashboard mount (`useState(true)`, not an effect) |
| `ExitPoll` rating buttons | Select | Square buttons, selecting one sets `border-primary bg-primary/10 text-primary`; Submit is disabled until a rating is picked |
| `ExitPoll` | After Submit | Replaces the rating row with "Thanks, that's recorded." and swaps the footer button to "Close" |
| Gauges | Value change | **Not animated** — the arc renders at final `strokeDashoffset` on mount, no transition. (Also flagged as a candidate improvement — `KpiStatCard`'s numbers count up via NumberFlow but the gauges don't, an inconsistency noted in review but not yet fixed.) |

---

## Responsive Behavior

| Breakpoint | Changes |
|---|---|
| Desktop (default) | Section 03 renders 2 columns (`lg:grid-cols-2`) |
| `< lg` | Section 03 collapses to 1 column (`grid-cols-1`) |
| Section 02 stat row | `flex-wrap` — cards wrap to a new row rather than compressing below their `basis-40` (160px) minimum |
| Section 01 | No breakpoint behavior — `flex-wrap` on the detail row's first line lets long titles/quotes wrap naturally at any width |

No `sm:`-level breakpoint exists on this screen specifically (the app's global
`max-w-5xl` container plus these two `lg:` rules are the entirety of this screen's
responsive surface). This screen has not been tested below ~640px viewport width.

---

## Edge Cases

- **Zero selected needs**: `PrescriptionReport` returns early with
  `<p className="text-sm text-muted-foreground">No recommendations were marked
  "Select" before finalizing.</p>` — none of the 3 sections render at all. This is
  the very first check in the component; nothing above it (including the async
  summary components) mounts.
- **Zero notes / zero revisions**: `getSessionSummary` returns an empty `timeline`;
  the sentence still renders (falls into the "high direct-acceptance, no notes"
  template branch — see `lib/mockAI.ts`'s `buildSummarySentence`), but the chart
  section is omitted entirely (`chartData.length > 0` guard).
  `deriveSessionStats([])`-equivalent inputs produce all-zero stat cards, not an
  error.
- **No themes** (nothing liked/disliked): `ThemesPopover` renders `null` — the stat
  row shows 3 cards with no 4th trigger element, not a disabled/empty pill.
- **A need with neither `matchScore` nor `retentionRate`**: no gauge row renders for
  that card (outer conditional), not two empty slots.
- **A need with only one of `matchScore`/`retentionRate`**: exactly one gauge
  renders, in a `flex gap-4` row — it does not stretch to fill the row or leave a
  visible gap where the second gauge would have been.
- **A need with neither `peerOutcome` nor `evidenceExamples`**: no "View evidence"
  trigger renders for that card at all (not a disabled trigger, not an empty
  disclosure).
- **A need with `peerOutcome` but no `evidenceExamples`** (or vice versa): the
  disclosure still renders, containing only whichever half is present.
- **Very long quote/title text**: no truncation or `line-clamp` applied anywhere on
  this screen — long strings wrap via `flex-wrap`. Not stress-tested against
  pathologically long single-word strings (e.g. a URL with no spaces).
- **Session switch while a summary is mid-fetch**: the in-flight `getUnderstoodSummary`/
  `getSessionSummary` promise is allowed to resolve but its result is discarded via a
  `cancelled` flag closure in each component's `useEffect` cleanup — no visible
  flicker of stale-session content, but also no visible "request cancelled" state;
  it just silently re-enters loading for the new session.

---

## Animation / Motion

| Element | Trigger | Animation | Duration | Easing |
|---|---|---|---|---|
| `ThemesPopover` content | Open/close | Radix default scale+fade, origin = trigger position | ~100ms (`duration-100` in `components/ui/popover.tsx`) | Radix default |
| `ExitPoll` dialog | Open/close | Radix `Dialog` default | Radix default | Radix default |
| Evidence `Collapsible` | Open/close | **None** — instant show/hide, no height/opacity transition | — | — |
| `MiniGauge` arc | Value set | **None** — renders at final value on mount | — | — |
| `KpiStatCard` numbers | Value set | NumberFlow count-up (via `ChartStatFlow`) | NumberFlow default | NumberFlow default |
| `FeedbackStatCard` numbers | Value set | **None** — plain static `<span>`, not routed through `ChartStatFlow`/NumberFlow like its sibling `KpiStatCard` | — | — |

**Known gaps, not yet fixed** (surfaced in design review, tracked here so they aren't
re-discovered from scratch): the evidence `Collapsible` has no open/close transition,
`MiniGauge` doesn't animate its value in, and `FeedbackStatCard` doesn't count up like
`KpiStatCard` does. All three were flagged as inconsistent with the rest of the
screen's motion language but intentionally deferred rather than bundled into this
polish pass.

---

## Accessibility Notes

- **`MiniGauge` is screen-reader accessible despite being purely visual SVG**: the
  `<svg>` itself is `aria-hidden="true"`, but a `<span className="sr-only">{value}%
  {label}</span>` sits alongside it announcing the same information a sighted user
  gets from the visible label — added specifically because the SVG-only version was
  an accessibility regression (value existed only inside `<text>`, invisible to
  screen readers). If you touch this component, keep the `sr-only` span.
- **Evidence disclosure trigger**: uses Radix `CollapsibleTrigger` with `asChild` on a
  real `<button type="button">` — `aria-expanded`/`aria-controls`/`data-state` are
  handled by Radix automatically. No custom `aria-label` needed since "View evidence"
  is the visible, accessible text.
- **`ThemesPopover` trigger**: same pattern, real `<button>` with visible text
  ("Themes"), Radix handles `aria-expanded`/`aria-haspopup`.
- **`ExitPoll` rating buttons**: plain `<button>`s, the number is the only accessible
  name, no `aria-pressed` on the selected state — selection is communicated visually
  (border/background) but not announced to assistive tech beyond the button's own
  focus/activation. Not fixed in this pass; flagging for whoever picks up an
  accessibility-focused pass on this screen.
- **Focus order**: natural DOM order top-to-bottom, no `tabIndex` overrides anywhere
  on this screen.

---

## What NOT to Reintroduce

Things this screen used to have, deliberately removed — don't re-add them without
re-reading why they were cut (`docs/superpowers/specs/2026-08-06-reporting-screen-declutter-design.md`):

- Section 01 as a 3-column **card grid** (was `Card` per need, is now a flat
  `divide-y` list with no card background).
- A standalone "Themes that shaped this" full-width card in Section 02 (is now a
  small popover trigger next to the stat row).
- 7 individual stat cards in Section 02 (Liked, Disliked, Selected, Paths explored,
  Options picked, Answered in own words, Notes added — now consolidated to 3:
  Feedback, Paths explored, Your input).
- A separate "Why this should work" fourth section with its own `SectionHead` (is now
  merged into each Section 03 card's evidence disclosure).
- The `HoverCard` "linked to your note" provenance trigger on Section 01 items (quote
  is now shown inline directly, no separate trigger/overlay).
