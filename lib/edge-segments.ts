/**
 * Turns an SVG edge path into the straight runs it is drawn with, so the
 * canvas's Surface Field can keep its dots off the edges (see
 * components/canvas/surface-field-background.tsx).
 *
 * Handles the commands RxEdge emits: M, L and Q. A Q corner counts as its end
 * point: corners are small (4px), so the runs on either side cover them.
 */

export type Point = { x: number; y: number };

export function pathPoints(d: string): Point[] {
  const tokens = d.match(/[MLQmlq]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const points: Point[] = [];
  let cmd = "M";
  let nums: number[] = [];
  const flush = () => {
    const step = cmd.toUpperCase() === "Q" ? 4 : 2;
    for (let i = 0; i + step <= nums.length; i += step) {
      points.push({ x: nums[i + step - 2], y: nums[i + step - 1] });
    }
    nums = [];
  };
  for (const t of tokens) {
    if (/^[MLQmlq]$/.test(t)) {
      flush();
      cmd = t;
    } else {
      nums.push(Number(t));
    }
  }
  flush();
  return points;
}

/**
 * Only the route's corners: repeated points and points that sit on a straight
 * line between their neighbours are dropped. After this, run N of a route is
 * the same run of the edge from one frame to the next, which keeps the field's
 * per-surface ids stable while a card is dragged. Without it, a stub or a
 * zero-length run appearing or vanishing shifted every later run's index, and
 * the field "slid" a clearing from one run to another.
 */
export function simplifyRoute(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < 0.01 && Math.abs(last.y - p.y) < 0.01) continue;
    if (out.length >= 2) {
      const a = out[out.length - 2];
      const b = last;
      const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
      if (Math.abs(cross) < 0.01) {
        out[out.length - 1] = p; // b is on the line a -> p: extend the run instead
        continue;
      }
    }
    out.push(p);
  }
  return out;
}

/** Axis-aligned boxes around each straight run of the path, grown by `pad`. */
export function segmentBoxes(
  points: Point[],
  pad: number
): { left: number; top: number; right: number; bottom: number }[] {
  const boxes = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a.x === b.x && a.y === b.y) continue;
    boxes.push({
      left: Math.min(a.x, b.x) - pad,
      top: Math.min(a.y, b.y) - pad,
      right: Math.max(a.x, b.x) + pad,
      bottom: Math.max(a.y, b.y) + pad,
    });
  }
  return boxes;
}
