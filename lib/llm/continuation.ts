import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClient, MODELS } from "./client";
import { preferredContinuationSystemPrompt, feedbackContextLine, type Locale } from "./prompts";
import { ContinuationSchema, type Continuation } from "./schemas";
import type { Usage } from "./telemetry";

/** Content the model needs to continue a card's direction. Structure (ids,
 *  groups, depth, the preserved kind) is assembled by the caller. */
export interface ContinuationContext {
  title: string;
  body: string;
  kind: string;
  liked: string[];
  disliked: string[];
}

export async function readPreferredContinuation(
  ctx: ContinuationContext,
  locale: Locale
): Promise<{ continuation: Continuation; usage: Usage }> {
  const client = getClient();

  const userContent =
    `The card they are continuing (kind: ${ctx.kind}):\n` +
    `Title: ${ctx.title}\n` +
    `Body: ${ctx.body}` +
    feedbackContextLine(ctx.liked, ctx.disliked);

  const msg = await client.messages.parse({
    model: MODELS.reasoning,
    max_tokens: 768,
    system: preferredContinuationSystemPrompt(locale),
    output_config: { format: zodOutputFormat(ContinuationSchema) },
    messages: [{ role: "user", content: userContent }],
  });
  if (!msg.parsed_output) {
    throw new Error("Model did not return a parseable continuation.");
  }
  return { continuation: msg.parsed_output, usage: msg.usage };
}
