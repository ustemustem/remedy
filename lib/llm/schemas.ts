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
