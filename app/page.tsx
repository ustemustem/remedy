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

  // Live experiments — mounted once here (not per-screen) so the same panel
  // and the same tuned values are reachable from chat, canvas, and dashboard
  // alike. Corner radius + smoothing drive the canvas's Apple-style squircle
  // cards (softness-context.tsx / rx-node.tsx) and, via --radius, the app's
  // whole rounded-corner scale. Card padding / micro type scale / link
  // weight are design-critique follow-ups that apply to both canvas and
  // dashboard cards through shared CSS custom properties (app/globals.css).
  const [cornerRadius, setCornerRadius] = useState(4);
  const [smoothing, setSmoothing] = useState(0.6);
  const [cardPadding, setCardPadding] = useState(16);
  const [textMeta, setTextMeta] = useState(10);
  const [textLabel, setTextLabel] = useState(11);
  const [linkWeight, setLinkWeight] = useState<"subtle" | "bold">("subtle");
  const [sourceStyle, setSourceStyle] = useState<SourceStyle>("default");
  useEffect(() => {
    document.documentElement.style.setProperty("--radius", `${cornerRadius}px`);
  }, [cornerRadius]);
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
  const softness = useMemo(() => ({ radius: cornerRadius, smoothing }), [cornerRadius, smoothing]);

  async function handleChatSubmit(text: string) {
    setLoading(true);
    setError(null);
    try {
      const initial = await getInitialCanvas(text);
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
        cornerRadius={cornerRadius}
        onCornerRadiusChange={setCornerRadius}
        smoothing={smoothing}
        onSmoothingChange={setSmoothing}
        cardPadding={cardPadding}
        onCardPaddingChange={setCardPadding}
        textMeta={textMeta}
        onTextMetaChange={setTextMeta}
        textLabel={textLabel}
        onTextLabelChange={setTextLabel}
        linkWeight={linkWeight}
        onLinkWeightChange={setLinkWeight}
        sourceStyle={sourceStyle}
        onSourceStyleChange={setSourceStyle}
      />
    </div>
  );
}
