import type { CheckResult } from "./checks";
import type { Usage } from "../lib/llm/telemetry";

/** One vent's outcome — the model's judgement, every check it ran, and its cost. */
export interface VentResult {
  id: string;
  expectThin: boolean;
  inputQuality: "workable" | "thin" | "error";
  checks: CheckResult[];
  latencyMs: number;
  usage: Usage;
  error?: string;
}

/** Rolled-up scores + the roadmap §04 hard gates. */
export interface Aggregate {
  n: number;
  structuralPct: number;
  askVsGuessPct: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalLatencyMs: number;
  gates: { structural: boolean; askVsGuess: boolean };
}

// The deterministic structural checks (roadmap §04 structural validity ≥99%).
// A vent counts as structurally valid only when every one of these it ran passed.
const STRUCTURAL_CHECK_NAMES = new Set([
  "schema-valid",
  "one-source",
  "suggestion-choice-3-options",
  "counter-argument-present",
  "highlights-verbatim",
  "edges-resolve",
]);

const STRUCTURAL_GATE = 0.99;
const ASK_VS_GUESS_GATE = 0.9;

export function aggregate(results: VentResult[]): Aggregate {
  const n = results.length;

  const structuralPass = results.filter((r) => {
    if (r.error) return false;
    const structural = r.checks.filter((c) => STRUCTURAL_CHECK_NAMES.has(c.name));
    return structural.length > 0 && structural.every((c) => c.pass);
  }).length;

  const askPass = results.filter((r) =>
    r.checks.some((c) => c.name === "ask-vs-guess" && c.pass)
  ).length;

  const structuralPct = n === 0 ? 0 : structuralPass / n;
  const askVsGuessPct = n === 0 ? 0 : askPass / n;

  const totalInputTokens = results.reduce((s, r) => s + (r.usage.input_tokens ?? 0), 0);
  const totalOutputTokens = results.reduce((s, r) => s + (r.usage.output_tokens ?? 0), 0);
  const totalLatencyMs = results.reduce((s, r) => s + r.latencyMs, 0);

  return {
    n,
    structuralPct,
    askVsGuessPct,
    totalInputTokens,
    totalOutputTokens,
    totalLatencyMs,
    gates: {
      structural: structuralPct >= STRUCTURAL_GATE,
      askVsGuess: askVsGuessPct >= ASK_VS_GUESS_GATE,
    },
  };
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

/** A plain-text report: per-vent lines (only failures spelled out) + a summary
 *  with the two hard-gate verdicts. Pure — returns a string, prints nowhere. */
export function formatReport(agg: Aggregate, results: VentResult[]): string {
  const lines: string[] = [];
  lines.push("=== getInitialCanvas eval ===");
  for (const r of results) {
    const failed = r.checks.filter((c) => !c.pass).map((c) => c.name);
    const status = r.error ? `ERROR (${r.error})` : failed.length === 0 ? "ok" : `FAIL: ${failed.join(", ")}`;
    lines.push(
      `  ${r.id.padEnd(18)} ${String(r.inputQuality).padEnd(9)} ${r.latencyMs}ms  ${status}`
    );
  }
  lines.push("");
  lines.push(`  Vents:         ${agg.n}`);
  lines.push(
    `  Structural:    ${pct(agg.structuralPct)}  [${agg.gates.structural ? "PASS" : "FAIL"}] (gate ≥99%)`
  );
  lines.push(
    `  Ask-vs-guess:  ${pct(agg.askVsGuessPct)}  [${agg.gates.askVsGuess ? "PASS" : "FAIL"}] (gate ≥90%)`
  );
  lines.push(
    `  Tokens:        in ${agg.totalInputTokens}, out ${agg.totalOutputTokens}  ·  Latency: ${agg.totalLatencyMs}ms total`
  );
  return lines.join("\n");
}
