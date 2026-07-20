"use client";

import { ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrescriptionReport } from "./prescription-report";
import { ExitPoll } from "./exit-poll";
import type { CanvasGraph } from "@/lib/types";

export function DashboardScreen({
  graph,
  onBackToCanvas,
  onReset,
}: {
  graph: CanvasGraph;
  /** Returns to the canvas without resetting — the graph is untouched by Finalize. */
  onBackToCanvas: () => void;
  onReset: () => void;
}) {
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
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBackToCanvas}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to canvas
          </Button>
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset session
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 pb-16">
        <PrescriptionReport nodes={graph.nodes} />
      </div>

      <ExitPoll />
    </main>
  );
}
