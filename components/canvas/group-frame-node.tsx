"use client";

import { useState } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { GripVertical, Lightbulb, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GroupFrameNodeData {
  groupId: string;
  color: "primary" | "cta";
  active: boolean;
  /** The path's founding card's title — see canvas-screen.tsx's originTitle tracking. Shown as a hover tooltip. */
  originTitle: string;
  /** Reports hover directly on the frame's own (card-free) area — see canvas-screen.tsx. */
  onHoverChange?: (groupId: string | null) => void;
}

export function GroupFrameNode({ data }: NodeProps<GroupFrameNodeData>) {
  const { groupId, color, active, originTitle, onHoverChange } = data;
  const isPrimary = color === "primary";
  // Local to this frame — unlike `active` (which also lights up when ANY
  // card inside the path is hovered, via the shared hoveredGroupId, so the
  // path border highlights no matter which card you're looking at), this
  // only tracks hovering the frame's OWN empty background. The grip icon
  // uses this instead of `active` so it doesn't appear at the same time as
  // a card's own grip (rx-node.tsx) when a tightly-wrapped single-card path
  // makes the two icons sit close together.
  const [isFrameHovered, setIsFrameHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => {
        onHoverChange?.(groupId);
        setIsFrameHovered(true);
      }}
      onMouseLeave={() => {
        onHoverChange?.(null);
        setIsFrameHovered(false);
      }}
      className={cn(
        // No nodrag/nopan here on purpose — the frame's own empty area (not
        // covered by a higher z-index card) is the drag handle for moving
        // the whole path at once. Border/background only shows on hover
        // (of the frame itself, or any card inside it via `active`).
        "relative h-full w-full cursor-grab rounded-lg border transition-all duration-150 active:cursor-grabbing",
        !active && "border-transparent bg-transparent",
        active &&
          (isPrimary ? "border-primary/40 bg-primary/10" : "border-cta/40 bg-cta/10")
      )}
    >
      {/* Lets an edge crossing INTO this path attach here instead of poking
          straight into the first card underneath the header — see
          canvas-screen.tsx's edge-rebuild effect, which retargets any edge
          whose child enters a new groupId to `frame-${groupId}`. Position.Top
          defaults to the node's own top-center, exactly where the header
          row (top-0) sits. */}
      <Handle type="target" position={Position.Top} className="!bg-border" />

      {/* A solid strip INSIDE the frame's own box (not floating above it)
          so it's genuinely part of this div's hoverable area no matter how
          tight the horizontal spacing between paths is. Background is
          always faintly visible (not hover-gated) so there's an obvious,
          generously-sized target to grab in the first place. Minimal
          content — just the kind icon + grip, origin idea (which idea this
          path actually is) available as a native hover tooltip. */}
      <div
        title={originTitle}
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 flex h-6 items-center justify-between gap-1.5 rounded-t-lg px-2 transition-colors duration-150",
          isPrimary ? (active ? "bg-primary/20" : "bg-primary/10") : active ? "bg-cta/20" : "bg-cta/10"
        )}
      >
        {isPrimary ? (
          <Lightbulb className="h-3 w-3 shrink-0 text-primary" />
        ) : (
          <ShieldAlert className="h-3 w-3 shrink-0 text-cta" />
        )}
        <GripVertical
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-opacity duration-150",
            isPrimary ? "text-primary" : "text-cta",
            isFrameHovered ? "opacity-100" : "opacity-50"
          )}
        />
      </div>
    </div>
  );
}
