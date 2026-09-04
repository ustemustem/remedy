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
} from "./types";
import type { DashboardNeed, ThemeEntry } from "./graph";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function delay() {
  return sleep(500 + Math.random() * 1000);
}

/**
 * Fake async: the canvas -> report loading transition's own promise (see
 * animation handoff). Distinct from getUnderstoodSummary's per-paragraph
 * delay below — this represents the overall "generating your prescription"
 * work the loader animation is timed against, not a proxy for any one
 * section's fetch. Owner-confirmed real generation time is ~2.5-4s, longer
 * than any other mock delay in this file, which is why it's a separate
 * function rather than reusing `delay()`.
 */
function reportGenerationDelay() {
  return sleep(2500 + Math.random() * 1500);
}

export async function generateReport(): Promise<void> {
  await reportGenerationDelay();
}

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function edge(source: string, target: string): CanvasEdgeData {
  return { id: `e-${source}-${target}`, source, target };
}

function refFor(n: DashboardNeed): SummarySegment {
  return {
    type: "ref",
    content: n.node.title.replace(/\s\(v\d+\)$/, "").toLowerCase(),
    nodeId: n.node.id,
  };
}

function text(content: string): SummarySegment {
  return { type: "text", content };
}

/**
 * Fake async: mocked "what we understood" summary, built from the real
 * title/quote data `deriveDashboardNeeds` already derived — not invented
 * copy. Every need gets exactly one `ref` segment pointing at its own node
 * id, by construction — this mock can't currently produce a partial index
 * (see docs/DASHBOARD_REPORT_HANDOFF.md's Section 1 notes for why that's
 * an honest limitation of a templated mock, not a claim about how a real
 * LLM would behave here). The renderer's degrade path (no refs, or a ref
 * whose nodeId matches nothing) still has to exist for when this seam is
 * replaced with a real model call — see UnderstoodSummary.
 */
export async function getUnderstoodSummary(needs: DashboardNeed[]): Promise<SummarySegment[]> {
  await delay();

  if (needs.length === 0) return [];

  if (needs.length === 1) {
    return [text("You came in with one clear need: "), refFor(needs[0]), text(` — ${needs[0].quote}`)];
  }

  if (needs.length === 2) {
    return [text("You came in with two needs: "), refFor(needs[0]), text(" and "), refFor(needs[1]), text(".")];
  }

  const [first, ...rest] = needs;
  const segments: SummarySegment[] = [
    text(`You came in with ${needs.length} needs. The one shaping everything else was `),
    refFor(first),
    text(` — ${first.quote}. Around it sat `),
  ];
  rest.forEach((n, i) => {
    segments.push(refFor(n));
    if (i < rest.length - 2) segments.push(text(", "));
    else if (i === rest.length - 2) segments.push(text(", and "));
  });
  segments.push(text("."));
  return segments;
}

function emphasis(content: string): ReadoutSegment {
  return { content, emphasis: true };
}

function plain(content: string): ReadoutSegment {
  return { content };
}

/**
 * Templated (not async — no LLM seam intended here, just canned copy keyed
 * off real derived data, same spirit as getUnderstoodSummary): the "how we
 * read your situation" paragraph for report Section 2. Reads the same
 * SessionStats and ThemeEntry[] the strip and theme columns already derive,
 * so the three pieces never disagree with each other.
 */
/**
 * Report Section 2's reading paragraph interprets what the strip's counts
 * MEAN (focus, trustworthiness of the shortlist, how much correcting it
 * took) rather than restating them — the strip already shows the raw
 * numbers, so this sentence deliberately avoids repeating them back
 * (report redesign, change B8).
 */
export function buildSessionReadout(stats: SessionStats, themes: ThemeEntry[]): ReadoutSegment[] {
  const segments: ReadoutSegment[] = [];
  const liked = themes.filter((t) => t.type === "like");
  const disliked = themes.filter((t) => t.type === "dislike");

  // Clause 1: focus/breadth — how much exploring it took to get here.
  if (stats.pathCount === 0) {
    segments.push(plain("Nothing here needed a detour, "), emphasis("you knew what fit"), plain(" from the first pass."));
  } else if (stats.pathCount <= stats.selectedCount) {
    segments.push(plain("A "), emphasis("focused search"), plain(": what you explored converged fast."));
  } else {
    segments.push(plain("You "), emphasis("cast a wide net"), plain(" before narrowing down. What made the cut had to earn it."));
  }

  // Clause 2: trustworthiness — how the shortlist held up to feedback.
  if (disliked.length === 0 && liked.length > 0) {
    segments.push(plain(" Nothing drew pushback, "), emphasis("a strong signal"), plain(" this shortlist holds up."));
  } else if (disliked.length > 0 && liked.length > disliked.length) {
    segments.push(plain(" More approval than pushback here: it survived "), emphasis("real scrutiny"), plain(", not just a first look."));
  } else if (disliked.length > 0) {
    segments.push(plain(" You read this "), emphasis("critically"), plain(": what's left reflects genuine scrutiny, not a first impression."));
  }

  // Clause 3: churn — how much correcting it took along the way.
  const steeringCount = stats.noteCount + stats.ownFramingCount;
  if (steeringCount === 0 && (stats.pathCount > 0 || liked.length + disliked.length > 0)) {
    segments.push(plain(" And it took "), emphasis("little correcting"), plain(" along the way."));
  } else if (steeringCount > 0) {
    segments.push(
      plain(" You "),
      emphasis("steered it directly"),
      plain(steeringCount > 1 ? ", in your own words, more than once." : ", in your own words, at least once.")
    );
  }

  return segments;
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

