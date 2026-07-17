"use client";

// PROTOTYPE ONLY — a live experiment panel for trying out canvas variants
// (branch-framing style, minimap style, whatever's next) without shipping
// a new header button each time. Changing a control here immediately
// updates the real canvas next to it. Remove once decisions are finalized —
// fold the winning variant into the real implementation and drop the rest.

import { useState } from "react";
import { FlaskConical, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FrameVariant } from "./group-frame-node";
import type { ConnectorVariant } from "./rx-edge";

export type MinimapVariant = "default" | "pathColored" | "compactCorner";

const FRAME_VARIANTS: { id: FrameVariant; label: string; description: string }[] = [
  { id: "onlyOnHover", label: "Hover only", description: "Path frame is invisible until you hover it or a card inside it." },
  { id: "alwaysFaint", label: "Always faint", description: "Path frame stays faintly visible, brightens on hover." },
];

const MINIMAP_VARIANTS: { id: MinimapVariant; label: string; description: string }[] = [
  { id: "default", label: "Default", description: "Standard React Flow minimap, neutral node color." },
  { id: "pathColored", label: "Path-colored", description: "Each card tinted by its path's color (green/orange)." },
  { id: "compactCorner", label: "Compact corner", description: "Smaller, dims until hovered, no pan/zoom." },
];

const CONNECTOR_VARIANTS: { id: ConnectorVariant; label: string; description: string }[] = [
  { id: "curved", label: "Curved", description: "Smooth bezier curve, dashed line (current default)." },
  { id: "step", label: "Right angle", description: "90° elbow connector, same dashed line." },
  { id: "dotted", label: "Dotted", description: "Straight line, small round dots instead of dashes." },
];

export function ExperimentOverlay({
  frameVariant,
  onFrameVariantChange,
  minimapVariant,
  onMinimapVariantChange,
  connectorVariant,
  onConnectorVariantChange,
}: {
  frameVariant: FrameVariant;
  onFrameVariantChange: (variant: FrameVariant) => void;
  minimapVariant: MinimapVariant;
  onMinimapVariantChange: (variant: MinimapVariant) => void;
  connectorVariant: ConnectorVariant;
  onConnectorVariantChange: (variant: ConnectorVariant) => void;
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
    <div className="fixed right-4 top-16 z-50 w-72 space-y-4 rounded-lg border border-border bg-card p-3 shadow-lg">
      <div className="flex items-center justify-between">
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

      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-foreground">Branch framing</p>
        <div className="space-y-1">
          {FRAME_VARIANTS.map((v) => (
            <VariantOption
              key={v.id}
              label={v.label}
              description={v.description}
              active={frameVariant === v.id}
              onClick={() => onFrameVariantChange(v.id)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-foreground">Minimap style</p>
        <div className="space-y-1">
          {MINIMAP_VARIANTS.map((v) => (
            <VariantOption
              key={v.id}
              label={v.label}
              description={v.description}
              active={minimapVariant === v.id}
              onClick={() => onMinimapVariantChange(v.id)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-foreground">Connector style</p>
        <div className="space-y-1">
          {CONNECTOR_VARIANTS.map((v) => (
            <VariantOption
              key={v.id}
              label={v.label}
              description={v.description}
              active={connectorVariant === v.id}
              onClick={() => onConnectorVariantChange(v.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function VariantOption({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-md border px-2 py-1.5 text-left transition-colors",
        active ? "border-cta bg-cta/5" : "border-border hover:border-foreground/30"
      )}
    >
      <span className="block text-[11px] font-medium text-foreground">{label}</span>
      <span className="block text-[10px] text-muted-foreground">{description}</span>
    </button>
  );
}
