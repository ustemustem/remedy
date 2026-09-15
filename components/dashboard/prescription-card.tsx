"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardNeed } from "@/lib/graph";
import { FitScore, FitBars } from "./fit-meter";
import { EvidenceRow } from "./evidence-row";

/**
 * Section 03's hero card. Shares one anatomy with PrescriptionCardCompact — the
 * fit score in a left column, then title / body — so the two card types read as
 * one component at two sizes. The hero is the larger size: a bigger fit score, a
 * full body, the fit breakdown, and grounded evidence shown inline.
 */
export function PrescriptionCard({
  need,
  evidenceLoading,
}: {
  need: DashboardNeed;
  evidenceLoading?: boolean;
}) {
  const { node } = need;

  return (
    <Card className="report-card-surface py-4">
      <CardContent className="space-y-3 px-[var(--card-px)]">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-bold uppercase tracking-wide text-primary">
            Our suggestion
          </span>
          <Badge>Top match</Badge>
        </div>

        <div className="grid grid-cols-[auto_1fr] gap-4">
          {need.fit && (
            <div className="flex flex-col items-center justify-center border-r border-border pr-4">
              <FitScore fit={need.fit} size="hero" />
            </div>
          )}

          <div className="min-w-0 space-y-1.5">
            <p className="text-[length:var(--text-title)] font-semibold text-foreground">
              {node.title.replace(/\s\(v\d+\)$/, "")}
            </p>
            <p className="text-[length:var(--text-body)] text-muted-foreground">{node.body}</p>
          </div>
        </div>

        {need.fit && (
          <div className="border-t border-border pt-3">
            <FitBars fit={need.fit} showNotes />
          </div>
        )}

        {need.evidence && need.evidence.length > 0 && <EvidenceRow examples={need.evidence} />}
        {evidenceLoading && !need.evidence?.length && (
          <p className="border-t border-border pt-3 text-[length:var(--text-label)] text-muted-foreground">
            Finding evidence…
          </p>
        )}
      </CardContent>
    </Card>
  );
}
