import type { CanvasNodeData, FeedbackContext } from "./types";

/** Ids of nodes that have since been revised — i.e. no longer the current version. */
export function getSupersededIds(nodes: CanvasNodeData[]): Set<string> {
  return new Set(
    nodes.filter((n) => n.previousVersionId).map((n) => n.previousVersionId as string)
  );
}

/** Walk a parentId chain forward past any superseded (hidden) ancestors. */
export function resolveVisibleParentId(
  parentId: string | null,
  byId: Map<string, CanvasNodeData>,
  supersededIds: Set<string>
): string | null {
  let pid = parentId;
  while (pid && supersededIds.has(pid)) {
    pid = byId.get(pid)?.parentId ?? null;
  }
  return pid;
}

/**
 * Collapse every liked/disliked node into a set of theme labels — reuses a
 * node's existing highlight tags where present, otherwise falls back to a
 * cleaned-up version of its title. Feeds mockAI's bias logic and the
 * "Etkilenen temalar" header strip.
 */
export function deriveFeedbackContext(nodes: CanvasNodeData[]): FeedbackContext {
  const liked = new Set<string>();
  const disliked = new Set<string>();

  for (const n of nodes) {
    if (!n.feedback) continue;
    const bucket = n.feedback === "like" ? liked : disliked;
    for (const theme of themesForNode(n)) bucket.add(theme);
  }

  return { liked: Array.from(liked), disliked: Array.from(disliked) };
}

function themesForNode(n: CanvasNodeData): string[] {
  if (n.highlights && n.highlights.length > 0) {
    return n.highlights.map((h) => h.primaryTag);
  }
  return [n.title.replace(/\s\(v\d+\)$/, "").replace(/^Given:\s*/, "")];
}

/** A theme label paired with the like/dislike it came from and the node(s) that carry it. */
export interface ThemeEntry {
  theme: string;
  type: "like" | "dislike";
  nodeIds: string[];
}

/**
 * Same theme extraction as deriveFeedbackContext, but keeps each theme's
 * originating node ids around — powers the "Themes that influenced this"
 * panel's jump-to-card and inline unlike/undislike actions.
 */
export function deriveThemeEntries(nodes: CanvasNodeData[]): ThemeEntry[] {
  const byKey = new Map<string, ThemeEntry>();

  for (const n of nodes) {
    if (!n.feedback) continue;
    for (const theme of themesForNode(n)) {
      const key = `${n.feedback}:${theme}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.nodeIds.push(n.id);
      } else {
        byKey.set(key, { theme, type: n.feedback, nodeIds: [n.id] });
      }
    }
  }

  return Array.from(byKey.values());
}
