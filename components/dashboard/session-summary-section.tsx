"use client";

import { useEffect, useState } from "react";
import { deriveSessionStats } from "@/lib/graph";
import { getSessionSummary } from "@/lib/mockAI";
import type { CanvasNodeData, SessionSummary } from "@/lib/types";
import { KpiStatCard } from "./kpi-stat-card";
import { LineChart, Line } from "@/components/charts/line-chart";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import { YAxis } from "@/components/charts/y-axis";
import AITextLoading from "@/components/kokonutui/ai-text-loading";

const TONE_VALUE: Record<"positive" | "neutral" | "negative", number> = {
  positive: 1,
  neutral: 0,
  negative: -1,
};

const SUMMARY_LOADING_STAGES = ["Reading your session…", "Summarizing…"];

export function SessionSummarySection({ nodes }: { nodes: CanvasNodeData[] }) {
  const stats = deriveSessionStats(nodes);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [trackedNodes, setTrackedNodes] = useState(nodes);

  // Reset the summary during render (not inside the effect) when `nodes`
  // changes, so the sentence/chart show their loading state immediately
  // instead of briefly flashing the previous session's summary before the
  // effect below has a chance to run.
  if (nodes !== trackedNodes) {
    setTrackedNodes(nodes);
    setSummary(null);
  }

  useEffect(() => {
    let cancelled = false;
    getSessionSummary(nodes, stats).then((result) => {
      if (!cancelled) setSummary(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  const chartData = (summary?.timeline ?? []).map((point) => ({
    date: new Date(point.timestamp),
    tone: TONE_VALUE[point.tone],
    label: point.label,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <KpiStatCard label="Liked" value={stats.likeCount} />
        <KpiStatCard label="Disliked" value={stats.dislikeCount} />
        <KpiStatCard label="Selected" value={stats.selectedCount} />
        <KpiStatCard label="Paths explored" value={stats.pathCount} />
        <KpiStatCard label="Options picked" value={stats.optionPickCount} />
        <KpiStatCard label="Answered in own words" value={stats.ownFramingCount} />
        <KpiStatCard label="Notes added" value={stats.noteCount} />
      </div>

      {summary === null ? (
        <AITextLoading texts={SUMMARY_LOADING_STAGES} interval={700} className="text-sm text-muted-foreground" />
      ) : (
        <>
          <p className="text-sm text-foreground">{summary.sentence}</p>
          {chartData.length > 0 && (
            <LineChart data={chartData} xDataKey="date" aspectRatio="4 / 1">
              <Grid horizontal />
              <Line dataKey="tone" stroke="var(--color-chart-3)" />
              <ChartTooltip showCrosshair={false} />
              <XAxis />
              <YAxis />
            </LineChart>
          )}
        </>
      )}
    </div>
  );
}
