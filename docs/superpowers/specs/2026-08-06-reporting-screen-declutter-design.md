# Reporting Screen — Declutter Pass (3 Sections, Grouped Stats, Merged Evidence)

**Status:** Approved, pending write-up review
**Date:** 2026-08-06
**Scope:** `components/dashboard/*`, `lib/graph.ts`, `lib/types.ts`

## Context

The 2026-08-03 pass (`2026-08-03-reporting-screen-kpi-design.md`) added session
KPIs, a behavioral sentiment summary, and mock evidence cards to the Verified
Prescription dashboard. Once built, the result had too much repeated/low-value
data spread across four sections, and too much empty whitespace in the
prescription cards. This pass restructures the same underlying data (no new
mock data sources) into three sections instead of four, consolidates the KPI
row, and merges "Your prescription" with "Why this should work."

This spec **replaces the visual/structural shape** the 08-03 spec produced. It
does not change `lib/mockAI.ts`'s data generation (`getSessionSummary`,
`deriveSessionStats`, `evidenceExamples`) — only how `components/dashboard/*`
lays that data out.

## Non-goals

- No change to `lib/mockAI.ts` mock data generation or its async delay
  convention.
- No change to the dashboard header or `ExitPoll` — out of scope.
- No new real data sourcing — evidence examples remain the existing generic,
  non-identifiable mock content (PRD Section 7, still deferred).

## Section 1 — "What we understood" (was: 3 cards → now: one explanation block)

Replaces the `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` card grid with a
single block under the existing `SectionHead`. One line per `DashboardNeed`,
list-style (not prose paragraph):

Per line:
- Need title (`node.title`, version suffix stripped — same regex already used
  elsewhere: `.replace(/\s\(v\d+\)$/, "")`)
- Quote, inline, styled as it is today (italic, muted)
- Category badge (`n.category`) — same `Badge variant="outline"` as today
- `"{n} approaches explored · {m} revisions"` text — same string logic as
  today's card footer (`n.eliminated ? "2 approaches explored" : "1 approach
  accepted directly"`, plus revision count)

Removed: the `HoverCard` "linked to your note" trigger (the provenance
click-through it replaced in the prior 08-03 spec is already gone from
today's code) entirely. No replacement — the quote is already inline in the
line itself, so a separate provenance affordance is redundant now.

Layout: `<ul>`-equivalent (a `div` with `divide-y` or simple `border-t`
per-row separators), full width, no per-item card background — this is meant
to read as an explanation, not a grid of cards.

## Section 2 — Stats + Themes + Sentiment (was: "How we read your situation" + 7-stat KPI row)

Single section, one `SectionHead` ("How we read your situation" — title
unchanged). Contents, top to bottom:

### 2a. Grouped stat row (3 cards, not 7)

Reuses `deriveSessionStats` (`lib/graph.ts`) unchanged — only the UI grouping
changes. Three `KpiStatCard`-style cards, framed as **what we took from your
input**, not "actions you performed":

1. **Feedback** — `likeCount` and `dislikeCount` shown together in one card
   (e.g. two stacked/side-by-side `ChartStatFlow`-style numbers, or one
   `"{like} liked · {dislike} disliked"` composite value), label: `"Feedback"`.
2. **Exploration** — `pathCount + optionPickCount` combined into a single
   displayed number (sum), label: `"Paths explored"`. (Rationale: both
   measure branching/decision surface area from the same underlying session;
   showing them separately was the redundancy being trimmed.)
3. **Your input** — `selectedCount + noteCount + ownFramingCount` combined
   into a single displayed number (sum), label: `"Your input"`.

These three cards keep the existing `KpiStatCard` visual style (mono bold
value, muted label) — only the count computed per card and the label text
change, plus there are 3 instead of 7.

### 2b. Themes trigger (was: full-width "Themes that shaped this" card)

`deriveThemeEntries` (`lib/graph.ts`) is unchanged. Its output no longer
renders as its own `Card`. Instead: a small trigger element (icon + short
label, e.g. a tag/sparkle icon with `"Themes"` text) placed inline next to (or
appended to) the 3 stat cards. Clicking it opens a `Popover`
(`components/ui/popover.tsx`, already installed) containing the same
like/dislike theme chips rendered today (`+ Ownership clarity`,
`− Heavy tooling changes`, etc., same color logic).

**Explicit choice (both `Popover` and `HoverCard` exist in `components/ui/`,
and Section 1 above removes the only current `HoverCard` usage, so there's no
existing-usage precedent to defer to):** use `Popover`, not `HoverCard` — a
click-to-open trigger reads more intentionally as "there's more detail here"
for a small icon+label affordance than a hover reveal does, and avoids
accidental-hover trigger noise given the trigger sits directly next to 3
stat cards a user's cursor will be passing over anyway.

### 2c. Sentiment sentence + timeline chart

Unchanged from the 08-03 spec: `getSessionSummary`'s `sentence` renders above
the timeline chart plotting `SentimentPoint[]`. Same loading-state handling
(renders its own shimmer while the mock async call is in flight).

## Section 3 — "Your prescription" (merged with "Why this should work")

Single `SectionHead` ("Your prescription" — title unchanged; "Why this should
work" as a separate heading is removed). Layout changes from a full-width
stacked list (`flex flex-col gap-3`) to a grid (`grid-cols-1 lg:grid-cols-2` —
match Section 1's prior card-grid pattern), one card per `DashboardNeed`.

Each card now contains, top to bottom:

1. Need code + title + Organic/Sponsored badge (unchanged from today).
2. **Which Section 1 item this relates to** — a small label referencing the
   need (the same `n.node.id.split("-")[0]` short code already used
   elsewhere, e.g. `"rec"`/`"branch"`), so the card is traceable back to its
   Section 1 line without needing the removed hover/click provenance link.
3. Body text (`n.node.body`) — unchanged.
4. **Match score / Active retention as Gauge charts**, replacing the current
   plain `{value}%` + label pairs. Two small arc gauges side by side, each
   using the `Gauge` component from the `@bklit` registry
   (`https://ui.bklit.com/r/gauge-chart.json`, installed via
   `npx shadcn add @bklit/gauge-chart` — this registry is already configured
   in `components.json`). Per gauge: `value` = the score/rate itself (0–100
   scale, both fields are already percentages so no conversion needed),
   `centerValue` = the same number for the label, `defaultLabel` = `"Match
   score"` / `"Active retention"` respectively, small `minWidth` sized to fit
   two side by side inside the card (implementation detail — pick a value
   that fits the grid card's column width, verify visually).
   **Both fields are already independently optional today** (today's code
   guards each with its own `n.node.matchScore != null` /
   `n.node.retentionRate != null` check) — that stays true here: render
   whichever gauge(s) have data, and if only one is present it takes the
   card's full gauge-row width alone rather than leaving an empty slot next
   to it.
5. Evidence, as an **attached expandable area** (not always-open, not a
   separate section): a `Collapsible`/disclosure trigger (e.g. `"View
   evidence"`) which, when opened, shows:
   - The existing peer-outcome bar chart (`n.peerOutcome.bars`) + `n=` cohort
     size badge — unchanged from today.
   - The cohort definition sentence — unchanged from today.
   - The 3 `evidenceExamples` (LinkedIn / app / company), **restructured**
     from today's plain label+detail columns into 3 separate
     heading-plus-narrative blocks, kept as distinct blocks (not merged into
     one paragraph):
     - **LinkedIn** (`kind: "linkedin"`) → heading **"Our recommendation"**,
       body: the recommendation framed as a sentence, followed by the
       LinkedIn example's `label` (role/company descriptor) and `detail`
       (their outcome) rendered as a quote (e.g. blockquote styling,
       consistent with the italic-quote styling already used for Section 1's
       quotes).
     - **App** (`kind: "app"`) → heading **"App suggestion"**, body: `label`
       + `detail` rendered as a short narrative sentence (not two separate
       label/value lines).
     - **Company** (`kind: "company"`) → heading **"Company match"**, body:
       `label` + `detail` rendered the same narrative way.

If `evidenceExamples` is undefined for a node (pre-existing edge case from the
08-03 spec, e.g. a session loaded from old localStorage data), the evidence
disclosure trigger itself is omitted for that card — same rule as before, just
now applied to a trigger instead of an always-visible row.

## New dependency

`@bklit/gauge-chart` needs installing (`npx shadcn add @bklit/gauge-chart`).
Per this project's own `shadcn` skill workflow: after adding, read the added
files, fix hardcoded import paths to this project's aliases (`@/components`,
`@/lib`), and wire `activeFill`/`inactiveFill` to this project's existing
`--color-chart-*`/`--color-primary` custom properties rather than the
registry's default palette — same adaptation pattern already applied to
`bar-chart.tsx`/`area-chart.tsx`'s bklit-sourced primitives.

**Verify at implementation time** that `gauge-chart` exists at this project's
configured `@bklit` registry (`components.json` →
`https://ui.bklit.com/r/{name}.json`; existence can't be confirmed from the
repo alone). If it isn't available, fall back to a small custom SVG arc built
the same way the sentiment timeline chart in Section 2 already hand-rolls an
SVG chart against this project's chart tokens, rather than blocking the whole
section on the registry component.

## Error handling / edge states

- Empty session (no selected needs): existing early return
  ("No recommendations were marked...") fires before any section renders —
  unchanged.
- Zero notes / zero revisions: Section 2's grouped stat cards still render
  (values may be 0), themes trigger is omitted if `deriveThemeEntries` returns
  empty (same as today's conditional), sentiment sentence uses the existing
  "high direct-acceptance, no notes" template.
- A need with no `peerOutcome` (today's existing `needsWithEvidence` filter
  logic): the evidence disclosure trigger is omitted for that card entirely,
  same as the `evidenceExamples` case above — a card can end up with no
  evidence trigger at all if it has neither.

## Testing / verification

No test framework in this project — verification is `npx tsc --noEmit` +
`npm run lint` + a manual browser check: build a session with a mix of liked,
disliked, revised (with notes), and directly-accepted nodes, reach the
dashboard, and confirm: Section 1 renders as a list (not cards) with no
provenance link, Section 2 shows exactly 3 stat cards plus a working themes
popover trigger, Section 3 cards render in a grid with working gauge charts
and an evidence disclosure that expands to show the 3 heading+narrative
blocks, and that a session with no selected needs still hits the existing
empty-state early return.
