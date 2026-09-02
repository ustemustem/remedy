"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function SeeMoreButton({
  count,
  expanded,
  onToggle,
}: {
  count: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="mx-auto flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 font-mono text-[length:var(--text-label)] uppercase tracking-wide text-muted-foreground motion-safe:transition-transform hover:border-foreground/30 hover:text-foreground motion-safe:active:scale-[0.98]"
    >
      <ChevronDown
        className={cn("h-3.5 w-3.5 motion-safe:transition-transform", expanded && "rotate-180")}
      />
      {expanded ? "See less" : `See more · ${count}`}
    </button>
  );
}
