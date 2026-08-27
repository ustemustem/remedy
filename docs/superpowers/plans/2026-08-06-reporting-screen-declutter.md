# Reporting Screen Declutter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Verified Prescription dashboard (`components/dashboard/*`) from 4 sections to 3 — a plain-text "What we understood" list, a 3-stat grouped KPI row with a themes popover, and a merged "Your prescription" section with gauge charts and collapsible evidence — per `docs/superpowers/specs/2026-08-06-reporting-screen-declutter-design.md`.

**Architecture:** Six new small, single-purpose dashboard components (`MiniGauge`, `FeedbackStatCard`, `ThemesPopover`, `NeedSummaryList`, `PrescriptionCard`) plus one narrow addition to the existing `KpiStatCard`, wired together by rewriting `PrescriptionReport` (orchestration) and `SessionSummarySection` (stats row). `EvidenceRow` is restructured in place. No changes to `lib/graph.ts` or `lib/mockAI.ts` — all data derivation is unchanged; only how the dashboard lays it out changes.

**Tech Stack:** Next.js (App Router), React, TypeScript, Tailwind v4 (`app/globals.css` tokens), shadcn/radix-ui primitives (`components/ui/*`), the project's own visx-based chart system (`components/charts/*`), lucide-react icons.

## Global Constraints

- No test framework is configured in this project. Verification for every task is `npx tsc --noEmit` + `npm run lint`, plus a manual browser check for the final task (per `CLAUDE.md`).
- All UI-facing strings are English (per `CLAUDE.md`'s language convention).
- `--radius-card`, `--color-card`, `--text-label`, `--card-px`, `--color-primary`, `--color-chart-*` etc. are the existing design tokens (`app/globals.css`) — new markup must reuse them, never hardcode raw colors/px values that already have a token.
- If a CSS-only change doesn't show up in the dev server, `rm -rf .next` before restarting (per `CLAUDE.md`) — try this before assuming a code change is wrong.
- `@bklit/gauge-chart` is NOT used in this plan. Per the spec's own fallback clause, `MiniGauge` (Task 1) is a small hand-rolled SVG arc component instead — its existence in the external `@bklit` registry could not be verified ahead of time, and building bespoke code avoids blocking on an unknown external API.

---

## Task 1: `MiniGauge` component

**Files:**
- Create: `components/dashboard/mini-gauge.tsx`

**Interfaces:**
- Consumes: nothing project-specific — just `--color-border`, `--color-primary`, `--color-foreground`, `--font-mono`, `--text-label` tokens (all already defined in `app/globals.css`).
- Produces: `MiniGauge({ value: number; label: string })` — a semicircle arc gauge (0–100 scale) with the numeric value centered above the arc's baseline and a muted label below it. Used by `PrescriptionCard` (Task 7).

- [ ] **Step 1: Create the component**

```tsx
// components/dashboard/mini-gauge.tsx
"use client";

const RADIUS = 28;
const CIRCUMFERENCE = Math.PI * RADIUS;

export function MiniGauge({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const offset = CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <div className="flex flex-col items-center gap-1" style={{ width: 88 }}>
      <svg width="72" height="44" viewBox="0 0 72 44" aria-hidden="true">
        <path
          d="M 8 36 A 28 28 0 0 1 64 36"
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M 8 36 A 28 28 0 0 1 64 36"
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
        <text
          x="36"
          y="30"
          textAnchor="middle"
          fill="var(--color-foreground)"
          style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700 }}
        >
          {Math.round(clamped)}%
        </text>
      </svg>
      <span className="text-[length:var(--text-label)] text-muted-foreground">{label}</span>
    </div>
  );
}
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no new errors.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/mini-gauge.tsx
git commit -m "Add MiniGauge component for prescription match/retention display"
```

---

## Task 2: `FeedbackStatCard` component

**Files:**
- Create: `components/dashboard/feedback-stat-card.tsx`

**Interfaces:**
- Consumes: `Card`/`CardContent` from `@/components/ui/card` (existing).
- Produces: `FeedbackStatCard({ likeCount: number; dislikeCount: number; className?: string })` — a single stat card showing both counts together, visually matching `KpiStatCard`'s value/label styling. Used by `SessionSummarySection` (Task 8).

- [ ] **Step 1: Create the component**

```tsx
// components/dashboard/feedback-stat-card.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function FeedbackStatCard({
  likeCount,
  dislikeCount,
  className,
}: {
  likeCount: number;
  dislikeCount: number;
  className?: string;
}) {
  return (
    <Card className={cn("py-4", className)}>
      <CardContent className="flex flex-col items-start gap-1 px-[var(--card-px)]">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-2xl font-bold text-foreground">{likeCount}</span>
          <span className="text-[length:var(--text-label)] text-muted-foreground">liked</span>
          <span className="ml-2 font-mono text-2xl font-bold text-foreground">{dislikeCount}</span>
          <span className="text-[length:var(--text-label)] text-muted-foreground">disliked</span>
        </div>
        <span className="mt-0.5 text-[length:var(--text-label)] text-muted-foreground">
          Feedback
        </span>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no new errors.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/feedback-stat-card.tsx
git commit -m "Add FeedbackStatCard for combined liked/disliked display"
```

---

## Task 3: Add optional `className` to `KpiStatCard`

**Files:**
- Modify: `components/dashboard/kpi-stat-card.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `KpiStatCard({ label: string; value: number; className?: string })` (new optional third prop). Used by `SessionSummarySection` (Task 8) to make the card `flex-1` inside a flex row instead of relying on a CSS grid.

- [ ] **Step 1: Read the current file to confirm exact current content**

Current `components/dashboard/kpi-stat-card.tsx`:

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

- [ ] **Step 2: Add the `className` prop**

```tsx
// components/dashboard/kpi-stat-card.tsx
"use client";

import { ChartStatFlow } from "@/components/charts/chart-stat-flow";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiStatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <Card className={cn("py-4", className)}>
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

- [ ] **Step 3: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no new errors (existing call sites that don't pass `className` still compile since it's optional).

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/kpi-stat-card.tsx
git commit -m "Add optional className prop to KpiStatCard"
```

---

## Task 4: `ThemesPopover` component

**Files:**
- Create: `components/dashboard/themes-popover.tsx`

**Interfaces:**
- Consumes: `ThemeEntry` type from `@/lib/graph` (`{ theme: string; type: "like" | "dislike"; nodeIds: string[] }`, already exists — no changes needed), `Popover`/`PopoverTrigger`/`PopoverContent` from `@/components/ui/popover` (already installed), `Tag` icon from `lucide-react`, `cn` from `@/lib/utils`.
- Produces: `ThemesPopover({ themes: ThemeEntry[] })` — renders `null` when `themes` is empty; otherwise a small pill trigger that opens a popover with the same like/dislike chip list `prescription-report.tsx` renders today. Used by `SessionSummarySection` (Task 8).

- [ ] **Step 1: Create the component**

```tsx
// components/dashboard/themes-popover.tsx
"use client";

import { Tag } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ThemeEntry } from "@/lib/graph";
import { cn } from "@/lib/utils";

export function ThemesPopover({ themes }: { themes: ThemeEntry[] }) {
  if (themes.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex flex-shrink-0 items-center gap-1.5 self-center rounded-full border border-border px-3 py-1.5 text-[length:var(--text-label)] font-medium text-muted-foreground hover:border-foreground/30 hover:text-foreground"
        >
          <Tag className="h-3.5 w-3.5" />
          Themes
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto">
        <p className="mb-2 font-mono text-[length:var(--text-label)] font-bold uppercase tracking-wide text-muted-foreground">
          Themes that shaped this
        </p>
        <div className="flex flex-wrap gap-2">
          {themes.map((t) => (
            <span
              key={`${t.type}-${t.theme}`}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[length:var(--text-label)] font-medium",
                t.type === "like"
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-destructive/30 bg-destructive/5 text-destructive"
              )}
            >
              {t.type === "like" ? "+" : "−"} {t.theme}
            </span>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no new errors.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/themes-popover.tsx
git commit -m "Add ThemesPopover component"
```

---

## Task 5: Restructure `EvidenceRow` into narrative blocks

**Files:**
- Modify: `components/dashboard/evidence-row.tsx`

**Interfaces:**
- Consumes: `EvidenceExample` type from `@/lib/types` (unchanged: `{ kind: "linkedin" | "app" | "company"; label: string; detail: string }`).
- Produces: `EvidenceRow({ examples: EvidenceExample[] })` — same signature as today, but each of the 3 examples now renders as a heading + narrative sentence instead of a badge + two stacked label/value lines. The LinkedIn example renders with quote styling (matching the italic-quote treatment already used for `NeedSummaryList`'s quotes, Task 6). Used by `PrescriptionCard` (Task 7).

- [ ] **Step 1: Confirm current file content**

Current `components/dashboard/evidence-row.tsx`:

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

- [ ] **Step 2: Replace with the narrative-block version**

```tsx
// components/dashboard/evidence-row.tsx
"use client";

import type { EvidenceExample } from "@/lib/types";

const KIND_HEADING: Record<EvidenceExample["kind"], string> = {
  linkedin: "Our recommendation",
  app: "App suggestion",
  company: "Company match",
};

function narrativeFor(example: EvidenceExample): string {
  return `${example.label} — ${example.detail}`;
}

export function EvidenceRow({ examples }: { examples: EvidenceExample[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-3">
      {examples.map((example) => (
        <div key={example.kind} className="space-y-1">
          <p className="font-mono text-[length:var(--text-label)] font-bold uppercase tracking-wide text-muted-foreground">
            {KIND_HEADING[example.kind]}
          </p>
          {example.kind === "linkedin" ? (
            <p className="border-l-2 border-border pl-2 text-[length:var(--text-label)] italic text-muted-foreground">
              &ldquo;{narrativeFor(example)}&rdquo;
            </p>
          ) : (
            <p className="text-[length:var(--text-label)] text-muted-foreground">
              {narrativeFor(example)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no new errors. (`Badge` import removal must not leave an unused-import lint error — it's fully removed from this file.)

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/evidence-row.tsx
git commit -m "Restructure EvidenceRow into narrative heading blocks"
```

---

## Task 6: `NeedSummaryList` component (Section 1 replacement)

**Files:**
- Create: `components/dashboard/need-summary-list.tsx`

**Interfaces:**
- Consumes: `DashboardNeed` type from `@/lib/graph` (`{ node: CanvasNodeData; category: string; quote: string; revisionCount: number; eliminated?: CanvasNodeData; peerOutcome?: PeerOutcome }`, unchanged), `Badge` from `@/components/ui/badge`.
- Produces: `NeedSummaryList({ needs: DashboardNeed[] })` — renders one row per need (title, category badge, quote, approaches/revisions text), no card backgrounds. Used by `PrescriptionReport` (Task 9) as the new Section 1 body.

- [ ] **Step 1: Create the component**

```tsx
// components/dashboard/need-summary-list.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import type { DashboardNeed } from "@/lib/graph";

export function NeedSummaryList({ needs }: { needs: DashboardNeed[] }) {
  return (
    <div className="divide-y divide-border border-t border-border">
      {needs.map((n) => (
        <div key={n.node.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-3">
          <span className="text-sm font-semibold text-foreground">
            {n.node.title.replace(/\s\(v\d+\)$/, "")}
          </span>
          <Badge variant="outline">{n.category}</Badge>
          <span className="text-[length:var(--text-label)] italic text-muted-foreground">
            &ldquo;{n.quote}&rdquo;
          </span>
          <span className="text-[length:var(--text-label)] text-muted-foreground">
            {n.eliminated ? "2 approaches explored" : "1 approach accepted directly"}
            {n.revisionCount > 0
              ? ` · ${n.revisionCount} revision${n.revisionCount > 1 ? "s" : ""}`
              : " · no revisions"}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no new errors.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/need-summary-list.tsx
git commit -m "Add NeedSummaryList component for decluttered Section 1"
```

---

## Task 7: `PrescriptionCard` component (merged Section 3 card)

**Files:**
- Create: `components/dashboard/prescription-card.tsx`

**Interfaces:**
- Consumes: `DashboardNeed` from `@/lib/graph` (unchanged), `MiniGauge` from `./mini-gauge` (Task 1), `EvidenceRow` from `./evidence-row` (Task 5), `Badge`/`Card`/`CardContent` from `@/components/ui/*`, `Collapsible`/`CollapsibleTrigger`/`CollapsibleContent` from `@/components/ui/collapsible` (already installed, same pattern as `components/canvas/rx-node.tsx`), `BarChart`/`Bar`/`Grid`/`BarXAxis`/`ChartTooltip` from `@/components/charts/*` (existing imports, unchanged), `ChevronRight` from `lucide-react`.
- Produces: `PrescriptionCard({ need: DashboardNeed })` — one card containing title/badge, body, up to two `MiniGauge`s (match score / active retention, each independently optional), and — if the need has a `peerOutcome` or `evidenceExamples` — a "View evidence" disclosure containing the peer-outcome bar chart and the `EvidenceRow`. Used by `PrescriptionReport` (Task 9).

- [ ] **Step 1: Create the component**

```tsx
// components/dashboard/prescription-card.tsx
"use client";

import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { Grid } from "@/components/charts/grid";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import type { DashboardNeed } from "@/lib/graph";
import { MiniGauge } from "./mini-gauge";
import { EvidenceRow } from "./evidence-row";

export function PrescriptionCard({ need }: { need: DashboardNeed }) {
  const { node, peerOutcome } = need;
  const hasEvidence = Boolean(peerOutcome || node.evidenceExamples);
  const barData =
    peerOutcome?.bars.map((v, i) => ({ cohort: `Cohort ${i + 1}`, outcome: v })) ?? [];

  return (
    <Card className="py-4">
      <CardContent className="space-y-2 px-[var(--card-px)]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-primary">
            {node.id.split("-")[0]}
          </span>
          <b className="text-sm">{node.title.replace(/\s\(v\d+\)$/, "")}</b>
          <Badge variant={node.transparency === "sponsored" ? "destructive" : "default"}>
            {node.transparency === "sponsored" ? "Sponsored" : "Organic"}
          </Badge>
        </div>

        <p className="text-[length:var(--text-label)] text-muted-foreground">{node.body}</p>

        {(node.matchScore != null || node.retentionRate != null) && (
          <div className="flex gap-4 pt-1">
            {node.matchScore != null && (
              <MiniGauge value={node.matchScore} label="Match score" />
            )}
            {node.retentionRate != null && (
              <MiniGauge value={node.retentionRate} label="Active retention" />
            )}
          </div>
        )}

        {hasEvidence && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="group flex items-center gap-1 border-t border-border pt-2 font-mono text-[length:var(--text-label)] uppercase tracking-wide text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
                View evidence
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {peerOutcome && (
                <>
                  <div className="flex items-center justify-end gap-2">
                    <Badge variant="outline">n={peerOutcome.cohortSize}</Badge>
                  </div>
                  <BarChart aspectRatio="3 / 1" data={barData} xDataKey="cohort">
                    <Grid horizontal />
                    <Bar dataKey="outcome" fill="var(--color-chart-3)" lineCap={4} />
                    <ChartTooltip showCrosshair={false} />
                    <BarXAxis />
                  </BarChart>
                  <p className="text-[length:var(--text-label)] text-muted-foreground">
                    Cohort: {peerOutcome.cohortDefinition}
                  </p>
                </>
              )}
              {node.evidenceExamples && <EvidenceRow examples={node.evidenceExamples} />}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no new errors.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/prescription-card.tsx
git commit -m "Add PrescriptionCard merging prescription and evidence sections"
```

---

## Task 8: Rewrite `SessionSummarySection` with grouped stats + themes

**Files:**
- Modify: `components/dashboard/session-summary-section.tsx`

**Interfaces:**
- Consumes: `FeedbackStatCard` (Task 2), `KpiStatCard` with `className` (Task 3), `ThemesPopover` (Task 4), `ThemeEntry` type from `@/lib/graph`. Everything else (`deriveSessionStats`, `getSessionSummary`, `LineChart`/`Line`/`Grid`/`ChartTooltip`/`XAxis`/`YAxis`, `AITextLoading`) is unchanged from the current file.
- Produces: `SessionSummarySection({ nodes: CanvasNodeData[]; themes: ThemeEntry[] })` — note the new required `themes` prop (previously this component took only `nodes`). Used by `PrescriptionReport` (Task 9), which now must pass `themes` too.

- [ ] **Step 1: Confirm current file content**

Current `components/dashboard/session-summary-section.tsx` (for reference — this whole file is being replaced in Step 2):

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

const TONE_LABEL: Record<number, string> = {
  1: "Positive",
  0: "Neutral",
  [-1]: "Negative",
};

const SUMMARY_LOADING_STAGES = ["Reading your session…", "Summarizing…"];

export function SessionSummarySection({ nodes }: { nodes: CanvasNodeData[] }) {
  const stats = deriveSessionStats(nodes);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [trackedNodes, setTrackedNodes] = useState(nodes);

  if (nodes !== trackedNodes) {
    setTrackedNodes(nodes);
    setSummary(null);
  }

  useEffect(() => {
    let cancelled = false;
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
              <ChartTooltip
                rows={(point) => [
                  {
                    color: "var(--color-chart-3)",
                    label: point.label as string,
                    value: TONE_LABEL[point.tone as number] ?? String(point.tone),
                  },
                ]}
                showCrosshair={false}
              />
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

- [ ] **Step 2: Replace the file**

```tsx
// components/dashboard/session-summary-section.tsx
"use client";

import { useEffect, useState } from "react";
import { deriveSessionStats, type ThemeEntry } from "@/lib/graph";
import { getSessionSummary } from "@/lib/mockAI";
import type { CanvasNodeData, SessionSummary } from "@/lib/types";
import { KpiStatCard } from "./kpi-stat-card";
import { FeedbackStatCard } from "./feedback-stat-card";
import { ThemesPopover } from "./themes-popover";
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

const TONE_LABEL: Record<number, string> = {
  1: "Positive",
  0: "Neutral",
  [-1]: "Negative",
};

const SUMMARY_LOADING_STAGES = ["Reading your session…", "Summarizing…"];

export function SessionSummarySection({
  nodes,
  themes,
}: {
  nodes: CanvasNodeData[];
  themes: ThemeEntry[];
}) {
  const stats = deriveSessionStats(nodes);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [trackedNodes, setTrackedNodes] = useState(nodes);

  if (nodes !== trackedNodes) {
    setTrackedNodes(nodes);
    setSummary(null);
  }

  useEffect(() => {
    let cancelled = false;
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
      <div className="flex flex-wrap items-stretch gap-3">
        <FeedbackStatCard
          likeCount={stats.likeCount}
          dislikeCount={stats.dislikeCount}
          className="flex-1 basis-40"
        />
        <KpiStatCard
          label="Paths explored"
          value={stats.pathCount + stats.optionPickCount}
          className="flex-1 basis-40"
        />
        <KpiStatCard
          label="Your input"
          value={stats.selectedCount + stats.noteCount + stats.ownFramingCount}
          className="flex-1 basis-40"
        />
        <ThemesPopover themes={themes} />
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
              <ChartTooltip
                rows={(point) => [
                  {
                    color: "var(--color-chart-3)",
                    label: point.label as string,
                    value: TONE_LABEL[point.tone as number] ?? String(point.tone),
                  },
                ]}
                showCrosshair={false}
              />
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

- [ ] **Step 3: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: this will show an error at the `<SessionSummarySection nodes={nodes} />` call site in `prescription-report.tsx` (missing required `themes` prop) — that's expected and gets fixed in Task 9. Confirm the error is only in `prescription-report.tsx` and not in `session-summary-section.tsx` itself.

Run: `npm run lint`
Expected: no new errors in `session-summary-section.tsx`, `feedback-stat-card.tsx`, or `themes-popover.tsx`.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/session-summary-section.tsx
git commit -m "Replace 7-stat KPI row with 3 grouped stats + themes popover"
```

---

## Task 9: Rewrite `PrescriptionReport` orchestration

**Files:**
- Modify: `components/dashboard/prescription-report.tsx`

**Interfaces:**
- Consumes: `NeedSummaryList` (Task 6), `SessionSummarySection` with `themes` prop (Task 8), `PrescriptionCard` (Task 7), `deriveDashboardNeeds`/`deriveThemeEntries` from `@/lib/graph` (unchanged).
- Produces: `PrescriptionReport({ nodes: CanvasNodeData[] })` — same external signature as today (used by `components/dashboard/dashboard-screen.tsx`, unchanged, no edits needed there). Internally now renders exactly 3 `SectionHead` blocks instead of 4.

- [ ] **Step 1: Confirm current file content**

Already on record from this session — current `components/dashboard/prescription-report.tsx` is 200 lines, importing `Badge`, `Card`/`CardContent`, `BarChart`/`Bar`/`Grid`/`BarXAxis`/`ChartTooltip`, `HoverCard`/`HoverCardTrigger`/`HoverCardContent`, `deriveDashboardNeeds`/`deriveThemeEntries`, `cn`, `SessionSummarySection`, `EvidenceRow`, and rendering 4 sections (needs-card-grid, themes-card, prescription-list, evidence-list).

- [ ] **Step 2: Replace the file**

```tsx
// components/dashboard/prescription-report.tsx
"use client";

import { deriveDashboardNeeds, deriveThemeEntries } from "@/lib/graph";
import type { CanvasNodeData } from "@/lib/types";
import { SessionSummarySection } from "./session-summary-section";
import { NeedSummaryList } from "./need-summary-list";
import { PrescriptionCard } from "./prescription-card";

function SectionHead({ index, title, hint }: { index: number; title: string; hint?: string }) {
  return (
    <div className="mb-4 mt-10 flex items-baseline justify-between">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-xs font-bold text-primary">
          {String(index).padStart(2, "0")}
        </span>
        <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
      </div>
      {hint && <span className="text-[length:var(--text-label)] text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function PrescriptionReport({ nodes }: { nodes: CanvasNodeData[] }) {
  const needs = deriveDashboardNeeds(nodes);
  const themes = deriveThemeEntries(nodes);

  if (needs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No recommendations were marked &ldquo;Select&rdquo; before finalizing.
      </p>
    );
  }

  return (
    <>
      <SectionHead index={1} title="What we understood" hint="each item links back to the moment it came from" />
      <NeedSummaryList needs={needs} />

      <SectionHead index={2} title="How we read your situation" hint="from your own feedback on the canvas" />
      <SessionSummarySection nodes={nodes} themes={themes} />

      <SectionHead index={3} title="Your prescription" hint="ranked by match, per need" />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {needs.map((n) => (
          <PrescriptionCard key={n.node.id} need={n} />
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in `components/dashboard/*` — this resolves the `themes` prop error flagged in Task 8, Step 3.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/prescription-report.tsx
git commit -m "Restructure PrescriptionReport into 3 sections"
```

---

## Task 10: Manual browser verification

**Files:** none (verification only).

**Interfaces:** N/A.

- [ ] **Step 1: Start the dev server**

Use the project's preview tooling to start `npm run dev` and open the app.

- [ ] **Step 2: Build a representative session**

From the chat entry screen, submit a prompt that produces at least 2 selected needs, with a mix of: one node liked, one disliked, at least one revision with a note (so the sentiment timeline has a point), and at least one option pick (so "Paths explored" is nonzero). Reach the dashboard via Finalize.

- [ ] **Step 3: Verify Section 1 ("What we understood")**

Confirm: no card backgrounds — a plain list with a top border and row dividers; each row shows title, category badge, italic quote, and "N approaches explored/accepted · M revisions" text; no "linked to your note" hover trigger remains anywhere on the page.

- [ ] **Step 4: Verify Section 2 ("How we read your situation")**

Confirm: exactly 3 stat cards (Feedback showing both counts, Paths explored, Your input) plus a "Themes" pill button in the same row; clicking the Themes pill opens a popover with the like/dislike chips (or the pill is absent entirely if the session has no feedback); the summary sentence and sentiment chart render below, unchanged from before.

- [ ] **Step 5: Verify Section 3 ("Your prescription")**

Confirm: cards render in a 2-column grid on desktop width; each card shows title/badge/body, up to 2 gauge arcs (match score / active retention — confirm a card with only one of the two fields set renders just one gauge, not an empty slot); clicking "View evidence" expands to show the peer-outcome bar chart, cohort caption, and 3 evidence blocks (LinkedIn rendered as a quote, App/Company as narrative sentences).

- [ ] **Step 6: Verify the empty-state path still works**

Start a fresh session, reach the canvas, click Finalize without selecting anything, confirm the dashboard shows the existing "No recommendations were marked..." message and none of the 3 sections render.

- [ ] **Step 7: Final full-project verification**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 8: Commit (if any fixes were needed during manual verification)**

```bash
git add -A
git commit -m "Fix issues found during manual verification of declutter pass"
```

(Skip this commit if Steps 3–6 required no code changes.)
