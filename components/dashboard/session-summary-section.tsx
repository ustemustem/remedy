"use client";

import { useMemo } from "react";
import { deriveSessionStats, type ThemeEntry } from "@/lib/graph";
import { buildSessionReadout } from "@/lib/mockAI";
import type { CanvasNodeData } from "@/lib/types";
import { SessionStrip } from "./session-strip";
import { ThemeColumns } from "./theme-columns";

export function SessionSummarySection({
  nodes,
  themes,
}: {
  nodes: CanvasNodeData[];
  themes: ThemeEntry[];
}) {
  const stats = useMemo(() => deriveSessionStats(nodes), [nodes]);
  const readout = useMemo(() => buildSessionReadout(stats, themes), [stats, themes]);

  return (
    <div className="space-y-4">
      <SessionStrip stats={stats} />
      <p className="text-sm leading-[1.55] text-foreground">
        {readout.map((seg, i) => (
          <span key={i} className={seg.emphasis ? "font-medium" : undefined}>
            {seg.content}
          </span>
        ))}
      </p>
      <ThemeColumns themes={themes} />
    </div>
  );
}
