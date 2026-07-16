// Mock AI layer for CanvasRx's prototype pass.
//
// SEAMS FOR REAL LLM INTEGRATION LATER:
// - getInitialCanvas(chatText)   -> replace with an LLM call that extracts entities/
//   sentiment from chatText and proactively drafts suggestion + counter-argument pairs
//   (PRD Section 7 sourcing, vector DB matching).
// - getNodeResponse(...)         -> replace with an LLM call that reads the node's full
//   thread (ancestors) plus the new comment and drafts the next revision.
// - getOptionResponse(...)       -> replace with an LLM call that branches on the picked
//   option using the same context.
// All three currently return canned, randomly-delayed data with no real reasoning.

import type {
  CanvasGraph,
  CanvasNodeData,
  CanvasEdgeData,
  OptionSet,
  FeedbackContext,
} from "./types";

export const MAX_BRANCH_DEPTH = 4;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function delay() {
  return sleep(500 + Math.random() * 1000);
}

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function edge(source: string, target: string): CanvasEdgeData {
  return { id: `e-${source}-${target}`, source, target };
}

const MOCK_MATCH_FACTORS = [
  { label: "Team size fit", weight: 34 },
  { label: "Stated pain points", weight: 28 },
  { label: "Budget band", weight: 21 },
  { label: "Peer adoption in cohort", weight: 17 },
];

function mockPeerOutcome(cohortSize: number, definition: string): CanvasNodeData["peerOutcome"] {
  return {
    cohortSize,
    cohortDefinition: definition,
    bars: [42, 58, 71, 65, 80, 74],
  };
}

/**
 * Fake async: build the initial canvas from a one-shot chat entry.
 * Returns the Source node plus the AI's proactive first-pass branching —
 * suggestion + counter-argument node pairs, some rendered as A/B/C option sets.
 */
export async function getInitialCanvas(chatText: string): Promise<CanvasGraph> {
  await delay();

  const sourceId = id("source");

  const source: CanvasNodeData = {
    id: sourceId,
    kind: "source",
    title: "What you wrote",
    body: chatText,
    parentId: null,
    depth: 0,
    selected: false,
    highlights: [
      {
        id: id("hl"),
        text: extractSnippet(chatText, 0),
        primaryTag: "Team process",
        secondaryTags: ["Growth stage"],
      },
      {
        id: id("hl"),
        text: extractSnippet(chatText, 1),
        primaryTag: "Tooling",
      },
    ],
  };

  const recA: CanvasNodeData = {
    id: id("rec"),
    kind: "recommendation",
    title: "Async-first standups",
    body: "Switch daily standups to an async written thread. Teams your size usually see meeting load drop within two weeks, without losing visibility.",
    parentId: sourceId,
    depth: 1,
    selected: false,
    matchScore: 87,
    retentionRate: 88,
    transparency: "organic",
    matchFactors: MOCK_MATCH_FACTORS,
    peerOutcome: mockPeerOutcome(412, "teams, 1–10 people, last 12 months"),
  };

  const counterA: CanvasNodeData = {
    id: id("counter"),
    kind: "counter-argument",
    title: "Counter-argument",
    body: "Async standups can hide blockers longer if your team doesn't already write clearly — worth pairing with a weekly live sync for the first month.",
    parentId: sourceId,
    depth: 1,
    selected: false,
  };

  const optionSet: OptionSet = {
    id: id("opts"),
    prompt: "Which best describes why planning keeps slipping?",
    choices: [
      { id: "A", label: "Too many priorities in flight", description: "Work is spread thin across parallel initiatives." },
      { id: "B", label: "Unclear ownership", description: "Tasks stall because it's unclear who's accountable." },
      { id: "C", label: "Estimation is consistently off", description: "Work reliably takes longer than planned." },
    ],
  };

  const recB: CanvasNodeData = {
    id: id("rec"),
    kind: "recommendation",
    title: "Narrow the active work-in-progress",
    body: "A few teams in your situation get more reliable delivery by first narrowing down what's actively in flight, before changing tools or process.",
    parentId: sourceId,
    depth: 1,
    selected: false,
    optionSet,
  };

  const counterB: CanvasNodeData = {
    id: id("counter"),
    kind: "counter-argument",
    title: "Counter-argument",
    body: "If the real issue is external dependencies rather than internal focus, narrowing WIP alone won't fix the slippage — worth ruling that out first.",
    parentId: sourceId,
    depth: 1,
    selected: false,
  };

  const nodes = [source, recA, counterA, recB, counterB];
  const edges = [
    edge(sourceId, recA.id),
    edge(sourceId, counterA.id),
    edge(sourceId, recB.id),
    edge(sourceId, counterB.id),
  ];

  return { nodes, edges };
}

/**
 * Fake async: submit a highlight+comment on any node. Returns a new revision
 * node (v2, v3, ...) linked to the commented-on node, plus its edge.
 */
export async function getNodeResponse(
  node: CanvasNodeData,
  commentText: string,
  feedbackContext?: FeedbackContext
): Promise<{ node: CanvasNodeData; edge: CanvasEdgeData }> {
  await delay();

  const nextDepth = node.depth + 1;
  const nextVersion = (node.version ?? 1) + 1;

  if (nextDepth > MAX_BRANCH_DEPTH) {
    const clarifying: CanvasNodeData = {
      id: id("clarify"),
      kind: "clarifying-question",
      title: "One more thing before I can refine this further",
      body: `We've gone a few rounds here — before branching again: what's the single constraint that matters most to you on "${node.title}"? (time, budget, or team buy-in?)`,
      parentId: node.id,
      depth: nextDepth,
      selected: false,
    };
    return { node: clarifying, edge: edge(node.id, clarifying.id) };
  }

  const { delta, matchedLiked } = biasFor(`${node.title} ${node.body}`, feedbackContext);
  let body = reviseBody(node.body, commentText);
  if (matchedLiked) {
    body += `\n\n(Weighted toward the "${matchedLiked}" theme you liked.)`;
  }

  const revision: CanvasNodeData = {
    id: id("rev"),
    kind: "revision",
    title: `${baseTitle(node)} (v${nextVersion})`,
    body,
    parentId: node.id,
    depth: nextDepth,
    selected: false,
    previousVersionId: node.id,
    version: nextVersion,
    matchScore:
      node.matchScore != null ? clamp(node.matchScore + swing() + delta, 40, 99) : undefined,
    retentionRate:
      node.retentionRate != null
        ? clamp(node.retentionRate + swing() + delta, 40, 99)
        : undefined,
    transparency: node.transparency,
    matchFactors: node.matchFactors,
    peerOutcome: node.peerOutcome,
  };

  return { node: revision, edge: edge(node.id, revision.id) };
}

/**
 * Fake async: user picked an A/B/C option on a node's option set. Returns a
 * fresh recommendation + counter-argument pair rooted at that choice — the
 * same proactive-branching pattern as getInitialCanvas, one level deeper —
 * so picking an option opens up a new "what do you want to do here" moment
 * instead of a dead-end single node.
 */
export async function getOptionResponse(
  node: CanvasNodeData,
  selectedOptionId: string,
  feedbackContext?: FeedbackContext
): Promise<{ nodes: CanvasNodeData[]; edges: CanvasEdgeData[] }> {
  await delay();

  const choice = node.optionSet?.choices.find((c) => c.id === selectedOptionId);
  const nextDepth = node.depth + 1;

  const { delta, matchedLiked } = biasFor(
    `${node.title} ${choice?.label ?? ""} ${choice?.description ?? ""}`,
    feedbackContext
  );

  let body = choice
    ? `Since "${choice.description}" — try tightening scope reviews to once a week and capping active workstreams at 3 per person before revisiting tooling.`
    : "Here's a tailored next step based on what you picked.";
  if (matchedLiked) {
    body += `\n\n(Weighted toward the "${matchedLiked}" theme you liked.)`;
  }

  const branch: CanvasNodeData = {
    id: id("branch"),
    kind: "recommendation",
    title: choice ? `Given: ${choice.label}` : "Branch",
    body,
    parentId: node.id,
    depth: nextDepth,
    selected: false,
    matchScore: clamp(79 + delta, 40, 99),
    retentionRate: clamp(81 + delta, 40, 99),
    transparency: "sponsored",
    matchFactors: MOCK_MATCH_FACTORS,
    peerOutcome: mockPeerOutcome(268, "teams that picked this option, last 12 months"),
  };

  const counter: CanvasNodeData = {
    id: id("counter"),
    kind: "counter-argument",
    title: "Counter-argument",
    body: choice
      ? `Worth checking first: if "${choice.label.toLowerCase()}" isn't actually the root cause, this fix won't stick — confirm it before committing the team's time.`
      : "Worth validating this is the actual root cause before committing time to it.",
    parentId: node.id,
    depth: nextDepth,
    selected: false,
  };

  return {
    nodes: [branch, counter],
    edges: [edge(node.id, branch.id), edge(node.id, counter.id)],
  };
}

function baseTitle(node: CanvasNodeData) {
  return node.title.replace(/\s\(v\d+\)$/, "");
}

function reviseBody(original: string, comment: string) {
  return `${original}\n\nRevised per your note ("${comment.trim()}"): adjusted to weigh that in directly.`;
}

function swing() {
  return Math.round((Math.random() - 0.3) * 10);
}

/**
 * Mock feedback loop: if the text being branched from touches a theme the
 * user liked/disliked (via the hover menu), nudge the score and — when a
 * liked theme actually matched — say so in the generated body.
 */
function biasFor(
  text: string,
  feedbackContext?: FeedbackContext
): { delta: number; matchedLiked?: string } {
  if (!feedbackContext) return { delta: 0 };
  const lower = text.toLowerCase();
  const matchedLiked = feedbackContext.liked.find((t) => lower.includes(t.toLowerCase()));
  const matchedDisliked = feedbackContext.disliked.find((t) =>
    lower.includes(t.toLowerCase())
  );
  let delta = 0;
  if (matchedLiked) delta += 8;
  if (matchedDisliked) delta -= 8;
  return { delta, matchedLiked };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function extractSnippet(text: string, index: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return text.slice(0, 24) || "this";
  const start = Math.min(index * 6, Math.max(words.length - 4, 0));
  return words.slice(start, start + 4).join(" ");
}
