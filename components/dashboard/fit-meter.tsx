"use client";

import type { FitSignal } from "@/lib/types";
import { InfoTooltip } from "./info-tooltip";
import { cn } from "@/lib/utils";

const FIT_TOOLTIP =
  "How well this fits you, out of 100 — how much of what you told us you need it covers, combined with how confident we are. Our judgement from your session, not measured data.";

/** The composite fit number + label, for a card's left column. */
export function FitScore({ fit, size }: { fit: FitSignal; size: "hero" | "compact" }) {
  const tooltip =
    size === "compact"
      ? `${FIT_TOOLTIP}\n\nCovers your needs: ${fit.coverageNote}\nConfidence: ${fit.confidenceNote}`
      : FIT_TOOLTIP;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className={cn(
          "font-mono font-bold leading-none text-foreground",
          size === "hero" ? "text-[length:var(--text-match)]" : "text-[length:var(--text-kpi)]"
        )}
      >
        {fit.score}
      </span>
      <span className="flex items-center gap-1 text-[length:var(--text-meta)] uppercase tracking-wide text-muted-foreground">
        Fit
        <InfoTooltip text={tooltip} />
      </span>
    </div>
  );
}

function FitBar({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-[length:var(--text-label)] text-muted-foreground">{label}</span>
      <div
        className="h-2 flex-1 overflow-hidden rounded-full"
        style={{ background: "color-mix(in srgb, var(--color-foreground) 9%, transparent)" }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${clamped}%`, background: "var(--color-primary)" }}
        />
      </div>
      <span className="w-8 shrink-0 text-right font-mono text-[length:var(--text-label)] font-bold text-primary">
        {clamped}
      </span>
    </div>
  );
}

/** The two-part explanation: Coverage + Confidence bars, notes optional. */
export function FitBars({ fit, showNotes }: { fit: FitSignal; showNotes: boolean }) {
  return (
    <div className="space-y-2">
      <FitBar label="Covers your needs" value={fit.coverageScore} />
      {showNotes && (
        <p className="pl-[calc(7rem+0.75rem)] text-[length:var(--text-label)] text-muted-foreground">
          {fit.coverageNote}
        </p>
      )}
      <FitBar label="Confidence" value={fit.confidenceScore} />
      {showNotes && (
        <p className="pl-[calc(7rem+0.75rem)] text-[length:var(--text-label)] text-muted-foreground">
          {fit.confidenceNote}
        </p>
      )}
    </div>
  );
}
