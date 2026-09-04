/**
 * Per-call telemetry — usage + latency logged from the very first call
 * (roadmap §Phase 0). Today it goes to the console; in Phase 4 the same
 * records persist to the database and feed the cost/latency dashboard that
 * turns the "measure-then-decide" budget items (§Still open) into real
 * numbers. Keeping the shape stable now means that later swap is a sink
 * change, not a rewrite of every call site.
 */

/** A structural subset of the SDK's `Usage` (whose token fields are
 *  `number | null`), kept loose so any message response's `usage` is
 *  assignable without importing the SDK type into the telemetry sink. */
export interface Usage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export interface CallRecord {
  seam: string;
  model: string;
  latencyMs: number;
  usage: Usage;
}

/** The sink. Console for Phase 0; DB-backed later. */
export function record(call: CallRecord): void {
  // Structured single-line log so it's greppable and later parseable.
  console.info("[llm]", JSON.stringify(call));
}

/**
 * Wraps an LLM call, timing it and recording its usage. The wrapped function
 * returns both the result and the raw `usage` from the response, so the
 * caller doesn't have to thread timing/logging through every seam.
 */
export async function withTelemetry<T>(
  seam: string,
  model: string,
  fn: () => Promise<{ result: T; usage: Usage }>
): Promise<T> {
  const start = Date.now();
  try {
    const { result, usage } = await fn();
    record({ seam, model, latencyMs: Date.now() - start, usage });
    return result;
  } catch (err) {
    record({ seam: `${seam}:error`, model, latencyMs: Date.now() - start, usage: {} });
    throw err;
  }
}
