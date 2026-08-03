"use client";

// Live experiment panel, mounted once in page.tsx (outside the step switch,
// same pattern as SessionSidebar) so it's reachable from chat/canvas/dashboard
// alike. Canvas: branch-framing settings were compared and finalized here
// (see canvas-screen.tsx / group-frame-node.tsx / rx-edge.tsx for the
// locked-in values) — corner radius, smoothing, and Source identity were
// three canvas experiments live-tunable here; all three are now locked in
// (Control 6px / Card 12px / Surface 8px / Smoothing 80% / Source identity
// "rail" — see app/page.tsx's constants and source-style-context.tsx). The
// OptionPicker choice-card radius is the one canvas control still worth
// live-tuning (a nested control, deliberately independent of --radius-card).
// Dashboard: design-critique follow-ups (card padding, micro type scale,
// provenance link weight) that apply to both screens at once through shared
// CSS custom properties.

import { FlaskConical, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function ExperimentOverlay({
  optionRadius,
  onOptionRadiusChange,
  headerRadius,
  onHeaderRadiusChange,
  cardPadding,
  onCardPaddingChange,
  textMeta,
  onTextMetaChange,
  textLabel,
  onTextLabelChange,
  linkWeight,
  onLinkWeightChange,
}: {
  /** OptionPicker A/B/C choice-card radius (px) — see --radius-option in globals.css. */
  optionRadius: number;
  onOptionRadiusChange: (radius: number) => void;
  /** A card's origin-strip/note-panel corner radius (px) — see --radius-header in
   *  globals.css. Independent from the outer card's own squircle boundary, since
   *  the same radius number reads differently on a plain arc vs. a squircle curve. */
  headerRadius: number;
  onHeaderRadiusChange: (radius: number) => void;
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
    <div className="fixed right-4 top-16 z-50 w-72 rounded-[var(--radius-surface)] border border-border bg-card shadow-lg">
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
            <p className="text-xs font-semibold text-foreground">Option card radius</p>
            <span className="text-[11px] tabular-nums text-muted-foreground">{optionRadius}px</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            The A/B/C choice cards inside a suggestion&rsquo;s option picker — independent of the
            outer card&rsquo;s own radius.
          </p>
          <input
            type="range"
            min={0}
            max={24}
            step={1}
            value={optionRadius}
            onChange={(e) => onOptionRadiusChange(Number(e.target.value))}
            className="w-full accent-cta"
          />
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Card header radius</p>
            <span className="text-[11px] tabular-nums text-muted-foreground">{headerRadius}px</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            The origin-strip/note-panel corners inside a card — a plain rounded corner, unlike
            the outer card&rsquo;s squircle boundary. Same 12px on both looks mismatched; tune
            this until the two visually line up.
          </p>
          <input
            type="range"
            min={0}
            max={24}
            step={1}
            value={headerRadius}
            onChange={(e) => onHeaderRadiusChange(Number(e.target.value))}
            className="w-full accent-cta"
          />
        </div>

        <div className="space-y-2 border-t border-border pt-4">
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
      </div>
    </div>
  );
}
