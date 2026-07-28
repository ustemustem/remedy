"use client";

import type { EdgeProps } from "reactflow";

// Must match rx-node.tsx's Card width (`w-80` = 320px) — there's no shared
// layout constant for it today, so this is the one place outside rx-node.tsx
// that needs to know a card's rendered width to compute where its LEFT edge
// sits (React Flow only gives edges the node's center via its Top/Bottom
// Handle positions).
const CARD_WIDTH = 320;
// How far left of a card's own left edge the thread line runs.
const LINE_INSET = 14;

// Radius of the rounded elbow where the line jogs sideways into a new
// indent level — reads as a soft "hook" turn rather than a sharp L-corner.
const CORNER_RADIUS = 8;

/**
 * Comment-thread connector — distinct from RxEdge's doctor's-note style used
 * everywhere else. Runs down the LEFT side of the source card (not
 * center-to-center), continuing straight through every card at the same
 * indent level, only jogging sideways where indent actually changes (e.g.
 * a suggestion → its first comment). A small solid cap marks where the
 * thread departs from its source, matching the reference mock — no second
 * pin at the target end, since the line's own arrival at the target's left
 * edge already reads as the connection point.
 */
export function ThreadEdge({ sourceX, sourceY, targetX, targetY }: EdgeProps) {
  const sourceLineX = sourceX - CARD_WIDTH / 2 - LINE_INSET;
  const targetLineX = targetX - CARD_WIDTH / 2 - LINE_INSET;
  const midY = sourceY + (targetY - sourceY) / 2;

  let path: string;
  if (sourceLineX === targetLineX) {
    path = `M ${sourceLineX},${sourceY} L ${targetLineX},${targetY}`;
  } else {
    // Round the two corners of the jog (a rounded step, not a sharp L) so
    // the line reads as one continuous "↳" hook rather than two segments
    // meeting at right angles.
    const dir = targetLineX > sourceLineX ? 1 : -1;
    const r = Math.min(CORNER_RADIUS, Math.abs(targetLineX - sourceLineX) / 2, Math.abs(midY - sourceY));
    path = [
      `M ${sourceLineX},${sourceY}`,
      `L ${sourceLineX},${midY - r}`,
      `Q ${sourceLineX},${midY} ${sourceLineX + dir * r},${midY}`,
      `L ${targetLineX - dir * r},${midY}`,
      `Q ${targetLineX},${midY} ${targetLineX},${midY + r}`,
      `L ${targetLineX},${targetY}`,
    ].join(" ");
  }

  return (
    <g className="animate-in fade-in-0 duration-500">
      <path
        d={path}
        fill="none"
        stroke="var(--cta)"
        strokeWidth={2}
        strokeDasharray="3 4"
        strokeLinecap="round"
      />
      <circle cx={sourceLineX} cy={sourceY} r={3.5} fill="var(--cta)" />
    </g>
  );
}
