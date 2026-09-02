"use client";

import type { SessionStats } from "@/lib/types";
import { cn } from "@/lib/utils";

const STAGGER_MS = 35;

interface Segment {
  label: string;
  value: number;
  tone?: "primary" | "cta";
}

/**
 * "How we read your situation" summary strip — flex-1 per segment always,
 * however few segments there are (a quiet 2-segment session stretching to
 * ~430px per number is an accepted tradeoff for keeping one layout mode).
 * Zero-value metrics don't get a segment at all, so the strip shrinks with
 * the session instead of padding out with empty counts.
 */
export function SessionStrip({ stats }: { stats: SessionStats }) {
  const allSegments: Segment[] = [
    { label: "Liked", value: stats.likeCount, tone: "primary" },
    { label: "Pushed back on", value: stats.dislikeCount, tone: "cta" },
    { label: "Paths explored", value: stats.pathCount },
    { label: "Selected", value: stats.selectedCount },
    { label: "Notes left", value: stats.noteCount },
  ];
  const segments = allSegments.filter((s) => s.value > 0);

  if (segments.length === 0) return null;

  return (
    <div className="flex w-full flex-wrap">
      {segments.map((s, i) => (
        <div
          key={s.label}
          className={cn(
            "strip-segment-in flex-1 basis-28",
            i > 0 && "pl-3.5 max-[560px]:pl-0",
            i < segments.length - 1 && "border-r border-border pr-3.5 max-[560px]:border-r-0 max-[560px]:pr-0"
          )}
          style={{ animationDelay: `${i * STAGGER_MS}ms` }}
        >
          <div
            className={cn(
              "font-mono text-[19px] font-bold leading-tight",
              s.tone === "primary" && "text-primary",
              s.tone === "cta" && "text-cta"
            )}
          >
            {s.value}
          </div>
          <div className="font-mono text-[length:var(--text-meta)] uppercase tracking-wide text-muted-foreground">
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}
