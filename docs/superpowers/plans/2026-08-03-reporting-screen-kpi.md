# Reporting Screen KPI/Sentiment/Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Verified Prescription dashboard with 7 behavioral KPI stat cards, a one-sentence session summary + note-derived sentiment timeline chart, mocked evidence cards (LinkedIn/app/company), and a hover-based provenance preview that replaces the current click-through "View source" dialog.

**Architecture:** Two new pure/mock data functions (`deriveSessionStats` in `lib/graph.ts`, `getSessionSummary` in `lib/mockAI.ts`, following those files' existing conventions exactly) feed three new presentational components (`KpiStatCard`, `SessionSummarySection`, `EvidenceRow`) wired into the existing `prescription-report.tsx`. The existing `SourceOverlay` Dialog is deleted and replaced by an inline `HoverCard`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, `@bklit`-sourced chart primitives already in `components/charts/*`, one new bklit component (`chart-stat-flow`), radix-ui `HoverCard` (already installed, currently unused).

## Global Constraints

- No test framework in this project — verification is `npx tsc --noEmit` + `npm run lint` + manual browser check, per every task below. Do not add a test runner.
- All UI-facing strings and mock content are English (project-wide convention, see `CLAUDE.md`).
- Never invent timestamps that don't exist in the data model — only note-triggered revisions carry `createdAt`; like/dislike/select/pick/framing flags do not.
- Mock evidence `label` fields must be generic role/company descriptors, never a specific invented name — see Task 5.
- Do not overwrite `components/ui/badge.tsx` or `components/ui/card.tsx` under any circumstance — both carry project-specific customizations (the `stamp` Badge variant; the squircle-compatible radius token system) that a registry `add` would silently delete. See Task 1.
- Spec reference: `docs/superpowers/specs/2026-08-03-reporting-screen-kpi-design.md`.

---

## Task 1: Install `@bklit/chart-stat-flow` without touching customized shared files

**Files:**
- Create: `components/charts/chart-stat-flow.tsx` (via CLI)
- Modify (then revert): `lib/utils.ts`

**Interfaces:**
- Produces: `ChartStatFlow({ value: number; label: string; formatOptions?; prefix?; suffix?; valueClassName?: string; labelClassName?: string; icon?: ReactNode })` — exported component, used by Task 7.

A prior dry-run of this exact command showed only `lib/utils.ts` would be touched (a cosmetic import-order change, not needed), and only `components/charts/chart-stat-flow.tsx` would be newly created. No other project file is at risk from this specific package (unlike the larger `@bklit/stat-card-line-01` block, which is intentionally NOT installed — its bundled `stat-card-line.tsx`/`trend-badge.tsx` are hardcoded to demo data and pull in a `@central-icons-react` icon dependency that conflicts with this project's `lucide` `iconLibrary`; we only need the standalone `ChartStatFlow` piece).

- [ ] **Step 1: Back up the one at-risk file**

```bash
cp lib/utils.ts lib/utils.ts.bak
```

- [ ] **Step 2: Run the install**

```bash
npx shadcn@latest add @bklit/chart-stat-flow
```

- [ ] **Step 3: Restore `lib/utils.ts` and remove the backup**

```bash
cp lib/utils.ts.bak lib/utils.ts
rm lib/utils.ts.bak
```

- [ ] **Step 4: Verify `components/charts/chart-stat-flow.tsx` exists and exports `ChartStatFlow`**

```bash
grep -n "export function ChartStatFlow" components/charts/chart-stat-flow.tsx
```

Expected: one match.

- [ ] **Step 5: Verify nothing else changed and the project still compiles**

```bash
git status --porcelain 2>/dev/null || echo "no git repo yet — inspect manually: lib/utils.ts must be byte-identical to before Step 1"
npx tsc --noEmit
```

Expected: `tsc` exits with no output (no errors). `lib/utils.ts` must still contain the project's original two-line `cn()` implementation (`import { clsx, type ClassValue } from "clsx"` first).

- [ ] **Step 6: Commit is deferred per user instruction ("test first, then commit") — skip for now.**

---

## Task 2: Extend `lib/types.ts` with the new data shapes

**Files:**
- Modify: `lib/types.ts`

**Interfaces:**
- Produces: `SessionStats`, `SentimentPoint`, `SessionSummary`, `EvidenceExample` interfaces; `evidenceExamples?: EvidenceExample[]` field on `CanvasNodeData`. All later tasks import these from `@/lib/types`.

- [ ] **Step 1: Add the new interfaces**

Add after the existing `MatchFactor` interface (currently at line 57-60):

```ts
export interface SessionStats {
  likeCount: number;
  dislikeCount: number;
  selectedCount: number;
  pathCount: number;
  optionPickCount: number;
  ownFramingCount: number;
  noteCount: number;
}

export interface SentimentPoint {
  timestamp: string;
  label: string;
  tone: "positive" | "neutral" | "negative";
}

export interface SessionSummary {
  sentence: string;
  timeline: SentimentPoint[];
}

export interface EvidenceExample {
  kind: "linkedin" | "app" | "company";
  label: string;
  detail: string;
}
```

- [ ] **Step 2: Add the new field to `CanvasNodeData`**

Find the "dashboard-only fields" comment block (currently around line 134-139):

```ts
  /** dashboard-only fields, present on recommendation/counter-argument/revision nodes */
  matchScore?: number;
  retentionRate?: number;
  peerOutcome?: PeerOutcome;
  transparency?: "organic" | "sponsored";
  matchFactors?: MatchFactor[];
```

Change to:

```ts
  /** dashboard-only fields, present on recommendation/counter-argument/revision nodes */
  matchScore?: number;
  retentionRate?: number;
  peerOutcome?: PeerOutcome;
  transparency?: "organic" | "sponsored";
  matchFactors?: MatchFactor[];
  /** Mock LinkedIn/app/company proof points for "Why this should work" —
   *  illustrative only, see lib/mockAI.ts's mockEvidenceExamples(). */
  evidenceExamples?: EvidenceExample[];
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit deferred (per user instruction) — skip.**

---

## Task 3: `deriveSessionStats` in `lib/graph.ts`

**Files:**
- Modify: `lib/graph.ts`

**Interfaces:**
- Consumes: `CanvasNodeData[]` (from `./types`).
- Produces: `export function deriveSessionStats(nodes: CanvasNodeData[]): SessionStats` — consumed by Task 7 (`SessionSummarySection`) and Task 4 (`getSessionSummary`'s caller passes the same `stats` object).

- [ ] **Step 1: Add the import**

At the top of `lib/graph.ts`, add `SessionStats` to the existing type-only import from `./types` (find the existing `import type { ... } from "./types"` line and add `SessionStats` to the list).

- [ ] **Step 2: Add the function**

Add at the end of `lib/graph.ts`:

```ts
/**
 * Behavioral KPI counts for the reporting screen — every field counts an
 * existing, already-tracked signal (feedback, selected, groupId, picked,
 * userFraming, revisions[].note). No new state, no fabricated data.
 */
export function deriveSessionStats(nodes: CanvasNodeData[]): SessionStats {
  const pathIds = new Set<string>();
  let likeCount = 0;
  let dislikeCount = 0;
  let selectedCount = 0;
  let optionPickCount = 0;
  let ownFramingCount = 0;
  let noteCount = 0;

  for (const node of nodes) {
    if (node.feedback === "like") likeCount++;
    if (node.feedback === "dislike") dislikeCount++;
    if (node.selected) selectedCount++;
    if (node.groupId) pathIds.add(node.groupId);
    if (node.picked != null) optionPickCount++;
    if (node.userFraming) ownFramingCount++;
    for (const revision of node.revisions ?? []) {
      if (revision.note) noteCount++;
    }
  }

  return {
    likeCount,
    dislikeCount,
    selectedCount,
    pathCount: pathIds.size,
    optionPickCount,
    ownFramingCount,
    noteCount,
  };
}
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Manual sanity check (no test framework in this project)**

Temporarily add `console.log(deriveSessionStats(graph.nodes))` inside `PrescriptionReport` (in `components/dashboard/prescription-report.tsx`, right after the existing `const needs = ...` line), open the dashboard in the browser with a session that has at least one like, one dislike, one selection, and one note, check the browser console for a `SessionStats` object with non-zero counts matching what you did on canvas, then **remove the temporary `console.log`**.

- [ ] **Step 5: Commit deferred — skip.**

---

## Task 4: `getSessionSummary` in `lib/mockAI.ts`

**Files:**
- Modify: `lib/mockAI.ts`

**Interfaces:**
- Consumes: `CanvasNodeData[]`, `SessionStats` (from Task 3).
- Produces: `export async function getSessionSummary(nodes: CanvasNodeData[], stats: SessionStats): Promise<SessionSummary>` — consumed by Task 7.

- [ ] **Step 1: Add imports**

Add `SentimentPoint` and `SessionSummary` to the existing type-only import block at the top of `lib/mockAI.ts` (the one currently importing `CanvasGraph, CanvasNodeData, CanvasEdgeData, ChoiceOption, FeedbackContext` from `./types`), and add `SessionStats` too (needed for the parameter type).

- [ ] **Step 2: Add the keyword lists and tone classifier**

Add near `MOCK_MATCH_FACTORS` (around line 42):

```ts
// Mocked heuristic, not real NLP — see docs/superpowers/specs/2026-08-03-reporting-screen-kpi-design.md.
// A real sentiment/NLP call is a future seam here, same as everything else in this file.
const NEGATIVE_NOTE_WORDS = ["wrong", "not what", "unclear", "don't", "instead", "too many", "confusing"];
const POSITIVE_NOTE_WORDS = ["good", "exactly", "perfect", "prefer", "yes", "works"];

function classifyRevisionTone(
  note: string,
  intent: CardOrigin["intent"] | undefined
): "positive" | "neutral" | "negative" {
  const lower = note.toLowerCase();
  if (NEGATIVE_NOTE_WORDS.some((w) => lower.includes(w))) return "negative";
  if (POSITIVE_NOTE_WORDS.some((w) => lower.includes(w))) return "positive";
  if (intent === "branch_new_direction") return "negative";
  return "neutral";
}
```

This requires importing `CardOrigin` as a type — add it to the same type-only import block as Step 1.

- [ ] **Step 3: Add the timeline builder**

```ts
function buildSentimentTimeline(nodes: CanvasNodeData[]): SentimentPoint[] {
  const points: SentimentPoint[] = [];

  for (const node of nodes) {
    if (!node.origin?.note || !node.activeRevision) continue;
    const revision = node.revisions?.[node.activeRevision - 1];
    if (!revision) continue;

    points.push({
      timestamp: revision.createdAt,
      label: revision.title,
      tone: classifyRevisionTone(node.origin.note, node.origin.intent),
    });
  }

  return points.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
```

- [ ] **Step 4: Add the sentence templates + `getSessionSummary`**

```ts
function buildSummarySentence(stats: SessionStats, timeline: SentimentPoint[]): string {
  if (stats.noteCount === 0) {
    return "You accepted every recommendation as given, without needing to redirect any of them.";
  }

  const negativeCount = timeline.filter((p) => p.tone === "negative").length;
  const negativeRatio = timeline.length > 0 ? negativeCount / timeline.length : 0;

  if (negativeRatio <= 0.5 && negativeCount <= 1) {
    return "You moved through this with confidence — most recommendations were accepted as given.";
  }

  if (negativeRatio <= 0.5) {
    return `You explored a few different directions before settling — ${negativeCount} recommendation${negativeCount === 1 ? "" : "s"} needed a different direction before you found the right fit.`;
  }

  return `This took some back-and-forth — you steered ${negativeCount} recommendation${negativeCount === 1 ? "" : "s"} in a new direction before landing on what worked.`;
}

/**
 * Fake async: mocked behavioral-proxy + note-keyword-scan "session summary."
 * Not real NLP — see the classifyRevisionTone comment above. This is the
 * seam for a future real LLM-generated summary.
 */
export async function getSessionSummary(
  nodes: CanvasNodeData[],
  stats: SessionStats
): Promise<SessionSummary> {
  await delay();

  const timeline = buildSentimentTimeline(nodes);
  const sentence = buildSummarySentence(stats, timeline);

  return { sentence, timeline };
}
```

- [ ] **Step 5: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Manual verification**

Temporarily call `getSessionSummary(graph.nodes, deriveSessionStats(graph.nodes)).then(console.log)` inside `PrescriptionReport` (same spot as Task 3 Step 4), reload the dashboard with a session that has at least 2 notes (one containing a negative-signal word like "unclear", one containing a positive-signal word like "exactly"), confirm the logged `SessionSummary.timeline` has 2 points with the expected `tone` values and the `sentence` matches one of the three templates. Remove the temporary call afterward.

- [ ] **Step 7: Commit deferred — skip.**

---

## Task 5: Mock evidence example generation in `lib/mockAI.ts`

**Files:**
- Modify: `lib/mockAI.ts`

**Interfaces:**
- Produces: `evidenceExamples: EvidenceExample[]` set on the node objects returned by `getPreferredContinuation`, `getOptionResponse`, `branchFromNote`, and `branchFromChoiceFraming` (the same four functions that already set `matchScore`/`peerOutcome`/`matchFactors` — confirmed by grepping the current file: lines ~245-253, ~316-320, ~494, ~545-549).

- [ ] **Step 1: Add `EvidenceExample` to the type-only import block** (same import line touched in Task 4).

- [ ] **Step 2: Add the mock evidence pool + generator**

Add near `MOCK_MATCH_FACTORS`:

```ts
// Deliberately generic — role/company-size descriptors only, never a specific
// invented name. Illustrative placeholder for future real sourcing (PRD
// Section 7), not real LinkedIn/company data.
const EVIDENCE_POOL: Record<EvidenceExample["kind"], EvidenceExample[]> = {
  linkedin: [
    { kind: "linkedin", label: "Engineering Manager, mid-size SaaS company", detail: "Cut sprint slippage by narrowing WIP limits before changing tooling." },
    { kind: "linkedin", label: "Head of Delivery, B2B platform team", detail: "Reported steadier sprint completion after the same approach." },
  ],
  app: [
    { kind: "app", label: "Project tracking tool, mid-market tier", detail: "Usage data shows teams with several active initiatives adopt this pattern first." },
    { kind: "app", label: "Sprint planning add-on", detail: "Most-enabled setting among teams reporting improved predictability." },
  ],
  company: [
    { kind: "company", label: "50-150 employee software company", detail: "Case study cohort where this recommendation was most effective." },
    { kind: "company", label: "Series B product company", detail: "Matched cohort with similar team size and process maturity." },
  ],
};

let evidenceCycleIndex = 0;
function mockEvidenceExamples(): EvidenceExample[] {
  const i = evidenceCycleIndex % 2;
  evidenceCycleIndex += 1;
  return [EVIDENCE_POOL.linkedin[i], EVIDENCE_POOL.app[i], EVIDENCE_POOL.company[i]];
}
```

- [ ] **Step 3: Wire it into the four call sites**

In each of `getPreferredContinuation`, `getOptionResponse`, `branchFromNote`, and `branchFromChoiceFraming`, find the object literal that sets `matchScore` (and usually `peerOutcome`/`matchFactors` alongside it) and add `evidenceExamples: mockEvidenceExamples(),` as one more field in that same object literal. There are 4 edit sites; each is a one-line addition next to the existing `matchScore:` line in that function.

- [ ] **Step 4: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Manual verification**

Start a new session, click through to select and confirm a recommendation via any of the 4 paths (pick an A/B/C option, prefer an option, submit a note that revises a card, or submit a note with your own framing on a choice card), reach the dashboard, and confirm (via a temporary `console.log(needs.map(n => n.node.evidenceExamples))` in `prescription-report.tsx`, removed afterward) that the selected need's node has a 3-item `evidenceExamples` array with one `linkedin`, one `app`, one `company` entry.

- [ ] **Step 6: Commit deferred — skip.**

---

## Task 6: `KpiStatCard` component

**Files:**
- Create: `components/dashboard/kpi-stat-card.tsx`

**Interfaces:**
- Consumes: `ChartStatFlow` (Task 1), `Card`/`CardContent` (`@/components/ui/card`).
- Produces: `export function KpiStatCard({ label, value }: { label: string; value: number }): JSX.Element` — consumed by Task 7.

No trend badge and no per-card sparkline: a single session has no prior period to compare a "trend %" against, and only note-triggered events carry timestamps (per the Global Constraints), so a fabricated per-KPI time series would misrepresent data that doesn't exist. `ChartStatFlow` alone (animated big number + label) is the right amount of polish here.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { ChartStatFlow } from "@/components/charts/chart-stat-flow";
import { Card, CardContent } from "@/components/ui/card";

export function KpiStatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="py-4">
      <CardContent className="flex flex-col items-start px-[var(--card-px)]">
        <ChartStatFlow
          value={value}
          label={label}
          valueClassName="font-mono text-2xl font-bold text-foreground"
          labelClassName="text-[length:var(--text-label)] text-muted-foreground"
        />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
npm run lint
```

- [ ] **Step 3: Commit deferred — skip (this component isn't reachable from the UI until Task 9 wires it in; visual verification happens there).**

---

## Task 7: `SessionSummarySection` component

**Files:**
- Create: `components/dashboard/session-summary-section.tsx`

**Interfaces:**
- Consumes: `deriveSessionStats` (Task 3), `getSessionSummary` (Task 4), `KpiStatCard` (Task 6), `LineChart`/`Line` (`@/components/charts/line-chart`), `Grid` (`@/components/charts/grid`), `ChartTooltip` (`@/components/charts/tooltip`), an x-axis component (mirror whichever one `prescription-report.tsx` already imports for its existing bar chart — `BarXAxis` from `@/components/charts/bar-x-axis` — for a line chart use the general-purpose `x-axis.tsx`/`y-axis.tsx` pair instead, imported as done in any other existing line-chart usage in this codebase; if none exists yet, import `XAxis`/`YAxis` directly from `@/components/charts/x-axis` / `@/components/charts/y-axis` and pass them as children exactly like `BarXAxis` is passed in `prescription-report.tsx`'s existing `<BarChart>` usage).
- Produces: `export function SessionSummarySection({ nodes }: { nodes: CanvasNodeData[] }): JSX.Element` — consumed by Task 9.

The 7 KPI cards render immediately from the synchronous `deriveSessionStats` — only the sentence + timeline chart (which need the mocked `getSessionSummary` delay) show a loading state. This avoids blocking data we already have on an artificial delay that exists only to simulate a future real AI call for the sentence/timeline part.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useState } from "react";
import { deriveSessionStats } from "@/lib/graph";
import { getSessionSummary } from "@/lib/mockAI";
import type { CanvasNodeData, SessionSummary } from "@/lib/types";
import { KpiStatCard } from "./kpi-stat-card";
import { LineChart, Line } from "@/components/charts/line-chart";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import { YAxis } from "@/components/charts/y-axis";
import AITextLoading from "@/components/kokonutui/ai-text-loading";

const TONE_VALUE: Record<"positive" | "neutral" | "negative", number> = {
  positive: 1,
  neutral: 0,
  negative: -1,
};

const SUMMARY_LOADING_STAGES = ["Reading your session…", "Summarizing…"];

export function SessionSummarySection({ nodes }: { nodes: CanvasNodeData[] }) {
  const stats = deriveSessionStats(nodes);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    getSessionSummary(nodes, stats).then((result) => {
      if (!cancelled) setSummary(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  const chartData = (summary?.timeline ?? []).map((point) => ({
    date: new Date(point.timestamp),
    tone: TONE_VALUE[point.tone],
    label: point.label,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <KpiStatCard label="Liked" value={stats.likeCount} />
        <KpiStatCard label="Disliked" value={stats.dislikeCount} />
        <KpiStatCard label="Selected" value={stats.selectedCount} />
        <KpiStatCard label="Paths explored" value={stats.pathCount} />
        <KpiStatCard label="Options picked" value={stats.optionPickCount} />
        <KpiStatCard label="Answered in own words" value={stats.ownFramingCount} />
        <KpiStatCard label="Notes added" value={stats.noteCount} />
      </div>

      {summary === null ? (
        <AITextLoading texts={SUMMARY_LOADING_STAGES} interval={700} className="text-sm text-muted-foreground" />
      ) : (
        <>
          <p className="text-sm text-foreground">{summary.sentence}</p>
          {chartData.length > 0 && (
            <LineChart data={chartData} xDataKey="date" aspectRatio="4 / 1">
              <Grid horizontal />
              <Line dataKey="tone" stroke="var(--color-chart-3)" />
              <ChartTooltip showCrosshair={false} />
              <XAxis />
              <YAxis />
            </LineChart>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

If `XAxis`/`YAxis` or `ChartTooltip`'s exported names/props differ from what's assumed above, open `components/charts/x-axis.tsx`, `components/charts/y-axis.tsx`, and `components/charts/tooltip/index.ts` and fix the import names/props to match exactly what those files actually export — don't guess a second time, read the file.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

- [ ] **Step 4: Commit deferred — visual verification happens in Task 9/10.**

---

## Task 8: `EvidenceRow` component

**Files:**
- Create: `components/dashboard/evidence-row.tsx`

**Interfaces:**
- Consumes: `EvidenceExample` (`@/lib/types`), `Badge` (`@/components/ui/badge`).
- Produces: `export function EvidenceRow({ examples }: { examples: EvidenceExample[] }): JSX.Element` — consumed by Task 9.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import type { EvidenceExample } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

const KIND_LABEL: Record<EvidenceExample["kind"], string> = {
  linkedin: "LinkedIn",
  app: "App",
  company: "Company",
};

export function EvidenceRow({ examples }: { examples: EvidenceExample[] }) {
  return (
    <div className="grid grid-cols-1 gap-2 border-t border-border pt-3 sm:grid-cols-3">
      {examples.map((example) => (
        <div key={example.kind} className="space-y-1">
          <Badge variant="outline">{KIND_LABEL[example.kind]}</Badge>
          <p className="text-[length:var(--text-label)] font-medium text-foreground">
            {example.label}
          </p>
          <p className="text-[length:var(--text-label)] text-muted-foreground">
            {example.detail}
          </p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
npm run lint
```

- [ ] **Step 3: Commit deferred — visual verification happens in Task 9.**

---

## Task 9: Wire everything into `prescription-report.tsx`; replace click-through with hover

**Files:**
- Modify: `components/dashboard/prescription-report.tsx`
- Delete: `components/dashboard/source-overlay.tsx`

**Interfaces:**
- Consumes: `SessionSummarySection` (Task 7), `EvidenceRow` (Task 8), `HoverCard`/`HoverCardTrigger`/`HoverCardContent` (`@/components/ui/hover-card`).

- [ ] **Step 1: Remove the `SourceOverlay` import, the `sourceNeed` state, and the `"View source →"` button**

In `components/dashboard/prescription-report.tsx`:
- Remove `import { SourceOverlay } from "./source-overlay";`
- Remove `const [sourceNeed, setSourceNeed] = useState<DashboardNeed | null>(null);`
- Remove the trailing `<SourceOverlay need={sourceNeed} onOpenChange={(open) => !open && setSourceNeed(null)} />` at the end of the returned JSX.
- Remove the `<button onClick={() => setSourceNeed(n)} className="provenance-link ...">View source →</button>` block inside the "What we understood" card map.
- Remove the now-unused `useState` import if `PrescriptionReport` no longer uses it anywhere else (check first — it's still used for nothing else in this file per the current source, so the import line `import { useState } from "react";` can be removed entirely).

- [ ] **Step 2: Add the hover-triggered provenance label in its place**

Add this import: `import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";`

Where the removed button was, add:

```tsx
<HoverCard>
  <HoverCardTrigger asChild>
    <span className="cursor-default font-mono text-[length:var(--text-label)] text-muted-foreground">
      linked to your note
    </span>
  </HoverCardTrigger>
  <HoverCardContent className="space-y-2 text-xs">
    <p className="text-foreground italic">&ldquo;{n.quote}&rdquo;</p>
    <p className="text-muted-foreground">
      Chosen: {n.node.title.replace(/\s\(v\d+\)$/, "")}
    </p>
    {n.eliminated && (
      <p className="text-muted-foreground">Set aside: {n.eliminated.title}</p>
    )}
    <p className="text-muted-foreground">
      {n.revisionCount === 0 ? "No revisions" : `${n.revisionCount} revision${n.revisionCount > 1 ? "s" : ""}`}
    </p>
  </HoverCardContent>
</HoverCard>
```

- [ ] **Step 3: Replace the removed "Where your attention went" bar chart with `SessionSummarySection`**

Find the `<Card className="py-4">` block containing `<p className="mb-2 font-mono ...">Where your attention went</p>` and the `<BarChart aspectRatio="2 / 1" data={focusData} xDataKey="need">...` beneath it, inside the `"How we read your situation"` section. Delete that whole `<Card>` block (the themes chip `<Card>` right before it stays untouched) and, immediately after the themes-chips `</Card>`, close the two-column grid and add:

```tsx
      <SessionSummarySection nodes={nodes} />
```

(placed after the `</div>` that closes the `grid grid-cols-1 gap-3 lg:grid-cols-2` wrapper, still inside the `{themes.length > 0 && (<> ... </>)}` block since it belongs to the same "How we read your situation" section). The now-unused `focusData` constant (built from `needs.map(...)` near the top of the component) can be removed too, along with the `BarChart`/`Bar`/`Grid`/`BarXAxis`/`ChartTooltip` imports **if** they're no longer used elsewhere in this file — check the "Why this should work" section below first, since it still uses `BarChart`/`Grid`/`Bar`/`ChartTooltip`/`BarXAxis` for the peer-outcome chart; only remove imports that become fully unused.

- [ ] **Step 4: Add `EvidenceRow` to the "Why this should work" cards**

Add `import { EvidenceRow } from "./evidence-row";`. Inside the `needsWithEvidence.map((n) => { ... })` block (Section 4, "Why this should work"), after the existing cohort caption `<p className="mt-1 ...">Cohort: {n.peerOutcome!.cohortDefinition}</p>`, add:

```tsx
{n.node.evidenceExamples && <EvidenceRow examples={n.node.evidenceExamples} />}
```

- [ ] **Step 5: Delete the now-unused overlay file**

```bash
rm components/dashboard/source-overlay.tsx
```

- [ ] **Step 6: Verify it compiles and lints**

```bash
npx tsc --noEmit
npm run lint
```

- [ ] **Step 7: Commit deferred — full manual verification is Task 10.**

---

## Task 10: End-to-end manual verification (this project has no test framework)

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server** (via the project's existing `npm run dev` / preview tooling) and open the app.

- [ ] **Step 2: Build a deliberately mixed session** — submit a chat entry, then on the canvas: like one node, dislike another, pick an A/B/C option, submit at least 2 text notes on different cards (one containing a word from `NEGATIVE_NOTE_WORDS`, e.g. "this is unclear", one containing a word from `POSITIVE_NOTE_WORDS`, e.g. "yes, exactly"), select at least 2 nodes, then Finalize.

- [ ] **Step 3: On the dashboard, verify:**
  - The 7 KPI stat cards under "How we read your situation" show numbers matching what you did in Step 2 (hand-count against your own actions).
  - A short loading state appears briefly, then the summary sentence renders and matches the mixed-session template (not the "no notes" or "high confidence" template, since you added 2 notes with differing tone).
  - The timeline chart renders 2 points.
  - Under "Why this should work", each need card shows a 3-item evidence row (LinkedIn / App / Company).
  - Under "What we understood", hovering the "linked to your note" label opens a small card showing the quote, chosen path, set-aside alternative (if applicable), and revision count — no click required, and there is no more "View source →" button anywhere.
  - No navigation to canvas occurs from any of the above.

- [ ] **Step 4: Confirm no regressions** — reset session, load an *old* session created before this change (if one exists in the sidebar from earlier testing) and confirm the dashboard still renders without crashing (a pre-existing node without `evidenceExamples` should simply omit its evidence row per Task 8/9's `n.node.evidenceExamples &&` guard — this is the edge case called out in the spec's Error Handling section).

- [ ] **Step 5: Only after all of the above pass, ask the user whether to initialize git and commit** (this project currently has no `.git` — confirmed earlier in this session; commit was explicitly deferred until after testing).

---

## Self-Review Notes (completed during plan authoring, not a step for the implementer)

- **Spec coverage:** Sections 1 (Task 3), 2 (Task 4/7), 3 (Task 5/8), 4 (Task 7/9), 5 (Task 8/9), 6 (Task 1 — scoped down from the spec's tentative `stat-card-line-01`/`composed-chart` mention to the single actually-needed `chart-stat-flow` piece, after inspecting the real registry contents and finding `composed-chart` already installed and `stat-card-line-01`'s other files unnecessary/risky), 7 (Task 9), error handling (Tasks 3/5/9/10), testing (Task 10) are all covered.
- **Type consistency:** `SessionStats`/`SentimentPoint`/`SessionSummary`/`EvidenceExample` field names are identical across Tasks 2, 3, 4, 5, 6, 7, 8, 9.
- **Deviation from spec, and why:** the spec named `@bklit/composed-chart` and `@bklit/stat-card-line-01` as the components to add. Investigation during planning found `composed-chart.tsx` already present in the project (no install needed — Task 7 uses the already-installed `line-chart.tsx`/`Line` instead, which covers the single-series timeline without the added complexity of a composed multi-series chart this feature doesn't need), and that `stat-card-line-01`'s only piece actually needed is `chart-stat-flow` (the rest is hardcoded demo data or requires an icon library swap for no real benefit here). This is a scope reduction, not a scope change — every requirement in the spec is still met.
