import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClient, MODELS, isLlmMock, WEB_SEARCH_TOOL_TYPE } from "./client";
import {
  understoodSummarySystemPrompt,
  sessionReadoutSystemPrompt,
  fitSignalSystemPrompt,
  groundingSearchSystemPrompt,
  groundingExtractSystemPrompt,
  type Locale,
} from "./prompts";
import {
  UnderstoodSummarySchema,
  SessionReadoutSchema,
  FitSignalSchema,
  GroundedEvidenceSchema,
} from "./schemas";
import type { Usage } from "./telemetry";
import type { SessionStats, FitSignal, EvidenceExample } from "../types";
import {
  fallbackUnderstoodSummary,
  fallbackSessionReadout,
  filterGroundedEvidence,
  type RawSummarySegment,
  type RawReadoutSegment,
} from "../report-segments";
import type { DashboardNeed, ThemeEntry } from "../graph";

export interface SummaryNeedInput {
  label: string;
  quote: string;
}
export interface ReadoutThemeInput {
  theme: string;
  type: "like" | "dislike";
}

/** getUnderstoodSummary — cheap Haiku call. Returns the model's raw segments;
 *  the client maps refIndex back to node ids. */
export async function readUnderstoodSummary(
  input: { vent: string; needs: SummaryNeedInput[] },
  locale: Locale
): Promise<{ result: RawSummarySegment[]; usage: Usage }> {
  if (isLlmMock()) {
    await new Promise((r) => setTimeout(r, 500));
    // Reuse the deterministic template, projected into raw (index-based) form.
    const fauxNeeds = input.needs.map(
      (n, i) => ({ node: { id: `mock-${i}`, title: n.label }, quote: n.quote }) as unknown as DashboardNeed
    );
    const idOfIndex = new Map(fauxNeeds.map((n, i) => [n.node.id, i + 1]));
    const result: RawSummarySegment[] = fallbackUnderstoodSummary(fauxNeeds).map((seg) =>
      seg.type === "ref"
        ? { content: seg.content, refIndex: idOfIndex.get(seg.nodeId) ?? null }
        : { content: seg.content, refIndex: null }
    );
    return { result, usage: {} };
  }

  const client = getClient();
  const numbered = input.needs.map((n, i) => `${i + 1}. ${n.label} — "${n.quote}"`).join("\n");
  const userContent =
    `The user's original message:\n"${input.vent}"\n\n` +
    `The needs they kept (numbered):\n${numbered}`;

  const msg = await client.messages.parse({
    model: MODELS.cheap,
    max_tokens: 512,
    system: understoodSummarySystemPrompt(locale),
    output_config: { format: zodOutputFormat(UnderstoodSummarySchema) },
    messages: [{ role: "user", content: userContent }],
  });
  if (!msg.parsed_output) {
    throw new Error("Model did not return a parseable summary.");
  }
  return { result: msg.parsed_output.segments, usage: msg.usage };
}

/** getSessionReadout — cheap Haiku call. Returns the model's raw segments. */
export async function readSessionReadout(
  input: { stats: SessionStats; themes: ReadoutThemeInput[] },
  locale: Locale
): Promise<{ result: RawReadoutSegment[]; usage: Usage }> {
  if (isLlmMock()) {
    await new Promise((r) => setTimeout(r, 500));
    const fauxThemes = input.themes.map((t) => ({ ...t, nodeIds: [] }) as ThemeEntry);
    const result: RawReadoutSegment[] = fallbackSessionReadout(input.stats, fauxThemes).map((seg) => ({
      content: seg.content,
      emphasis: Boolean(seg.emphasis),
    }));
    return { result, usage: {} };
  }

  const client = getClient();
  const themeLines =
    input.themes.length > 0
      ? input.themes.map((t) => `- ${t.type}: ${t.theme}`).join("\n")
      : "(no themes marked)";
  const userContent =
    `Session stats:\n` +
    `- paths explored: ${input.stats.pathCount}\n` +
    `- selected: ${input.stats.selectedCount}\n` +
    `- likes: ${input.stats.likeCount}, dislikes: ${input.stats.dislikeCount}\n` +
    `- own-framing steers: ${input.stats.ownFramingCount}, notes: ${input.stats.noteCount}\n\n` +
    `Themes the user marked:\n${themeLines}`;

  const msg = await client.messages.parse({
    model: MODELS.cheap,
    max_tokens: 384,
    system: sessionReadoutSystemPrompt(locale),
    output_config: { format: zodOutputFormat(SessionReadoutSchema) },
    messages: [{ role: "user", content: userContent }],
  });
  if (!msg.parsed_output) {
    throw new Error("Model did not return a parseable readout.");
  }
  return { result: msg.parsed_output.segments, usage: msg.usage };
}

export interface FitNeedInput {
  label: string;
  body: string;
}

/** getFitSignals — batched Sonnet call scoring every kept recommendation's fit.
 *  Returns raw parts (no composite); the client computes the composite. */
export async function readFitSignals(
  input: { vent: string; needs: FitNeedInput[] },
  locale: Locale
): Promise<{ result: Omit<FitSignal, "score">[]; usage: Usage }> {
  if (isLlmMock()) {
    await new Promise((r) => setTimeout(r, 600));
    const result = input.needs.map((_, i) => ({
      coverageScore: 90 - (i % 3) * 15,
      coverageNote: "Covers most of what you raised. (mock)",
      confidenceScore: 70 + (i % 4) * 8,
      confidenceNote: "Reasonably confident given the input. (mock)",
    }));
    return { result, usage: {} };
  }

  const client = getClient();
  const numbered = input.needs.map((n, i) => `${i + 1}. ${n.label} — ${n.body}`).join("\n");
  const userContent =
    `The user's original message:\n"${input.vent}"\n\n` +
    `The recommendations to score (numbered):\n${numbered}`;

  const msg = await client.messages.parse({
    model: MODELS.reasoning,
    max_tokens: 1024,
    system: fitSignalSystemPrompt(locale),
    output_config: { format: zodOutputFormat(FitSignalSchema) },
    messages: [{ role: "user", content: userContent }],
  });
  if (!msg.parsed_output) {
    throw new Error("Model did not return parseable fit signals.");
  }
  return { result: msg.parsed_output.fits, usage: msg.usage };
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/** Pull cited URLs out of web_search_tool_result blocks, defensively — the exact
 *  result-block shape is version-specific, so check at runtime. */
function extractCitations(content: Anthropic.ContentBlock[]): string[] {
  const urls: string[] = [];
  for (const block of content) {
    const b = block as unknown as { type: string; content?: unknown };
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content) {
        const rr = r as { url?: string };
        if (typeof rr.url === "string") urls.push(rr.url);
      }
    }
  }
  return urls;
}

export interface GroundNeedInput {
  label: string;
  body: string;
}

/** groundRecommendations for ONE recommendation (Phase 3b): web_search ->
 *  structured extraction constrained to the real URLs -> code citation-exists +
 *  dedup. Returns [] on an honest gap (no citations). */
export async function readGroundedEvidenceForOne(
  input: { vent: string; recommendation: GroundNeedInput },
  locale: Locale
): Promise<{ result: EvidenceExample[]; usage: Usage }> {
  if (isLlmMock()) {
    await new Promise((r) => setTimeout(r, 700));
    const slug = encodeURIComponent(
      input.recommendation.label.toLowerCase().replace(/\s+/g, "-").slice(0, 40)
    );
    const result: EvidenceExample[] = [
      { kind: "app", label: "A fitting tool", detail: "A tool that helps enact this. (mock)", url: `https://example.com/tool/${slug}` },
      { kind: "community", label: "Practitioner thread", detail: "Others who tried this discuss how. (mock)", url: `https://example.com/discussion/${slug}` },
    ];
    return { result, usage: {} };
  }

  const client = getClient();

  // 1) web_search — real sources + cited URLs.
  const search = await client.messages.create({
    model: MODELS.reasoning,
    max_tokens: 1024,
    system: groundingSearchSystemPrompt(locale),
    tools: [{ type: WEB_SEARCH_TOOL_TYPE, name: "web_search", max_uses: 3 }],
    messages: [
      {
        role: "user",
        content:
          `The user's situation:\n"${input.vent}"\n\n` +
          `The recommendation to support:\n${input.recommendation.label} — ${input.recommendation.body}`,
      },
    ],
  });
  const searchText = extractText(search.content);
  const allowedUrls = extractCitations(search.content);
  if (allowedUrls.length === 0) {
    return { result: [], usage: search.usage };
  }

  // 2) structured extraction, constrained to the real URLs.
  const extract = await client.messages.parse({
    model: MODELS.cheap,
    max_tokens: 768,
    system: groundingExtractSystemPrompt(locale),
    output_config: { format: zodOutputFormat(GroundedEvidenceSchema) },
    messages: [
      {
        role: "user",
        content:
          `Recommendation:\n${input.recommendation.label} — ${input.recommendation.body}\n\n` +
          `Search findings:\n${searchText}\n\n` +
          `Real URLs (use only these):\n${allowedUrls.join("\n")}`,
      },
    ],
  });
  const items = extract.parsed_output?.items ?? [];
  return { result: filterGroundedEvidence(items, allowedUrls, 3), usage: extract.usage };
}
