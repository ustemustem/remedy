import type { z } from "zod/v4";

/**
 * Programmatic eval checks (roadmap §04). These are the cheap, deterministic
 * gates run on every candidate output before any LLM-judge or human review —
 * the ones that must hit ≥99% / 100% (structural validity, grounding
 * integrity). They take no model calls, so they run for free on every eval.
 *
 * Phase 0 ships the primitives; Phase 1 composes them per seam (schema-valid
 * graph, depth caps respected) and Phase 3 adds the grounding gate.
 */

export interface CheckResult {
  name: string;
  pass: boolean;
  detail?: string;
}

/** Does the value parse against its schema? The floor under structural validity. */
export function schemaValid<T>(schema: z.ZodType<T>, value: unknown): CheckResult {
  const r = schema.safeParse(value);
  return {
    name: "schema-valid",
    pass: r.success,
    detail: r.success ? undefined : r.error.issues.map((i) => i.message).join("; "),
  };
}

/** Every concrete recommendation must carry at least one real, cited URL, or
 *  it isn't shown (roadmap §03 grounding gate — a hard release blocker). */
export function citationExists(citations: string[]): CheckResult {
  const real = citations.filter((u) => /^https?:\/\/./.test(u));
  return {
    name: "citation-exists",
    pass: real.length > 0,
    detail: real.length > 0 ? `${real.length} cited URL(s)` : "no real cited URL",
  };
}

/** Guards the "no fabricated named private individual" rule: a recommendation
 *  must not present a specific person as a real contact without a source. This
 *  is a coarse Phase 0 heuristic (a linkedin.com/in/<name> URL with no
 *  citation backing it); Phase 3 tightens it with human review. */
export function noUnsourcedNamedPerson(text: string, citations: string[]): CheckResult {
  const namesAPerson = /linkedin\.com\/in\//i.test(text);
  const grounded = citations.some((u) => /^https?:\/\/./.test(u));
  const pass = !namesAPerson || grounded;
  return {
    name: "no-unsourced-named-person",
    pass,
    detail: pass ? undefined : "names a LinkedIn person without a cited source",
  };
}

/** Runs a batch and returns whether all passed, for a one-line eval summary. */
export function summarize(results: CheckResult[]): { allPass: boolean; failed: string[] } {
  const failed = results.filter((r) => !r.pass).map((r) => r.name);
  return { allPass: failed.length === 0, failed };
}
