"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { Grid } from "@/components/charts/grid";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import { deriveDashboardNeeds, deriveThemeEntries, type DashboardNeed } from "@/lib/graph";
import type { CanvasNodeData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SourceOverlay } from "./source-overlay";

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
  const [sourceNeed, setSourceNeed] = useState<DashboardNeed | null>(null);
  const needs = deriveDashboardNeeds(nodes);
  const themes = deriveThemeEntries(nodes);
  const needsWithEvidence = needs.filter((n) => n.peerOutcome);

  if (needs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No recommendations were marked &ldquo;Select&rdquo; before finalizing.
      </p>
    );
  }

  const focusData = needs.map((n) => ({
    need: n.node.title.replace(/\s\(v\d+\)$/, ""),
    revisions: n.revisionCount,
  }));

  return (
    <>
      <SectionHead index={1} title="What we understood" hint="each item links back to the moment it came from" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {needs.map((n) => (
          <Card key={n.node.id} className="gap-2 py-4">
            <CardContent className="space-y-2 px-[var(--card-px)]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[length:var(--text-label)] font-bold text-primary">
                  {n.node.id.split("-")[0]}
                </span>
                <Badge variant="outline">{n.category}</Badge>
              </div>
              <p className="text-sm font-semibold text-foreground">
                {n.node.title.replace(/\s\(v\d+\)$/, "")}
              </p>
              <p className="min-h-9 text-[length:var(--text-label)] italic text-muted-foreground">
                &ldquo;{n.quote}&rdquo;
              </p>
              <p className="border-t border-border pt-2 text-[length:var(--text-label)] text-muted-foreground">
                {n.eliminated ? "2 approaches explored" : "1 approach accepted directly"}
                {n.revisionCount > 0
                  ? ` · ${n.revisionCount} revision${n.revisionCount > 1 ? "s" : ""}`
                  : " · no revisions"}
              </p>
              <button
                onClick={() => setSourceNeed(n)}
                className="provenance-link text-xs font-semibold text-primary hover:underline"
              >
                View source →
              </button>
            </CardContent>
          </Card>
        ))}
      </div>

      {themes.length > 0 && (
        <>
          <SectionHead index={2} title="How we read your situation" hint="from your own feedback on the canvas" />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Card className="py-4">
              <CardContent className="px-[var(--card-px)]">
                <p className="mb-3 font-mono text-[length:var(--text-label)] font-bold uppercase tracking-wide text-muted-foreground">
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
              </CardContent>
            </Card>

            <Card className="py-4">
              <CardContent className="px-[var(--card-px)]">
                <p className="mb-2 font-mono text-[length:var(--text-label)] font-bold uppercase tracking-wide text-muted-foreground">
                  Where your attention went
                </p>
                <BarChart aspectRatio="2 / 1" data={focusData} xDataKey="need">
                  <Grid horizontal />
                  <Bar dataKey="revisions" fill="var(--color-primary)" lineCap={4} />
                  <ChartTooltip showCrosshair={false} />
                  <BarXAxis />
                </BarChart>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <SectionHead index={3} title="Your prescription" hint="ranked by match, per need" />
      <div className="flex flex-col gap-3">
        {needs.map((n) => (
          <Card key={n.node.id} className="py-4">
            <CardContent className="space-y-2 px-[var(--card-px)]">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-primary">
                  {n.node.id.split("-")[0]}
                </span>
                <b className="text-sm">{n.node.title.replace(/\s\(v\d+\)$/, "")}</b>
                <Badge variant={n.node.transparency === "sponsored" ? "destructive" : "default"}>
                  {n.node.transparency === "sponsored" ? "Sponsored" : "Organic"}
                </Badge>
              </div>
              <p className="text-[length:var(--text-label)] text-muted-foreground">{n.node.body}</p>
              <div className="flex gap-6 pt-1">
                {n.node.matchScore != null && (
                  <div>
                    <p className="font-mono text-lg font-bold tabular-nums text-foreground">
                      {n.node.matchScore}%
                    </p>
                    <p className="text-[length:var(--text-meta)] text-muted-foreground">Match score</p>
                  </div>
                )}
                {n.node.retentionRate != null && (
                  <div>
                    <p className="font-mono text-lg font-bold tabular-nums text-foreground">
                      {n.node.retentionRate}%
                    </p>
                    <p className="text-[length:var(--text-meta)] text-muted-foreground">Active retention</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {needsWithEvidence.length > 0 && (
        <>
          <SectionHead index={4} title="Why this should work" hint="every claim carries its source" />
          <div className="flex flex-col gap-3">
            {needsWithEvidence.map((n) => {
              const data = n.peerOutcome!.bars.map((v, i) => ({
                cohort: `Cohort ${i + 1}`,
                outcome: v,
              }));
              return (
                <Card key={n.node.id} className="py-4">
                  <CardContent className="px-[var(--card-px)]">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        {n.node.title.replace(/\s\(v\d+\)$/, "")}
                      </p>
                      <Badge variant="outline">
                        n={n.peerOutcome!.cohortSize}
                      </Badge>
                    </div>
                    <BarChart aspectRatio="3 / 1" data={data} xDataKey="cohort">
                      <Grid horizontal />
                      <Bar dataKey="outcome" fill="var(--color-chart-3)" lineCap={4} />
                      <ChartTooltip showCrosshair={false} />
                      <BarXAxis />
                    </BarChart>
                    <p className="mt-1 text-[length:var(--text-label)] text-muted-foreground">
                      Cohort: {n.peerOutcome!.cohortDefinition}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <SourceOverlay need={sourceNeed} onOpenChange={(open) => !open && setSourceNeed(null)} />
    </>
  );
}
