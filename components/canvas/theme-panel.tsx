"use client";

import { useReactFlow, type Node } from "reactflow";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ThemeEntry } from "@/lib/graph";
import type { RxNodeData } from "./rx-node";

/**
 * Persistent top-left panel listing every liked/disliked theme, replacing the
 * old header badge strip. Rendered inside <ReactFlowProvider> (a sibling of
 * <ReactFlow>) so it can call useReactFlow to pan the camera to a theme's
 * source card. Clicking the theme jumps to it; clicking the thumb icon
 * removes that feedback (on every node the theme came from).
 */
export function ThemePanel({
  themes,
  nodes,
  onToggleFeedback,
}: {
  themes: ThemeEntry[];
  nodes: Node<RxNodeData>[];
  onToggleFeedback: (nodeIds: string[], type: "like" | "dislike") => void;
}) {
  const { setCenter } = useReactFlow();

  if (themes.length === 0) return null;

  function handleJump(nodeIds: string[]) {
    const target = nodes.find((n) => nodeIds.includes(n.id));
    if (!target) return;
    const width = target.width ?? 320;
    const height = target.height ?? 160;
    setCenter(target.position.x + width / 2, target.position.y + height / 2, {
      zoom: 1,
      duration: 500,
    });
  }

  return (
    <div className="fixed left-4 top-16 z-40 w-64 space-y-1.5 rounded-lg border border-border bg-card p-3 shadow-lg">
      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        Themes that influenced this
      </p>
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {themes.map((t) => (
          <div
            key={`${t.type}-${t.theme}`}
            className={cn(
              "flex items-center justify-between gap-2 rounded-md border px-2 py-1",
              t.type === "like"
                ? "border-primary/30 bg-primary/5"
                : "border-destructive/30 bg-destructive/5"
            )}
          >
            <button
              type="button"
              onClick={() => handleJump(t.nodeIds)}
              title="Jump to card"
              className="min-w-0 flex-1 truncate text-left text-[11px] font-medium text-foreground hover:underline"
            >
              {t.theme}
            </button>
            <button
              type="button"
              onClick={() => onToggleFeedback(t.nodeIds, t.type)}
              title={t.type === "like" ? "Remove like" : "Remove dislike"}
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center",
                t.type === "like" ? "text-primary" : "text-destructive"
              )}
            >
              {t.type === "like" ? (
                <ThumbsUp className="h-3 w-3" />
              ) : (
                <ThumbsDown className="h-3 w-3" />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
