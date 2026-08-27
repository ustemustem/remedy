"use client";

import { useEffect, useRef, useState } from "react";
import { useReactFlow, type Node } from "reactflow";
import {
  ThumbsUp,
  ThumbsDown,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Filter,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ThemeEntry } from "@/lib/graph";
import type { RxNodeData } from "./rx-node";

const PAGE_SIZE = 3;

/**
 * Floating badge button (mirrors experiment-overlay.tsx's flask toggle —
 * same overlay chrome) replacing the old always-expanded top-center bar,
 * which ate vertical space across the whole canvas the moment a single
 * theme existed. Collapsed state is just a count; the full liked/disliked
 * list only appears in the overlay on click. Absolutely positioned (not
 * `fixed`) against canvas-screen.tsx's own `relative` canvas container —
 * Experiments can get away with `fixed` because nothing else lives on the
 * viewport's right edge, but the viewport's left edge is the session
 * sidebar, so a `fixed left-4` here would float on top of it instead of
 * staying inside the canvas.
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
  const [open, setOpen] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const prevCountRef = useRef(themes.length);

  useEffect(() => {
    if (themes.length > prevCountRef.current) {
      setJustAdded(true);
      const timeout = setTimeout(() => setJustAdded(false), 300);
      prevCountRef.current = themes.length;
      return () => clearTimeout(timeout);
    }
    prevCountRef.current = themes.length;
  }, [themes.length]);

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
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Your reactions"
        className="absolute left-4 top-3 z-40 flex items-center gap-1.5 rounded-[var(--radius-control)] border border-border bg-card px-2.5 py-1.5 text-muted-foreground shadow-sm hover:text-foreground"
      >
        <Filter className="h-3.5 w-3.5" />
        <span className="text-[length:var(--text-label)] font-medium">Your reactions</span>
        <span
          className={cn(
            "rounded-[var(--radius-control)] bg-primary px-1.5 py-0 text-[length:var(--text-meta)] font-medium text-primary-foreground transition-transform duration-200",
            justAdded && "scale-[1.15]"
          )}
        >
          {themes.length}
        </span>
      </button>
    );
  }

  return (
    <div className="absolute left-4 top-3 z-40 w-72 rounded-[var(--radius-surface)] border border-border bg-card shadow-lg">
      <div className="flex items-center justify-between border-b border-border p-3">
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          <Filter className="h-3 w-3" />
          Your reactions
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-2 p-3">
        <div className="flex flex-wrap gap-1.5">
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
          <div className="flex items-center justify-center gap-0.5 border-t border-border pt-2">
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
