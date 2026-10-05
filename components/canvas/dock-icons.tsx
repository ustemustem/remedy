"use client";

import type { SVGProps } from "react";
import { Footprints, Hand, TriangleAlert, type LucideIcon } from "lucide-react";
import type { AngleId } from "@/lib/angles";

/**
 * The dock's three icons, drawn on the Lucide grid (24 x 24, stroke 2, round
 * caps and joins) in one language: the card comes from New issue, the dashed
 * path and filled pin from Link, and Spark combines both: the same card, seen
 * from a moved viewpoint. See docs/handoff-canvas-dock.md, section C.
 */

const BASE: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function QuoteCardPlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} {...props}>
      <rect x="2.5" y="6" width="14" height="14" rx="3" />
      <path d="M7.5 11v3" />
      <path d="M11.5 11v3" />
      <path d="M20 2v6" />
      <path d="M17 5h6" />
    </svg>
  );
}

export function PinConnectorDashedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} {...props}>
      <circle fill="currentColor" stroke="none" cx="5" cy="5.5" r="2.4" />
      <circle fill="currentColor" stroke="none" cx="19" cy="18.5" r="2.4" />
      <path d="M5 8.5v2a2 2 0 0 0 2 2h10a2 2 0 0 1 2 2v1" strokeDasharray="2.2 2.6" />
    </svg>
  );
}

/** Spark: the card stays; the viewpoint (pin) has moved from the front (ring) around to the side. */
export function SparkOrbitFromIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE} {...props}>
      <rect x="2.5" y="9" width="12" height="12.5" rx="3" />
      <circle cx="4.95" cy="4.31" r="1.3" />
      <path data-part="orbit" d="M8.1 3.76A11.5 11.5 0 0 1 19.89 13.65" strokeDasharray="2.2 2.6" />
      <circle data-part="pin" fill="currentColor" stroke="none" cx="19.89" cy="13.65" r="2.4" />
    </svg>
  );
}

/** The icon on an angle card's strip. */
export const ANGLE_ICON: Record<AngleId, LucideIcon> = {
  pushback: Hand,
  risk: TriangleAlert,
  step: Footprints,
};

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The pin leaves the ring and travels the orbit once. Spark started by click only, never by key. */
export function playSparkOrbit(svg: SVGSVGElement) {
  if (reducedMotion()) return;
  const orbit = svg.querySelector<SVGPathElement>('[data-part="orbit"]');
  const pin = svg.querySelector<SVGCircleElement>('[data-part="pin"]');
  if (!orbit || !pin) return;
  const len = orbit.getTotalLength();
  const end = { cx: pin.getAttribute("cx")!, cy: pin.getAttribute("cy")! };
  // Close to --ease-in-out.
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const dur = 600;
  orbit.animate([{ opacity: 0, strokeDashoffset: 9.6 }, { opacity: 1, strokeDashoffset: 0 }], {
    duration: dur,
    easing: "cubic-bezier(0.77, 0, 0.175, 1)",
  });
  let t0: number | null = null;
  const step = (ts: number) => {
    t0 ??= ts;
    const t = Math.min(1, (ts - t0) / dur);
    const p = orbit.getPointAtLength(ease(t) * len);
    pin.setAttribute("cx", p.x.toFixed(2));
    pin.setAttribute("cy", p.y.toFixed(2));
    pin.style.opacity = String(Math.min(1, t * 5));
    if (t < 1) requestAnimationFrame(step);
    else {
      pin.setAttribute("cx", end.cx);
      pin.setAttribute("cy", end.cy);
      pin.style.opacity = "";
    }
  };
  requestAnimationFrame(step);
}
