"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChatEntryScreen } from "@/components/chat-entry-screen";
import { CanvasScreen } from "@/components/canvas/canvas-screen";
import { DashboardScreen } from "@/components/dashboard/dashboard-screen";
import { ReportLoader } from "@/components/dashboard/report-loader";
import { SessionSidebar } from "@/components/session-sidebar";
import { ExperimentOverlay } from "@/components/experiment-overlay";
import {
  SURFACE_FIELD_DEFAULTS,
  type SurfaceFieldSettings,
} from "@/components/canvas/surface-field-background";
import type { SourceStyle } from "@/components/canvas/source-style-context";
import { getInitialCanvas } from "@/lib/mockAI";
import {
  addReport,
  createSession,
  loadSessions,
  renameSession,
  setPinned,
  updateReport,
  updateSession,
  type SessionRecord,
} from "@/lib/sessions";
import {
  carryTasks,
  getIssue,
  getIssues,
  isOutdated,
  issueGraph,
  issueOf,
  issueStates,
  latestReport,
  newReportId,
  type SavedReport,
} from "@/lib/reports";
import { deriveDashboardNeeds } from "@/lib/graph";
import { buildMockTasks } from "@/lib/tasks-mock";
import { loadingCycleMs, withMinDuration } from "@/lib/timing";
import type { CanvasGraph, ReportData, Step } from "@/lib/types";

const EMPTY_GRAPH: CanvasGraph = { nodes: [], edges: [] };

export default function Home() {
  const [step, setStep] = useState<Step>("chat");
  const [graph, setGraph] = useState<CanvasGraph>(EMPTY_GRAPH);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The canvas -> report loading transition (ReportLoader) is a transient UI
  // state, deliberately NOT part of `Step` — `Step` is also what
  // SessionRecord.step persists to localStorage, and a session should never
  // be saved mid-transition. `step` stays "canvas" until the loader's
  // onReady fires, at which point it flips straight to "dashboard".
  const [transitioning, setTransitioning] = useState(false);
  // Reports are saved with the session (lib/reports.ts). The loader runs only
  // to build a new version; opening a saved one reads it from storage.
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  // Sessions live in localStorage — only readable after mount.
  useEffect(() => {
    const timer = setTimeout(() => setSessions(loadSessions()), 0);
    return () => clearTimeout(timer);
  }, []);

  // Radius/smoothing/source-identity were the live-tunable experiments —
  // now locked in (see experiment-overlay.tsx, which dropped their sliders
  // and the Source identity switcher accordingly): Control 6px, Card 12px,
  // Surface 8px, Source identity "rail" (see
  // source-style-context.tsx). No longer state — these never change at
  // runtime, so plain constants replace what used to be tunable useState.
  const CONTROL_RADIUS = 6;
  const CARD_RADIUS = 12;
  const SURFACE_RADIUS = 8;
  const sourceStyle: SourceStyle = "rail";

  // The Experiments panel is a dev-only tuning tool. It is back on to tune the
  // shared paper background (canvas + report). Flip to false to shelve it again.
  const SHOW_EXPERIMENTS = true;

  // Live experiments — mounted once here (not per-screen) so the same panel
  // and the same tuned values are reachable from chat, canvas, and dashboard
  // alike. Card padding / micro type scale / link weight are design-critique
  // follow-ups that apply to both canvas and dashboard cards through shared
  // CSS custom properties.
  const [cardPadding, setCardPadding] = useState(16);
  const [textMeta, setTextMeta] = useState(11);
  const [textLabel, setTextLabel] = useState(12);
  // Report Section 1's user-quote size — must stay above --text-label so a
  // person's own sentence never reads smaller than the meta note about it.
  const [textQuote, setTextQuote] = useState(13);
  const [linkWeight, setLinkWeight] = useState<"subtle" | "bold">("subtle");
  // The A/B/C choice cards inside a suggestion card's OptionPicker — kept
  // independently tunable from --radius-card (see globals.css) since it's a
  // nested control, not the outer card.
  const [optionRadius, setOptionRadius] = useState(8);
  // A card's own origin-strip/note-panel corners (rx-node.tsx), tunable
  // apart from the card's outer corner (--radius-card). Cards dropped the
  // squircle for a plain radius on 2026-10-01, so the two can now simply
  // match. See --radius-header in globals.css.
  const [headerRadius, setHeaderRadius] = useState(12);
  // Canvas background experiment: React Flow's plain dot grid vs Surface Field,
  // which bends around the cards (components/canvas/surface-field-background.tsx).
  const [canvasBackground, setCanvasBackground] = useState<"dots" | "field">("field");
  const [surfaceField, setSurfaceField] = useState<SurfaceFieldSettings>(SURFACE_FIELD_DEFAULTS);
  useEffect(() => {
    document.documentElement.style.setProperty("--radius-control", `${CONTROL_RADIUS}px`);
    document.documentElement.style.setProperty("--radius-card", `${CARD_RADIUS}px`);
    document.documentElement.style.setProperty("--radius-surface", `${SURFACE_RADIUS}px`);
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty("--radius-option", `${optionRadius}px`);
  }, [optionRadius]);
  useEffect(() => {
    document.documentElement.style.setProperty("--radius-header", `${headerRadius}px`);
  }, [headerRadius]);
  useEffect(() => {
    document.documentElement.style.setProperty("--card-px", `${cardPadding}px`);
  }, [cardPadding]);
  useEffect(() => {
    document.documentElement.style.setProperty("--text-meta", `${textMeta}px`);
  }, [textMeta]);
  useEffect(() => {
    document.documentElement.style.setProperty("--text-label", `${textLabel}px`);
  }, [textLabel]);
  useEffect(() => {
    document.documentElement.style.setProperty("--text-quote", `${textQuote}px`);
  }, [textQuote]);
  useEffect(() => {
    document.documentElement.dataset.linkWeight = linkWeight;
  }, [linkWeight]);

  const session = sessions.find((s) => s.id === sessionId) ?? null;
  const reports = useMemo(() => session?.reports ?? [], [session]);
  // Every issue on the canvas with its latest report and state, for the
  // canvas header's View report button and its issue menu.
  const issueReports = useMemo(() => issueStates(reports, graph), [reports, graph]);
  // The issue a new version is being built for (set at the end card).
  const [buildIssueId, setBuildIssueId] = useState<string | null>(null);
  const activeReport = reports.find((r) => r.id === activeReportId) ?? null;

  /** Puts a freshly saved record at the top of the sidebar list. */
  function applySession(updated: SessionRecord | null) {
    if (updated) setSessions((prev) => [updated, ...prev.filter((s) => s.id !== updated.id)]);
  }

  async function handleChatSubmit(text: string) {
    setLoading(true);
    setError(null);
    try {
      // getInitialCanvas's own mock delay is 500-1500ms at random — short
      // enough that on a fast roll the button could jump straight from
      // "Reading…" to the canvas before ever reaching "Preparing canvas…",
      // the LAST of chat-entry-screen.tsx's three LOADING_STAGES (cycled
      // every 700ms). withMinDuration floors the wait to one full cycle
      // (see lib/timing.ts) so every stage always gets seen once before
      // navigating, regardless of how fast the mock call itself resolves.
      const initial = await withMinDuration(getInitialCanvas(text), loadingCycleMs(3, 700));
      const record = createSession(text, initial, "canvas");
      setSessions((prev) => [record, ...prev]);
      setSessionId(record.id);
      setGraph(initial);
      setStep("canvas");
    } catch {
      setError("Something went wrong generating your canvas. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Autosaves on every canvas edit, not just at Finalize — so resuming a
  // session from the sidebar always picks up where the user left off.
  const handleGraphChange = useCallback(
    (nextGraph: CanvasGraph) => {
      setGraph(nextGraph);
      if (!sessionId) return;
      const updated = updateSession(sessionId, nextGraph, "canvas");
      if (updated) {
        setSessions((prev) => [updated, ...prev.filter((s) => s.id !== updated.id)]);
      }
    },
    [sessionId]
  );

  function openReport(report: SavedReport) {
    setActiveReportId(report.id);
    setStep("dashboard");
    if (sessionId) applySession(updateSession(sessionId, graph, "dashboard"));
  }

  // "View report" on the card at the end of a path. Opens the saved report
  // when the canvas hasn't changed since; otherwise builds a new version.
  function handleFinalize(finalGraph: CanvasGraph, fromNodeId?: string) {
    setGraph(finalGraph);
    // The end card's own issue; the first issue when the caller doesn't say.
    const issueId = (fromNodeId && issueOf(fromNodeId, finalGraph.nodes)) || getIssue(finalGraph)?.id || null;
    setBuildIssueId(issueId);
    const last = issueId ? latestReport(reports, issueId) : null;
    if (last && !isOutdated(last, finalGraph)) {
      openReport(last);
      return;
    }
    setTransitioning(true);
  }

  function handleReportReady(data: ReportData) {
    const builtIssue = getIssues(graph).find((i) => i.id === buildIssueId) ?? getIssue(graph);
    if (!builtIssue) return;
    // A report reads and keeps only its own issue's tree.
    const builtGraph = issueGraph(graph, builtIssue.id);
    const previous = latestReport(reports, builtIssue.id);
    const freshTasks = buildMockTasks(deriveDashboardNeeds(builtGraph.nodes));
    const report: SavedReport = {
      id: newReportId(),
      issueId: builtIssue.id,
      issueTitle: builtIssue.title,
      version: (previous?.version ?? 0) + 1,
      data,
      graph: builtGraph,
      tasks: previous ? carryTasks(previous.tasks, freshTasks) : freshTasks,
      createdAt: Date.now(),
    };
    if (sessionId) {
      addReport(sessionId, report);
      applySession(updateSession(sessionId, graph, "dashboard"));
    }
    // Storage can fail (quota, private mode); the report still opens this visit.
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId && !s.reports?.some((r) => r.id === report.id)
          ? { ...s, reports: [...(s.reports ?? []), report] }
          : s
      )
    );
    setActiveReportId(report.id);
    setTransitioning(false);
    setStep("dashboard");
  }

  function handleReportChange(reportId: string, patch: Partial<Pick<SavedReport, "tasks" | "data">>) {
    if (sessionId) updateReport(sessionId, reportId, patch);
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, reports: (s.reports ?? []).map((r) => (r.id === reportId ? { ...r, ...patch } : r)) }
          : s
      )
    );
  }

  function handleBackToCanvas() {
    setStep("canvas");
  }

  function handlePin(id: string, pinned: boolean) {
    const updated = setPinned(id, pinned);
    if (updated) setSessions((prev) => prev.map((s) => (s.id === id ? updated : s)));
  }

  function handleRename(id: string, title: string) {
    const updated = renameSession(id, title);
    if (updated) setSessions((prev) => prev.map((s) => (s.id === id ? updated : s)));
  }

  function handleReset() {
    setGraph(EMPTY_GRAPH);
    setSessionId(null);
    setError(null);
    setActiveReportId(null);
    setTransitioning(false);
    setStep("chat");
  }

  function handleSelectSession(session: SessionRecord) {
    setSessionId(session.id);
    setGraph(session.graph);
    setError(null);
    const saved = [...(session.reports ?? [])].sort((a, b) => b.createdAt - a.createdAt)[0];
    setActiveReportId(saved?.id ?? null);
    if (session.step === "dashboard" && !saved) {
      // Saved before reports were stored: build its first version once.
      setStep("canvas");
      setTransitioning(true);
      return;
    }
    setTransitioning(false);
    setStep(session.step);
  }

  // A dashboard step with no saved report to show (e.g. storage was cleared)
  // falls back to the canvas, where the end card can build one.
  const content = transitioning ? (
      <ReportLoader
        graph={issueGraph(graph, buildIssueId ?? getIssue(graph)?.id ?? "")}
        onReady={handleReportReady}
      />
    ) : step === "dashboard" && activeReport ? (
      <DashboardScreen
        key={activeReport.id}
        report={activeReport}
        reports={reports}
        issueOrder={getIssues(graph).map((i) => i.id)}
        outdated={isOutdated(latestReport(reports, activeReport.issueId) ?? activeReport, graph)}
        sessionId={sessionId}
        onSelectReport={(id) => setActiveReportId(id)}
        onTasksChange={(tasks) => handleReportChange(activeReport.id, { tasks })}
        onEvidence={(evidence) =>
          handleReportChange(activeReport.id, { data: { ...activeReport.data, evidence } })
        }
        onBackToCanvas={handleBackToCanvas}
        onReset={handleReset}
      />
    ) : step !== "chat" ? (
      <CanvasScreen
        key={sessionId ?? "new"}
        initialGraph={graph}
        onGraphChange={handleGraphChange}
        onFinalize={handleFinalize}
        issueReports={issueReports}
        onOpenReport={(issueId) => {
          const last = latestReport(reports, issueId);
          if (last) openReport(last);
        }}
        onReset={handleReset}
        sourceStyle={sourceStyle}
        background={canvasBackground}
        fieldSettings={surfaceField}
      />
    ) : (
      <>
        <ChatEntryScreen onSubmit={handleChatSubmit} loading={loading} fieldSettings={surfaceField} />
        {error && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 border border-destructive bg-card px-4 py-2 text-sm text-destructive shadow-none">
            {error}
          </div>
        )}
      </>
    );

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="report-print-hide contents">
        <SessionSidebar
          sessions={sessions}
          activeId={sessionId}
          onSelect={handleSelectSession}
          onNewSession={handleReset}
          onRename={handleRename}
          onPin={handlePin}
        />
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">{content}</div>
      {SHOW_EXPERIMENTS && (
        <ExperimentOverlay
          optionRadius={optionRadius}
          onOptionRadiusChange={setOptionRadius}
          headerRadius={headerRadius}
          onHeaderRadiusChange={setHeaderRadius}
          cardPadding={cardPadding}
          onCardPaddingChange={setCardPadding}
          textMeta={textMeta}
          onTextMetaChange={setTextMeta}
          textLabel={textLabel}
          onTextLabelChange={setTextLabel}
          textQuote={textQuote}
          onTextQuoteChange={setTextQuote}
          linkWeight={linkWeight}
          onLinkWeightChange={setLinkWeight}
          canvasBackground={canvasBackground}
          onCanvasBackgroundChange={setCanvasBackground}
          surfaceField={surfaceField}
          onSurfaceFieldChange={setSurfaceField}
        />
      )}
    </div>
  );
}
