"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deriveDashboardNeeds } from "@/lib/graph";
import { PrescriptionReport } from "./prescription-report";
import { ExitPoll } from "./exit-poll";
import type { CanvasGraph } from "@/lib/types";

export function DashboardScreen({
  graph,
  sessionId,
  onBackToCanvas,
  onReset,
}: {
  graph: CanvasGraph;
  /** The real session id — becomes the letterhead REF / footer control number. */
  sessionId?: string | null;
  /** Returns to the canvas without resetting — the graph is untouched by Finalize. */
  onBackToCanvas: () => void;
  onReset: () => void;
}) {
  // Report redesign / animation handoff: on mount (right after the loader's
  // exit, or a direct session-sidebar restore into this step) focus moves
  // into the report container — an intentional a11y handoff from the
  // loader's status region.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.focus();
  }, []);

  // Real, honest letterhead values — derived from the actual session/graph,
  // never fabricated (see docs/REPORT_PAPER_RESKIN.md, requirement 3).
  // DashboardScreen only mounts after a client-side step change (page.tsx is a
  // client component that starts on "chat"), so it never server-renders in the
  // real flow — computing the date at render is safe and hydration-neutral.
  const issued = new Date().toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const prescribedCount = deriveDashboardNeeds(graph.nodes).length;
  const ref = sessionId
    ? sessionId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase()
    : null;

  return (
    <div className="report-scope flex h-full flex-col bg-background">
      {/* Screen chrome — sits above the sheet, hidden in print/export. */}
      <header className="report-print-hide report-reveal-in flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- static local SVG, no optimization needed */}
        <img src="/logo.svg" alt="Remedy" className="h-7 w-auto" />
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

      {/* This screen's own scroll region — the report body can run much taller
          than the viewport, but only THIS area scrolls. tabIndex=-1 + the focus
          effect make it the loader's a11y handoff target. */}
      <div ref={scrollRef} tabIndex={-1} className="flex-1 overflow-y-auto outline-none">
        <div className="mx-auto max-w-[1240px] px-4 py-7 pb-16 sm:px-8">
          {/* The Cotton Bond sheet the whole report sits on. */}
          <div className="report-sheet report-reveal-in">
            {/* Heading — a calm document title in place of the old clinical
                "Rx · Remedy Clinical Discovery · Verified Prescription" letterhead. */}
            <header className="report-letterhead flex flex-col gap-3.5 px-6 py-6 sm:px-8">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                <span className="font-bold text-primary">Remedy</span>
                <span>
                  {ref && (
                    <>
                      REF <span className="font-bold text-primary">#{ref}</span> ·{" "}
                    </>
                  )}
                  {issued}
                </span>
              </div>
              <h1 className="font-mono text-[26px] font-bold tracking-[-0.01em] text-foreground">
                Your Prescription
              </h1>
              <p className="max-w-[60ch] text-[length:var(--text-body)] text-muted-foreground">
                {`${prescribedCount} needs read from your session, and what we’d do about them — with the evidence behind each call.`}
              </p>
            </header>

            {/* Report body. */}
            <div className="px-4 py-5 sm:px-8 sm:py-7">
              <PrescriptionReport nodes={graph.nodes} />
            </div>

            {/* Verification stamp — an honest control number from the real REF. */}
            <footer className="flex items-center justify-between gap-4 border-t border-[color:var(--paper-hair)] px-6 py-3 sm:px-8">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                Control no. {ref ?? "—"}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-primary/50">
                Remedy Clinical Discovery
              </span>
            </footer>
          </div>

          {/* Exit poll — inline, at the very bottom, after the sheet. */}
          <div className="report-print-hide report-reveal-in mx-auto mt-6 max-w-[760px]">
            <ExitPoll />
          </div>
        </div>
      </div>
    </div>
  );
}
