import { parseStructured, MODELS, isLlmMock } from "./client";
import { optionResponseSystemPrompt, feedbackContextLine, type Locale } from "./prompts";
import { OptionResponseSchema, type OptionResponse } from "./schemas";
import type { Usage } from "./telemetry";

/** The context the model needs to continue from a picked option. Only content
 *  fields — the graph structure (ids, groups, depth) is assembled by the
 *  caller, never sent to the model. */
export interface OptionContext {
  parentTitle: string;
  parentBody: string;
  option: { title: string; subtitle: string } | null;
  liked: string[];
  disliked: string[];
}

/** LLM_MOCK fixture — builds on the picked option so it reads coherently. */
async function mockOptionResponse(
  ctx: OptionContext
): Promise<{ response: OptionResponse; usage: Usage }> {
  await new Promise((r) => setTimeout(r, 600));
  const pick = ctx.option?.title ?? "your direction";
  return {
    response: {
      recommendation: {
        title: "Make it one concrete step",
        body: `You leaned toward “${pick}”. Turn it into the smallest version you can run this week and define what "done" looks like — momentum beats a perfect plan. (mock)`,
      },
      counterArgument: {
        title: "Check it's the real lever",
        body: `Before committing, make sure “${pick}” actually moves the original problem rather than being a comfortable side-quest. (mock)`,
      },
    },
    usage: {},
  };
}

export async function readOptionResponse(
  ctx: OptionContext,
  locale: Locale
): Promise<{ response: OptionResponse; usage: Usage }> {
  if (isLlmMock()) return mockOptionResponse(ctx);

  const optionLine = ctx.option
    ? `They picked this option:\n- ${ctx.option.title}: ${ctx.option.subtitle}`
    : "They did not pick a listed option.";

  const userContent =
    `The card they were working from:\n` +
    `Title: ${ctx.parentTitle}\n` +
    `Body: ${ctx.parentBody}\n\n` +
    optionLine +
    feedbackContextLine(ctx.liked, ctx.disliked);

  const { result, usage } = await parseStructured({
    model: MODELS.reasoning,
    maxTokens: 1024,
    system: optionResponseSystemPrompt(locale),
    user: userContent,
    schema: OptionResponseSchema,
    schemaName: "option_response",
  });
  return { response: result, usage };
}
