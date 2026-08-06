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
