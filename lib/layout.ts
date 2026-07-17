import type { CanvasNodeData } from "./types";

/**
 * Horizontal spacing between sibling cards at the same depth (card is
 * w-80 = 320px). Paired with canvas-screen.tsx's FRAME_PADDING_X (16px):
 * a 44px raw gap leaves 12px between adjacent path frames, comfortably
 * above the 36px minimum without ever triggering resolveFrameOverlaps'
 * avoidance nudge — that nudge adds its own spacing on top, so letting it
 * fire for the common case (a suggestion and its counter-argument, now
 * always separate paths) would make siblings end up farther apart than
 * before, not closer.
 */
const SIBLING_GAP = 364;
/** Vertical spacing per depth level — trimmed down from the original layout, still clears a 3-choice option-set card with room to spare. */
const DEPTH_GAP = 380;

/**
 * Top-to-bottom tree layout: y by depth, x by an in-order pass over each
 * node's visible children so siblings spread out horizontally without
 * overlapping.
 */
export function layoutNodes(
  nodes: CanvasNodeData[]
): Record<string, { x: number; y: number }> {
  const byParent = new Map<string | null, CanvasNodeData[]>();
  for (const n of nodes) {
    const key = n.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(n);
  }

  const positions: Record<string, { x: number; y: number }> = {};
  let nextX = 0;

  function place(node: CanvasNodeData): number {
    const children = byParent.get(node.id) ?? [];
    let x: number;
    if (children.length === 0) {
      x = nextX;
      nextX += SIBLING_GAP;
    } else {
      const childXs = children.map(place);
      x = childXs.reduce((a, b) => a + b, 0) / childXs.length;
    }
    positions[node.id] = { x, y: node.depth * DEPTH_GAP };
    return x;
  }

  const roots = byParent.get(null) ?? [];
  for (const root of roots) place(root);

  return positions;
}
