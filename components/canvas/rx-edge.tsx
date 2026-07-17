"use client";

import { getBezierPath, getSmoothStepPath, getStraightPath, type EdgeProps } from "reactflow";

/** Connector shape/dash options — see the experiment overlay's "Connector style" section. */
export type ConnectorVariant = "curved" | "step" | "dotted";

export interface RxEdgeData {
  variant?: ConnectorVariant;
}

/**
 * "Doctor's-note" connector — dashed line with a filled pin at each end
 * instead of an arrowhead. See docs/CanvasRx_DESIGN_GUIDELINES.md Section 3.
 * Wrapped in a <g> so the whole connector (line + pins) fades in together
 * when a brand new edge mounts, matching the card's own entrance animation
 * — re-renders (drag, resize) reuse the same DOM node so this never replays.
 */
export function RxEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
}: EdgeProps<RxEdgeData>) {
  const variant = data?.variant ?? "curved";

  const [edgePath] =
    variant === "step"
      ? getSmoothStepPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
          borderRadius: 4,
        })
      : variant === "dotted"
        ? getStraightPath({ sourceX, sourceY, targetX, targetY })
        : getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  const strokeDasharray = variant === "dotted" ? "1.5 6" : "4 4";
  const strokeLinecap = variant === "dotted" ? "round" : "butt";

  return (
    <g className="animate-in fade-in-0 duration-500">
      <path
        d={edgePath}
        fill="none"
        style={{
          stroke: "var(--border)",
          strokeWidth: 1.5,
          strokeDasharray,
          strokeLinecap,
          ...style,
        }}
      />
      <circle cx={sourceX} cy={sourceY} r={3} fill="var(--border)" />
      <circle cx={targetX} cy={targetY} r={3} fill="var(--border)" />
    </g>
  );
}
