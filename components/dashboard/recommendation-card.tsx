"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CanvasNodeData } from "@/lib/types";

export function RecommendationCard({ node }: { node: CanvasNodeData }) {
  const transparency = node.transparency ?? "organic";
  const isSponsored = transparency === "sponsored";

  return (
    <Card className="gap-3 border-border py-4 shadow-none">
      <CardHeader className="px-4">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base font-semibold text-foreground">
            {node.title}
          </CardTitle>
          <Badge
            variant="stamp"
            className={isSponsored ? "text-destructive" : "text-primary"}
          >
            {isSponsored ? "Sponsored" : "Organic"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-4">
        <p className="text-sm text-muted-foreground">{node.body}</p>

        <div className="flex items-end justify-between gap-4">
          <HoverCard>
            <HoverCardTrigger asChild>
              <button className="text-left">
                <p className="font-mono text-2xl font-bold tabular-nums text-foreground">
                  {node.matchScore ?? "—"}%
                </p>
                <p className="text-[11px] text-muted-foreground underline decoration-dotted">
                  Match score
                </p>
              </button>
            </HoverCardTrigger>
            <HoverCardContent className="w-64 space-y-2">
              <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Contributing factors
              </p>
              <ul className="space-y-1.5">
                {(node.matchFactors ?? []).map((f) => (
                  <li key={f.label} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-foreground">{f.label}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {f.weight}%
                    </span>
                  </li>
                ))}
              </ul>
            </HoverCardContent>
          </HoverCard>

          <div className="text-right">
            <p className="font-mono text-2xl font-bold tabular-nums text-foreground">
              {node.retentionRate ?? "—"}%
            </p>
            <p className="text-[11px] text-muted-foreground">Active retention</p>
          </div>
        </div>

        {node.peerOutcome && (
          <div className="space-y-1.5">
            <div className="flex h-14 items-end gap-1">
              {node.peerOutcome.bars.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 bg-primary/70"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="cursor-help text-[11px] text-muted-foreground underline decoration-dotted">
                  Peer outcomes, n={node.peerOutcome.cohortSize}
                </p>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-56 text-xs">
                  Cohort: {node.peerOutcome.cohortDefinition}
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
