import type { CanvasNodeData, FeedbackContext, PeerOutcome, SessionStats } from "./types";

/** Ids of nodes that have since been revised — i.e. no longer the current version. */
export function getSupersededIds(nodes: CanvasNodeData[]): Set<string> {
  return new Set(
    nodes.filter((n) => n.previousVersionId).map((n) => n.previousVersionId as string)
  );
}

/**
 * A node whose `createdUnderRevision` no longer matches its parent's
 * CURRENT `activeRevision` was created under a premise the parent has since
 * revised away — it (and everything below it, since this check walks the
 * whole ancestor chain) goes stale: hidden, never deleted. Reverting the
 * parent's `activeRevision` back to the matching one brings the subtree
 * back automatically, with no extra bookkeeping — see the context-note
 * model in lib/types.ts.
 */
export function isStale(node: CanvasNodeData, byId: Map<string, CanvasNodeData>): boolean {
  let current = node;
  while (current.parentId) {
    const parent = byId.get(current.parentId);
    if (!parent) return false;
    if (
      current.createdUnderRevision != null &&
      parent.activeRevision != null &&
      current.createdUnderRevision !== parent.activeRevision
    ) {
      return true;
    }
    current = parent;
  }
  return false;
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

/** One selected node, reshaped for the finalize dashboard's report layout. */
export interface DashboardNeed {
  node: CanvasNodeData;
  category: string;
  /** An actual excerpt from the user's original chat text, not invented copy. */
  quote: string;
  revisionCount: number;
  /** The sibling counter-argument this need's path won out over, if any. */
  eliminated?: CanvasNodeData;
  peerOutcome?: PeerOutcome;
}

/**
 * Reshapes the graph's currently-selected (non-superseded) nodes into
 * dashboard "needs" — everything here is derived from real graph data
 * (the Source node's highlighted excerpts, sibling counter-arguments,
 * revision counts via `version`), never fabricated content.
 */
export function deriveDashboardNeeds(nodes: CanvasNodeData[]): DashboardNeed[] {
  const supersededIds = getSupersededIds(nodes);
  const selectedNodes = nodes.filter((n) => n.selected && !supersededIds.has(n.id));
  const source = nodes.find((n) => n.kind === "source");
  const sourceHighlights = source?.highlights ?? [];

  return selectedNodes.map((node, i) => {
    const siblings = nodes.filter((n) => n.parentId === node.parentId && n.id !== node.id);
    const eliminated = siblings.find((n) => n.kind === "counter-argument" && !n.selected);

    const quote =
      sourceHighlights.length > 0
        ? sourceHighlights[i % sourceHighlights.length].text
        : (source?.body ?? node.body).slice(0, 90);

    return {
      node,
      category: node.highlights?.[0]?.primaryTag ?? themesForNode(node)[0] ?? "General",
      quote,
      revisionCount: (node.activeRevision ?? node.version ?? 1) - 1,
      eliminated,
      peerOutcome: node.peerOutcome,
    };
  });
}

/**
 * Report Section 3's hero/support/hidden ranking. Sorted by matchScore
 * descending (a missing score sorts last, never first). The first
 * non-sponsored item is always the hero — a paid placement never takes the
 * top slot, whatever its score. If every need is sponsored, there is no
 * hero at all: everything falls through to support/hidden in ranked order
 * rather than crashing or fabricating a hero.
 *
 * Dedup rule (owner decision, report redesign): a need sharing the hero's
 * `groupId` is dropped from support/hidden entirely, not just deprioritized.
 * `groupId` already tracks "same underlying recommendation, however many
 * revisions/continuations deep" (see CanvasNodeData.groupId) — a selected
 * node AND its own "Prefer this option" continuation both selected would
 * otherwise rank as two near-identical cards (same framing, different
 * matchScore). Only the hero's own chain is deduped; two DIFFERENT chains
 * that happen to look similar are left alone, since there's no rule today
 * for detecting content similarity across genuinely different chains.
 */
export interface DashboardFeed {
  hero: DashboardNeed | null;
  support: DashboardNeed[];
  hidden: DashboardNeed[];
}

export function deriveDashboardFeed(needs: DashboardNeed[]): DashboardFeed {
  const sorted = [...needs].sort(
    (a, b) => (b.node.matchScore ?? -Infinity) - (a.node.matchScore ?? -Infinity)
  );
  const hero = sorted.find((n) => n.node.transparency !== "sponsored") ?? null;
  const rest = sorted.filter((n) => {
    if (n === hero) return false;
    if (hero?.node.groupId && n.node.groupId === hero.node.groupId) return false;
    return true;
  });

  return {
    hero,
    support: rest.slice(0, 2),
    hidden: rest.slice(2),
  };
}

/** Section 3's "teams like you vs typical team" evidence comparison. */
export interface EvidenceComparison {
  you: number;
  typical: number;
  deltaPts: number;
}

/**
 * PeerOutcome doesn't carry an explicit "your segment" vs "typical team"
 * split yet (see Section 3 handoff open question 1) — real per-segment
 * values are expected once the planned LLM sourcing work lands and can
 * export whatever comparison fields it needs at that point. Until then
 * this is a documented mock rule, not a real derivation: the last bar
 * stands in for "your segment", the average of the rest for "typical
 * team". `PeerOutcome`'s shape is intentionally left alone rather than
 * growing new fields for a mock that's about to be replaced.
 */
export function deriveEvidenceComparison(peerOutcome?: PeerOutcome): EvidenceComparison | null {
  if (!peerOutcome || peerOutcome.bars.length === 0) return null;
  const bars = peerOutcome.bars;
  const you = bars[bars.length - 1];
  const rest = bars.slice(0, -1);
  const typical = rest.length > 0 ? rest.reduce((a, b) => a + b, 0) / rest.length : you;
  return {
    you: Math.round(you),
    typical: Math.round(typical),
    deltaPts: Math.round(you - typical),
  };
}

/**
 * Behavioral KPI counts for the reporting screen — every field counts an
 * existing, already-tracked signal (feedback, selected, groupId, picked,
 * userFraming, revisions[].note). No new state, no fabricated data.
 */
export function deriveSessionStats(nodes: CanvasNodeData[]): SessionStats {
  const pathIds = new Set<string>();
  let likeCount = 0;
  let dislikeCount = 0;
  let selectedCount = 0;
  let optionPickCount = 0;
  let ownFramingCount = 0;
  let noteCount = 0;

  for (const node of nodes) {
    if (node.feedback === "like") likeCount++;
    if (node.feedback === "dislike") dislikeCount++;
    if (node.selected) selectedCount++;
    if (node.groupId) pathIds.add(node.groupId);
    if (node.picked != null) optionPickCount++;
    if (node.userFraming) ownFramingCount++;
    for (const revision of node.revisions ?? []) {
      if (revision.note) noteCount++;
    }
  }

  return {
    likeCount,
    dislikeCount,
    selectedCount,
    pathCount: pathIds.size,
    optionPickCount,
    ownFramingCount,
    noteCount,
  };
}
