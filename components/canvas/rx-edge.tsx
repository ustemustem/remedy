"use client";

import { BaseEdge, getBezierPath, type EdgeProps } from "reactflow";

/**
 * "Doctor's-note" connector — dashed line with a filled pin at each end
 * instead of an arrowhead. See docs/CanvasRx_DESIGN_GUIDELINES.md Section 3.
 */
export function RxEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: "var(--border)",
          strokeWidth: 1.5,
          strokeDasharray: "4 4",
          ...style,
        }}
      />
      <circle cx={sourceX} cy={sourceY} r={3} fill="var(--border)" />
      <circle cx={targetX} cy={targetY} r={3} fill="var(--border)" />
    </>
  );
}
