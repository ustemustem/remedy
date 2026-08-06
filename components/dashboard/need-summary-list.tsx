"use client";

import { Badge } from "@/components/ui/badge";
import type { DashboardNeed } from "@/lib/graph";

export function NeedSummaryList({ needs }: { needs: DashboardNeed[] }) {
  return (
    <div className="divide-y divide-border border-t border-border">
      {needs.map((n) => (
        <div key={n.node.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-3">
          <span className="font-mono text-xs font-bold text-primary">
            {n.node.id.split("-")[0]}
          </span>
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
