import { parseStructured, MODELS, isLlmMock } from "./client";
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
  if (isLlmMock()) {
    await new Promise((r) => setTimeout(r, 300));
    // Heuristic so both paths are testable: a corrective note branches, else refine.
    const branchy =
      /\b(wrong|different|instead|actually|rather|no,|off base|not it|missed|misunderstood)\b/i.test(note);
    return { intent: branchy ? "branch_new_direction" : "refine_in_place", usage: {} };
  }
  try {
    const { result, usage } = await parseStructured({
      model: MODELS.cheap,
      maxTokens: 128,
      system: classifyNoteSystemPrompt(locale),
      user: note,
      schema: NoteIntentSchema,
      schemaName: "note_intent",
    });
    return { intent: result.intent, usage };
  } catch {
    // Classify is low-stakes — default to the safe intent rather than failing
    // the whole note submission if the model returns something unparseable.
    return { intent: "refine_in_place", usage: {} };
  }
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
  if (isLlmMock()) {
    await new Promise((r) => setTimeout(r, 600));
    const branch = op.startsWith("branch");
    return {
      content: {
        title: branch ? "A new direction from your note" : "Adjusted to your note",
        body:
          `Taking your note (“${ctx.note}”) into account, here's ${branch ? "a different angle on" : "a tightened version of"} ` +
          `“${ctx.parentTitle}” — shaped so it addresses that directly. (mock)`,
      },
      usage: {},
    };
  }
  const userContent =
    `The card (kind: ${ctx.kind}):\n` +
    `Title: ${ctx.parentTitle}\n` +
    `Body: ${ctx.parentBody}\n\n` +
    `The user's note:\n"${ctx.note}"` +
    feedbackContextLine(ctx.liked, ctx.disliked);

  const { result, usage } = await parseStructured({
    model: MODELS.reasoning,
    maxTokens: 1024,
    system: noteContentSystemPrompt(op, locale),
    user: userContent,
    schema: CardContentSchema,
    schemaName: "card_content",
  });
  return { content: result, usage };
}

/** refineChoiceOptions — regenerate a choice card's option set from a note. */
export async function readRefinedOptions(
  ctx: NoteContext,
  locale: Locale
): Promise<{ options: RefinedOptions["options"]; usage: Usage }> {
  if (isLlmMock()) {
    await new Promise((r) => setTimeout(r, 550));
    return {
      options: [
        { title: "Reframe A", subtitle: `Shaped by your note: “${ctx.note}”. (mock)` },
        { title: "Reframe B", subtitle: "A more cautious take that checks assumptions first. (mock)" },
        { title: "Reframe C", subtitle: "A bolder take that moves faster with less certainty. (mock)" },
      ],
      usage: {},
    };
  }
  const userContent =
    `The choice card's question:\n${ctx.parentTitle}\n` +
    (ctx.parentBody ? `Context: ${ctx.parentBody}\n` : "") +
    `\nThe user's note (the current options don't fit):\n"${ctx.note}"` +
    feedbackContextLine(ctx.liked, ctx.disliked);

  const { result, usage } = await parseStructured({
    model: MODELS.reasoning,
    maxTokens: 768,
    system: refineOptionsSystemPrompt(locale),
    user: userContent,
    schema: RefinedOptionsSchema,
    schemaName: "refined_options",
  });
  return { options: result.options, usage };
}
