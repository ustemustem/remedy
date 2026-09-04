import { describe, it, expect } from "vitest";
import { aggregate, formatReport, type VentResult } from "./score";
import type { CheckResult } from "./checks";

const STRUCTURAL_OK: CheckResult[] = [
  { name: "schema-valid", pass: true },
  { name: "one-source", pass: true },
  { name: "suggestion-choice-3-options", pass: true },
  { name: "counter-argument-present", pass: true },
  { name: "highlights-verbatim", pass: true },
  { name: "edges-resolve", pass: true },
];

function vent(over: Partial<VentResult>): VentResult {
  return {
    id: "v",
    expectThin: false,
    inputQuality: "workable",
    checks: [...STRUCTURAL_OK, { name: "ask-vs-guess", pass: true }],
    latencyMs: 1000,
    usage: { input_tokens: 100, output_tokens: 50 },
    ...over,
  };
}

describe("aggregate", () => {
  it("reports 100% and passes both gates when all vents pass", () => {
    const agg = aggregate([vent({}), vent({}), vent({})]);
    expect(agg.structuralPct).toBe(1);
    expect(agg.askVsGuessPct).toBe(1);
    expect(agg.gates.structural).toBe(true);
    expect(agg.gates.askVsGuess).toBe(true);
  });

  it("fails the structural gate below 99%", () => {
    const broken = vent({
      checks: [
        { name: "schema-valid", pass: true },
        { name: "counter-argument-present", pass: false },
        { name: "ask-vs-guess", pass: true },
      ],
    });
    const agg = aggregate([broken, ...Array.from({ length: 9 }, () => vent({}))]);
    expect(agg.structuralPct).toBeCloseTo(0.9, 5);
    expect(agg.gates.structural).toBe(false);
  });

  it("fails the ask-vs-guess gate below 90%", () => {
    const miss = vent({
      inputQuality: "workable",
      expectThin: true,
      checks: [...STRUCTURAL_OK, { name: "ask-vs-guess", pass: false }],
    });
    const agg = aggregate([miss, miss, ...Array.from({ length: 8 }, () => vent({}))]);
    expect(agg.askVsGuessPct).toBeCloseTo(0.8, 5);
    expect(agg.gates.askVsGuess).toBe(false);
  });

  it("counts an errored vent as a structural failure", () => {
    const agg = aggregate([vent({ inputQuality: "error", checks: [], error: "boom" })]);
    expect(agg.structuralPct).toBe(0);
    expect(agg.gates.structural).toBe(false);
  });

  it("sums tokens and latency", () => {
    const agg = aggregate([vent({}), vent({})]);
    expect(agg.totalInputTokens).toBe(200);
    expect(agg.totalOutputTokens).toBe(100);
    expect(agg.totalLatencyMs).toBe(2000);
  });
});

describe("formatReport", () => {
  it("includes the gate verdicts and headline percentages", () => {
    const out = formatReport(aggregate([vent({})]), [vent({})]);
    expect(out).toContain("Structural");
    expect(out).toContain("Ask-vs-guess");
    expect(out).toMatch(/PASS|FAIL/);
  });
});
