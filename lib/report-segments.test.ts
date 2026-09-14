import { describe, it, expect } from "vitest";
import { mapSummarySegments, mapReadoutSegments } from "./report-segments";
import type { DashboardNeed } from "./graph";

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
