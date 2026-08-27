"use client";

import { useEffect, useMemo, useState } from "react";
import { deriveDashboardNeeds, deriveThemeEntries } from "@/lib/graph";
import type { CanvasNodeData } from "@/lib/types";
import { SessionSummarySection } from "./session-summary-section";
import { UnderstoodSummary } from "./understood-summary";
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
  // Memoized on `nodes` specifically: deriveDashboardNeeds/deriveThemeEntries
  // build fresh arrays every call, and PrescriptionReport re-renders on every
  // hover/focus during Section 1's ref<->row highlight below. Without this,
  // UnderstoodSummary's `needs !== trackedNeeds` reference check (its signal
  // to refetch) would see a "new" needs array on every hover and reset back
  // to its loading state — the bug this fixes.
  const needs = useMemo(() => deriveDashboardNeeds(nodes), [nodes]);
  const themes = useMemo(() => deriveThemeEntries(nodes), [nodes]);

  // Section 1's ref<->row two-way highlight, lifted here since UnderstoodSummary
  // and NeedSummaryList are siblings that both need to read and drive it.
  // Effective highlight = sticky (click-to-pin) if set, else whatever's hovered/focused.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [stickyId, setStickyId] = useState<string | null>(null);
  const highlightedId = stickyId ?? hoveredId;

  const handleEnter = (nodeId: string) => {
    if (!stickyId) setHoveredId(nodeId);
  };
  const handleLeave = () => {
    if (!stickyId) setHoveredId(null);
  };
  const handleToggle = (nodeId: string) => {
    setStickyId((current) => (current === nodeId ? null : nodeId));
    setHoveredId(null);
  };

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setStickyId(null);
        setHoveredId(null);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  if (needs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No recommendations were marked &ldquo;Select&rdquo; before finalizing.
      </p>
    );
  }

  return (
    <>
      <SectionHead index={1} title="What we understood" hint="drawn from your own words" />
      <div className="space-y-3">
        <UnderstoodSummary
          needs={needs}
          highlightedId={highlightedId}
          onEnter={handleEnter}
          onLeave={handleLeave}
          onToggle={handleToggle}
        />
        <NeedSummaryList
          needs={needs}
          highlightedId={highlightedId}
          onEnter={handleEnter}
          onLeave={handleLeave}
          onToggle={handleToggle}
        />
      </div>

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
