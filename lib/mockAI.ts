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
  EvidenceExample,
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

// Deliberately generic — role/company-size descriptors only, never a specific
// invented name. Illustrative placeholder for future real sourcing (PRD
// Section 7), not real LinkedIn/company data.
const EVIDENCE_POOL: Record<EvidenceExample["kind"], EvidenceExample[]> = {
  linkedin: [
    { kind: "linkedin", label: "Engineering Manager, mid-size SaaS company", detail: "Cut sprint slippage by narrowing WIP limits before changing tooling." },
    { kind: "linkedin", label: "Head of Delivery, B2B platform team", detail: "Reported steadier sprint completion after the same approach." },
  ],
  app: [
    { kind: "app", label: "Project tracking tool, mid-market tier", detail: "Usage data shows teams with several active initiatives adopt this pattern first." },
    { kind: "app", label: "Sprint planning add-on", detail: "Most-enabled setting among teams reporting improved predictability." },
  ],
  company: [
    { kind: "company", label: "50-150 employee software company", detail: "Case study cohort where this recommendation was most effective." },
    { kind: "company", label: "Series B product company", detail: "Matched cohort with similar team size and process maturity." },
  ],
};

let evidenceCycleIndex = 0;
function mockEvidenceExamples(): EvidenceExample[] {
  const i = evidenceCycleIndex % 2;
  evidenceCycleIndex += 1;
  return [EVIDENCE_POOL.linkedin[i], EVIDENCE_POOL.app[i], EVIDENCE_POOL.company[i]];
}

function mockPeerOutcome(cohortSize: number, definition: string): CanvasNodeData["peerOutcome"] {
  return {
    cohortSize,
    cohortDefinition: definition,
    bars: [42, 58, 71, 65, 80, 74],
  };
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
export function buildSessionReadout(stats: SessionStats, themes: ThemeEntry[]): ReadoutSegment[] {
  const segments: ReadoutSegment[] = [];

  if (stats.pathCount > 0) {
    segments.push(
      plain(`You worked through ${stats.pathCount} distinct path${stats.pathCount > 1 ? "s" : ""} and landed on `),
      emphasis(`${stats.selectedCount} recommendation${stats.selectedCount !== 1 ? "s" : ""}`),
      plain(" to move forward with.")
    );
  } else {
    segments.push(
      plain("You landed on "),
      emphasis(`${stats.selectedCount} recommendation${stats.selectedCount !== 1 ? "s" : ""}`),
      plain(" to move forward with.")
    );
  }

  const liked = themes.filter((t) => t.type === "like");
  const disliked = themes.filter((t) => t.type === "dislike");

  if (liked.length > 0 && disliked.length > 0) {
    segments.push(
      plain(" Along the way you responded well to "),
      emphasis(liked[0].theme),
      plain(liked.length > 1 ? ", among other things, but pushed back on " : ", but pushed back on "),
      emphasis(disliked[0].theme),
      plain(".")
    );
  } else if (liked.length > 0) {
    segments.push(plain(" Along the way you responded well to "), emphasis(liked[0].theme), plain("."));
  } else if (disliked.length > 0) {
    segments.push(plain(" Along the way you pushed back on "), emphasis(disliked[0].theme), plain("."));
  }

  if (stats.noteCount > 0) {
    segments.push(
      plain(` You left ${stats.noteCount} note${stats.noteCount > 1 ? "s" : ""} steering the recommendations directly.`)
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
export async function getInitialCanvas(chatText: string): Promise<CanvasGraph> {
  await delay();

  const sourceId = id("source");
  // A suggestion and a counter-argument are different directions from the
  // start — they don't share a path just because they were drafted
  // together, since what each grows into downstream naturally diverges.
  const recGroupId = id("group");
  const counterGroupId = id("group");
  const now = new Date().toISOString();

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

  const recTitle = "Narrow the active work-in-progress";
  const recBody =
    "A few teams in your situation get more reliable delivery by first narrowing down what's actively in flight, before changing tools or process.";
  const recOptions: ChoiceOption[] = [
    { title: "Too many priorities in flight", subtitle: "Work is spread thin across parallel initiatives." },
    { title: "Unclear ownership", subtitle: "Tasks stall because it's unclear who's accountable." },
    { title: "Estimation is consistently off", subtitle: "Work reliably takes longer than planned." },
  ];

  const rec: CanvasNodeData = {
    id: id("rec"),
    kind: "recommendation",
    title: recTitle,
    body: recBody,
    parentId: sourceId,
    depth: 1,
    selected: false,
    cardType: "choice",
    question: "Which best describes why planning keeps slipping?",
    options: recOptions,
    picked: null,
    userFraming: null,
    revisions: [{ revision: 1, title: recTitle, body: recBody, note: null, createdAt: now }],
    activeRevision: 1,
    origin: null,
    groupId: recGroupId,
    groupLabel: "Suggestion",
  };

  const counterTitle = "Counter-argument";
  const counterBody =
    "If the real issue is external dependencies rather than internal focus, narrowing WIP alone won't fix the slippage. It's worth ruling that out first.";

  const counter: CanvasNodeData = {
    id: id("counter"),
    kind: "counter-argument",
    title: counterTitle,
    body: counterBody,
    parentId: sourceId,
    depth: 1,
    selected: false,
    cardType: "plain",
    revisions: [{ revision: 1, title: counterTitle, body: counterBody, note: null, createdAt: now }],
    activeRevision: 1,
    origin: null,
    groupId: counterGroupId,
    groupLabel: "Counter-argument",
  };

  const nodes = [source, rec, counter];
  const edges = [edge(sourceId, rec.id), edge(sourceId, counter.id)];

  return { nodes, edges };
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
  await delay();

  const nextDepth = node.depth + 1;

  if (shouldConclude(nextDepth, feedbackContext)) {
    return clarifyingNode(node.id, nextDepth);
  }

  const { delta, matchedLiked } = biasFor(`${node.title} ${node.body}`, feedbackContext);
  let body = `Continuing with "${baseTitle(node)}". The next concrete step is to lock this in with the team this week, then check back in after the first cycle.`;
  if (matchedLiked) {
    body += `\n\n(Weighted toward the "${matchedLiked}" theme you liked.)`;
  }

  const now = new Date().toISOString();
  const title = baseTitle(node);
  const next: CanvasNodeData = {
    id: id("next"),
    // Continuing a card keeps its own kind — a counter-argument "Prefer"'d
    // into its next step is still a counter-argument, not a suggestion.
    // Hardcoding "recommendation" here used to leave the eyebrow (which
    // reads nodeData.kind) and the carried-over title (baseTitle(node),
    // still literally "Counter-argument") disagreeing with each other.
    kind: node.kind,
    title,
    body,
    parentId: node.id,
    depth: nextDepth,
    selected: false,
    cardType: "plain",
    revisions: [{ revision: 1, title, body, note: null, createdAt: now }],
    activeRevision: 1,
    origin: null,
    createdUnderRevision: node.activeRevision ?? 1,
    matchScore:
      node.matchScore != null ? clamp(node.matchScore + swing() + delta, 40, 99) : undefined,
    retentionRate:
      node.retentionRate != null
        ? clamp(node.retentionRate + swing() + delta, 40, 99)
        : undefined,
    transparency: node.transparency,
    matchFactors: node.matchFactors,
    peerOutcome: node.peerOutcome,
    evidenceExamples: mockEvidenceExamples(),
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
  await delay();

  const choice = node.options?.[selectedIndex];
  const nextDepth = node.depth + 1;

  if (shouldConclude(nextDepth, feedbackContext)) {
    const { node: clarifying, edge: e } = clarifyingNode(node.id, nextDepth);
    return { nodes: [clarifying], edges: [e] };
  }

  const { delta, matchedLiked } = biasFor(
    `${node.title} ${choice?.title ?? ""} ${choice?.subtitle ?? ""}`,
    feedbackContext
  );

  let body = choice
    ? `Since "${choice.subtitle}", try tightening scope reviews to once a week and capping active workstreams at 3 per person before revisiting tooling.`
    : "Here's a tailored next step based on what you picked.";
  if (matchedLiked) {
    body += `\n\n(Weighted toward the "${matchedLiked}" theme you liked.)`;
  }

  const now = new Date().toISOString();
  const branchTitle = choice ? `Given: ${choice.title}` : "Branch";
  const branch: CanvasNodeData = {
    id: id("branch"),
    kind: "recommendation",
    title: branchTitle,
    body,
    parentId: node.id,
    depth: nextDepth,
    selected: false,
    cardType: "plain",
    revisions: [{ revision: 1, title: branchTitle, body, note: null, createdAt: now }],
    activeRevision: 1,
    origin: null,
    createdUnderRevision: node.activeRevision ?? 1,
    matchScore: clamp(79 + delta, 40, 99),
    retentionRate: clamp(81 + delta, 40, 99),
    transparency: "sponsored",
    matchFactors: MOCK_MATCH_FACTORS,
    peerOutcome: mockPeerOutcome(268, "teams that picked this option, last 12 months"),
    evidenceExamples: mockEvidenceExamples(),
    groupId: node.groupId,
    groupLabel: node.groupLabel,
  };

  const includeCounter = Math.random() < counterArgumentChance(feedbackContext);
  // This counter-argument is a direct rebuttal of the option just picked, not
  // an independent idea in its own right — it stays in the same path as the
  // recommendation it's responding to (unlike the initial proactive pair in
  // getInitialCanvas, which really are two different directions from the
  // start). Rendering it alongside `branch` in one shared path frame is what
  // canvas-screen.tsx's groupId-based framing already does automatically.
  const counterTitle = "Counter-argument";
  const counterBody = choice
    ? `Worth checking first: if "${choice.title.toLowerCase()}" isn't actually the root cause, this fix won't stick. Confirm it before committing the team's time.`
    : "Worth validating this is the actual root cause before committing time to it.";
  const counter: CanvasNodeData = {
    id: id("counter"),
    kind: "counter-argument",
    title: counterTitle,
    body: counterBody,
    parentId: node.id,
    depth: nextDepth,
    selected: false,
    cardType: "plain",
    revisions: [{ revision: 1, title: counterTitle, body: counterBody, note: null, createdAt: now }],
    activeRevision: 1,
    origin: null,
    createdUnderRevision: node.activeRevision ?? 1,
    groupId: node.groupId,
    groupLabel: node.groupLabel,
  };

  const nodes = includeCounter ? [branch, counter] : [branch];
  return {
    nodes,
    edges: nodes.map((n) => edge(node.id, n.id)),
  };
}

// ---------------------------------------------------------------------------
// Context-note model
// ---------------------------------------------------------------------------

export type NoteIntent = "refine_in_place" | "branch_new_direction";

// Keyword heuristics for the mock — a real model call drops in here later
// without touching any call site, since every caller only ever sees the two
// labels back. Turkish equivalents included since this repo's prototype
// audience has tested in both languages.
const BRANCH_SIGNALS = [
  "none of these",
  "neither",
  "actually",
  "real issue",
  "real problem",
  "that's not",
  "thats not",
  "isn't the",
  "isnt the",
  "not the issue",
  "different approach",
  "instead of that",
  "rather than",
  "mine is",
  "asıl sorun",
  "aslında",
  "bu değil",
  "hiçbiri",
];

/**
 * Classifies a context note into one of two intents. Defaults to
 * `refine_in_place` — a note only branches when it clearly signals "this
 * card is wrong," not merely "adjust this."
 */
export function classifyNote(text: string): NoteIntent {
  const t = text.toLowerCase();
  return BRANCH_SIGNALS.some((s) => t.includes(s)) ? "branch_new_direction" : "refine_in_place";
}

function trim(s: string, n = 46): string {
  return s.length > n ? s.slice(0, n).trim() + "…" : s;
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
  await delay();
  const { matchedLiked } = biasFor(note, feedbackContext);
  let body = `Adjusted for what you said — "${trim(note)}". Keep the same direction, but size it to what you actually described, not the default.`;
  if (matchedLiked) {
    body += `\n\n(Weighted toward the "${matchedLiked}" theme you liked.)`;
  }
  return { title: baseTitle(node), body };
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
  await delay();
  void node;
  void note;
  void feedbackContext;
  return [
    { title: "Priorities are reset from outside", subtitle: "Someone above the team changes the order mid-sprint." },
    { title: "Work is started before it's ready", subtitle: "Tickets enter the sprint without a clear definition of done." },
    { title: "Nobody owns the sequencing call", subtitle: "When two things collide, there's no one to break the tie." },
  ];
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
  await delay();

  const nextDepth = node.depth + 1;

  if (shouldConclude(nextDepth, feedbackContext)) {
    return clarifyingNode(node.id, nextDepth);
  }

  const { delta, matchedLiked } = biasFor(note, feedbackContext);
  const isCounter = node.kind === "counter-argument";
  let body = isCounter
    ? `Taking your framing — "${trim(note)}". Worth checking first whether this changes the underlying assumption before locking in the next step.`
    : `Taking your framing — "${trim(note)}". Here's a next step built around that instead.`;
  if (!isCounter && matchedLiked) {
    body += `\n\n(Weighted toward the "${matchedLiked}" theme you liked.)`;
  }

  const now = new Date().toISOString();
  const title = isCounter ? "Counter-argument" : "New direction";
  const branch: CanvasNodeData = {
    id: id("branch"),
    kind: node.kind,
    title,
    body,
    parentId: node.id,
    depth: nextDepth,
    selected: false,
    cardType: "plain",
    revisions: [{ revision: 1, title, body, note: null, createdAt: now }],
    activeRevision: 1,
    origin: { intent: "branch_new_direction", note },
    createdUnderRevision: node.activeRevision ?? 1,
    // Counter-argument cards never carry the dashboard-only match fields —
    // same convention as every other counter-argument node in this file.
    ...(isCounter
      ? {}
      : {
          matchScore: clamp(75 + delta, 40, 99),
          retentionRate: clamp(78 + delta, 40, 99),
          transparency: "organic" as const,
          evidenceExamples: mockEvidenceExamples(),
        }),
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
  await delay();

  const nextDepth = node.depth + 1;

  if (shouldConclude(nextDepth, feedbackContext)) {
    return clarifyingNode(node.id, nextDepth);
  }

  const { delta, matchedLiked } = biasFor(framing, feedbackContext);
  let body = `Since "${trim(framing).toLowerCase()}", the move is to tighten scope reviews to once a week and cap active workstreams at 3 per person before revisiting tooling.`;
  if (matchedLiked) {
    body += `\n\n(Weighted toward the "${matchedLiked}" theme you liked.)`;
  }

  const now = new Date().toISOString();
  const title = "Given your framing";
  const branch: CanvasNodeData = {
    id: id("branch"),
    kind: "recommendation",
    title,
    body,
    parentId: node.id,
    depth: nextDepth,
    selected: false,
    cardType: "plain",
    revisions: [{ revision: 1, title, body, note: null, createdAt: now }],
    activeRevision: 1,
    // Skipping the A/B/C picker for your own words is just as much a
    // redirect as branchFromNote — the report's "From your note" marker
    // (need-summary-list.tsx) reads this same origin.intent, so both paths
    // must set it the same way.
    origin: { intent: "branch_new_direction", note: framing },
    createdUnderRevision: node.activeRevision ?? 1,
    matchScore: clamp(79 + delta, 40, 99),
    retentionRate: clamp(81 + delta, 40, 99),
    transparency: "sponsored",
    matchFactors: MOCK_MATCH_FACTORS,
    peerOutcome: mockPeerOutcome(268, "teams that picked this option, last 12 months"),
    evidenceExamples: mockEvidenceExamples(),
    groupId: node.groupId,
    groupLabel: node.groupLabel,
  };

  return { node: branch, edge: edge(node.id, branch.id) };
}

function baseTitle(node: CanvasNodeData) {
  return node.title.replace(/\s\(v\d+\)$/, "");
}

function swing() {
  return Math.round((Math.random() - 0.3) * 10);
}

/**
 * Decides how likely a counter-argument is worth surfacing, based on how
 * this user has reacted to counter-arguments before — deriveFeedbackContext
 * falls back to a node's title when it has no highlight tags, so a
 * liked/disliked counter-argument card shows up here literally as the theme
 * "Counter-argument". No signal yet → default to a coin flip.
 */
function counterArgumentChance(feedbackContext?: FeedbackContext): number {
  if (!feedbackContext) return 0.5;
  const disliked = feedbackContext.disliked.some((t) => t.toLowerCase() === "counter-argument");
  const liked = feedbackContext.liked.some((t) => t.toLowerCase() === "counter-argument");
  if (disliked && !liked) return 0.15;
  if (liked && !disliked) return 0.85;
  return 0.5;
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
