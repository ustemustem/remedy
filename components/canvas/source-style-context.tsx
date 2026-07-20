"use client";

import { createContext, useContext } from "react";

/**
 * Live-tunable visual identity for the Source card (see experiment-overlay.tsx's
 * "Source identity" control). Source is the user's own original text, not an
 * AI suggestion — "default" looks identical to every other card (the bug this
 * experiment exists to fix), "stamp" reuses the design system's existing
 * rotated stamp badge (docs/CanvasRx_DESIGN_GUIDELINES.md Section 3, until now
 * only specced for Organic/Sponsored) instead of inventing new chrome, and
 * "quote" leans into typography (quotation marks, italic) to read as a
 * literal excerpt of what the user wrote. "rail" — the direction settled on
 * after live comparison — restructures the card itself: a solid --primary
 * side panel (not a tint) carrying a diagonal-hairline texture and the quote
 * glyph, full-bleed color rather than a badge or type treatment layered on
 * an otherwise-identical card.
 */
export type SourceStyle = "default" | "stamp" | "quote" | "rail";

const SourceStyleContext = createContext<SourceStyle>("default");

export const SourceStyleProvider = SourceStyleContext.Provider;

export function useSourceStyle() {
  return useContext(SourceStyleContext);
}
