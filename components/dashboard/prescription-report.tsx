"use client";

import { deriveDashboardNeeds, deriveThemeEntries } from "@/lib/graph";
import type { CanvasNodeData } from "@/lib/types";
import { SessionSummarySection } from "./session-summary-section";
import { NeedSummaryList } from "./need-summary-list";
import { PrescriptionCard } from "./prescription-card";

function SectionHead({ index, title, hint }: { index: number; title: string; hint?: string }) {
  return (
    <div className="mb-4 mt-10 flex items-baseline justify-between">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-xs font-bold text-primary">
          {String(index).padStart(2, "0")}
        </span>
        <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
      </div>
      {hint && <span className="text-[length:var(--text-label)] text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function PrescriptionReport({ nodes }: { nodes: CanvasNodeData[] }) {
  const needs = deriveDashboardNeeds(nodes);
  const themes = deriveThemeEntries(nodes);

  if (needs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No recommendations were marked &ldquo;Select&rdquo; before finalizing.
      </p>
    );
  }

  return (
    <>
      <SectionHead index={1} title="What we understood" hint="each item links back to the moment it came from" />
      <NeedSummaryList needs={needs} />

      <SectionHead index={2} title="How we read your situation" hint="from your own feedback on the canvas" />
      <SessionSummarySection nodes={nodes} themes={themes} />

      <SectionHead index={3} title="Your prescription" hint="ranked by match, per need" />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {needs.map((n) => (
          <PrescriptionCard key={n.node.id} need={n} />
        ))}
      </div>
    </>
  );
}
