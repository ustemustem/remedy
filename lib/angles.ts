/**
 * Spark's three angles. Spark tests one card from another angle: it opens a
 * new card that shows the side of that card the user missed. It does not make
 * new ideas. See docs/handoff-canvas-dock.md, section E.
 */

import type { CanvasNodeData } from "./types";

export type AngleId = "pushback" | "risk" | "step";

export interface AngleMeta {
  id: AngleId;
  /** The question on the new card's strip. */
  question: string;
  /** The Spark button's stage label while this angle is written. */
  stage: string;
}

export const ANGLES: Record<AngleId, AngleMeta> = {
  pushback: { id: "pushback", question: "Who pushes back", stage: "Finding who pushes back…" },
  risk: { id: "risk", question: "What could go wrong", stage: "Looking for what breaks…" },
  step: { id: "step", question: "Smallest step this week", stage: "Shrinking it to one step…" },
};

export const ANGLE_IDS: AngleId[] = ["pushback", "risk", "step"];

/** The first stage label, shown before the angle is known. */
export const SPARK_FIRST_STAGE = "Turning the card…";

/** Angles already opened on this card: its angle children. */
export function usedAngles(card: CanvasNodeData, nodes: CanvasNodeData[]): AngleId[] {
  return nodes
    .filter((n) => n.parentId === card.id && n.kind === "angle" && n.angle)
    .map((n) => n.angle as AngleId);
}

/** Cards Spark can test. The end-of-path card is a conclusion, not a claim. */
export function canSpark(card: CanvasNodeData): boolean {
  return card.kind !== "clarifying-question" && !card.draft;
}
