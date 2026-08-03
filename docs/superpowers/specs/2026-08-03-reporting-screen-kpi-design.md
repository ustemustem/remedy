# Reporting Screen — Session KPIs, Behavioral Sentiment Trend, and Provenance Hover

**Status:** Approved, pending write-up review
**Date:** 2026-08-03
**Scope:** `components/dashboard/*`, `lib/graph.ts`, `lib/mockAI.ts`, `lib/types.ts`

## Context

The canvas build pass is done. This spec covers the next phase: extending the
Verified Prescription dashboard (`components/dashboard/*`) to surface clearer,
numeric KPIs about how the user actually used the canvas, a one-sentence
behavioral summary with a supporting trend chart, mocked third-party evidence
("why this should work" proof points), and a lighter-weight way to see why a
given recommendation exists.

The dashboard already implements PRD 6.4's baseline (Match Score, peer-outcome
chart, retention, Transparency Badge, exit poll) across four sections: "What we
understood," "How we read your situation," "Your prescription," and "Why this
should work." This spec adds to that structure — it does not replace it.

## Non-goals (explicitly out of scope for this pass)

- Real NLP/sentiment analysis. All "sentiment" here is a **behavioral proxy**
  (like/dislike ratio, revision counts, path abandonment) plus a **simple
  keyword-scan** of the user's own free-text notes — not a real
  emotion-detection model. This is a mocked seam for a future real LLM call,
  same pattern as `getInitialCanvas`/`getNodeResponse`/`getOptionResponse`.
- Real LinkedIn/company/app sourcing. Evidence cards (Section 3) are
  illustrative mock data, deliberately generic (role + company-size
  descriptors, never a specific invented name), pending real data sourcing
  (PRD Section 7 — already out of scope for the whole prototype pass per
  `docs/BUILD_BRIEF.md`).
- Sponsorship ranking governance (PRD 6.5) — unaffected by this change.
- Any change to the canvas screens or the `step` state machine.

## 1) Data layer — `lib/graph.ts`

New pure, synchronous function, following the existing `deriveDashboardNeeds`/
`deriveThemeEntries` pattern (derived fresh from `nodes` on every render, no
new persisted state):

```ts
export interface SessionStats {
  likeCount: number;
  dislikeCount: number;
  selectedCount: number;
  pathCount: number;          // distinct groupId count across visible nodes
  optionPickCount: number;    // choice cards where picked != null
  ownFramingCount: number;    // choice cards answered via userFraming instead of a pick
  noteCount: number;          // total revisions[].note entries that are non-null, across all nodes
}

export function deriveSessionStats(nodes: CanvasNodeData[]): SessionStats
```

Counting rules (all from fields that already exist on `CanvasNodeData` — no
schema additions needed for this function):

- `likeCount`/`dislikeCount`: count of nodes with `feedback === "like"` /
  `"dislike"` respectively (not deduplicated by path — a like on a superseded
  revision still counts, since it was a real action the user took).
- `selectedCount`: count of nodes with `selected === true`.
- `pathCount`: count of distinct `groupId` values present across `nodes`
  (undefined `groupId` is not counted).
- `optionPickCount`: count of nodes where `picked != null`.
- `ownFramingCount`: count of nodes where `userFraming` is set (non-null,
  non-empty).
- `noteCount`: sum, across all nodes, of `revisions` entries where `note` is
  non-null.

**Known limitation, stated explicitly (not a bug to fix here):** like/dislike
toggles carry no timestamp in the current data model — `feedback` is a flag on
the node, not a timed event. The sentiment timeline in Section 2 therefore
does **not** attempt to place like/dislike events on a time axis; only
note-triggered revisions (which have `CardRevision.createdAt`) are plotted.
Like/dislike counts still feed the aggregate summary sentence (Section 2) as
an unordered signal. This is a deliberate choice to avoid inventing timestamps
that don't exist.

Edge case: `deriveSessionStats([])` returns all-zero counts (`pathCount: 0`,
etc.) — no special-casing needed by callers, matches the existing
`needs.length === 0` early-return already in `prescription-report.tsx`.

## 2) Behavioral summary — `lib/mockAI.ts`

New async function, same artificial-delay convention as `getInitialCanvas`
(500–1500ms):

```ts
export interface SentimentPoint {
  timestamp: string;                        // CardRevision.createdAt of the note that produced this point
  label: string;                             // short label, e.g. the node's title
  tone: "positive" | "neutral" | "negative"; // see classification below
}

export interface SessionSummary {
  sentence: string;
  timeline: SentimentPoint[];
}

export async function getSessionSummary(
  nodes: CanvasNodeData[],
  stats: SessionStats
): Promise<SessionSummary>
```

**Timeline construction:** collect every `{ node, revision }` pair across all
nodes where `revision.note` is non-null, sorted ascending by
`revision.createdAt`. Each becomes one `SentimentPoint`.

**Tone classification per point** (mocked heuristic, explicitly not real NLP —
documented as such in a code comment at the classification function, matching
this codebase's existing honesty about `mockAI.ts`'s limits):

1. Keyword-scan `revision.note` (English word lists, since all UI-facing and
   mock content in this codebase is English going forward):
   - Negative-signal words: `"wrong"`, `"not what"`, `"unclear"`, `"don't"`,
     `"instead"`, `"too many"`, `"confusing"`.
   - Positive-signal words: `"good"`, `"exactly"`, `"perfect"`, `"prefer"`,
     `"yes"`, `"works"`.
   - First match wins (negative list checked first, since a correction note is
     the stronger signal); no match falls through to step 2.
2. Fallback to the revision's originating `origin.intent` (present on the
   node whose `activeRevision` this is): `"branch_new_direction"` →
   `"negative"`, `"refine_in_place"` → `"neutral"`, no `origin` at all (the
   node's very first revision) → not included as a timeline point (nothing to
   plot yet — revision 1 has no note).

**Sentence selection:** one of three deterministic templates, chosen by
`selectedCount`, `pathCount`, and the negative/positive ratio in the computed
timeline — not free-form generation:

- **High direct-acceptance** (timeline has ≤1 negative point, or `noteCount`
  is 0): _"You moved through this with confidence — most recommendations were
  accepted as given."_ (if `noteCount === 0`, drop "as given" framing entirely
  and use: _"You accepted every recommendation as given, without needing to
  redirect any of them."_)
- **Mixed** (negative points exist but are a minority of the timeline):
  _"You explored a few different directions before settling — {n}
  recommendation{s} needed a different direction before you found the right
  fit."_ where `{n}` = count of negative timeline points.
- **High revision/friction** (negative points are the majority):
  _"This took some back-and-forth — you steered {n} recommendation{s} in a
  new direction before landing on what worked."_

Exact thresholds: "majority" = negative points > 50% of total timeline
points; "minority" = negative points > 0 and ≤ 50%.

## 3) Mock evidence cards — `lib/mockAI.ts` + `lib/types.ts`

New dashboard-only field on `CanvasNodeData`, alongside the existing
`matchScore`/`peerOutcome`/`matchFactors`:

```ts
export interface EvidenceExample {
  kind: "linkedin" | "app" | "company";
  label: string;   // generic role/product descriptor, never a specific invented name
  detail: string;  // one-line outcome, e.g. "Reduced sprint slippage after narrowing WIP limits"
}

// on CanvasNodeData:
evidenceExamples?: EvidenceExample[];
```

Populated wherever `matchScore`/`peerOutcome`/`matchFactors` are already set
today (`getInitialCanvas`'s recommendation/counter-argument pairs,
`refineChoiceOptions`, `branchFromNote`, `branchFromChoiceFraming` — the same
existing call sites, no new seams). Each populated node gets exactly 3
examples, one per `kind` (`linkedin`, `app`, `company`), so the UI can render
a fixed 3-column row without conditional layout.

**Content constraint (hard requirement, not a style preference):** `label`
must never read as a specific, real, identifiable person or company — generic
role + company-size/industry descriptors only (e.g. `"Engineering Manager,
mid-size SaaS company"`, not a name). This mock data is illustrative of a
future real-sourcing feature (PRD Section 7) and must not be mistaken for
real profiles.

## 4) UI — "How we read your situation" (extended)

Existing theme chips (liked/disliked themes) are unchanged. The existing
single "Where your attention went" bar chart is **removed** — its signal
(revisions per need) is now one of the KPI stat cards below, so keeping both
would be redundant.

Added, in this order:

1. A row of KPI stat cards, one per `SessionStats` field (7 cards: likes,
   dislikes, selected, paths explored, options picked, own framing used,
   notes added), sourced from `@bklit/stat-card-line-01` (sparkline + trend
   badge) adapted to this project's token system
   (`--color-chart-*`/`chart-context.tsx`, the same adaptation
   `bar-chart.tsx`/`area-chart.tsx` already went through for their bklit
   primitives). The "trend" sparkline on each card is a simple cumulative
   count across the sorted timeline (Section 2), not a separate data source.
2. The one-sentence summary from `getSessionSummary` (Section 2), shown above
   the chart.
3. The mood/engagement timeline chart itself, sourced from
   `@bklit/composed-chart` (or `@bklit/line-chart` if the composed variant
   proves unnecessary once the timeline data shape is in hand — decided during
   implementation, not a spec-blocking choice since both read the same
   `SentimentPoint[]` shape).

This section becomes async (backed by `getSessionSummary`) — it renders its
own loading state (shimmer, matching the existing `AITextLoading`/shimmer
convention used elsewhere in the app) while the mock delay is in flight, while
the rest of the dashboard (which is fully synchronous today) renders
immediately.

## 5) UI — "Why this should work" (extended)

Unchanged: per-need peer-outcome bar chart + cohort caption.

Added: a 3-item evidence row per need card, rendering that need's
`evidenceExamples` (LinkedIn / app / company, one each), directly below the
peer-outcome chart.

## 6) New bklit components to add

```
npx shadcn add @bklit/stat-card-line-01 @bklit/composed-chart
```

Post-add, per this project's own `shadcn` skill workflow: read the added
files, fix any hardcoded import paths to this project's aliases
(`@/components`, `@/lib`), swap any icon imports to `lucide-react` (this
project's configured `iconLibrary`), and wire color props to the existing
`--color-chart-*` custom properties rather than the registry's default
palette — matching how `bar-chart.tsx`/`area-chart.tsx`/`area.tsx` already
consume their own bklit-sourced primitives.

## 7) "What we understood" card — hover provenance link (replaces click-through)

The existing **"View source →"** button and the `SourceOverlay` Dialog
component are **removed entirely**, along with the `sourceNeed`/
`setSourceNeed` state in `prescription-report.tsx`.

Replaced by:

- A small, mono, non-underlined label in the same corner of the card (e.g.
  `"linked to your note"`) — does not read as a clickable link.
- Wrapping it: `HoverCard` / `HoverCardTrigger` / `HoverCardContent`
  (`components/ui/hover-card.tsx`, already installed, currently unused
  anywhere in the app) rendered directly inside each `DashboardNeed` card —
  no separate overlay component.
- `HoverCardContent` shows exactly what `SourceOverlay` shows today: the
  quote, the chosen path's title, the eliminated counter-argument's title (if
  `eliminated` is set), and the revision count. Same data, same
  `DashboardNeed` shape — only the trigger mechanism (hover vs. click) and the
  container (`HoverCard` vs. `Dialog`) change.
- No navigation to canvas — everything renders inline on the dashboard.

## Error handling / edge states (all sections)

- Empty session (`nodes` has no selected needs): existing early return in
  `prescription-report.tsx` ("No recommendations were marked...") fires before
  any of the new sections render — unchanged behavior.
- Zero notes across the whole session: `getSessionSummary` returns an empty
  `timeline` and the "high direct-acceptance, no notes" sentence variant
  (Section 2) — the KPI stat cards and the (empty) timeline chart still
  render; the chart component must handle a zero-length series without
  erroring (verify during implementation — `@bklit/composed-chart`'s own
  empty-state behavior should be checked against this project's usage, not
  assumed).
- A need with no `evidenceExamples` (shouldn't happen given Section 3's "every
  populated node gets exactly 3" rule, but if a node predates this feature —
  e.g. loaded from an old localStorage session — `evidenceExamples` will be
  `undefined`): the evidence row is omitted for that card entirely, not
  rendered as empty/broken slots.

## Testing / verification

No test framework in this project (per `CLAUDE.md`) — verification is
`npx tsc --noEmit` + `npm run lint` + a manual browser check: build a session
with a deliberate mix of liked, disliked, revised (with notes), and
directly-accepted nodes, reach the dashboard, and confirm: the 7 KPI stat
cards match hand-counted values from the session, the summary sentence
matches the mix (should land in the "Mixed" template for a session with some
but not all recommendations revised), the timeline chart renders one point
per note, and the "What we understood" cards show the hover card instead of
the old click-through dialog.
