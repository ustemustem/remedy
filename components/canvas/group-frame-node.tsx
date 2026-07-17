"use client";

// PROTOTYPE ONLY — throwaway comparison tool for the branch-framing decision.
// Remove this file (and its wiring in canvas-screen.tsx) once a variant is picked.

import type { NodeProps } from "reactflow";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export type FrameVariant = "onlyOnHover" | "alwaysFaint";

export interface GroupFrameNodeData {
  groupId: string;
  label: string;
  color: "primary" | "cta";
  variant: FrameVariant;
  active: boolean;
  /** Reports hover directly on the frame's own (card-free) area — see canvas-screen.tsx. */
  onHoverChange?: (groupId: string | null) => void;
}

export function GroupFrameNode({ data }: NodeProps<GroupFrameNodeData>) {
  const { groupId, label, color, variant, active, onHoverChange } = data;
  const isPrimary = color === "primary";

  return (
    <div
      onMouseEnter={() => onHoverChange?.(groupId)}
      onMouseLeave={() => onHoverChange?.(null)}
      className={cn(
        // No nodrag/nopan here on purpose — the frame's own empty area (not
        // covered by a higher z-index card) is the drag handle for moving
        // the whole path at once.
        "relative h-full w-full cursor-grab rounded-lg border transition-all duration-150 active:cursor-grabbing",
        variant === "onlyOnHover" && !active && "border-transparent bg-transparent",
        variant === "onlyOnHover" &&
          active &&
          (isPrimary
            ? "border-primary/40 bg-primary/10"
            : "border-cta/40 bg-cta/10"),
        variant === "alwaysFaint" &&
          !active &&
          (isPrimary
            ? "border-primary/15 bg-primary/[0.04]"
            : "border-cta/15 bg-cta/[0.04]"),
        variant === "alwaysFaint" &&
          active &&
          (isPrimary
            ? "border-primary/50 bg-primary/10"
            : "border-cta/50 bg-cta/10")
      )}
    >
      <span
        className={cn(
          "absolute -top-5 left-3 font-mono text-[9px] uppercase tracking-wide transition-opacity duration-150",
          isPrimary ? "text-primary" : "text-cta",
          variant === "alwaysFaint" && !active && "opacity-40",
          (variant === "onlyOnHover" && !active) ? "opacity-0" : "opacity-100"
        )}
      >
        {label}
      </span>

      {/* Purely a "this whole path is grabbable" affordance — the frame's
          empty area is already the drag handle, this icon doesn't need to
          handle events. Sits just outside the frame's right edge, follows
          the same visibility rules as the label. */}
      <GripVertical
        className={cn(
          "pointer-events-none absolute top-1/2 -right-6 h-4 w-4 -translate-y-1/2 transition-opacity duration-150",
          isPrimary ? "text-primary" : "text-cta",
          variant === "alwaysFaint" && !active && "opacity-40",
          (variant === "onlyOnHover" && !active) ? "opacity-0" : "opacity-100"
        )}
      />
    </div>
  );
}
