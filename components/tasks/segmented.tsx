"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Two-or-more option switch with one sliding indicator (see `.seg` in
 * globals.css). Options share equal width, so the indicator moves by exactly
 * 100% of its own width per step. No measuring needed.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  return (
    <div role="tablist" aria-label={label} className={cn("seg", className)}>
      <span
        aria-hidden="true"
        className="seg-indicator"
        style={{
          width: `calc((100% - 4px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative z-10 flex h-7 items-center justify-center gap-1.5 whitespace-nowrap px-3 text-[0.8rem] font-medium transition-colors",
            o.value === value ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
