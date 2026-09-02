"use client";

import { useEffect, useRef } from "react";
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
  // Report redesign / animation handoff: on mount (right after the loader's
  // exit, or a direct session-sidebar restore into this step) focus moves
  // into the report container — an intentional a11y handoff from the
  // loader's status region, not just "focus starts wherever the DOM puts it".
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.focus();
  }, []);

  return (
    <div className="report-scope flex h-full flex-col bg-background">
      <header className="report-print-hide report-reveal-in flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
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

      {/* This screen's own scroll region — the report body can run much
          taller than the viewport, but only THIS area should scroll; the
          header above stays put and the session sidebar (a sibling outside
          this component, in page.tsx) has its own independent scroll
          region. tabIndex=-1 + the focus effect above make this the
          loader's a11y handoff target without adding it to normal Tab
          order. */}
      <div ref={scrollRef} tabIndex={-1} className="flex-1 overflow-y-auto outline-none">
        <div className="mx-auto max-w-[780px] px-4 pb-16">
          <PrescriptionReport nodes={graph.nodes} />
        </div>

        <div className="report-print-hide">
          <ExitPoll />
        </div>
      </div>
    </div>
  );
}
