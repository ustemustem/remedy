import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClient, MODELS } from "./client";
import {
  classifyNoteSystemPrompt,
  noteContentSystemPrompt,
  refineOptionsSystemPrompt,
  feedbackContextLine,
  type Locale,
  type NoteOp,
} from "./prompts";
import {
  NoteIntentSchema,
  CardContentSchema,
  RefinedOptionsSchema,
  type CardContent,
  type RefinedOptions,
} from "./schemas";
import type { Usage } from "./telemetry";

/** classifyNote — cheap Haiku call returning one of the two intents. */
export async function classifyNoteReal(
  note: string,
  locale: Locale
): Promise<{ intent: "refine_in_place" | "branch_new_direction"; usage: Usage }> {
  const client = getClient();
  const msg = await client.messages.parse({
    model: MODELS.cheap,
    max_tokens: 128,
    system: classifyNoteSystemPrompt(locale),
    output_config: { format: zodOutputFormat(NoteIntentSchema) },
    messages: [{ role: "user", content: note }],
  });
  // Default to the safe intent if the model somehow returns nothing parseable.
  return { intent: msg.parsed_output?.intent ?? "refine_in_place", usage: msg.usage };
}

export interface NoteContext {
  parentTitle: string;
  parentBody: string;
  kind: string;
  note: string;
  liked: string[];
  disliked: string[];
}

/** The three title+body note operations (refine-plain, branch-plain, branch-framing). */
export async function readNoteContent(
  op: NoteOp,
  ctx: NoteContext,
  locale: Locale
): Promise<{ content: CardContent; usage: Usage }> {
  const client = getClient();
  const userContent =
    `The card (kind: ${ctx.kind}):\n` +
    `Title: ${ctx.parentTitle}\n` +
    `Body: ${ctx.parentBody}\n\n` +
    `The user's note:\n"${ctx.note}"` +
    feedbackContextLine(ctx.liked, ctx.disliked);

  const msg = await client.messages.parse({
    model: MODELS.reasoning,
    max_tokens: 1024,
    system: noteContentSystemPrompt(op, locale),
    output_config: { format: zodOutputFormat(CardContentSchema) },
    messages: [{ role: "user", content: userContent }],
  });
  if (!msg.parsed_output) {
    throw new Error("Model did not return parseable note content.");
  }
  return { content: msg.parsed_output, usage: msg.usage };
}

/** refineChoiceOptions — regenerate a choice card's option set from a note. */
export async function readRefinedOptions(
  ctx: NoteContext,
  locale: Locale
): Promise<{ options: RefinedOptions["options"]; usage: Usage }> {
  const client = getClient();
  const userContent =
    `The choice card's question:\n${ctx.parentTitle}\n` +
    (ctx.parentBody ? `Context: ${ctx.parentBody}\n` : "") +
    `\nThe user's note (the current options don't fit):\n"${ctx.note}"` +
    feedbackContextLine(ctx.liked, ctx.disliked);

  const msg = await client.messages.parse({
    model: MODELS.reasoning,
    max_tokens: 768,
    system: refineOptionsSystemPrompt(locale),
    output_config: { format: zodOutputFormat(RefinedOptionsSchema) },
    messages: [{ role: "user", content: userContent }],
  });
  if (!msg.parsed_output) {
    throw new Error("Model did not return parseable options.");
  }
  return { options: msg.parsed_output.options, usage: msg.usage };
}
