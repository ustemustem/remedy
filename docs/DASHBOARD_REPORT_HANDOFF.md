# Handoff Spec: Dashboard — "Verified Prescription" Report Screen

Generated from the current implementation (not a pre-build spec) — documents what's
actually built and shipped as of this pass. **Fully supersedes the previous version of
this file.** Every section changed: Section 01 was restructured, Section 02's stat
cards/sentiment chart were deleted and rebuilt as a strip + reading paragraph + theme
columns, and Section 03 went from a 2-column `MiniGauge` card grid to a single-column
hero/support/hidden feed with progressive disclosure. If anything below conflicts with
`docs/superpowers/plans/*` or `docs/superpowers/specs/*`, this file wins — those are
historical planning documents, not maintained after the fact.

**Tech stack:** Next.js (Turbopack) + React 19 + Tailwind v4 + shadcn/ui (radix-nova
style). No backend — every number and sentence on this screen is either derived
synchronously from real graph state (`lib/graph.ts`) or produced by a mocked async/sync
"AI" call (`lib/mockAI.ts`), noted per field below. The chart-library system
(`components/charts/*`, visx-based) is **no longer used anywhere on this screen** —
Section 02's sentiment chart and Section 03's peer-outcome bar chart were both replaced
with plain CSS (flex/grid + filled `<div>` tracks). Do not reach for `components/charts/*`
when extending this screen; there is no remaining precedent for it here.

**Entry point:** `components/dashboard/dashboard-screen.tsx`, rendered by `app/page.tsx`
when `step === 'dashboard'`. Reached via Finalize (canvas) or a `clarifying-question`
node's "View report" CTA. Terminal screen — the only way out is "Back to canvas" or
"Reset session" (the header buttons) or picking a different session from the sidebar.

---

## Overview

A read-only report synthesizing everything the user selected, liked/disliked, and
revised while working the canvas. Three numbered sections, top to bottom: **(01)** what
the app understood from the user's own words (with a two-way hover/click highlight
between the summary paragraph and the detail rows), **(02)** a behavioral read of how
the user actually used the canvas (strip of non-zero metrics + a templated reading
paragraph + accepted/pushed-back theme chips), **(03)** the resulting prescription as a
ranked hero/support/hidden feed with match/outcome/retention signals and evidence.

---

## Layout

- Outer: `components/dashboard/dashboard-screen.tsx` — `flex h-full flex-col`, header
  (`shrink-0`) + a single scrollable body region (`flex-1 overflow-y-auto`). The
  Session Sidebar (persistent app chrome, not part of this screen) has its own
  independent scroll region outside this one.
- Body: `mx-auto max-w-5xl px-4 pb-16` wrapping `<PrescriptionReport />`, followed by
  `<ExitPoll />` (mounts outside the `max-w-5xl` wrapper, its own centered dialog).
- Section 03's feed is single-column at every width (`space-y-3` — no `grid-cols-2` at
  any breakpoint, unlike the previous version of this screen). Section 03's individual
  cards have their own internal breakpoints (KPI strip wraps, evidence bars reflow) —
  see Responsive Behavior below.

### Header
- Left: `public/logo.svg` (28px tall, `h-7`) stacked above "Verified prescription"
  (`font-mono text-lg font-bold`).
- Right: "Back to canvas" (ghost button, `ArrowLeft` icon) + "Reset session" (ghost
  button, `RotateCcw` icon). Both plain navigation — no confirmation dialog on Reset.
- `border-b border-border px-4 py-2.5`.

### Section header pattern (all 3 sections)
Component: `SectionHead` (private, defined inline in `prescription-report.tsx`). No
`hint` prop exists anymore (removed — see "What NOT to Reintroduce").

```
mb-4 mt-10 flex items-baseline gap-3
  01/02/03: font-mono text-xs font-bold text-primary, zero-padded via padStart(2,"0")
  Title: font-heading text-lg font-semibold text-foreground
```

`mt-10` (40px) above every section header, `mb-4` (16px) below it before content —
this is the screen's primary vertical rhythm; don't introduce a different inter-section
gap value elsewhere.

---

## Design Tokens Used

All from `app/globals.css`, under `@theme inline`. This screen (across the three
sections' rework) introduced every token below except the first four, which predate it.

| Token | Value | Usage on this screen |
|---|---|---|
| `--color-card` | `hsl(140 6% 91%)` | Every `Card` background (Section 03's hero/support cards) |
| `--color-primary` | `#1F4838` (light) | Section index numbers, id-codes, liked-theme chips, "Top match" badge, Outcome KPI (the *only* green number), evidence "Teams like you" bar |
| `--color-cta` | `#CD5C1F` | "Sponsored" badge, "From your note" origin marker (Section 01), disliked-theme chips, Section 02's "Pushed back on" strip segment |
| `--color-foreground` / `--color-muted-foreground` | — | Primary vs. secondary text throughout; Match/Retention KPI numbers are explicitly `--color-foreground` (neutral), never tinted |
| `--color-border` | `hsl(100 4% 80%)` | Hairlines: row dividers, KPI cell dividers, evidence track background base |
| `--radius-card` (via `--radius: 4px`) | `4px` | All `Card` components |
| `--card-px` | `16px` | Horizontal inset on every card's content AND on `NeedSummaryList`'s rows — keeps Section 01 and Section 03 left-aligned with each other |
| `--text-meta` | `11px` | Smallest micro-label size — strip/KPI labels, evidence footer captions |
| `--text-label` | `12px` | Badges, quote-adjacent captions, evidence pill text, theme chips |
| `--text-quote` | `13px` | Section 01's user-quote line — must read above `--text-meta`/`--text-label` |
| `--text-body` | `14px` | Hero card body paragraph (same value as Tailwind `text-sm`, tokenized for Section 03) |
| `--text-title` | `20px` | **Report-wide "title" size** — Section 01's need-row title AND Section 03's hero title both use this token (bumped together per explicit owner decision; do not scope this larger scale to Section 03 alone) |
| `--text-support-title` | `17px` | Section 03 support/hidden card title only |
| `--text-kpi` | `26px` | Section 03 hero KPI strip numbers (Outcome/Match/Retention) |
| `--text-match` | `30px` | Section 03 support/hidden card's right-aligned Match number |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Every mount-in stagger animation on this screen (need rows, strip segments, theme columns) |
| `--font-mono` (IBM Plex Mono) | — | Section index, id-codes, KPI/Match numbers, strip values, theme labels — the "label/data" register |
| `--font-sans` / `--font-heading` | — | Titles, body copy, summary paragraphs — the "prose" register |

---

## Components

| Component | File | Props | Notes |
|---|---|---|---|
| `PrescriptionReport` | `prescription-report.tsx` | `{ nodes: CanvasNodeData[] }` | Orchestrator. Owns Section 01's hover/sticky highlight state and Section 03's `showHidden` toggle. Calls `deriveDashboardNeeds`, `deriveThemeEntries`, `deriveDashboardFeed` (all `lib/graph.ts`, synchronous, pure, memoized on `nodes`/`needs`). |
| `UnderstoodSummary` | `understood-summary.tsx` | `{ needs, highlightedId, onEnter, onLeave, onToggle }` | Section 01's synthesized paragraph. Self-contained async fetch + own loading state. Refs inside the paragraph are clickable/hoverable, two-way bound to `NeedSummaryList` rows via the lifted highlight state. |
| `NeedSummaryList` | `need-summary-list.tsx` | same highlight props as above, `{ needs }` | Section 01's per-need rows — real `<button>`s (not divs), stagger in via `.need-row-in` (40ms/step, capped at 4 steps). No card background — plain `divide-y` list. |
| `SessionSummarySection` | `session-summary-section.tsx` | `{ nodes: CanvasNodeData[]; themes: ThemeEntry[] }` | Section 02 in full: strip + reading paragraph + theme columns. Computes `stats` via `useMemo(() => deriveSessionStats(nodes), [nodes])`, no async fetch — see States note. |
| `SessionStrip` | `session-strip.tsx` | `{ stats: SessionStats }` | Up to 5 segments (Liked/Pushed back on/Paths explored/Selected/Notes left); zero-value segments are omitted, not shown as "0". `flex-1` per segment always, regardless of count (explicit owner decision — do not add an intrinsic-width fallback for low counts). |
| `ThemeColumns` | `theme-columns.tsx` | `{ themes: ThemeEntry[] }` | Two-column "Accepted" / "Pushed back on" chip grid, `min-[620px]:grid-cols-2` (single column below). Returns `null` when there are no themes at all — no "nothing yet" placeholder. |
| `PrescriptionCard` | `prescription-card.tsx` | `{ need: DashboardNeed }` | **Hero card only** — rendered at most once per report. KPI strip + evidence two-bar comparison. |
| `PrescriptionCardCompact` | `prescription-card-compact.tsx` | `{ need: DashboardNeed }` | Support **and** hidden cards both use this — there is no visual distinction between "support" and "hidden" card styling, only their position (before/after the "See more" toggle). |
| `SeeMoreButton` | `see-more-button.tsx` | `{ count, expanded, onToggle }` | Dumb toggle button; the actual reveal animation lives in the parent's `.see-more-panel` wrapper, not in this component. |
| `InfoTooltip` | `info-tooltip.tsx` | `{ text: string }` | CSS-only popover (`:hover`/`:focus-within`, no JS state, no Radix). Used after every scored/percentage label: Outcome, Match, Retention, Evidence caption, support card's Match label. |
| `EvidenceRow` | `evidence-row.tsx` | `{ examples: EvidenceExample[] }` | Unchanged from before this pass. The 3-column linkedin/app/company narrative block, reused inside both `PrescriptionCard`'s support-card evidence panel (hero does **not** render this — chart only, see Section 03 spec) and `PrescriptionCardCompact`'s. |
| `ExitPoll` | `exit-poll.tsx` | none | Unchanged. Self-contained dialog, no props, no dependency on report data. |

### Removed since the previous version of this doc

`feedback-stat-card.tsx`, `kpi-stat-card.tsx`, `components/charts/chart-stat-flow.tsx`,
`themes-popover.tsx`, `mini-gauge.tsx` — all deleted, zero remaining consumers. Do not
re-add imports of any of these; they no longer exist in the repo.

### Data functions consumed (not components, but load-bearing)

| Function | File | Sync/Async | Returns |
|---|---|---|---|
| `deriveDashboardNeeds(nodes)` | `lib/graph.ts` | Sync | `DashboardNeed[]` — `{ node, category, quote, revisionCount, eliminated?, peerOutcome? }`, one per selected non-superseded node |
| `deriveThemeEntries(nodes)` | `lib/graph.ts` | Sync | `ThemeEntry[]` — `{ theme, type: "like"\|"dislike", nodeIds }`, deduped by theme+type |
| `deriveSessionStats(nodes)` | `lib/graph.ts` | Sync | `SessionStats` — `{ likeCount, dislikeCount, selectedCount, pathCount, optionPickCount, ownFramingCount, noteCount }` |
| `deriveDashboardFeed(needs)` | `lib/graph.ts` | Sync | `DashboardFeed` — `{ hero: DashboardNeed \| null, support: DashboardNeed[], hidden: DashboardNeed[] }`. Sorts by `matchScore` desc (missing score sorts last); hero = first item where `transparency !== "sponsored"`; if none qualify, `hero` is `null` and everything falls to support/hidden in ranked order |
| `deriveEvidenceComparison(peerOutcome)` | `lib/graph.ts` | Sync | `EvidenceComparison \| null` — `{ you, typical, deltaPts }`. **Documented mock rule, not a real derivation**: `you` = last entry of `peerOutcome.bars`, `typical` = average of the rest. `PeerOutcome`'s shape was deliberately left alone (no new `outcomeYou`/`outcomeTypical` fields) pending planned LLM-sourced real values |
| `getUnderstoodSummary(needs)` | `lib/mockAI.ts` | **Async, ~500–1500ms mock delay** | `SummarySegment[]` — Section 01's paragraph, mixed text/ref segments |
| `buildSessionReadout(stats, themes)` | `lib/mockAI.ts` | **Sync**, not async — no loading stage | `ReadoutSegment[]` — Section 02's reading paragraph, plain text/emphasis segments (no node refs, unlike `SummarySegment`) |

---

## Section-by-Section Spec

### Section 01 — "What we understood"

**Layout:** `<div className="space-y-3">` containing `<UnderstoodSummary>` then
`<NeedSummaryList>`, sharing one lifted highlight state (owned by `PrescriptionReport`).

**Two-way highlight:** hovering/focusing a ref in the summary paragraph highlights the
matching `NeedSummaryList` row (and vice versa); clicking either **pins** it (sticky —
survives mouse-leave until clicked again or Escape is pressed). `Escape` clears both
`stickyId` and `hoveredId` globally (`keydown` listener on `document`, added in
`prescription-report.tsx`'s `useEffect`).

**Summary paragraph** (`UnderstoodSummary`):
- `text-sm text-foreground`, single paragraph. Ref segments render as real
  `<button>`s: `underline decoration-primary/40`, `hover:bg-primary/12`, highlighted
  state is `bg-primary/12 decoration-primary`.
- A ref segment whose `nodeId` doesn't match any current need's id degrades to plain
  text — not a dead link. This is a designed degrade path, not a bug guard.
- **Mocked LLM seam** — `getUnderstoodSummary` in `lib/mockAI.ts` branches on
  `needs.length` (1 / 2 / 3+ have distinct templates). Not real summarization; read the
  function, not the sentence content, as the spec.

**Detail list** (`NeedSummaryList`): real `<button>`s, `divide-y divide-border`, each
`px-[var(--card-px)] py-3`, `.need-row-in` stagger (40ms/step, capped at 4 steps,
`translateY(6px)`→0 + opacity, 320ms `var(--ease-out)`). No card background.

Per row:
1. `flex flex-wrap items-baseline gap-x-2 gap-y-1`: title
   (`text-[length:var(--text-title)] font-semibold`, version suffix stripped) + category
   `Badge variant="outline"`.
2. Quote — own line, `mt-1 text-[length:var(--text-quote)] italic text-foreground/78`.
3. Meta line — `mt-1.5 text-[length:var(--text-label)] text-muted-foreground`:
   - If `n.node.origin?.intent === "branch_new_direction"`: prefixes with
     `"From your note"` (`font-mono text-cta uppercase`) + a `·` separator before the
     path summary.
   - Path summary: `"{1|2} approach{es} explored/accepted directly"` +
     `" · {N} revision{s}"` or `" · no revisions"`.

### Section 02 — "How we read your situation"

**Layout:** `<div className="space-y-4">`, three children in order (first two always
render, third conditionally):

**1. `SessionStrip`** — up to 5 segments (Liked / Pushed back on / Paths explored /
Selected / Notes left), each computed from `deriveSessionStats`. **Zero-value segments
are filtered out entirely** — a quiet 2-metric session shows exactly 2 segments, not 5
with zeros. `flex-1` per segment regardless of count (explicit decision — a 2-segment
session's segments each stretch to ~half the strip's width; this was chosen over an
intrinsic-width fallback specifically to avoid a second layout mode). Segment value:
`font-mono text-[19px] font-bold` — a **hardcoded literal, not `--text-kpi`**. It
predates the Section 03 token work and was not retroactively tokenized; don't assume
`--text-kpi` covers this value if you touch it. Liked segment tinted `text-primary`,
Pushed-back-on tinted `text-cta`, all others neutral (`text-foreground`). `border-r
border-border` between segments (last has none).
Stagger: `.strip-segment-in`, 35ms/step, `translateY(5px)`→0 + opacity, 300ms.
Wraps to single column with borders dropped under `max-[560px]`.

**2. Reading paragraph** — `text-sm leading-[1.55] text-foreground`, built by
`buildSessionReadout(stats, themes)` (sync, templated, same canned-copy convention as
`getUnderstoodSummary` but with no async delay/loading stage — see States). Emphasis
segments (`font-medium`) mark the paragraph's most telling phrases (a recommendation
count, a specific liked/disliked theme name). Conditional clauses: mentions paths only
if `pathCount > 0`; mentions liked/disliked themes only if present (and varies phrasing
by which combination exists); mentions notes only if `noteCount > 0`.

**3. `ThemeColumns`** — only renders if at least one liked or disliked theme exists (no
"nothing yet" placeholder for the empty case — the whole block is simply absent).
`grid grid-cols-1 min-[620px]:grid-cols-2 gap-6`, separated from the reading paragraph
by `border-t border-border pt-3.5 mt-4`. Each column: mono/bold/uppercase label
(`--primary` "Accepted" / `--cta` "Pushed back on") + wrapped chip row below
(`rounded-full`, tinted border ~35%/bg ~7% of the column's color). Chips wrap
internally within their own column without affecting the other column's layout or the
row's height — verified with 7 chips on one side. Stagger: `.theme-column-in`, the two
columns fire at 170ms/215ms respectively (not per-chip), `translateY(6px)`, 320ms.

### Section 03 — "Your prescription"

**This is a ranked feed, not a grid.** `deriveDashboardFeed(needs)` sorts all needs by
`node.matchScore` descending (a `null`/`undefined` score sorts last, never first), then:

- **Hero** = the first item in that sorted order where `node.transparency !==
  "sponsored"`. A sponsored recommendation is *never* the hero, however high its score.
- **Support** = the next up to 2 items from the remaining (sorted-minus-hero) list —
  this can include a sponsored item if its score ranks it there.
- **Hidden** = everything else, behind "See more".
- **Edge case (not literally covered by the original design brief, resolved during
  implementation):** if *every* need is sponsored, there is no eligible hero at all —
  `hero` is `null`, nothing crashes or fabricates a hero, and every need renders as a
  support/hidden card instead. This is now rare in practice: see the mock-data note
  below.

Render order: `<PrescriptionCard need={feed.hero} />` (if non-null) → `feed.support`
mapped to `<PrescriptionCardCompact>` → (if `feed.hidden.length > 0`) a
`.see-more-panel` wrapping `feed.hidden` mapped to `<PrescriptionCardCompact>`, plus a
`<SeeMoreButton>`.

**Mock-data note — `transparency` defaults:** as of this pass, `getOptionResponse` and
`branchFromChoiceFraming` (`lib/mockAI.ts`) both set `transparency: "organic"` on the
recommendation they produce (picking an A/B/C option, or typing your own framing, are
both organic user decisions). Only `getInitialCanvas`'s first-pass pair and
`getPreferredContinuation`'s inherited value can currently be anything other than
organic, and nothing in the current mock ever actually produces `"sponsored"` — it's a
reachable, spec'd, tested state (see Verification note below) that the live mock simply
never generates today. If you're debugging "why doesn't the Sponsored badge ever show
up," this is why — inject `transparency: "sponsored"` on a test node manually, don't
assume the real flow will produce one.

#### Hero card (`PrescriptionCard`) — top to bottom

1. **Header row** — id-code (`node.id.split("-")[0]`, `font-mono text-xs font-bold
   uppercase text-primary`) left, `<Badge>Top match</Badge>` (default variant = `bg-primary
   text-primary-foreground`) right. Unconditional — a hero always shows this badge.
2. **KPI strip** — up to 3 cells, conditionally present:
   - Outcome (only if `deriveEvidenceComparison(peerOutcome)` is non-null): `+{deltaPts}%`,
     `text-primary` — **the only green KPI number**.
   - Match (only if `node.matchScore != null`): the raw number, `text-foreground` (neutral).
   - Retention (only if `node.retentionRate != null`): `{value}%`, `text-foreground`.
   - Zero, one, two, or three cells can render depending on data — the strip itself is
     omitted entirely if all three are absent (not shown as an empty bordered row).
   - Each cell: `font-mono text-[length:var(--text-kpi)] font-bold` value above a
     `text-[length:var(--text-meta)] uppercase` label + `<InfoTooltip>`. Cells after the
     first get `border-l border-border`.
3. **Title** — `text-[length:var(--text-title)] font-semibold`, version suffix stripped.
4. **Body** — `node.body`, `text-[length:var(--text-body)] text-muted-foreground`.
5. **Evidence** (only if `deriveEvidenceComparison` is non-null — same gate as the
   Outcome KPI cell, so Outcome and Evidence always appear/disappear together):
   - Caption row: "Evidence" + `<InfoTooltip>`, right-aligned "% FASTER WORK" unit label.
   - Two bar rows (`label | track | value`): "Teams like you" (`--color-primary` fill
     and value) then "Typical team" (`color-mix(in srgb, var(--color-primary) 22%,
     transparent)` fill, muted value). Track background:
     `color-mix(in srgb, var(--color-foreground) 9%, transparent)`. Bar width = the
     value itself, 0–100, clamped.
   - Footer: `+{deltaPts} pts ahead` chip (`color-mix(..., 12%, ...)` bg, `text-primary`)
     + `Based on {cohortSize} teams`.
   - **Hero never renders `evidenceExamples`** — explicit decision, chart-only, to avoid
     crowding the highest-detail card further. `evidenceExamples` only ever appear on
     support/hidden cards.

#### Support/hidden card (`PrescriptionCardCompact`)

1. **Header** — id-code, plus `<Badge className="bg-cta text-cta-foreground">Sponsored</Badge>`
   **only** when `node.transparency === "sponsored"`. No badge at all when organic —
   organic is implicit, there is no "Organic" badge anymore (the previous version of
   this screen had one; it was removed).
2. **Body grid** `grid-cols-[1fr_auto]`:
   - Left (`min-w-0`, `truncate`d title so it never wraps into a second line and
     collides with the Match number): title (`text-[length:var(--text-support-title)]
     font-semibold`) → outcome line (only if evidence comparison exists): `+{deltaPts}%`
     (`text-primary font-bold`) + `"faster work"` + `· n={cohortSize}` (mono, muted).
   - Right (only if `node.matchScore != null`, `border-l border-border pl-4`): the raw
     match number at `text-[length:var(--text-match)]` (**30px — the single largest
     number on this screen, larger even than the hero's KPI numbers**), `text-foreground`
     neutral, "Match" label + `<InfoTooltip>` below.
3. **Evidence** (`Collapsible`, only rendered if `evidenceCount > 0`, where
   `evidenceCount = (peerOutcome ? 1 : 0) + (evidenceExamples?.length ?? 0)`):
   - Trigger: `"View evidence · {evidenceCount}"` pill, `ChevronRight` rotates 90° open.
   - Content: `peerOutcome.cohortDefinition` sentence (if present) then
     `<EvidenceRow examples={...} />` (if present). **No chart on support/hidden
     cards** — that's hero-exclusive.

---

## States and Interactions

| Element | State | Behavior |
|---|---|---|
| `UnderstoodSummary` | Loading | `AITextLoading` cycling `["Reading what you wrote…", "Summarizing…"]` at 700ms — replaces the paragraph entirely until the mock fetch resolves |
| `UnderstoodSummary` | `needs` reference changes (session switch) | `needs !== trackedNeeds` reference check resets to loading and re-fetches — intentional, and depends on `PrescriptionReport` memoizing `needs`/`themes`/`feed` on `nodes` (see the comment at the top of that file); if that memo is ever removed, every hover in Section 01 will incorrectly reset this back to loading |
| `SessionSummarySection` | Any state | **No loading state at all** — `deriveSessionStats` and `buildSessionReadout` are both synchronous now (the old `SessionSummarySection` had an async fetch/loading stage; that's gone). Don't add a loading skeleton here without reason; there's nothing to wait on |
| Section 01 ref / row | Hover, focus, click | Two-way highlight — see Section 01 spec above for the full sticky/Escape behavior |
| Evidence disclosure (support/hidden cards) | Click, Enter/Space, tap | Radix `CollapsibleTrigger asChild` on a real `<button>` — keyboard and touch both work natively, `aria-expanded`/`data-state` handled by Radix |
| `InfoTooltip` trigger | Hover (desktop, `@media (hover: hover) and (pointer: fine)`), focus, tap | CSS-only, no JS — opens via `:hover`/`:focus-within` on the wrapping `.info-tooltip` span. A tapped `<button>` picks up `:focus` on touch, so tap works without a separate touch handler |
| `SeeMoreButton` | Click | Toggles `showHidden` in `PrescriptionReport`; label swaps `"See more · {n}"` ↔ `"See less"`, chevron rotates 180° |
| `ExitPoll` dialog | Mount | Opens automatically and exactly once per dashboard mount (`useState(true)`, not an effect) |
| `ExitPoll` rating buttons | Select | Selecting sets `border-primary bg-primary/10 text-primary`; Submit disabled until a rating is picked |
| `ExitPoll` | After Submit | Replaces the rating row with "Thanks, that's recorded." and swaps the footer button to "Close" |

---

## Responsive Behavior

| Breakpoint | Changes |
|---|---|
| `max-[560px]` | `SessionStrip` segments wrap to (effectively) one per row and drop their `border-r`/padding pairing |
| `max-[620px]` (i.e. below `min-[620px]`) | `ThemeColumns` collapses from 2 columns to 1 |
| Section 01 | No breakpoint behavior — `flex-wrap` on the row's first line lets long titles wrap naturally at any width |
| Section 03 | Single-column at every width by design (this is the point of the feed redesign — no `lg:grid-cols-2` exists anymore). Individual cards use `flex-wrap`/`min-w-0`/`truncate` internally so their own content reflows rather than the layout changing columns |

Verified down to 375px (mobile preset) with the session sidebar collapsed: no
horizontal scroll, KPI strip and evidence bars reflow, support card titles truncate
rather than colliding with the Match number. **Not verified with the session sidebar
expanded below ~560px** — the sidebar itself doesn't currently collapse automatically
at narrow viewports (a pre-existing, screen-independent issue, not something this pass
touched or fixed).

---

## Edge Cases

- **Zero selected needs**: `PrescriptionReport` returns early with a muted-text message
  — none of the 3 sections render. First check in the component; nothing above it
  (including `UnderstoodSummary`'s async fetch) mounts.
- **`node.matchScore == null`**: hero's Match KPI cell omitted (strip becomes 2-up or
  fewer); support/hidden card's entire right-hand Match column omitted — the left
  column does not expand to fill the freed space (`grid-cols-[1fr_auto]` with the
  `auto` slot simply absent).
- **`node.retentionRate == null`**: hero's Retention KPI cell omitted only.
- **`peerOutcome` absent** (→ `deriveEvidenceComparison` returns `null`): hero renders
  its KPI strip (Match/Retention only, no Outcome cell) with **no Evidence block at
  all** — not an empty chart. Support/hidden card's outcome line (the `+N% faster
  work · n=` line) is omitted; only title (and Match, if present) show.
- **`peerOutcome.bars` is an empty array**: `deriveEvidenceComparison` returns `null`
  (guarded explicitly) — same degrade as "absent" above, not a divide-by-zero or NaN.
- **`evidenceExamples` absent AND `peerOutcome` absent**: no "View evidence" control on
  that support/hidden card at all (not a disabled trigger).
- **`evidenceExamples` absent, `peerOutcome` present** (or vice versa): the evidence
  panel still renders, containing only whichever half is present.
- **Every selected need is sponsored**: `deriveDashboardFeed` returns `hero: null`; all
  needs render as support/hidden cards. See the Section 03 spec above and the
  mock-data note on why this is rare but not impossible.
- **No liked/disliked themes at all**: `ThemeColumns` renders `null` — Section 02 shows
  only the strip + reading paragraph (both always render, per the "shrink, never
  disappear" rule — a quiet session is 2 strip segments + 1 sentence, not a padded
  empty state).
- **All `SessionStats` fields are 0**: `SessionStrip` returns `null` (all 5 segments
  filtered out) — the reading paragraph still renders (its own conditional clauses all
  fall through to the base "You landed on N recommendations" sentence).
- **Very long quote/title text**: Section 01 wraps via `flex-wrap`, no truncation.
  Section 03's support/hidden card title `truncate`s (single line, ellipsis) — this is
  a deliberate difference from Section 01, driven by the fixed `grid-cols-[1fr_auto]`
  layout needing the Match number to never be pushed off/wrapped under.
- **Session switch while `UnderstoodSummary` is mid-fetch**: the in-flight
  `getUnderstoodSummary` promise is allowed to resolve but its result is discarded via
  a `cancelled` flag closure in the `useEffect` cleanup — no stale-session flicker, and
  no visible "cancelled" state; it silently re-enters loading for the new session.
  (`buildSessionReadout` has no equivalent concern — it's synchronous.)

---

## Animation / Motion

| Element | Trigger | Animation | Duration | Easing |
|---|---|---|---|---|
| Section 01 need rows | Mount | `.need-row-in`, `translateY(6px)`→0 + opacity, 40ms/row stagger, capped at 4 steps | 320ms | `var(--ease-out)` |
| Section 02 strip segments | Mount | `.strip-segment-in`, `translateY(5px)`→0 + opacity, 35ms/segment stagger | 300ms | `var(--ease-out)` |
| Section 02 theme columns | Mount | `.theme-column-in`, `translateY(6px)`→0 + opacity, columns fire at fixed 170ms/215ms delays (not per-chip) | 320ms | `var(--ease-out)` |
| Section 03 "See more" reveal | Toggle | `.see-more-panel`, `grid-template-rows: 0fr`→`1fr` (animates open AND closed, no JS height measurement) | 320ms | `var(--ease-out)` |
| `InfoTooltip` bubble | Hover/focus | Opacity + `translateY` fade via `.info-tooltip-bubble` | 160ms | `var(--ease-out)` |
| Evidence `Collapsible` (support/hidden cards) | Open/close | **None** — Radix default, instant show/hide, no height/opacity transition | — | — |
| `ThemesPopover` content | — | **Removed with the component** — no popover exists on this screen anymore | — | — |

**`prefers-reduced-motion: reduce`**: every custom keyframe animation above
(`.need-row-in`, `.strip-segment-in`, `.theme-column-in`) swaps to a shared
200ms-opacity-only fade (`need-row-fade-kf`) with translate dropped, guarded in
`app/globals.css`. `.see-more-panel`'s grid-rows transition is fully disabled (`transition:
none`) rather than shortened. `.info-tooltip-bubble`'s transition shortens to 120ms
opacity-only with the translate forced off via `!important`. If you add a new
mount-in/toggle animation to this screen, mirror one of these two patterns — don't
introduce a third reduced-motion strategy.

---

## Accessibility Notes

- **Section 03 KPI numbers are plain text, not SVG** (unlike the previous version's
  `MiniGauge`, which needed an explicit `sr-only` span because its value only existed
  inside an SVG `<text>` element). No equivalent workaround is needed here — a
  screen reader reads the number and its label as normal adjacent text content.
- **`InfoTooltip`** is a real `<button aria-label="More info">` wrapping a `role="tooltip"`
  span, no Radix/JS state — opens on `:focus-within` for both keyboard and (since a
  tapped button receives focus) touch, and on `:hover` gated to
  `(hover: hover) and (pointer: fine)` so it doesn't stick open after a tap on touch
  devices.
- **Evidence disclosure trigger**: `CollapsibleTrigger asChild` on a real
  `<button type="button">` — `aria-expanded`/`aria-controls`/`data-state` handled by
  Radix automatically.
- **`SeeMoreButton`**: plain `<button aria-expanded={expanded}>`, not Radix-backed (this
  toggle isn't a `Collapsible` — it's a custom grid-rows reveal), so `aria-expanded` is
  set manually and must be kept in sync with `showHidden` if this component changes.
- **Section 01 rows and refs**: real `<button>`s throughout, `focus-visible:outline-2
  outline-primary`. `Escape` clears the sticky highlight globally (see Section 01 spec).
- **`ExitPoll` rating buttons**: plain `<button>`s, the number is the only accessible
  name, no `aria-pressed` on the selected state — selection is communicated visually
  only. Not fixed in this pass; unchanged from before.
- **Focus order**: natural DOM order top-to-bottom, no `tabIndex` overrides anywhere
  on this screen.

---

## Known Gaps / Dead Fields (flag, don't silently fix)

- **`CanvasNodeData.matchFactors`** is populated by every mock code path that sets
  `matchScore` (`MOCK_MATCH_FACTORS`, a fixed 4-entry weighted list — "Team size fit,"
  "Stated pain points," etc.) but **is never read by any component on this screen**.
  It's live mock data with no UI consumer. If a future pass wants to surface "why this
  score," this is already-sourced data sitting unused — don't regenerate an equivalent
  structure from scratch.
- **`matchScore`/`retentionRate` provenance**: both are `hardcoded base + ±8
  like/dislike-theme-match nudge + random noise` (see `lib/mockAI.ts`'s `biasFor`/
  `swing`), not a real scoring model. Section 03 ships them at full visual prominence
  (26px hero KPI, 30px support Match) anyway — an explicit owner decision to build the
  design "real-data-ready" now rather than wait, not an oversight. If a real scoring
  model lands later, no rendering change should be needed, only the mock data source.
- **Evidence "you vs typical" numbers** (`deriveEvidenceComparison`) are a documented
  placeholder rule (last bar = you, average of the rest = typical), not real
  per-segment data — see the function's own doc comment in `lib/graph.ts` and the
  Section 03 spec above. `PeerOutcome`'s shape was deliberately not extended for this;
  expect it to change once real LLM-sourced values are available.

---

## What NOT to Reintroduce

Things this screen used to have, deliberately removed across this and the prior pass —
don't re-add without understanding why they were cut:

- Section 01 as a 3-column **card grid** (flat `divide-y` list with no card background
  now, and predates even that — no card grid version currently exists to revert to).
- `ThemesPopover` (a standalone "Your reactions" popover trigger in Section 02) — its
  content now lives inline as `ThemeColumns`, always visible, no click-to-reveal.
- Section 02's 3 `KpiStatCard`/`FeedbackStatCard` grouped stat cards and its sentiment
  `LineChart` — replaced by `SessionStrip` (up to 5 ungrouped, individually-hideable
  segments) and the templated reading paragraph. `lib/mockAI.ts`'s `getSessionSummary`,
  `buildSentimentTimeline`, `buildSummarySentence`, `classifyRevisionTone`, and the
  `SentimentPoint`/`SessionSummary` types are all deleted — do not resurrect these
  names expecting old behavior; they're gone from the codebase entirely.
- Section 03 as a `grid-cols-1 lg:grid-cols-2` card grid with `MiniGauge`s and an
  "Organic"/"Sponsored" badge pair on every card — replaced by the hero/support/hidden
  ranked feed. `MiniGauge`'s SVG semicircle geometry does not carry over to anything;
  the KPI/Match numbers are plain typography now.
- The "Organic" badge specifically — organic is implicit (no badge) now; only
  "Sponsored" ever renders a badge.
- A separate "Why this should work" fourth section — evidence lives inside each
  Section 03 card (chart-only on hero, `EvidenceRow`-only on support/hidden), there is
  no fourth `SectionHead` on this screen.
