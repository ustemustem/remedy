// Shared canvas types for CanvasRx. See docs/CanvasRx_TASKS.md Phase 0.

export type NodeKind =
  | "source"
  | "recommendation"
  | "counter-argument"
  | "revision"
  | "clarifying-question";

/**
 * Context-note model: a card no longer spawns comment children when the
 * user corrects it — it carries its own edit history instead. Revision 1
 * is always the original content; each `refine_in_place` note pushes one
 * more entry and bumps `CanvasNodeData.activeRevision` to match.
 */
export interface CardRevision {
  revision: number;
  title: string;
  body: string;
  /** Choice cards only — the option set as of this revision, so "restore
   *  this version" can bring back the exact options a regenerated set
   *  replaced, not just the (unchanged) title/body. */
  options?: ChoiceOption[];
  /** The note that produced this revision; null for revision 1. */
  note: string | null;
  createdAt: string;
}

/** Why the card currently showing looks the way it does — drives the
 *  origin strip. Absent (or null) for untouched original content. */
export interface CardOrigin {
  intent: "refine_in_place" | "branch_new_direction";
  note: string;
}

/** A choice card's single option — deliberately just title/subtitle, no id;
 *  choices are addressed by array index (`picked`) since they're
 *  regenerated wholesale on `refine_in_place`, never edited individually. */
export interface ChoiceOption {
  title: string;
  subtitle: string;
}

export interface HighlightSpan {
  id: string;
  text: string;
  primaryTag: string;
  secondaryTags?: string[];
}

export interface PeerOutcome {
  cohortSize: number;
  cohortDefinition: string;
  bars: number[]; // relative bar heights, 0-100
}

export interface MatchFactor {
  label: string;
  weight: number; // 0-100
}

export interface CanvasNodeData {
  id: string;
  kind: NodeKind;
  title: string;
  body: string;
  /** id of the node this one branches/derives from, null for the source node */
  parentId: string | null;
  /** branch depth from the source node; used to cap revision chains */
  depth: number;
  /** true once the user has explicitly marked this node "Select" */
  selected: boolean;
  /**
   * Independent of `selected` — a lightweight thumbs up/down signal the user
   * can leave on ANY node (whether or not it's the one they end up picking),
   * purely to steer the mock AI's later suggestions.
   */
  feedback?: "like" | "dislike";
  /** pre-existing highlights the AI proactively placed on this node's body */
  highlights?: HighlightSpan[];
  /** for revision nodes: the node this one supersedes, kept collapsed behind it.
   *  Legacy — nothing currently writes this; superseded by `revisions` below. */
  previousVersionId?: string | null;
  /** for revision nodes: v2, v3, ... (source/first-pass nodes are implicitly v1).
   *  Legacy — nothing currently writes this; superseded by `activeRevision`. */
  version?: number;
  /**
   * Context-note model — "plain" (a proposal with a `Prefer this option`
   * action) or "choice" (asking which framing fits before proposing
   * anything). Undefined for source/clarifying-question nodes, which don't
   * take notes at all.
   */
  cardType?: "plain" | "choice";
  /** Full edit history for this card; revision 1 = original. Undefined for
   *  source/clarifying-question nodes. */
  revisions?: CardRevision[];
  /** Which entry in `revisions` is currently showing as this node's
   *  title/body. */
  activeRevision?: number;
  /** Set when the CURRENT active revision (or, for a branched card, the
   *  card itself) came from a context note — drives the origin strip.
   *  Null/undefined for untouched original content. */
  origin?: CardOrigin | null;
  /**
   * Which revision of this node's PARENT was active when this node was
   * created — lets a revised parent's downstream subtree go stale (hidden,
   * never deleted) without losing it: reverting the parent back to this
   * revision brings the matching subtree back automatically. Undefined for
   * the source node and any node whose parent doesn't carry revisions.
   */
  createdUnderRevision?: number;
  /** Choice cards only — the framing question being asked. */
  question?: string;
  /** Choice cards only — the current option set (regenerated wholesale on
   *  `refine_in_place`, never edited per-option). */
  options?: ChoiceOption[];
  /** Choice cards only — index into `options`, or null before a pick. */
  picked?: number | null;
  /** Choice cards only — set when the user answered in their own words
   *  instead of picking an option (a `branch_new_direction` note). The
   *  question/options are hidden and this is echoed back as the accepted
   *  framing. */
  userFraming?: string | null;
  /**
   * Groups this node into a path for the branch-framing prototype. A
   * suggestion (recommendation) chain and its counter-argument are always
   * different paths from the moment each is created — they diverge, so
   * they never share one — no matter how many revisions, option-picks, or
   * "Prefer this option" continuations happen along the way.
   */
  groupId?: string;
  /** display label for the branch-framing prototype's group frame */
  groupLabel?: string;
  /** dashboard-only fields, present on recommendation/counter-argument/revision nodes */
  matchScore?: number;
  retentionRate?: number;
  peerOutcome?: PeerOutcome;
  transparency?: "organic" | "sponsored";
  matchFactors?: MatchFactor[];
}

export interface CanvasEdgeData {
  id: string;
  source: string;
  target: string;
}

export interface CanvasGraph {
  nodes: CanvasNodeData[];
  edges: CanvasEdgeData[];
}

export type Step = "chat" | "canvas" | "dashboard";

/** Themes pulled from liked/disliked nodes — steers the mock AI's later output. */
export interface FeedbackContext {
  liked: string[];
  disliked: string[];
}
