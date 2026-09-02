"use client";

import { Info } from "lucide-react";

/**
 * CSS-only tooltip (no JS state) — opens on :hover, :focus-within, and tap
 * (a real <button> picks up :focus on touch). See .info-tooltip in
 * app/globals.css.
 */
export function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="info-tooltip">
      <button
        type="button"
        aria-label="More info"
        className="cursor-help text-muted-foreground motion-safe:transition-transform hover:text-foreground motion-safe:active:scale-[0.98]"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span
        role="tooltip"
        className="info-tooltip-bubble rounded-[4px] border border-border bg-popover px-2.5 py-1.5 text-[length:var(--text-label)] font-normal normal-case tracking-normal text-popover-foreground shadow-sm"
      >
        {text}
      </span>
    </span>
  );
}
