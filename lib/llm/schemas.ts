// The SDK's zodOutputFormat helper imports `zod/v4`, so our schemas must be
// v4 schemas to match its expected type (zod 3.25+ ships this subpath).
import { z } from "zod/v4";

/**
 * Structured-output schemas. The model fills a schema rather than
 * free-writing JSON (roadmap §02), and `output_config.format` +
 * `messages.parse()` validate the response automatically.
 *
 * Phase 0 ships one tiny proof schema. The real `CanvasGraph` schema (the
 * source + Suggestion / Counter-argument shape, or a clarifying question when
 * the input is thin) lands in Phase 1 and replaces this as the spine.
 */

/** A minimal schema, only to prove structured output round-trips end to end.
 *  Throwaway — delete with app/api/llm-proof once the real seams are trusted. */
export const ProofSchema = z.object({
  greeting: z.string().describe("A one-sentence friendly greeting for a busy professional"),
  language: z.enum(["en", "tr"]).describe("The language the greeting is written in"),
});
export type Proof = z.infer<typeof ProofSchema>;

/**
 * getInitialCanvas (Phase 1 spine): the CONTENT the model produces from a
 * vent — the two headings (Suggestion + Counter-argument), the spans of the
 * user's own words to highlight, and a thin/workable judgement. All the
 * structural scaffolding (ids, groups, edges, revision wrappers, depth) is
 * assembled in code around this, never by the model.
 */
export const InitialReadingSchema = z.object({
  inputQuality: z
    .enum(["workable", "thin"])
    .describe(
      "'thin' if the vent is too vague to advise on without inventing specifics; otherwise 'workable'."
    ),
  highlights: z
    .array(
      z.object({
        text: z
          .string()
          .describe("An EXACT substring copied verbatim from the user's message."),
        primaryTag: z
          .string()
          .describe("A 1-3 word theme label for this span, e.g. 'Ownership', 'Tooling'."),
      })
    )
    .max(3)
    .describe(
      "0-3 spans of the user's OWN words that name their core issues. Empty when the input is too thin to contain any."
    ),
  suggestion: z
    .object({
      title: z.string().describe("A short, imperative recommendation title (<= 8 words)."),
      body: z
        .string()
        .describe(
          "2-3 sentences. When inputQuality is 'thin', acknowledge what's missing rather than inventing specifics. No invented statistics."
        ),
      question: z
        .string()
        .describe(
          "A framing question shown above the options. When 'thin', make it genuinely clarifying (ask what's really going on)."
        ),
      options: z
        .array(
          z.object({
            title: z.string().describe("A short option label (<= 6 words)."),
            subtitle: z.string().describe("One sentence expanding the option."),
          })
        )
        .length(3)
        .describe("Exactly 3 candidate framings the user picks from."),
    })
    .describe("The Suggestion heading — a recommendation with a framing choice."),
  counterArgument: z
    .object({
      title: z.string().describe("A short title for the constructive counter-argument (<= 8 words)."),
      body: z
        .string()
        .describe(
          "2-3 sentences of CONSTRUCTIVE critique: where the suggestion might not hold, or what to check first. Strengthens the suggestion, never demolishes it."
        ),
    })
    .describe("The Counter-argument heading — a constructive critique of the suggestion."),
});
export type InitialReading = z.infer<typeof InitialReadingSchema>;

/**
 * getOptionResponse (Phase 2): the user picked an A/B/C option on a choice
 * card. The model produces the next recommendation building on that pick, and
 * OPTIONALLY a constructive counter-argument — null when it has no genuinely
 * useful pushback to make (a real model shouldn't manufacture one). No
 * numbers here; the fit signal and evidence are Phase 3.
 */
export const OptionResponseSchema = z.object({
  recommendation: z
    .object({
      title: z.string().describe("A short, imperative title for the next step (<= 8 words)."),
      body: z
        .string()
        .describe("2-3 sentences building concretely on the option the user picked. No invented statistics."),
    })
    .describe("The next recommendation, continuing the picked option's direction."),
  counterArgument: z
    .object({
      title: z.string().describe("A short title for the constructive counter-argument (<= 8 words)."),
      body: z
        .string()
        .describe("2-3 sentences of constructive critique of THIS recommendation: what to check first, where it might not hold."),
    })
    .nullable()
    .describe("A constructive counter-argument, or null when there is no genuinely useful one to make."),
});
export type OptionResponse = z.infer<typeof OptionResponseSchema>;

/**
 * getPreferredContinuation (Phase 2): the user clicked "Prefer this option" to
 * keep going in a card's direction. The model returns the single next step, to
 * be rendered in the same kind as the card it continues.
 */
export const ContinuationSchema = z.object({
  title: z.string().describe("A short, imperative title for the next step (<= 8 words)."),
  body: z
    .string()
    .describe("2-3 sentences carrying this direction one concrete step further. No invented statistics."),
});
export type Continuation = z.infer<typeof ContinuationSchema>;

/**
 * Note flow (Phase 2). A user's context note is first classified, then turned
 * into either a revision (refine) or a new card (branch).
 */

/** classifyNote — refine the card in place, or branch a new direction. */
export const NoteIntentSchema = z.object({
  intent: z
    .enum(["refine_in_place", "branch_new_direction"])
    .describe(
      "'branch_new_direction' only when the note clearly says the card is wrong or the real issue is different. Otherwise 'refine_in_place' (adjust this card)."
    ),
});
export type NoteIntentResult = z.infer<typeof NoteIntentSchema>;

/** Refine-in-place on a plain card, or a branched new card — both a title+body. */
export const CardContentSchema = z.object({
  title: z.string().describe("A short, imperative title (<= 8 words)."),
  body: z.string().describe("2-3 plain sentences. No invented statistics."),
});
export type CardContent = z.infer<typeof CardContentSchema>;

/** Refine-in-place on a choice card — a regenerated set of framing options. */
export const RefinedOptionsSchema = z.object({
  options: z
    .array(
      z.object({
        title: z.string().describe("A short option label (<= 6 words)."),
        subtitle: z.string().describe("One sentence expanding the option."),
      })
    )
    .length(3)
    .describe("Exactly 3 fresh framing options that reflect the user's note."),
});
export type RefinedOptions = z.infer<typeof RefinedOptionsSchema>;
