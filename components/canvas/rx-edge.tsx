"use client";

import { getSmoothStepPath, type EdgeProps } from "reactflow";

/**
 * "Doctor's-note" connector — dashed right-angle line with a filled pin at
 * each end instead of an arrowhead. See docs/CanvasRx_DESIGN_GUIDELINES.md
 * Section 3. Wrapped in a <g> so the whole connector (line + pins) fades in
 * together when a brand new edge mounts, matching the card's own entrance
 * animation — re-renders (drag, resize) reuse the same DOM node so this
 * never replays.
 */
export function RxEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 4,
  });

  return (
    <g className="animate-in fade-in-0 duration-500">
      <path
        d={edgePath}
        fill="none"
        style={{
          stroke: "var(--border)",
          strokeWidth: 1.5,
          strokeDasharray: "4 4",
          strokeLinecap: "butt",
          ...style,
        }}
      />
      <circle cx={sourceX} cy={sourceY} r={3} fill="var(--border)" />
      <circle cx={targetX} cy={targetY} r={3} fill="var(--border)" />
    </g>
  );
}
