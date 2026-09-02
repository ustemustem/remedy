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
  'How much faster teams worked after this change. "Teams like you" are close to your size and setup. "Typical team" is the median across all n teams.';

function KpiCell({
  value,
  label,
  tooltip,
  tone,
  bordered,
}: {
  value: string;
  label: string;
  tooltip: string;
  tone: "primary" | "neutral";
  bordered: boolean;
}) {
  return (
    <div className={cn("flex-1 px-4 first:pl-0", bordered && "border-l border-border")}>
      <div
        className={cn(
          "font-mono text-[length:var(--text-kpi)] font-bold leading-none",
          tone === "primary" ? "text-primary" : "text-foreground"
        )}
      >
        {value}
      </div>
      <div className="mt-1 flex items-center gap-1 text-[length:var(--text-meta)] uppercase tracking-wide text-muted-foreground">
        {label}
        <InfoTooltip text={tooltip} />
      </div>
    </div>
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

export function PrescriptionCard({ need }: { need: DashboardNeed }) {
  const { node, peerOutcome } = need;
  const comparison = deriveEvidenceComparison(peerOutcome);

  const cells: { value: string; label: string; tooltip: string; tone: "primary" | "neutral" }[] =
    [];
  if (comparison) {
    cells.push({
      value: `+${comparison.deltaPts}%`,
      label: "Outcome",
      tooltip: OUTCOME_TOOLTIP,
      tone: "primary",
    });
  }
  if (node.matchScore != null) {
    cells.push({
      value: `${node.matchScore}`,
      label: "Match",
      tooltip: MATCH_TOOLTIP,
      tone: "neutral",
    });
  }
  if (node.retentionRate != null) {
    cells.push({
      value: `${node.retentionRate}%`,
      label: "Retention",
      tooltip: RETENTION_TOOLTIP,
      tone: "neutral",
    });
  }

  return (
    <Card className="report-card-surface py-4">
      <CardContent className="space-y-3 px-[var(--card-px)]">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-bold uppercase tracking-wide text-primary">
            Start here
          </span>
          <Badge>Top match</Badge>
        </div>

        {cells.length > 0 && (
          <div className="flex border-t border-b border-border py-3">
            {cells.map((cell, i) => (
              <KpiCell key={cell.label} {...cell} bordered={i > 0} />
            ))}
          </div>
        )}

        <p className="text-[length:var(--text-title)] font-semibold text-foreground">
          {node.title.replace(/\s\(v\d+\)$/, "")}
        </p>
        <p className="text-[length:var(--text-body)] text-muted-foreground">{node.body}</p>

        {comparison && peerOutcome && (
          <div className="max-w-[460px] space-y-2 border-t border-border pt-3">
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

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span
                className="rounded-full px-2 py-0.5 font-mono text-[length:var(--text-meta)] font-bold text-primary"
                style={{ background: "color-mix(in srgb, var(--color-primary) 12%, transparent)" }}
              >
                +{comparison.deltaPts} pts ahead
              </span>
              <span className="text-[length:var(--text-meta)] text-muted-foreground">
                Based on {peerOutcome.cohortSize} teams
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
