import { parseStructured, MODELS, isLlmMock } from "./client";
import { initialCanvasSystemPrompt, type Locale } from "./prompts";
import { InitialReadingSchema, type InitialReading } from "./schemas";
import type { Usage } from "./telemetry";
import type { CanvasGraph, CanvasNodeData, HighlightSpan } from "@/lib/types";

/**
 * getInitialCanvas, real (Phase 1 spine). The model produces the CONTENT
 * (readInitialCanvas); the code assembles the graph structure around it
 * (assembleInitialGraph). This keeps ids, groups, edges, and revision
 * wrappers deterministic and out of the model's hands.
 */

function rid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * A canned reading for LLM_MOCK mode — no API call. Highlights are sliced from
 * the real vent so they render (assembleInitialGraph keeps only verbatim
 * substrings), and the copy is plainly marked as a mock so it's never mistaken
 * for a real model answer. A short delay mimics latency so the loading
 * animations show. Zero usage → telemetry logs a $0 call.
 */
async function mockInitialReading(
  chatText: string
): Promise<{ reading: InitialReading; usage: Usage }> {
  await new Promise((r) => setTimeout(r, 700));
  const words = chatText.trim().split(/\s+/).filter(Boolean);
  const spanA = words.slice(0, Math.min(6, words.length)).join(" ");
  const spanB = words.length > 11 ? words.slice(6, 11).join(" ") : "";
  const highlights: InitialReading["highlights"] = [
    ...(spanA && chatText.includes(spanA) ? [{ text: spanA, primaryTag: "Core issue" }] : []),
    ...(spanB && chatText.includes(spanB) ? [{ text: spanB, primaryTag: "Signal" }] : []),
  ];
  const reading: InitialReading = {
    inputQuality: "workable",
    highlights,
    suggestion: {
      title: "Name the real bottleneck first",
      body: "Get everyone to agree on the single point where things actually break before fixing anything — a shared, specific diagnosis stops three people solving three different problems. (Mock mode — no model was called.)",
      question: "Where do you want to start?",
      options: [
        { title: "Map the current flow", subtitle: "Write down each step end to end and mark where it stalls." },
        { title: "Ask the people closest", subtitle: "Short 1:1s with whoever hits the wall most often." },
        { title: "Look at the data", subtitle: "Pull the numbers on where time is actually being lost." },
      ],
    },
    counterArgument: {
      title: "Don't over-diagnose",
      body: "Mapping everything can become its own delay. If one cause is already obvious, run a small fix this week and learn from it instead of studying the problem for a month. (Mock mode.)",
    },
  };
  return { reading, usage: {} };
}

/** Calls the model and returns the parsed reading plus raw usage for telemetry. */
export async function readInitialCanvas(
  chatText: string,
  locale: Locale
): Promise<{ reading: InitialReading; usage: Usage }> {
  if (isLlmMock()) return mockInitialReading(chatText);
  // The vent is untrusted data in the user turn — behaviour is in the system prompt.
  const { result, usage } = await parseStructured({
    model: MODELS.reasoning,
    maxTokens: 2048,
    system: initialCanvasSystemPrompt(locale),
    user: chatText,
    schema: InitialReadingSchema,
    schemaName: "initial_reading",
  });
  return { reading: result, usage };
}

/**
 * Builds the CanvasGraph from the model's reading, mirroring the shape the
 * canvas already expects (source + a Suggestion choice card + a
 * Counter-argument card on two separate paths).
 */
export function assembleInitialGraph(chatText: string, reading: InitialReading): CanvasGraph {
  const now = new Date().toISOString();
  const sourceId = rid("source");
  const recGroupId = rid("group");
  const counterGroupId = rid("group");

  // Keep only highlights that are verbatim substrings of the vent, so each
  // span actually renders over the source text (a paraphrase would not match).
  const highlights: HighlightSpan[] = reading.highlights
    .filter((h) => h.text.trim() !== "" && chatText.includes(h.text))
    .map((h) => ({ id: rid("hl"), text: h.text, primaryTag: h.primaryTag }));

  const source: CanvasNodeData = {
    id: sourceId,
    kind: "source",
    title: "What you wrote",
    body: chatText,
    parentId: null,
    depth: 0,
    selected: false,
    highlights,
  };

  const { suggestion, counterArgument } = reading;

  const rec: CanvasNodeData = {
    id: rid("rec"),
    kind: "recommendation",
    title: suggestion.title,
    body: suggestion.body,
    parentId: sourceId,
    depth: 1,
    selected: false,
    cardType: "choice",
    question: suggestion.question,
    options: suggestion.options,
    picked: null,
    userFraming: null,
    revisions: [
      { revision: 1, title: suggestion.title, body: suggestion.body, note: null, createdAt: now },
    ],
    activeRevision: 1,
    origin: null,
    groupId: recGroupId,
    groupLabel: "Suggestion",
  };

  const counter: CanvasNodeData = {
    id: rid("counter"),
    kind: "counter-argument",
    title: counterArgument.title,
    body: counterArgument.body,
    parentId: sourceId,
    depth: 1,
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
    groupId: counterGroupId,
    groupLabel: "Counter-argument",
  };

  return {
    nodes: [source, rec, counter],
    edges: [
      { id: `e-${sourceId}-${rec.id}`, source: sourceId, target: rec.id },
      { id: `e-${sourceId}-${counter.id}`, source: sourceId, target: counter.id },
    ],
  };
}
