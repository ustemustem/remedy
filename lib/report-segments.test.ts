import { describe, it, expect } from "vitest";
import { mapSummarySegments, mapReadoutSegments, computeCompositeFit, filterGroundedEvidence } from "./report-segments";
import type { DashboardNeed } from "./graph";
import type { EvidenceExample } from "./types";

function ev(url: string, kind: EvidenceExample["kind"] = "app"): EvidenceExample {
  return { kind, label: "L", detail: "D", url };
}

function need(id: string): DashboardNeed {
  return {
    // Only .node.id is read by mapSummarySegments; the rest satisfies the type.
    node: { id } as DashboardNeed["node"],
    category: "General",
    quote: "q",
    revisionCount: 0,
  };
}

describe("mapSummarySegments", () => {
  const needs = [need("n1"), need("n2")];

  it("maps a 1-based refIndex to that need's node id", () => {
    const out = mapSummarySegments([{ content: "a", refIndex: 2 }], needs);
    expect(out).toEqual([{ type: "ref", content: "a", nodeId: "n2" }]);
  });

  it("treats null refIndex as plain text", () => {
    const out = mapSummarySegments([{ content: "b", refIndex: null }], needs);
    expect(out).toEqual([{ type: "text", content: "b" }]);
  });

  it("degrades an out-of-range or non-integer refIndex to plain text", () => {
    const out = mapSummarySegments(
      [
        { content: "zero", refIndex: 0 },
        { content: "too big", refIndex: 5 },
        { content: "neg", refIndex: -1 },
        { content: "frac", refIndex: 1.5 },
      ],
      needs
    );
    expect(out.every((s) => s.type === "text")).toBe(true);
  });
});

describe("mapReadoutSegments", () => {
  it("keeps emphasis true and drops emphasis false to undefined", () => {
    const out = mapReadoutSegments([
      { content: "x", emphasis: true },
      { content: "y", emphasis: false },
    ]);
    expect(out).toEqual([{ content: "x", emphasis: true }, { content: "y" }]);
  });
});

describe("computeCompositeFit", () => {
  it("is the 50/50 average, rounded", () => {
    expect(computeCompositeFit(90, 70)).toBe(80);
    expect(computeCompositeFit(75, 86)).toBe(81); // (75+86)/2 = 80.5 -> 81
  });
  it("clamps out-of-range and non-finite parts", () => {
    expect(computeCompositeFit(150, -10)).toBe(50); // 100 & 0
    expect(computeCompositeFit(Number.NaN, 80)).toBe(40); // 0 & 80
  });
});

describe("filterGroundedEvidence", () => {
  const allowed = ["https://a.com", "https://b.com", "https://c.com"];
  it("drops urls not in the real citation set", () => {
    const out = filterGroundedEvidence([ev("https://a.com"), ev("https://evil.com")], allowed);
    expect(out.map((e) => e.url)).toEqual(["https://a.com"]);
  });
  it("dedups by url and caps at max", () => {
    const out = filterGroundedEvidence(
      [ev("https://a.com"), ev("https://a.com"), ev("https://b.com"), ev("https://c.com")],
      allowed,
      2
    );
    expect(out.map((e) => e.url)).toEqual(["https://a.com", "https://b.com"]);
  });
  it("returns [] when nothing matches", () => {
    expect(filterGroundedEvidence([ev("https://x.com")], allowed)).toEqual([]);
  });
});
