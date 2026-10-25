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
  data,
}: EdgeProps<{ onPath?: boolean }>) {
  // The same dashed note line everywhere; the report path is just darker gray
  // (owner decision 2026-10-13: no green, no thicker line).
  const onPath = !!data?.onPath;
  const color = onPath ? "hsl(100 4% 44%)" : "var(--border)";
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
          stroke: color,
          strokeWidth: 1.5,
          strokeDasharray: "4 4",
          transition: "stroke 200ms ease-out",
          strokeLinecap: "butt",
          ...style,
        }}
      />
      <circle cx={sourceX} cy={sourceY} r={3} fill={color} />
      <circle cx={targetX} cy={targetY} r={3} fill={color} />
    </g>
  );
}
