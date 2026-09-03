"use client";

import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { deriveEvidenceComparison, type DashboardNeed } from "@/lib/graph";
import { EvidenceRow } from "./evidence-row";
import { InfoTooltip } from "./info-tooltip";

const MATCH_TOOLTIP =
  "How well this fits you, out of 100. Built from how many similar teams we have data from, and how close their size, setup, and limits are to yours.";

export function PrescriptionCardCompact({ need }: { need: DashboardNeed }) {
  const { node, peerOutcome } = need;
  const comparison = deriveEvidenceComparison(peerOutcome);
  const evidenceCount = (peerOutcome ? 1 : 0) + (node.evidenceExamples?.length ?? 0);
  const hasStatLine = Boolean(comparison) || node.retentionRate != null;

  return (
    <Card className="report-card-surface py-4">
      <CardContent className="space-y-3 px-[var(--card-px)]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold uppercase tracking-wide text-primary">
            Alternative path
          </span>
          {node.transparency === "sponsored" && (
            <Badge className="bg-cta text-cta-foreground">Sponsored</Badge>
          )}
        </div>

        <div className="grid grid-cols-[auto_1fr] items-center gap-4">
          {node.matchScore != null && (
            <div className="border-r border-border pr-4 text-center">
              {/* --text-kpi (26px) against the hero's --text-match (30px):
                  with both card types now sharing one anatomy, the size of
                  this number is the only thing left that separates them. */}
              <div className="font-mono text-[length:var(--text-kpi)] font-bold leading-none text-foreground">
                {node.matchScore}
              </div>
              <div className="mt-1 flex items-center justify-center gap-1 text-[length:var(--text-meta)] uppercase tracking-wide text-muted-foreground">
                Match
                <InfoTooltip text={MATCH_TOOLTIP} />
              </div>
            </div>
          )}

          <div className="min-w-0 space-y-1">
            <p className="truncate text-[length:var(--text-support-title)] font-semibold text-foreground">
              {node.title.replace(/\s\(v\d+\)$/, "")}
            </p>
            <p className="line-clamp-1 text-[length:var(--text-label)] text-muted-foreground">
              {node.body}
            </p>
            {/* Same stat row as the hero card: every figure at one size, role
                carried by colour. "n=142" was statistical notation on a screen
                read by HR and procurement people, and it was the only figure in
                the row without a unit word after it — "based on 142 teams" fixes
                both. */}
            {hasStatLine && (
              <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-[length:var(--text-label)]">
                {comparison && (
                  <>
                    <span className="font-mono text-[length:var(--text-label)] font-bold text-primary">
                      +{comparison.deltaPts}%
                    </span>
                    <span className="text-muted-foreground">faster work</span>
                  </>
                )}
                {node.retentionRate != null && (
                  <>
                    {comparison && <span className="text-border">&middot;</span>}
                    <span className="font-mono text-[length:var(--text-label)] font-bold text-foreground">
                      {node.retentionRate}%
                    </span>
                    <span className="text-muted-foreground">retention</span>
                  </>
                )}
                {peerOutcome && (
                  <>
                    {(comparison || node.retentionRate != null) && (
                      <span className="text-border">&middot;</span>
                    )}
                    <span className="text-muted-foreground">based on</span>
                    <span className="font-mono text-[length:var(--text-label)] font-bold text-muted-foreground">
                      {peerOutcome.cohortSize}
                    </span>
                    <span className="text-muted-foreground">teams</span>
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        {evidenceCount > 0 && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="group flex items-center gap-1 rounded-full border border-border px-3 py-1 font-mono text-[length:var(--text-label)] uppercase tracking-wide text-muted-foreground motion-safe:transition-transform hover:border-foreground/30 hover:text-foreground motion-safe:active:scale-[0.98]"
              >
                <ChevronRight className="h-3 w-3 motion-safe:transition-transform group-data-[state=open]:rotate-90" />
                View evidence &middot; {evidenceCount}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {peerOutcome && (
                <p className="text-[length:var(--text-label)] text-muted-foreground">
                  {peerOutcome.cohortDefinition}
                </p>
              )}
              {node.evidenceExamples && <EvidenceRow examples={node.evidenceExamples} />}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
