// Shared canvas types for CanvasRx. See docs/CanvasRx_TASKS.md Phase 0.

export type NodeKind =
  | "source"
  | "recommendation"
  | "counter-argument"
  | "revision"
  | "clarifying-question";

export interface OptionChoice {
  id: string;
  label: string;
  description: string;
}

export interface OptionSet {
  id: string;
  prompt: string;
  choices: OptionChoice[];
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
  /** present when this node offers an A/B/C picker instead of a single suggestion */
  optionSet?: OptionSet;
  /** for revision nodes: the node this one supersedes, kept collapsed behind it */
  previousVersionId?: string | null;
  /** for revision nodes: v2, v3, ... (source/first-pass nodes are implicitly v1) */
  version?: number;
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
