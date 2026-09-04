import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClient, MODELS } from "./client";
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

/** Calls the model and returns the parsed reading plus raw usage for telemetry. */
export async function readInitialCanvas(
  chatText: string,
  locale: Locale
): Promise<{ reading: InitialReading; usage: Usage }> {
  const client = getClient();
  const msg = await client.messages.parse({
    model: MODELS.reasoning,
    max_tokens: 2048,
    system: initialCanvasSystemPrompt(locale),
    output_config: { format: zodOutputFormat(InitialReadingSchema) },
    // The vent is untrusted data in the user turn — behaviour is in the system prompt.
    messages: [{ role: "user", content: chatText }],
  });
  if (!msg.parsed_output) {
    throw new Error("Model did not return a parseable reading.");
  }
  return { reading: msg.parsed_output, usage: msg.usage };
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
