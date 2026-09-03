"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { deriveEvidenceComparison, type DashboardNeed } from "@/lib/graph";
import { InfoTooltip } from "./info-tooltip";
import { cn } from "@/lib/utils";

const MATCH_TOOLTIP =
  "How well this fits you, out of 100. Built from how many similar teams we have data from, and how close their size, setup, and limits are to yours.";
const OUTCOME_TOOLTIP =
  "Median change for teams that made this change, versus their own pace before. Half did better, half did less.";
const RETENTION_TOOLTIP = "Share of those teams still using the change six months on.";
const EVIDENCE_TOOLTIP =
  'How much faster teams worked after this change. "Teams like you" are close to your size and setup. "Typical team" is the middle result across every team we have data for.';

/**
 * One figure in the card's stat row. Every figure in that row renders at the
 * SAME size (--text-body) — outcome, retention and cohort size are all
 * measures of one cohort, so sizing one above the others states a hierarchy
 * that isn't there. Role is carried by colour instead: primary for the
 * outcome (the lead signal, and the only green thing in the card), plain
 * foreground for retention, muted for the sample size.
 */
function StatFigure({
  value,
  unit,
  tooltip,
  tone,
}: {
  value: string;
  unit: string;
  tooltip?: string;
  tone: "primary" | "neutral" | "muted";
}) {
  return (
    <>
      <span
        className={cn(
          "font-mono text-[length:var(--text-body)] font-bold leading-none",
          tone === "primary" && "text-primary",
          tone === "neutral" && "text-foreground",
          tone === "muted" && "text-muted-foreground"
        )}
      >
        {value}
      </span>
      <span className="flex items-center gap-1 text-[length:var(--text-label)] text-muted-foreground">
        {unit}
        {tooltip && <InfoTooltip text={tooltip} />}
      </span>
    </>
  );
}

function EvidenceBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "muted";
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-[length:var(--text-label)] text-muted-foreground">
        {label}
      </span>
      <div
        className="h-2 flex-1 overflow-hidden rounded-full"
        style={{ background: "color-mix(in srgb, var(--color-foreground) 9%, transparent)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${clamped}%`,
            background:
              tone === "primary"
                ? "var(--color-primary)"
                : "color-mix(in srgb, var(--color-primary) 22%, transparent)",
          }}
        />
      </div>
      <span
        className={cn(
          "w-11 shrink-0 text-right font-mono text-[length:var(--text-label)] font-bold",
          tone === "primary" ? "text-primary" : "text-muted-foreground"
        )}
      >
        {clamped}%
      </span>
    </div>
  );
}

/**
 * Section 03's hero card. Shares one anatomy with PrescriptionCardCompact —
 * match score in a left column, then title / body / stat row — so the two
 * card types read as one component at two sizes rather than as two different
 * components. The hero is the larger size: a bigger match score, a full body,
 * and the evidence comparison the alternative cards don't carry.
 */
export function PrescriptionCard({ need }: { need: DashboardNeed }) {
  const { node, peerOutcome } = need;
  const comparison = deriveEvidenceComparison(peerOutcome);
  const hasStatRow = Boolean(comparison) || node.retentionRate != null || Boolean(peerOutcome);

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
          {node.matchScore != null && (
            <div className="flex flex-col items-center gap-0.5 border-r border-border pr-4">
              <span className="font-mono text-[length:var(--text-match)] font-bold leading-none text-foreground">
                {node.matchScore}
              </span>
              <span className="flex items-center gap-1 text-[length:var(--text-meta)] uppercase tracking-wide text-muted-foreground">
                Match
                <InfoTooltip text={MATCH_TOOLTIP} />
              </span>
            </div>
          )}

          <div className="min-w-0 space-y-1.5">
            <p className="text-[length:var(--text-title)] font-semibold text-foreground">
              {node.title.replace(/\s\(v\d+\)$/, "")}
            </p>
            <p className="text-[length:var(--text-body)] text-muted-foreground">{node.body}</p>

            {hasStatRow && (
              <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 pt-0.5">
                {comparison && (
                  <StatFigure
                    value={`+${comparison.deltaPts}%`}
                    unit="faster work"
                    tooltip={OUTCOME_TOOLTIP}
                    tone="primary"
                  />
                )}
                {node.retentionRate != null && (
                  <>
                    {comparison && <span className="text-border">&middot;</span>}
                    <StatFigure
                      value={`${node.retentionRate}%`}
                      unit="retention"
                      tooltip={RETENTION_TOOLTIP}
                      tone="neutral"
                    />
                  </>
                )}
                {peerOutcome && (
                  <>
                    {(comparison || node.retentionRate != null) && (
                      <span className="text-border">&middot;</span>
                    )}
                    <span className="text-[length:var(--text-label)] text-muted-foreground">
                      based on
                    </span>
                    <StatFigure
                      value={`${peerOutcome.cohortSize}`}
                      unit="teams"
                      tone="muted"
                    />
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        {comparison && peerOutcome && (
          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[length:var(--text-label)] font-medium text-foreground">
                Evidence
                <InfoTooltip text={EVIDENCE_TOOLTIP} />
              </span>
              <span className="text-[length:var(--text-meta)] uppercase tracking-wide text-muted-foreground">
                % faster work
              </span>
            </div>

            <EvidenceBar label="Teams like you" value={comparison.you} tone="primary" />
            <EvidenceBar label="Typical team" value={comparison.typical} tone="muted" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
