import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClient, MODELS, isLlmMock } from "./client";
import {
  understoodSummarySystemPrompt,
  sessionReadoutSystemPrompt,
  fitSignalSystemPrompt,
  type Locale,
} from "./prompts";
import { UnderstoodSummarySchema, SessionReadoutSchema, FitSignalSchema } from "./schemas";
import type { Usage } from "./telemetry";
import type { SessionStats, FitSignal } from "../types";
import {
  fallbackUnderstoodSummary,
  fallbackSessionReadout,
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
