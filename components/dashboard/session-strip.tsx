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
 * "How we read your situation" summary strip — always renders all five
 * metrics, zero included. Previously zero-value metrics were dropped entirely
 * so the strip could shrink to fit a quiet session, but a fixed,
 * always-complete set reads more consistently than a strip whose shape changes
 * with the session (and a 0 is itself useful information: it tells the user a
 * signal genuinely wasn't there, not that it was omitted).
 *
 * Two layouts for the two places this renders (report layout A):
 * - `row` — spread across the full card width, for the stacked single-column
 *   layout the report falls back to under 1024px.
 * - `rail` — one metric per line, value left, label right, hairline between,
 *   for the 340px session rail. Five numbers stretched across a wide row read
 *   as a dashboard; the same five stacked in a narrow rail read as a summary,
 *   which is what they are.
 */
export function SessionStrip({
  stats,
  variant = "row",
}: {
  stats: SessionStats;
  variant?: "row" | "rail";
}) {
  const segments: Segment[] = [
    { label: "Liked", value: stats.likeCount, tone: "primary" },
    { label: "Pushed back on", value: stats.dislikeCount, tone: "cta" },
    { label: "Paths explored", value: stats.pathCount },
    { label: "Selected", value: stats.selectedCount },
    { label: "Notes left", value: stats.noteCount },
  ];

  if (variant === "rail") {
    return (
      <div className="flex w-full flex-col">
        {segments.map((s, i) => (
          <div
            key={s.label}
            className={cn(
              "strip-segment-in flex items-baseline justify-between gap-3 py-1.5",
              i < segments.length - 1 && "border-b border-border"
            )}
            style={{ animationDelay: `${i * STAGGER_MS}ms` }}
          >
            <span
              className={cn(
                "font-mono text-[17px] font-bold leading-none",
                s.tone === "primary" && "text-primary",
                s.tone === "cta" && "text-cta"
              )}
            >
              {s.value}
            </span>
            <span className="font-mono text-[length:var(--text-meta)] uppercase tracking-wide text-muted-foreground">
              {s.label}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-wrap justify-between">
      {segments.map((s, i) => (
        <div
          key={s.label}
          className={cn(
            "strip-segment-in shrink-0",
            i > 0 && "pl-3.5",
            i < segments.length - 1 && "border-r border-border pr-3.5"
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
