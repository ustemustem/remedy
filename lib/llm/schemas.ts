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

/** A minimal schema, only to prove structured output round-trips end to end. */
export const ProofSchema = z.object({
  greeting: z.string().describe("A one-sentence friendly greeting for a busy professional"),
  language: z.enum(["en", "tr"]).describe("The language the greeting is written in"),
});
export type Proof = z.infer<typeof ProofSchema>;
