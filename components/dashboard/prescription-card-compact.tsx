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

  return (
    <Card className="py-4">
      <CardContent className="space-y-3 px-[var(--card-px)]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold uppercase tracking-wide text-primary">
            {node.id.split("-")[0]}
          </span>
          {node.transparency === "sponsored" && (
            <Badge className="bg-cta text-cta-foreground">Sponsored</Badge>
          )}
        </div>

        <div className="grid grid-cols-[1fr_auto] items-center gap-4">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-[length:var(--text-support-title)] font-semibold text-foreground">
              {node.title.replace(/\s\(v\d+\)$/, "")}
            </p>
            {comparison && peerOutcome && (
              <p className="flex flex-wrap items-baseline gap-x-1.5 text-[length:var(--text-label)]">
                <span className="font-mono font-bold text-primary">+{comparison.deltaPts}%</span>
                <span className="text-muted-foreground">faster work</span>
                <span className="font-mono text-muted-foreground">
                  &middot; n={peerOutcome.cohortSize}
                </span>
              </p>
            )}
          </div>

          {node.matchScore != null && (
            <div className="border-l border-border pl-4 text-right">
              <div className="font-mono text-[length:var(--text-match)] font-bold leading-none text-foreground">
                {node.matchScore}
              </div>
              <div className="mt-1 flex items-center justify-end gap-1 text-[length:var(--text-meta)] uppercase tracking-wide text-muted-foreground">
                Match
                <InfoTooltip text={MATCH_TOOLTIP} />
              </div>
            </div>
          )}
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
