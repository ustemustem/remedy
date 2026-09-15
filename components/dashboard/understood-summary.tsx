"use client";

import { useEffect, useState } from "react";
import { getUnderstoodSummary } from "@/lib/mockAI";
import type { DashboardNeed } from "@/lib/graph";
import type { SummarySegment } from "@/lib/types";
import { cn } from "@/lib/utils";
import AITextLoading from "@/components/kokonutui/ai-text-loading";

const SUMMARY_LOADING_STAGES = ["Reading what you wrote…", "Summarizing…"];

export function UnderstoodSummary({
  needs,
  vent,
  preloaded,
  highlightedId,
  onEnter,
  onLeave,
  onToggle,
}: {
  needs: DashboardNeed[];
  vent: string;
  /** Pre-loaded by generateReport behind the loader (Phase 3d); when present the
   *  component skips its own fetch. Absent on the session-resume path. */
  preloaded?: SummarySegment[];
  highlightedId: string | null;
  onEnter: (nodeId: string) => void;
  onLeave: () => void;
  onToggle: (nodeId: string) => void;
}) {
  const [fetched, setFetched] = useState<SummarySegment[] | null>(null);
  const segments = preloaded ?? fetched;
  const [trackedNeeds, setTrackedNeeds] = useState(needs);

  if (!preloaded && needs !== trackedNeeds) {
    setTrackedNeeds(needs);
    setFetched(null);
  }

  useEffect(() => {
    if (preloaded) return;
    let cancelled = false;
    getUnderstoodSummary(needs, vent).then((result) => {
      if (!cancelled) setFetched(result);
    });
    return () => {
      cancelled = true;
    };
  }, [needs, vent, preloaded]);

  if (segments === null) {
    return (
      <AITextLoading
        texts={SUMMARY_LOADING_STAGES}
        interval={700}
        className="text-sm text-muted-foreground"
      />
    );
  }

  // A ref segment only renders as a live reference if its nodeId actually
  // matches one of this session's needs — a summary with no refs, or refs
  // pointing at nothing, degrades to plain text rather than a dead link.
  const validIds = new Set(needs.map((n) => n.node.id));

  return (
    <p className="text-sm text-foreground" data-testid="understood-summary">
      {segments.map((seg, i) => {
        if (seg.type === "text" || !validIds.has(seg.nodeId)) {
          return <span key={i}>{seg.content}</span>;
        }
        return (
          <button
            key={i}
            type="button"
            onMouseEnter={() => onEnter(seg.nodeId)}
            onMouseLeave={onLeave}
            onFocus={() => onEnter(seg.nodeId)}
            onBlur={onLeave}
            onClick={() => onToggle(seg.nodeId)}
            className={cn(
              "rounded-[2px] font-medium underline decoration-1 decoration-primary/40 underline-offset-[3px] transition-colors",
              "hover:bg-primary/12 hover:decoration-primary",
              "focus-visible:bg-primary/12 focus-visible:decoration-primary focus-visible:outline-2 focus-visible:outline-primary",
              "active:bg-primary/20 active:transition-none",
              highlightedId === seg.nodeId && "bg-primary/12 decoration-primary"
            )}
          >
            {seg.content}
          </button>
        );
      })}
    </p>
  );
}
