"use client";

import { useEffect, useMemo, useState } from "react";
import { deriveSessionStats, type ThemeEntry } from "@/lib/graph";
import { getSessionReadout } from "@/lib/mockAI";
import type { CanvasNodeData, ReadoutSegment } from "@/lib/types";
import AITextLoading from "@/components/kokonutui/ai-text-loading";
import { SessionStrip } from "./session-strip";
import { ThemeColumns } from "./theme-columns";

const READOUT_LOADING_STAGES = ["Reading your session…", "Summarizing…"];

export function SessionSummarySection({
  nodes,
  themes,
  variant = "row",
}: {
  nodes: CanvasNodeData[];
  themes: ThemeEntry[];
  /** "rail" is the narrow session rail in report layout A; "row" is the
   *  full-width card the report falls back to on narrow viewports. */
  variant?: "row" | "rail";
}) {
  const stats = useMemo(() => deriveSessionStats(nodes), [nodes]);
  const [readout, setReadout] = useState<ReadoutSegment[] | null>(null);

  // Reset to the loading state during render when the session changes (both
  // `stats` and `themes` derive from `nodes`), rather than calling setState
  // inside the effect — mirrors UnderstoodSummary's tracked-prop pattern.
  const [trackedNodes, setTrackedNodes] = useState(nodes);
  if (nodes !== trackedNodes) {
    setTrackedNodes(nodes);
    setReadout(null);
  }

  useEffect(() => {
    let cancelled = false;
    getSessionReadout(stats, themes).then((result) => {
      if (!cancelled) setReadout(result);
    });
    return () => {
      cancelled = true;
    };
  }, [stats, themes]);

  return (
    <div className="space-y-4">
      <SessionStrip stats={stats} variant={variant} />
      {readout === null ? (
        <AITextLoading
          texts={READOUT_LOADING_STAGES}
          interval={700}
          className="text-sm text-muted-foreground"
        />
      ) : (
        <p className="text-sm leading-[1.55] text-foreground">
          {readout.map((seg, i) => (
            <span key={i} className={seg.emphasis ? "font-medium" : undefined}>
              {seg.content}
            </span>
          ))}
        </p>
      )}
      <ThemeColumns themes={themes} variant={variant} />
    </div>
  );
}
