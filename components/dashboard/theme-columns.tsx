"use client";

import type { ThemeEntry } from "@/lib/graph";
import { cn } from "@/lib/utils";

function ThemeColumn({
  label,
  entries,
  tone,
  delayMs,
}: {
  label: string;
  entries: ThemeEntry[];
  tone: "primary" | "cta";
  delayMs: number;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="theme-column-in" style={{ animationDelay: `${delayMs}ms` }}>
      <p
        className={cn(
          "font-mono text-[length:var(--text-meta)] font-bold uppercase tracking-wide",
          tone === "primary" ? "text-primary" : "text-cta"
        )}
      >
        {label}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {entries.map((t) => (
          <span
            key={t.theme}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[length:var(--text-label)] font-medium",
              tone === "primary"
                ? "border-primary/35 bg-primary/7 text-primary"
                : "border-cta/35 bg-cta/7 text-cta"
            )}
          >
            {t.theme}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Report Section 2's accepted/pushed-back theme columns — single column
 *  under ~620px, side-by-side above it. No "nothing yet" placeholder: the
 *  whole block is absent when there are no themes at all.
 *
 *  `variant="rail"` forces the single-column stack regardless of viewport:
 *  the side-by-side breakpoint is a viewport media query, so inside the
 *  340px session rail it would otherwise try to split two columns across a
 *  track far too narrow for them. */
export function ThemeColumns({
  themes,
  variant = "row",
}: {
  themes: ThemeEntry[];
  variant?: "row" | "rail";
}) {
  const liked = themes.filter((t) => t.type === "like");
  const disliked = themes.filter((t) => t.type === "dislike");

  if (liked.length === 0 && disliked.length === 0) return null;

  return (
    <div
      className={cn(
        "mt-4 grid grid-cols-1 border-t border-border pt-3.5",
        variant === "rail" ? "gap-4" : "gap-6 min-[620px]:grid-cols-2"
      )}
    >
      <ThemeColumn label="Accepted" entries={liked} tone="primary" delayMs={170} />
      <ThemeColumn label="Pushed back on" entries={disliked} tone="cta" delayMs={215} />
    </div>
  );
}
