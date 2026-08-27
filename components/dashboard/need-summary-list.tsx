"use client";

import { Badge } from "@/components/ui/badge";
import type { DashboardNeed } from "@/lib/graph";
import { cn } from "@/lib/utils";

const MAX_STAGGER_STEPS = 4;
const STAGGER_MS = 40;

export function NeedSummaryList({
  needs,
  highlightedId,
  onEnter,
  onLeave,
  onToggle,
}: {
  needs: DashboardNeed[];
  highlightedId: string | null;
  onEnter: (nodeId: string) => void;
  onLeave: () => void;
  onToggle: (nodeId: string) => void;
}) {
  return (
    <div className="divide-y divide-border">
      {needs.map((n, i) => {
        const id = n.node.id;
        const isRedirect = n.node.origin?.intent === "branch_new_direction";
        const pathSummary = `${
          n.eliminated ? "2 approaches explored" : "1 approach accepted directly"
        }${
          n.revisionCount > 0
            ? ` · ${n.revisionCount} revision${n.revisionCount > 1 ? "s" : ""}`
            : " · no revisions"
        }`;

        return (
          <button
            key={id}
            type="button"
            onMouseEnter={() => onEnter(id)}
            onMouseLeave={onLeave}
            onFocus={() => onEnter(id)}
            onBlur={onLeave}
            onClick={() => onToggle(id)}
            className={cn(
              "need-row-in w-full px-[var(--card-px)] py-3 text-left transition-colors",
              "hover:bg-primary/8 active:bg-primary/14 active:transition-none",
              "focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2",
              highlightedId === id && "bg-primary/8"
            )}
            style={{ animationDelay: `${Math.min(i, MAX_STAGGER_STEPS) * STAGGER_MS}ms` }}
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[15px] font-semibold tracking-[-0.005em] text-foreground">
                {n.node.title.replace(/\s\(v\d+\)$/, "")}
              </span>
              <Badge variant="outline" className="text-[length:var(--text-meta)]">
                {n.category}
              </Badge>
            </div>
            <p className="mt-1 text-[length:var(--text-quote)] italic text-foreground/78">
              &ldquo;{n.quote}&rdquo;
            </p>
            <p className="mt-1.5 text-[length:var(--text-label)] text-muted-foreground">
              {isRedirect && (
                <>
                  <span className="font-mono text-[length:var(--text-meta)] font-bold uppercase tracking-wide text-cta">
                    From your note
                  </span>{" "}
                  <span className="text-border">&middot;</span>{" "}
                </>
              )}
              {pathSummary}
            </p>
          </button>
        );
      })}
    </div>
  );
}
