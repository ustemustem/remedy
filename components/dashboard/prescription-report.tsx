"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { deriveDashboardFeed, deriveDashboardNeeds, deriveThemeEntries } from "@/lib/graph";
import { getFitSignals, getGroundedEvidence } from "@/lib/mockAI";
import type { CanvasNodeData, FitSignal, EvidenceExample, ReportData } from "@/lib/types";
import AITextLoading from "@/components/kokonutui/ai-text-loading";
import { SessionSummarySection } from "./session-summary-section";
import { UnderstoodSummary } from "./understood-summary";
import { NeedSummaryList } from "./need-summary-list";
import { PrescriptionCard } from "./prescription-card";
import { PrescriptionCardCompact } from "./prescription-card-compact";
import { SeeMoreButton } from "./see-more-button";
import { ReportFooter } from "./report-footer";

/**
 * Report layout A: the numbered sections are the two that run down the
 * document column. The session panel in the rail is deliberately unnumbered —
 * it sits alongside the document rather than inside its sequence, and a
 * number there would claim an order the layout no longer has.
 */
function SectionHead({ index, title }: { index?: number; title: string }) {
  return (
    <div className="mb-4 flex items-baseline gap-3">
      {index != null && (
        <span className="font-mono text-xs font-bold text-primary">
          {String(index).padStart(2, "0")}
        </span>
      )}
      <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
    </div>
  );
}

/**
 * Report redesign change A1/A3: each section's title sits above its own
 * Card (not inside it) so every section shares one left edge, and the
 * inter-section rhythm is a tighter 22px (down from the old mt-10/40px).
 * Section 03 is the one exception — its content is already a stack of its
 * own individual cards (hero + support/hidden), so it renders its own
 * wrapper directly rather than nesting card-in-card here.
 */
function ReportSection({
  index,
  title,
  delayMs,
  children,
}: {
  index: number;
  title: string;
  delayMs: number;
  children: ReactNode;
}) {
  return (
    <div className="report-reveal-in mt-[22px] first:mt-0" style={{ animationDelay: `${delayMs}ms` }}>
      <SectionHead index={index} title={title} />
      <Card className="report-card-surface">
        <CardContent className="px-[var(--card-px)] py-4">{children}</CardContent>
      </Card>
    </div>
  );
}

export function PrescriptionReport({
  nodes,
  preloaded,
  onEvidence,
  railTop,
}: {
  nodes: CanvasNodeData[];
  preloaded?: ReportData | null;
  /** Called once when evidence arrives, so the caller can save it with the report. */
  onEvidence?: (evidence: EvidenceExample[][]) => void;
  /** Rendered first in the sticky rail, so it stays in view while the user
   *  reads (the Next steps card). */
  railTop?: ReactNode;
}) {
  // Memoized on `nodes` specifically: deriveDashboardNeeds/deriveThemeEntries
  // build fresh arrays every call, and PrescriptionReport re-renders on every
  // hover/focus during Section 1's ref<->row highlight below. Without this,
  // UnderstoodSummary's `needs !== trackedNeeds` reference check (its signal
  // to refetch) would see a "new" needs array on every hover and reset back
  // to its loading state — the bug this fixes.
  const needs = useMemo(() => deriveDashboardNeeds(nodes), [nodes]);
  const themes = useMemo(() => deriveThemeEntries(nodes), [nodes]);
  // The Source node's body is the user's original vent — passed to the summary
  // and fit seams so the model works from what they actually came in with.
  const vent = useMemo(() => nodes.find((n) => n.kind === "source")?.body ?? "", [nodes]);
  const [showHidden, setShowHidden] = useState(false);

  // Fit signal (Phase 3a): one batched call scores every need; the cards section
  // waits for it, then ranks by fit. On failure getFitSignals returns [] so fit
  // is omitted (no fabricated number) and the order falls back to stable.
  const [fits, setFits] = useState<FitSignal[] | null>(preloaded?.fits ?? null);
  const [trackedForFit, setTrackedForFit] = useState(needs);
  if (!preloaded && needs !== trackedForFit) {
    setTrackedForFit(needs);
    setFits(null);
  }
  useEffect(() => {
    if (preloaded) return; // fits came pre-loaded from generateReport (Phase 3d)
    let cancelled = false;
    getFitSignals(vent, needs).then((r) => {
      if (!cancelled) setFits(r);
    });
    return () => {
      cancelled = true;
    };
  }, [needs, vent, preloaded]);
  // Grounded evidence (Phase 3b): one call per need, in parallel with fit. Loads
  // per-card (non-gating) since web_search is slow; omitted on failure.
  // Saved evidence (a report opened before) is used as is, with no new search.
  const savedEvidence = preloaded?.evidence;
  const [evidence, setEvidence] = useState<EvidenceExample[][] | null>(savedEvidence ?? null);
  const [trackedForEvidence, setTrackedForEvidence] = useState(needs);
  if (!savedEvidence && needs !== trackedForEvidence) {
    setTrackedForEvidence(needs);
    setEvidence(null);
  }
  const onEvidenceRef = useRef(onEvidence);
  useEffect(() => {
    onEvidenceRef.current = onEvidence;
  }, [onEvidence]);
  useEffect(() => {
    if (savedEvidence) return;
    let cancelled = false;
    getGroundedEvidence(vent, needs).then((r) => {
      if (cancelled) return;
      setEvidence(r);
      // An all-empty result is also what a failed call returns, so it is not
      // saved: the next open tries again.
      if (r.some((list) => list.length > 0)) onEvidenceRef.current?.(r);
    });
    return () => {
      cancelled = true;
    };
  }, [needs, vent, savedEvidence]);

  const needsEnriched = useMemo(
    () => needs.map((n, i) => ({ ...n, fit: fits?.[i], evidence: evidence?.[i] })),
    [needs, fits, evidence]
  );
  const feed = useMemo(() => deriveDashboardFeed(needsEnriched), [needsEnriched]);

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
    /**
     * Report layout A: a document column plus a session rail. The reading
     * column stays at its old 780px measure — the rail is paid for out of the
     * margin that was previously dead space either side of the column, not out
     * of the prose. Under 1024px the rail drops back underneath the document,
     * which is also what @media print collapses it to (see globals.css), so an
     * exported PDF stays a single-column report.
     */
    <div className="report-grid grid gap-x-8 min-[1024px]:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        {/* Under 1024px the rail drops below the document, so the rail-top
            card would sit at the very bottom. Show it first instead. */}
        {railTop && (
          <div className="report-reveal-in mb-[22px] min-[1024px]:hidden" style={{ animationDelay: "40ms" }}>
            {railTop}
          </div>
        )}
        <ReportSection index={1} title="What we understood" delayMs={60}>
          <div className="space-y-3">
            <UnderstoodSummary
              needs={needs}
              vent={vent}
              preloaded={preloaded?.summary}
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
        </ReportSection>

        <div
          className="report-sep report-reveal-in mt-[22px]"
          style={{ animationDelay: "180ms" }}
          aria-hidden="true"
        >
          <span className="report-sep-line" />
          <span className="report-sep-mark" />
          <span className="report-sep-line" />
        </div>

        <div className="report-reveal-in mt-4" style={{ animationDelay: "220ms" }}>
          <SectionHead index={2} title="Your prescription" />
          <div className="space-y-3">
            {fits === null ? (
              <AITextLoading
                texts={["Scoring fit…", "Ranking recommendations…"]}
                interval={700}
                className="text-sm text-muted-foreground"
              />
            ) : (
              <>
                {feed.hero && <PrescriptionCard need={feed.hero} evidenceLoading={evidence === null} />}
                {feed.support.map((n) => (
                  <PrescriptionCardCompact key={n.node.id} need={n} evidenceLoading={evidence === null} />
                ))}
                {feed.hidden.length > 0 && (
                  <>
                    <div className="see-more-panel" data-open={showHidden}>
                      <div className="space-y-3">
                        {feed.hidden.map((n) => (
                          <PrescriptionCardCompact key={n.node.id} need={n} evidenceLoading={evidence === null} />
                        ))}
                      </div>
                    </div>
                    <SeeMoreButton
                      count={feed.hidden.length}
                      expanded={showHidden}
                      onToggle={() => setShowHidden((v) => !v)}
                    />
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <aside className="report-rail min-w-0 mt-[22px] min-[1024px]:mt-0">
        <div className="min-[1024px]:sticky min-[1024px]:top-[22px]">
          {railTop && (
            <div className="report-reveal-in mb-[22px] hidden min-[1024px]:block" style={{ animationDelay: "100ms" }}>
              {railTop}
            </div>
          )}
          <div className="report-reveal-in" style={{ animationDelay: "140ms" }}>
            <SectionHead title="How we read your situation" />
            <Card className="report-card-surface">
              <CardContent className="px-[var(--card-px)] py-4">
                <SessionSummarySection
                  nodes={nodes}
                  themes={themes}
                  preloaded={preloaded?.readout}
                  variant="rail"
                />
              </CardContent>
            </Card>
          </div>

          <div className="report-reveal-in" style={{ animationDelay: "300ms" }}>
            <ReportFooter />
          </div>
        </div>
      </aside>
    </div>
  );
}
