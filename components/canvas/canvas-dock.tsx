"use client";

import { Link2, Plus, Sparkles, type LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * The canvas dock: the thinking tools, floating at the bottom center.
 * New issue adds another quote to the session, Link connects two quotes so
 * one issue's report reads the other's, and Spark applies a lens to any card.
 *
 * SKELETON: the tools are placed but not wired yet. Each one says so on hover
 * instead of being disabled, so the tooltip still shows.
 */

const TOOLS: { label: string; hint: string; icon: LucideIcon }[] = [
  { label: "New issue", hint: "Add another problem to this session", icon: Plus },
  { label: "Link", hint: "Connect two issues so one builds on the other", icon: Link2 },
  { label: "Spark", hint: "Look at a card through a new lens", icon: Sparkles },
];

export function CanvasDock() {
  return (
    <div
      role="toolbar"
      aria-label="Canvas tools"
      className="absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-0.5 rounded-[var(--radius-surface)] border border-border bg-card p-1 shadow-sm"
    >
      {TOOLS.map(({ label, hint, icon: Icon }) => (
        <Tooltip key={label}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-disabled="true"
              className="flex items-center gap-1.5 rounded-[var(--radius-control)] px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {hint}
            <span className="block text-[10px] opacity-70">Coming next</span>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
