import { describe, it, expect } from "vitest";
import { checkInitialGraphStructure, checkAskVsGuess } from "./initial-canvas-checks";
import type { CanvasGraph } from "../lib/types";

function goodGraph(): CanvasGraph {
  return {
    nodes: [
      {
        id: "s", kind: "source", title: "What you wrote",
        body: "our sprint deadlines keep slipping and nobody owns priorities",
        parentId: null, depth: 0, selected: false,
        highlights: [{ id: "h", text: "deadlines keep slipping", primaryTag: "Delivery" }],
      },
      {
        id: "r", kind: "recommendation", title: "Cap work in progress",
        body: "…", parentId: "s", depth: 1, selected: false, cardType: "choice",
        options: [
          { title: "a", subtitle: "x" },
          { title: "b", subtitle: "y" },
          { title: "c", subtitle: "z" },
        ],
      },
      {
        id: "c", kind: "counter-argument", title: "Check the root cause first",
        body: "…", parentId: "s", depth: 1, selected: false, cardType: "plain",
      },
    ],
    edges: [
      { id: "e1", source: "s", target: "r" },
      { id: "e2", source: "s", target: "c" },
    ],
  };
}

describe("checkInitialGraphStructure", () => {
  it("passes a well-formed graph", () => {
    expect(checkInitialGraphStructure(goodGraph()).every((r) => r.pass)).toBe(true);
  });
  it("fails when the counter-argument is missing", () => {
    const g = goodGraph();
    g.nodes = g.nodes.filter((n) => n.kind !== "counter-argument");
    const r = checkInitialGraphStructure(g).find((x) => x.name === "counter-argument-present");
    expect(r?.pass).toBe(false);
  });
  it("fails when the suggestion does not have exactly 3 options", () => {
    const g = goodGraph();
    const rec = g.nodes.find((n) => n.kind === "recommendation")!;
    rec.options = rec.options!.slice(0, 2);
    const r = checkInitialGraphStructure(g).find((x) => x.name === "suggestion-choice-3-options");
    expect(r?.pass).toBe(false);
  });
  it("fails when a highlight is not a verbatim substring of the vent", () => {
    const g = goodGraph();
    const src = g.nodes.find((n) => n.kind === "source")!;
    src.highlights = [{ id: "h", text: "not in the vent", primaryTag: "X" }];
    const r = checkInitialGraphStructure(g).find((x) => x.name === "highlights-verbatim");
    expect(r?.pass).toBe(false);
  });
  it("fails when an edge points at a missing node", () => {
    const g = goodGraph();
    g.edges.push({ id: "e3", source: "s", target: "ghost" });
    const r = checkInitialGraphStructure(g).find((x) => x.name === "edges-resolve");
    expect(r?.pass).toBe(false);
  });
});

describe("checkAskVsGuess", () => {
  it("passes a thin vent judged thin", () => {
    expect(checkAskVsGuess("thin", true).pass).toBe(true);
  });
  it("passes a workable vent judged workable", () => {
    expect(checkAskVsGuess("workable", false).pass).toBe(true);
  });
  it("fails a thin vent judged workable", () => {
    expect(checkAskVsGuess("workable", true).pass).toBe(false);
  });
});
