"use client";

import { useCallback, useEffect, useState } from "react";
import { ChatEntryScreen } from "@/components/chat-entry-screen";
import { CanvasScreen } from "@/components/canvas/canvas-screen";
import { DashboardScreen } from "@/components/dashboard/dashboard-screen";
import { SessionSidebar } from "@/components/session-sidebar";
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
      />
    ) : step === "dashboard" ? (
      <DashboardScreen graph={graph} onReset={handleReset} />
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
    </div>
  );
}
