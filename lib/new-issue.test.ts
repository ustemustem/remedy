import { describe, expect, it } from "vitest";
import { getIssues, issueGraph } from "./reports";
import { pickLinkType, suggestNextIssues } from "./mockAI";
import type { CanvasGraph, CanvasNodeData } from "./types";

function node(id: string, patch: Partial<CanvasNodeData> = {}): CanvasNodeData {
  return { id, kind: "recommendation", title: id, body: `${id} body`, parentId: null, depth: 1, selected: false, ...patch };
}

const GRAPH: CanvasGraph = {
  nodes: [
    node("s1", { kind: "source", body: "I can't find a job.", depth: 0 }),
    node("a", { parentId: "s1", selected: true, title: "Rewrite the CV" }),
    node("s2", { kind: "source", body: "Is my search method wrong?", depth: 0, links: [{ to: "s1", type: "digs-into" }] }),
    node("b", { parentId: "s2" }),
    node("d", { kind: "source", body: "", depth: 0, draft: true }),
  ],
  edges: [
    { id: "e1", source: "s1", target: "a" },
    { id: "e2", source: "s2", target: "b" },
  ],
};

describe("New issue", () => {
  it("does not count a draft as an issue", () => {
    expect(getIssues(GRAPH).map((i) => i.id)).toEqual(["s1", "s2"]);
  });

  it("cuts one issue's own tree out of the canvas", () => {
    const g = issueGraph(GRAPH, "s2");
    expect(g.nodes.map((n) => n.id)).toEqual(["s2", "b"]);
    expect(g.edges.map((e) => e.id)).toEqual(["e2"]);
  });

  it("picks Digs into for a question about the cause, Follows up otherwise", () => {
    expect(pickLinkType("Is my job search method wrong?")).toBe("digs-into");
    expect(pickLinkType("Why do recruiters never reply?")).toBe("digs-into");
    expect(pickLinkType("I tried the referral plan. Now what?")).toBe("follows-up");
  });

  it("suggests questions drawn from the latest issue", async () => {
    const suggestions = await suggestNextIssues(GRAPH);
    expect(suggestions.length).toBeGreaterThanOrEqual(2);
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });
});
