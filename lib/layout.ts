import type { CanvasNodeData } from "./types";

/** Horizontal spacing between sibling cards at the same depth (card is w-80 = 320px). */
const SIBLING_GAP = 380;
/** Vertical spacing per depth level — generous enough to clear a 3-choice option-set card. */
const DEPTH_GAP = 460;

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
