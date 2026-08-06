// components/dashboard/themes-popover.tsx
"use client";

import { Tag } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ThemeEntry } from "@/lib/graph";
import { cn } from "@/lib/utils";

export function ThemesPopover({ themes }: { themes: ThemeEntry[] }) {
  if (themes.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex flex-shrink-0 items-center gap-1.5 self-center rounded-full border border-border px-3 py-1.5 text-[length:var(--text-label)] font-medium text-muted-foreground hover:border-foreground/30 hover:text-foreground"
        >
          <Tag className="h-3.5 w-3.5" />
          Themes
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto">
        <p className="mb-2 font-mono text-[length:var(--text-label)] font-bold uppercase tracking-wide text-muted-foreground">
          Themes that shaped this
        </p>
        <div className="flex flex-wrap gap-2">
          {themes.map((t) => (
            <span
              key={`${t.type}-${t.theme}`}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[length:var(--text-label)] font-medium",
                t.type === "like"
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-destructive/30 bg-destructive/5 text-destructive"
              )}
            >
              {t.type === "like" ? "+" : "−"} {t.theme}
            </span>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
