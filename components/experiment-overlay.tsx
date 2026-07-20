"use client";

// Live experiment panel, mounted once in page.tsx (outside the step switch,
// same pattern as SessionSidebar) so it's reachable from chat/canvas/dashboard
// alike. Canvas tab: branch-framing settings were compared and finalized here
// (see canvas-screen.tsx / group-frame-node.tsx / rx-edge.tsx for the
// locked-in values) — corner radius + smoothing ("Softness") are what's still
// worth live-tuning. Dashboard tab: design-critique follow-ups (card padding,
// micro type scale, provenance link weight) that apply to both screens at
// once via shared CSS custom properties.

import { useState } from "react";
import { FlaskConical, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SourceStyle } from "@/components/canvas/source-style-context";

const MIN_RADIUS = 0;
const MAX_RADIUS = 24;

const SOFTNESS_PRESETS: { label: string; radius: number }[] = [
  { label: "Sharp", radius: 0 },
  { label: "Soft", radius: 8 },
  { label: "Rounded", radius: 16 },
  { label: "Pill", radius: 24 },
];

const SOURCE_STYLE_OPTIONS: { label: string; value: SourceStyle }[] = [
  { label: "Default", value: "default" },
  { label: "Stamp", value: "stamp" },
  { label: "Quote", value: "quote" },
  { label: "Rail", value: "rail" },
];

export function ExperimentOverlay({
  cornerRadius,
  onCornerRadiusChange,
  smoothing,
  onSmoothingChange,
  cardPadding,
  onCardPaddingChange,
  textMeta,
  onTextMetaChange,
  textLabel,
  onTextLabelChange,
  linkWeight,
  onLinkWeightChange,
  sourceStyle,
  onSourceStyleChange,
}: {
  cornerRadius: number;
  onCornerRadiusChange: (radius: number) => void;
  /** 0-1 — how squircle-like the corner curve is (see softness-context.tsx). */
  smoothing: number;
  onSmoothingChange: (smoothing: number) => void;
  /** Horizontal card padding (px) — shared by canvas cards and dashboard cards. */
  cardPadding: number;
  onCardPaddingChange: (px: number) => void;
  /** Smallest micro-label size (px) — timestamps, meta captions. */
  textMeta: number;
  onTextMetaChange: (px: number) => void;
  /** Standard micro-label size (px) — mono headers, captions. */
  textLabel: number;
  onTextLabelChange: (px: number) => void;
  /** Whether the dashboard's "View source"/"View report" links read as bolder. */
  linkWeight: "subtle" | "bold";
  onLinkWeightChange: (weight: "subtle" | "bold") => void;
  /** How the Source card visually reads as "your own words, not an AI card". */
  sourceStyle: SourceStyle;
  onSourceStyleChange: (style: SourceStyle) => void;
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

      <Tabs defaultValue="canvas" className="p-3">
        <TabsList className="w-full">
          <TabsTrigger value="canvas">Canvas</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        </TabsList>

        <TabsContent value="canvas" className="space-y-4 pt-2">
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
              Apple-style continuous corner curve (squircle) instead of a plain circular radius —
              0% is a normal rounded corner, 100% is fully squircle.
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

          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-xs font-semibold text-foreground">Source identity</p>
            <p className="text-[10px] text-muted-foreground">
              The Source card is the user&rsquo;s own text, not an AI suggestion —
              &ldquo;Stamp&rdquo; reuses the design system&rsquo;s existing rotated badge and drops
              the squircle; &ldquo;Quote&rdquo; leans on typography instead.
            </p>
            <div className="flex gap-1">
              {SOURCE_STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onSourceStyleChange(opt.value)}
                  className={cn(
                    "flex-1 rounded-md border px-1.5 py-1 text-[10px] font-medium transition-colors",
                    sourceStyle === opt.value
                      ? "border-cta bg-cta/5 text-foreground"
                      : "border-border text-muted-foreground hover:border-foreground/30"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-4 pt-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">Card padding</p>
              <span className="text-[11px] tabular-nums text-muted-foreground">{cardPadding}px</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Canvas cards and dashboard cards used px-3 and px-4 independently — this is the
              single shared value now driving both.
            </p>
            <input
              type="range"
              min={8}
              max={24}
              step={1}
              value={cardPadding}
              onChange={(e) => onCardPaddingChange(Number(e.target.value))}
              className="w-full accent-cta"
            />
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-xs font-semibold text-foreground">Micro type scale</p>
            <p className="text-[10px] text-muted-foreground">
              Replaces six hand-tuned 10-12.5px sizes across canvas + dashboard with two shared
              steps.
            </p>
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">Meta (timestamps, captions)</p>
              <span className="text-[11px] tabular-nums text-muted-foreground">{textMeta}px</span>
            </div>
            <input
              type="range"
              min={9}
              max={13}
              step={0.5}
              value={textMeta}
              onChange={(e) => onTextMetaChange(Number(e.target.value))}
              className="w-full accent-cta"
            />
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">Label (mono headers)</p>
              <span className="text-[11px] tabular-nums text-muted-foreground">{textLabel}px</span>
            </div>
            <input
              type="range"
              min={10}
              max={14}
              step={0.5}
              value={textLabel}
              onChange={(e) => onTextLabelChange(Number(e.target.value))}
              className="w-full accent-cta"
            />
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-xs font-semibold text-foreground">Provenance link weight</p>
            <p className="text-[10px] text-muted-foreground">
              The dashboard&rsquo;s &ldquo;View source&rdquo;/&ldquo;View report&rdquo; links carry
              the transparency pitch — test whether they should read heavier.
            </p>
            <div className="flex gap-1">
              {(["subtle", "bold"] as const).map((weight) => (
                <button
                  key={weight}
                  type="button"
                  onClick={() => onLinkWeightChange(weight)}
                  className={cn(
                    "flex-1 rounded-md border px-1.5 py-1 text-[10px] font-medium capitalize transition-colors",
                    linkWeight === weight
                      ? "border-cta bg-cta/5 text-foreground"
                      : "border-border text-muted-foreground hover:border-foreground/30"
                  )}
                >
                  {weight}
                </button>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
