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
 * Top-to-bottom tree layout: x by an in-order pass over each node's visible
 * children so siblings spread out horizontally without overlapping; y by
 * walking each node's OWN ancestor chain independently.
 *
 * `nodeHeights[nodeId]` is the (already-smoothed) vertical space that node's
 * own card needs below it before its children start — see
 * canvas-screen.tsx, which derives it from that specific card's measured
 * height, not a value shared across sibling branches. This is deliberate:
 * a branch with a tall card (e.g. a fully-expanded option-set) shouldn't
 * push down an unrelated branch's short continuation chain just because
 * they happen to sit at the same depth.
 */
export function layoutNodes(
  nodes: CanvasNodeData[],
  nodeHeights: Record<string, number>
): Record<string, { x: number; y: number }> {
  const byParent = new Map<string | null, CanvasNodeData[]>();
  for (const n of nodes) {
    const key = n.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(n);
  }

  const positions: Record<string, { x: number; y: number }> = {};
  let nextX = 0;

  function placeX(node: CanvasNodeData): number {
    const children = byParent.get(node.id) ?? [];
    let x: number;
    if (children.length === 0) {
      x = nextX;
      nextX += SIBLING_GAP;
    } else {
      const childXs = children.map(placeX);
      x = childXs.reduce((a, b) => a + b, 0) / childXs.length;
    }
    positions[node.id] = { x, y: 0 };
    return x;
  }

  const roots = byParent.get(null) ?? [];
  for (const root of roots) placeX(root);

  // y second pass, shallowest depth first, so every parent's y is already
  // settled by the time its children read it off `positions`.
  const byDepth = [...nodes].sort((a, b) => a.depth - b.depth);
  for (const n of byDepth) {
    if (!n.parentId) continue; // roots stay at y: 0 from the pass above
    const parentPos = positions[n.parentId];
    if (!parentPos) continue;
    positions[n.id].y = parentPos.y + (nodeHeights[n.parentId] ?? 0);
  }

  return positions;
}
