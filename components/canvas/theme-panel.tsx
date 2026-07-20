"use client";

import { useState } from "react";
import { useReactFlow, type Node } from "reactflow";
import { ThumbsUp, ThumbsDown, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ThemeEntry } from "@/lib/graph";
import type { RxNodeData } from "./rx-node";

const PAGE_SIZE = 3;

/**
 * Persistent top-center bar listing every liked/disliked theme, replacing
 * the old header badge strip and the earlier left-side panel. Rendered
 * inside <ReactFlowProvider> (a sibling of <ReactFlow>) so it can call
 * useReactFlow to pan the camera to a theme's source card. Shows at most
 * PAGE_SIZE themes at once with first/prev/next/last paging underneath —
 * clicking a theme jumps to it, clicking the thumb icon removes that
 * feedback (on every node the theme came from).
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
  const [page, setPage] = useState(0);

  if (themes.length === 0) return null;

  const totalPages = Math.max(1, Math.ceil(themes.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);
  const pageThemes = themes.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);
  const atStart = clampedPage === 0;
  const atEnd = clampedPage === totalPages - 1;

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
    <div className="fixed left-1/2 top-16 z-40 flex -translate-x-1/2 flex-col items-center gap-1.5">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
        <span className="font-mono text-[length:var(--text-meta)] uppercase tracking-wide text-muted-foreground">
          Themes:
        </span>
        {pageThemes.map((t) => (
          <div
            key={`${t.type}-${t.theme}`}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2 py-1",
              t.type === "like"
                ? "border-primary/30 bg-primary/5"
                : "border-destructive/30 bg-destructive/5"
            )}
          >
            <button
              type="button"
              onClick={() => handleJump(t.nodeIds)}
              title="Jump to card"
              className="max-w-40 truncate text-left text-[length:var(--text-label)] font-medium text-foreground hover:underline"
            >
              {t.theme}
            </button>
            <button
              type="button"
              onClick={() => onToggleFeedback(t.nodeIds, t.type)}
              title={t.type === "like" ? "Remove like" : "Remove dislike"}
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center",
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

      {totalPages > 1 && (
        <div className="flex items-center gap-0.5 rounded-full border border-border bg-card px-1 py-1 shadow-sm">
          <PageButton disabled={atStart} title="First page" onClick={() => setPage(0)}>
            <ChevronsLeft className="h-3.5 w-3.5" />
          </PageButton>
          <PageButton
            disabled={atStart}
            title="Previous page"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </PageButton>
          <PageButton
            disabled={atEnd}
            title="Next page"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </PageButton>
          <PageButton disabled={atEnd} title="Last page" onClick={() => setPage(totalPages - 1)}>
            <ChevronsRight className="h-3.5 w-3.5" />
          </PageButton>
        </div>
      )}
    </div>
  );
}

function PageButton({
  disabled,
  title,
  onClick,
  children,
}: {
  disabled: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
