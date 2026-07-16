"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecommendationCard } from "./recommendation-card";
import { ExitPoll } from "./exit-poll";
import { getSupersededIds } from "@/lib/graph";
import type { CanvasGraph } from "@/lib/types";

export function DashboardScreen({
  graph,
  onReset,
}: {
  graph: CanvasGraph;
  onReset: () => void;
}) {
  // Only the current (non-superseded) version of a node counts — if the user
  // marked "Select" and then kept refining it with comments, the dashboard
  // should reflect the latest revision's data, not the version that was
  // selected first.
  const supersededIds = getSupersededIds(graph.nodes);
  const selectedNodes = graph.nodes.filter((n) => n.selected && !supersededIds.has(n.id));

  return (
    <main className="min-h-full bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="space-y-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- static local SVG, no optimization needed */}
          <img src="/logo.svg" alt="Remedy" className="h-7 w-auto" />
          <h1 className="font-mono text-lg font-bold text-foreground">
            Verified prescription
          </h1>
        </div>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5" />
          Reset session
        </Button>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {selectedNodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No recommendations were marked &ldquo;Select&rdquo; before finalizing.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {selectedNodes.map((node) => (
              <RecommendationCard key={node.id} node={node} />
            ))}
          </div>
        )}
      </div>

      <ExitPoll />
    </main>
  );
}
