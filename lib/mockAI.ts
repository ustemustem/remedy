// Mock AI layer for CanvasRx's prototype pass.
//
// SEAMS FOR REAL LLM INTEGRATION LATER:
// - getInitialCanvas(chatText)   -> replace with an LLM call that extracts entities/
//   sentiment from chatText and proactively drafts suggestion + counter-argument pairs
//   (PRD Section 7 sourcing, vector DB matching).
// - getOptionResponse(...)       -> replace with an LLM call that branches on the picked
//   option using the same context.
// - getPreferredContinuation(...) -> replace with an LLM call that continues the
//   preferred direction using the same context.
// - classifyNote(...)            -> replace with a real classifier call. Keyword
//   heuristics are fine for the mock; call sites only ever see the two labels.
// - refinePlainCard / refineChoiceOptions / branchFromNote / branchFromChoiceFraming
//   -> replace with LLM calls that read the note plus the card's own ancestor chain.
// All currently return canned, randomly-delayed data with no real reasoning.
// None of the depth-capping below is a hard wall — see shouldConclude.

import type {
  CanvasGraph,
  CanvasNodeData,
  CanvasEdgeData,
  ChoiceOption,
  FeedbackContext,
  SummarySegment,
  ReadoutSegment,
  SessionStats,
  FitSignal,
  EvidenceExample,
  ReportData,
} from "./types";
import type { DashboardNeed, ThemeEntry } from "./graph";
import { deriveDashboardNeeds, deriveThemeEntries, deriveSessionStats } from "./graph";
import {
  mapSummarySegments,
  mapReadoutSegments,
  fallbackUnderstoodSummary,
  fallbackSessionReadout,
  computeCompositeFit,
} from "./report-segments";

/**
 * Real generateReport (Phase 3d) — orchestrates the fast report seams behind the
 * loader (summary + readout + fit, in parallel) and returns them so the report
 * renders fully-loaded without re-fetching. Grounded evidence is deliberately
 * left out: it is slow (web_search) and loads progressively per card. The
 * ReportLoader awaits this promise (with its own MIN_VISIBLE_MS floor +
 * CEILING_MS timeout race), so its stages now track real work, not a fake timer.
 */
export async function generateReport(graph: CanvasGraph): Promise<ReportData> {
  const needs = deriveDashboardNeeds(graph.nodes);
  const themes = deriveThemeEntries(graph.nodes);
  const stats = deriveSessionStats(graph.nodes);
  const vent = graph.nodes.find((n) => n.kind === "source")?.body ?? "";
  const [summary, readout, fits] = await Promise.all([
    getUnderstoodSummary(needs, vent),
    getSessionReadout(stats, themes),
    getFitSignals(vent, needs),
  ]);
  return { summary, readout, fits };
}

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function edge(source: string, target: string): CanvasEdgeData {
  return { id: `e-${source}-${target}`, source, target };
}

/**
 * Real getUnderstoodSummary (Phase 3c) — POSTs the vent + kept needs to the
 * report route (Haiku, key server-side) and maps the model's index-based
 * segments back onto node ids. Falls back to the deterministic template on any
 * error or offline, so the report always renders honest, session-faithful text.
 */
export async function getUnderstoodSummary(
  needs: DashboardNeed[],
  vent = ""
): Promise<SummarySegment[]> {
  if (needs.length === 0) return [];
  try {
    const res = await fetch("/api/report/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vent,
        needs: needs.map((n) => ({ label: baseTitle(n.node), quote: n.quote })),
      }),
    });
    if (!res.ok) throw new Error(`summary ${res.status}`);
    const { segments } = (await res.json()) as {
      segments: { content: string; refIndex: number | null }[];
    };
    return mapSummarySegments(segments, needs);
  } catch {
    return fallbackUnderstoodSummary(needs);
  }
}

/**
 * Real getSessionReadout (Phase 3c) — POSTs real session stats + themes to the
 * report route (Haiku) and returns the "how we read your situation" paragraph.
 * Falls back to the deterministic template on any error/offline. Replaces the
 * former synchronous buildSessionReadout.
 */
export async function getSessionReadout(
  stats: SessionStats,
  themes: ThemeEntry[]
): Promise<ReadoutSegment[]> {
  try {
    const res = await fetch("/api/report/readout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stats,
        themes: themes.map((t) => ({ theme: t.theme, type: t.type })),
      }),
    });
    if (!res.ok) throw new Error(`readout ${res.status}`);
    const { segments } = (await res.json()) as {
      segments: { content: string; emphasis: boolean }[];
    };
    return mapReadoutSegments(segments);
  } catch {
    return fallbackSessionReadout(stats, themes);
  }
}

/**
 * Real getFitSignals (Phase 3a) — POSTs the vent + kept recommendations to the
 * report route (Sonnet), returning one FitSignal per need in order. The
 * composite is computed in code (50/50). On any error/offline returns [] so the
 * report omits fit rather than showing a fabricated number.
 */
export async function getFitSignals(vent: string, needs: DashboardNeed[]): Promise<FitSignal[]> {
  if (needs.length === 0) return [];
  try {
    const res = await fetch("/api/report/fit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vent,
        needs: needs.map((n) => ({ label: baseTitle(n.node), body: n.node.body })),
      }),
    });
    if (!res.ok) throw new Error(`fit ${res.status}`);
    const { fits } = (await res.json()) as { fits: Omit<FitSignal, "score">[] };
    return fits.map((f) => ({ ...f, score: computeCompositeFit(f.coverageScore, f.confidenceScore) }));
  } catch {
    return [];
  }
}

/**
 * Real getGroundedEvidence (Phase 3b) — POSTs the vent + recommendations to the
 * ground route (web_search + extraction per need), returning cited evidence per
 * need in order. On any error/offline returns [] per need so evidence is omitted
 * (no fabricated fallback).
 */
export async function getGroundedEvidence(
  vent: string,
  needs: DashboardNeed[]
): Promise<EvidenceExample[][]> {
  if (needs.length === 0) return [];
  try {
    const res = await fetch("/api/report/ground", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vent,
        needs: needs.map((n) => ({ label: baseTitle(n.node), body: n.node.body })),
      }),
    });
    if (!res.ok) throw new Error(`ground ${res.status}`);
    const { evidence } = (await res.json()) as { evidence: EvidenceExample[][] };
    return evidence;
  } catch {
    return needs.map(() => []);
  }
}

/**
 * Fake async: build the initial canvas from a one-shot chat entry.
 * Returns the Source node plus the AI's proactive first-pass branch — a
 * single recommendation + counter-argument pair, drafted together but
 * placed in two separate paths from the start (a suggestion and its
 * counter-argument grow in different directions, so they never shared a
 * path to begin with). Starting with just one pair per kind (rather than
 * several suggestions in parallel) keeps the canvas legible on arrival;
 * further paths open only as the user's own choices warrant them (see
 * getOptionResponse's finalize-graduates-a-new-path behavior). The
 * suggestion is a "choice" card (asking which framing fits before
 * proposing anything); the counter-argument is a "plain" card (a proposal,
 * `Prefer this option` only) — see lib/types.ts's cardType.
 */
/**
 * Real getInitialCanvas — POSTs the vent to the server route (which runs the
 * LLM with the key held server-side) and returns the assembled CanvasGraph.
 * Same signature the front end always used; only the internals changed from
 * canned data to a real call (backend roadmap Phase 1). The vent -> Suggestion
 * + Counter-argument pair (or a clarifying framing when the input is thin) is
 * produced server-side in lib/llm/initial-canvas.ts.
 */
export async function getInitialCanvas(chatText: string): Promise<CanvasGraph> {
  const res = await fetch("/api/canvas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatText }),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? `Canvas generation failed (${res.status}).`);
  }
  const data = (await res.json()) as { graph: CanvasGraph };
  return data.graph;
}

/**
 * Mock stand-in for "the model recognizes the conversation has converged" —
 * every branching path here used to stop at a hard MAX_BRANCH_DEPTH wall
 * (4); this replaces it with a probability that climbs with depth instead.
 * There's no cutoff a chain literally cannot cross, but in practice a chain
 * converges to a conclusion within a handful of turns — depth 1-2 almost
 * never concludes, depth ~4 is a coin flip, depth 7-8+ is very likely done.
 * A stronger accumulated like/dislike signal (the user steering more
 * decisively) nudges the model toward concluding sooner too.
 */
function conclusionChance(nextDepth: number, feedbackContext?: FeedbackContext): number {
  const base = 1 - Math.exp(-0.18 * Math.max(0, nextDepth - 1));
  const signalCount = feedbackContext
    ? feedbackContext.liked.length + feedbackContext.disliked.length
    : 0;
  const bump = signalCount > 0 ? 0.1 : 0;
  return Math.min(0.97, base + bump);
}

function shouldConclude(nextDepth: number, feedbackContext?: FeedbackContext): boolean {
  return Math.random() < conclusionChance(nextDepth, feedbackContext);
}

function clarifyingNode(
  parentId: string,
  depth: number
): { node: CanvasNodeData; edge: CanvasEdgeData } {
  const clarifying: CanvasNodeData = {
    id: id("clarify"),
    kind: "clarifying-question",
    title: "Based on what you picked, I have a recommendation ready for you.",
    body: "",
    parentId,
    depth,
    selected: false,
  };
  return { node: clarifying, edge: edge(parentId, clarifying.id) };
}

/**
 * Fake async: the user explicitly preferred a node and wants to continue in
 * that direction ("Prefer this option"). Unlike a revision — which rewrites
 * the card where it stands — this always appends a brand new CHILD node one
 * depth down. The preferred card stays fully visible on the canvas; only
 * the "Selected" mark moves onto this new continuation (handled by the
 * caller).
 */
export async function getPreferredContinuation(
  node: CanvasNodeData,
  feedbackContext?: FeedbackContext
): Promise<{ node: CanvasNodeData; edge: CanvasEdgeData }> {
  const nextDepth = node.depth + 1;

  if (shouldConclude(nextDepth, feedbackContext)) {
    return clarifyingNode(node.id, nextDepth);
  }

  const res = await fetch("/api/canvas/prefer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: baseTitle(node),
      body: node.body,
      kind: node.kind,
      liked: feedbackContext?.liked ?? [],
      disliked: feedbackContext?.disliked ?? [],
    }),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? `Continuation failed (${res.status}).`);
  }
  const { continuation } = (await res.json()) as { continuation: { title: string; body: string } };

  const now = new Date().toISOString();
  const next: CanvasNodeData = {
    id: id("next"),
    // Continuing a card keeps its own kind — a counter-argument "Prefer"'d
    // into its next step is still a counter-argument, not a suggestion.
    kind: node.kind,
    title: continuation.title,
    body: continuation.body,
    parentId: node.id,
    depth: nextDepth,
    selected: false,
    cardType: "plain",
    revisions: [
      { revision: 1, title: continuation.title, body: continuation.body, note: null, createdAt: now },
    ],
    activeRevision: 1,
    origin: null,
    createdUnderRevision: node.activeRevision ?? 1,
    // No fabricated numbers carried over — the fit signal and evidence are Phase 3.
    groupId: node.groupId,
    groupLabel: node.groupLabel,
  };

  return { node: next, edge: edge(node.id, next.id) };
}

/**
 * Fake async: user picked an A/B/C option on a choice card. Returns one to
 * two nodes rooted at that choice — always a recommendation, plus a
 * counter-argument some of the time (a real LLM wouldn't manufacture a
 * counter-argument when it doesn't have a genuinely useful one to make; how
 * often depends on whether this user has liked or disliked counter-arguments
 * before — see counterArgumentChance). The two never share a path: the
 * recommendation stays in the picked node's branch-framing group — it's
 * still the same suggestion, how ever many picks or revisions deep — while
 * the counter-argument gets its own fresh path immediately, since it's a
 * different direction from the suggestion it's responding to, not a
 * variant of it.
 */
export async function getOptionResponse(
  node: CanvasNodeData,
  selectedIndex: number,
  feedbackContext?: FeedbackContext
): Promise<{ nodes: CanvasNodeData[]; edges: CanvasEdgeData[] }> {
  const nextDepth = node.depth + 1;

  // Depth-cap / conclusion stays in code (roadmap §02) — no LLM call needed
  // to decide the conversation has converged.
  if (shouldConclude(nextDepth, feedbackContext)) {
    const { node: clarifying, edge: e } = clarifyingNode(node.id, nextDepth);
    return { nodes: [clarifying], edges: [e] };
  }

  const choice = node.options?.[selectedIndex];
  const res = await fetch("/api/canvas/option", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      parentTitle: baseTitle(node),
      parentBody: node.body,
      option: choice ? { title: choice.title, subtitle: choice.subtitle } : null,
      liked: feedbackContext?.liked ?? [],
      disliked: feedbackContext?.disliked ?? [],
    }),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? `Option response failed (${res.status}).`);
  }
  const { recommendation, counterArgument } = (await res.json()) as {
    recommendation: { title: string; body: string };
    counterArgument: { title: string; body: string } | null;
  };

  // The model produced the CONTENT; the code owns the structure (ids, groups,
  // depth, edges). No fabricated numbers — the fit signal and evidence are
  // Phase 3. The rebuttal counter-argument stays in the same path as the
  // recommendation it responds to (shared groupId), matching the prior shape.
  const now = new Date().toISOString();
  const branch: CanvasNodeData = {
    id: id("branch"),
    kind: "recommendation",
    title: recommendation.title,
    body: recommendation.body,
    parentId: node.id,
    depth: nextDepth,
    selected: false,
    cardType: "plain",
    revisions: [
      { revision: 1, title: recommendation.title, body: recommendation.body, note: null, createdAt: now },
    ],
    activeRevision: 1,
    origin: null,
    createdUnderRevision: node.activeRevision ?? 1,
    groupId: node.groupId,
    groupLabel: node.groupLabel,
  };

  const nodes: CanvasNodeData[] = [branch];
  if (counterArgument) {
    nodes.push({
      id: id("counter"),
      kind: "counter-argument",
      title: counterArgument.title,
      body: counterArgument.body,
      parentId: node.id,
      depth: nextDepth,
      selected: false,
      cardType: "plain",
      revisions: [
        {
          revision: 1,
          title: counterArgument.title,
          body: counterArgument.body,
          note: null,
          createdAt: now,
        },
      ],
      activeRevision: 1,
      origin: null,
      createdUnderRevision: node.activeRevision ?? 1,
      groupId: node.groupId,
      groupLabel: node.groupLabel,
    });
  }

  return { nodes, edges: nodes.map((n) => edge(node.id, n.id)) };
}

// ---------------------------------------------------------------------------
// Context-note model
// ---------------------------------------------------------------------------

export type NoteIntent = "refine_in_place" | "branch_new_direction";

/**
 * Classifies a context note into one of two intents. Defaults to
 * `refine_in_place` — a note only branches when it clearly signals "this
 * card is wrong," not merely "adjust this."
 */
export async function classifyNote(text: string): Promise<NoteIntent> {
  const res = await fetch("/api/canvas/classify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note: text }),
  });
  if (!res.ok) {
    // Don't block the note on a classify failure — fall back to the safe intent.
    return "refine_in_place";
  }
  const { intent } = (await res.json()) as { intent: NoteIntent };
  return intent;
}


/**
 * `refine_in_place` on a PLAIN card — new title/body for the SAME node
 * (caller pushes this as a new CardRevision and bumps activeRevision; this
 * function never touches the graph itself).
 */
export async function refinePlainCard(
  node: CanvasNodeData,
  note: string,
  feedbackContext?: FeedbackContext
): Promise<{ title: string; body: string }> {
  const res = await fetch("/api/canvas/note", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      op: "refine-plain",
      parentTitle: baseTitle(node),
      parentBody: node.body,
      kind: node.kind,
      note,
      liked: feedbackContext?.liked ?? [],
      disliked: feedbackContext?.disliked ?? [],
    }),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? `Refine failed (${res.status}).`);
  }
  const { content } = (await res.json()) as { content: { title: string; body: string } };
  return content;
}

/**
 * `refine_in_place` on a CHOICE card — the option SET is regenerated, not
 * the card's own title/body (per the handoff: correcting a question means
 * "these options don't fit," not "the question's prose is wrong"). Any
 * prior pick is cleared by the caller.
 */
export async function refineChoiceOptions(
  node: CanvasNodeData,
  note: string,
  feedbackContext?: FeedbackContext
): Promise<ChoiceOption[]> {
  const res = await fetch("/api/canvas/note", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      op: "refine-options",
      parentTitle: node.question ?? baseTitle(node),
      parentBody: node.body,
      kind: node.kind,
      note,
      liked: feedbackContext?.liked ?? [],
      disliked: feedbackContext?.disliked ?? [],
    }),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? `Refine options failed (${res.status}).`);
  }
  const { options } = (await res.json()) as { options: ChoiceOption[] };
  return options;
}

/**
 * `branch_new_direction` on a PLAIN card — a brand new card one depth
 * below, in the SAME kind as `node` (a counter-argument redirected is still
 * a counter-argument), carrying the note as its origin. Depth-capped the
 * same probabilistic way as every other branching path here.
 */
export async function branchFromNote(
  node: CanvasNodeData,
  note: string,
  feedbackContext?: FeedbackContext
): Promise<{ node: CanvasNodeData; edge: CanvasEdgeData }> {
  const nextDepth = node.depth + 1;

  if (shouldConclude(nextDepth, feedbackContext)) {
    return clarifyingNode(node.id, nextDepth);
  }

  const res = await fetch("/api/canvas/note", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      op: "branch-plain",
      parentTitle: baseTitle(node),
      parentBody: node.body,
      kind: node.kind,
      note,
      liked: feedbackContext?.liked ?? [],
      disliked: feedbackContext?.disliked ?? [],
    }),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? `Branch failed (${res.status}).`);
  }
  const { content } = (await res.json()) as { content: { title: string; body: string } };

  const now = new Date().toISOString();
  const branch: CanvasNodeData = {
    id: id("branch"),
    // A redirected card keeps its kind — a counter-argument branched is still
    // a counter-argument (the prompt is told to keep it a caution).
    kind: node.kind,
    title: content.title,
    body: content.body,
    parentId: node.id,
    depth: nextDepth,
    selected: false,
    cardType: "plain",
    revisions: [
      { revision: 1, title: content.title, body: content.body, note: null, createdAt: now },
    ],
    activeRevision: 1,
    origin: { intent: "branch_new_direction", note },
    createdUnderRevision: node.activeRevision ?? 1,
    // No fabricated numbers — the fit signal and evidence are Phase 3.
    groupId: node.groupId,
    groupLabel: node.groupLabel,
  };

  return { node: branch, edge: edge(node.id, branch.id) };
}

/**
 * `branch_new_direction` on a CHOICE card — the question is skipped
 * entirely; the user's own words become the accepted framing (caller sets
 * `userFraming` on the choice card itself), and this produces the same
 * shape of continuation `getOptionResponse` would after a picked option.
 */
export async function branchFromChoiceFraming(
  node: CanvasNodeData,
  framing: string,
  feedbackContext?: FeedbackContext
): Promise<{ node: CanvasNodeData; edge: CanvasEdgeData }> {
  const nextDepth = node.depth + 1;

  if (shouldConclude(nextDepth, feedbackContext)) {
    return clarifyingNode(node.id, nextDepth);
  }

  const res = await fetch("/api/canvas/note", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      op: "branch-framing",
      parentTitle: node.question ?? baseTitle(node),
      parentBody: node.body,
      kind: node.kind,
      note: framing,
      liked: feedbackContext?.liked ?? [],
      disliked: feedbackContext?.disliked ?? [],
    }),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? `Branch failed (${res.status}).`);
  }
  const { content } = (await res.json()) as { content: { title: string; body: string } };

  const now = new Date().toISOString();
  const branch: CanvasNodeData = {
    id: id("branch"),
    kind: "recommendation",
    title: content.title,
    body: content.body,
    parentId: node.id,
    depth: nextDepth,
    selected: false,
    cardType: "plain",
    revisions: [
      { revision: 1, title: content.title, body: content.body, note: null, createdAt: now },
    ],
    activeRevision: 1,
    // Skipping the A/B/C picker for your own words is just as much a redirect
    // as branchFromNote — the report's "From your note" marker
    // (need-summary-list.tsx) reads this same origin.intent, so both paths
    // set it the same way.
    origin: { intent: "branch_new_direction", note: framing },
    createdUnderRevision: node.activeRevision ?? 1,
    // No fabricated numbers — the fit signal and evidence are Phase 3.
    groupId: node.groupId,
    groupLabel: node.groupLabel,
  };

  return { node: branch, edge: edge(node.id, branch.id) };
}

function baseTitle(node: CanvasNodeData) {
  return node.title.replace(/\s\(v\d+\)$/, "");
}

