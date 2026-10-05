"use client";

import { createContext, useContext } from "react";

/**
 * The card Spark will test: the last card the user clicked. Kept in
 * canvas-screen.tsx state, not in React Flow's own `selected`, because the
 * canvas rebuilds its React Flow nodes on every graph change and that would
 * drop the selection. A context, not node data, so moving the selection
 * re-renders only the cards and never rebuilds the node list.
 */
export const SparkTargetContext = createContext<string | null>(null);

export function useIsSparkTarget(nodeId: string): boolean {
  return useContext(SparkTargetContext) === nodeId;
}
