"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChatEntryScreen } from "@/components/chat-entry-screen";
import { CanvasScreen } from "@/components/canvas/canvas-screen";
import { DashboardScreen } from "@/components/dashboard/dashboard-screen";
import { SessionSidebar } from "@/components/session-sidebar";
import { ExperimentOverlay } from "@/components/experiment-overlay";
import type { SourceStyle } from "@/components/canvas/source-style-context";
import { getInitialCanvas } from "@/lib/mockAI";
import { createSession, loadSessions, updateSession, type SessionRecord } from "@/lib/sessions";
import { loadingCycleMs, withMinDuration } from "@/lib/timing";
import type { CanvasGraph, Step } from "@/lib/types";

const EMPTY_GRAPH: CanvasGraph = { nodes: [], edges: [] };

export default function Home() {
  const [step, setStep] = useState<Step>("chat");
  const [graph, setGraph] = useState<CanvasGraph>(EMPTY_GRAPH);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sessions live in localStorage — only readable after mount.
  useEffect(() => {
    const timer = setTimeout(() => setSessions(loadSessions()), 0);
    return () => clearTimeout(timer);
  }, []);

  // Radius/smoothing/source-identity were the live-tunable experiments —
  // now locked in (see experiment-overlay.tsx, which dropped their sliders
  // and the Source identity switcher accordingly): Control 6px, Card 12px,
  // Surface 8px, Smoothing 80%, Source identity "rail" (see
  // source-style-context.tsx). No longer state — these never change at
  // runtime, so plain constants replace what used to be tunable useState.
  const CONTROL_RADIUS = 6;
  const CARD_RADIUS = 12;
  const SURFACE_RADIUS = 8;
  const SMOOTHING = 0.8;
  const sourceStyle: SourceStyle = "rail";

  // Live experiments — mounted once here (not per-screen) so the same panel
  // and the same tuned values are reachable from chat, canvas, and dashboard
  // alike. Card padding / micro type scale / link weight are design-critique
  // follow-ups that apply to both canvas and dashboard cards through shared
  // CSS custom properties.
  const [cardPadding, setCardPadding] = useState(16);
  const [textMeta, setTextMeta] = useState(10);
  const [textLabel, setTextLabel] = useState(11);
  const [linkWeight, setLinkWeight] = useState<"subtle" | "bold">("subtle");
  // The A/B/C choice cards inside a suggestion card's OptionPicker — kept
  // independently tunable from --radius-card (see globals.css) since it's a
  // nested control, not the outer card.
  const [optionRadius, setOptionRadius] = useState(8);
  useEffect(() => {
    document.documentElement.style.setProperty("--radius-control", `${CONTROL_RADIUS}px`);
    document.documentElement.style.setProperty("--radius-card", `${CARD_RADIUS}px`);
    document.documentElement.style.setProperty("--radius-surface", `${SURFACE_RADIUS}px`);
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty("--radius-option", `${optionRadius}px`);
  }, [optionRadius]);
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
    document.documentElement.dataset.linkWeight = linkWeight;
  }, [linkWeight]);
  const softness = useMemo(() => ({ radius: CARD_RADIUS, smoothing: SMOOTHING }), []);

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

  function handleFinalize(finalGraph: CanvasGraph) {
    setGraph(finalGraph);
    setStep("dashboard");
    if (!sessionId) return;
    const updated = updateSession(sessionId, finalGraph, "dashboard");
    if (updated) {
      setSessions((prev) => [updated, ...prev.filter((s) => s.id !== updated.id)]);
    }
  }

  function handleBackToCanvas() {
    setStep("canvas");
  }

  function handleReset() {
    setGraph(EMPTY_GRAPH);
    setSessionId(null);
    setError(null);
    setStep("chat");
  }

  function handleSelectSession(session: SessionRecord) {
    setSessionId(session.id);
    setGraph(session.graph);
    setStep(session.step === "chat" ? "chat" : session.step);
    setError(null);
  }

  const content =
    step === "canvas" ? (
      <CanvasScreen
        key={sessionId ?? "new"}
        initialGraph={graph}
        onGraphChange={handleGraphChange}
        onFinalize={handleFinalize}
        onReset={handleReset}
        softness={softness}
        sourceStyle={sourceStyle}
      />
    ) : step === "dashboard" ? (
      <DashboardScreen graph={graph} onBackToCanvas={handleBackToCanvas} onReset={handleReset} />
    ) : (
      <>
        <ChatEntryScreen onSubmit={handleChatSubmit} loading={loading} />
        {error && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 border border-destructive bg-card px-4 py-2 text-sm text-destructive shadow-none">
            {error}
          </div>
        )}
      </>
    );

  return (
    <div className="flex h-screen">
      <SessionSidebar
        sessions={sessions}
        activeId={sessionId}
        onSelect={handleSelectSession}
        onNewSession={handleReset}
      />
      <div className="min-w-0 flex-1">{content}</div>
      <ExperimentOverlay
        optionRadius={optionRadius}
        onOptionRadiusChange={setOptionRadius}
        cardPadding={cardPadding}
        onCardPaddingChange={setCardPadding}
        textMeta={textMeta}
        onTextMetaChange={setTextMeta}
        textLabel={textLabel}
        onTextLabelChange={setTextLabel}
        linkWeight={linkWeight}
        onLinkWeightChange={setLinkWeight}
      />
    </div>
  );
}
