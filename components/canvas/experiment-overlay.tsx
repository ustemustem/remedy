"use client";

// Live experiment panel — branch-framing, minimap, connector, grip, path
// grab affordance, header content, and spacing variants were all compared
// here and finalized (see canvas-screen.tsx / group-frame-node.tsx /
// rx-edge.tsx for the locked-in values). Corner radius ("Softness") is the
// one setting still worth live-tuning per session, so it's the only control
// left.

import { useState } from "react";
import { FlaskConical, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MIN_RADIUS = 0;
const MAX_RADIUS = 24;

const SOFTNESS_PRESETS: { label: string; radius: number }[] = [
  { label: "Sharp", radius: 0 },
  { label: "Soft", radius: 8 },
  { label: "Rounded", radius: 16 },
  { label: "Pill", radius: 24 },
];

export function ExperimentOverlay({
  cornerRadius,
  onCornerRadiusChange,
  smoothing,
  onSmoothingChange,
}: {
  cornerRadius: number;
  onCornerRadiusChange: (radius: number) => void;
  /** 0-1 — how squircle-like the corner curve is (see softness-context.tsx). */
  smoothing: number;
  onSmoothingChange: (smoothing: number) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Experiments"
        className="fixed right-4 top-16 z-50 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground"
      >
        <FlaskConical className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="fixed right-4 top-16 z-50 w-72 rounded-lg border border-border bg-card shadow-lg">
      <div className="flex items-center justify-between border-b border-border p-3">
        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          Experiments
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-4 p-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Corner radius</p>
            <input
              type="number"
              min={MIN_RADIUS}
              max={MAX_RADIUS}
              value={cornerRadius}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isNaN(next)) return;
                onCornerRadiusChange(Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, next)));
              }}
              className="w-12 rounded border border-border bg-background px-1 py-0.5 text-right text-[11px] tabular-nums text-foreground"
            />
          </div>

          <div className="flex gap-1">
            {SOFTNESS_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => onCornerRadiusChange(preset.radius)}
                className={cn(
                  "flex-1 rounded-md border px-1.5 py-1 text-[10px] font-medium transition-colors",
                  cornerRadius === preset.radius
                    ? "border-cta bg-cta/5 text-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/30"
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <input
            type="range"
            min={MIN_RADIUS}
            max={MAX_RADIUS}
            step={1}
            value={cornerRadius}
            onChange={(e) => onCornerRadiusChange(Number(e.target.value))}
            className="w-full accent-cta"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Smoothing</p>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {Math.round(smoothing * 100)}%
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Apple-style continuous corner curve (squircle) instead of a plain circular radius — 0% is a normal rounded corner, 100% is fully squircle.
          </p>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(smoothing * 100)}
            onChange={(e) => onSmoothingChange(Number(e.target.value) / 100)}
            className="w-full accent-cta"
          />
        </div>
      </div>
    </div>
  );
}
