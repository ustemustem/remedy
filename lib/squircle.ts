/**
 * Apple-style "corner smoothing" — a superellipse curve, not a plain
 * circular border-radius. `smoothing` (0-1) interpolates the corner's
 * exponent from a perfect circular arc (2, what `border-radius` already
 * draws) toward a flatter, more continuous squircle curve (~5, closer to
 * how iOS app icons round their corners). Returns an SVG path `d` string
 * in the element's own 0,0 → width,height box, meant for
 * `clip-path: path('...')`.
 */
export function getSquirclePath(
  width: number,
  height: number,
  radius: number,
  smoothing: number
): string {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  if (r <= 0) {
    return `M0,0 H${width} V${height} H0 Z`;
  }

  const n = 2 + Math.max(0, Math.min(1, smoothing)) * 3;
  const STEPS_PER_CORNER = 8;

  function cornerPoints(cx: number, cy: number, startAngle: number, sweep: number): [number, number][] {
    const pts: [number, number][] = [];
    for (let i = 0; i <= STEPS_PER_CORNER; i++) {
      const angle = startAngle + sweep * (i / STEPS_PER_CORNER);
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const x = cx + r * Math.sign(c) * Math.abs(c) ** (2 / n);
      const y = cy + r * Math.sign(s) * Math.abs(s) ** (2 / n);
      pts.push([x, y]);
    }
    return pts;
  }

  const corners = [
    { cx: width - r, cy: r, start: -Math.PI / 2, sweep: Math.PI / 2 }, // top-right
    { cx: width - r, cy: height - r, start: 0, sweep: Math.PI / 2 }, // bottom-right
    { cx: r, cy: height - r, start: Math.PI / 2, sweep: Math.PI / 2 }, // bottom-left
    { cx: r, cy: r, start: Math.PI, sweep: Math.PI / 2 }, // top-left
  ];

  let d = "";
  for (const corner of corners) {
    for (const [x, y] of cornerPoints(corner.cx, corner.cy, corner.start, corner.sweep)) {
      d += d ? ` L${x.toFixed(2)},${y.toFixed(2)}` : `M${x.toFixed(2)},${y.toFixed(2)}`;
    }
  }
  return d + " Z";
}
