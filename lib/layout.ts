import type { CanvasNodeData } from "./types";

/**
 * Horizontal spacing between sibling cards at the same depth (card is
 * w-80 = 320px). Paired with canvas-screen.tsx's FRAME_PADDING_X (32px):
 * leaves a ~28px margin between adjacent path frames, wide enough to
 * reliably hover/drag a path by, without ever triggering
 * resolveFrameOverlaps' avoidance nudge for the common two-sibling case
 * (which adds its own spacing on top if it ever fires).
 */
const SIBLING_GAP = 412;
/**
 * Vertical spacing per depth level. Y positioning is purely depth-based
 * (no measured-height avoidance the way X positioning has via
 * resolveFrameOverlaps in canvas-screen.tsx) — a fully-expanded option-set
 * card (3 choices + reveal text) renders well past 400px tall, so this
 * needs real margin above that to keep a child from overlapping its
 * parent's bottom.
 */
const DEPTH_GAP = 520;

/**
 * Top-to-bottom tree layout: y by depth, x by an in-order pass over each
 * node's visible children so siblings spread out horizontally without
 * overlapping.
 */
export function layoutNodes(nodes: CanvasNodeData[]): Record<string, { x: number; y: number }> {
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
