import { describe, expect, it } from "vitest";
import {
  carryTasks,
  getIssue,
  isOutdated,
  latestReport,
  reportedIssues,
  reportsForIssue,
  type SavedReport,
} from "./reports";
import type { Task } from "./tasks";
import type { CanvasGraph, CanvasNodeData } from "./types";

function node(id: string, patch: Partial<CanvasNodeData> = {}): CanvasNodeData {
  return { id, kind: "recommendation", title: id, body: id, parentId: null, depth: 1, selected: false, ...patch };
}

const GRAPH: CanvasGraph = {
  nodes: [node("src", { kind: "source", body: "I can't find a job.", depth: 0 }), node("a")],
  edges: [],
};

function report(issueId: string, version: number, createdAt = version, graph = GRAPH): SavedReport {
  return {
    id: `${issueId}-v${version}`,
    issueId,
    issueTitle: `Issue ${issueId}`,
    version,
    data: { summary: [], readout: [], fits: [] },
    graph,
    tasks: [],
    createdAt,
  };
}

function task(needNodeId: string, title: string, patch: Partial<Task> = {}): Task {
  return {
    id: `${needNodeId}-${title}`,
    needNodeId,
    needTitle: needNodeId,
    title,
    why: "",
    priority: "medium",
    order: 0,
    status: "todo",
    timeframe: "this-week",
    durationMin: 30,
    contact: { who: "Your manager", channel: "email", draft: "" },
    steps: [],
    notes: "",
    sources: [],
    version: 1,
    history: [],
    ...patch,
  };
}

describe("getIssue", () => {
  it("reads the source node", () => {
    expect(getIssue(GRAPH)).toEqual({ id: "src", title: "I can't find a job." });
  });
  it("returns null on an empty canvas", () => {
    expect(getIssue({ nodes: [], edges: [] })).toBeNull();
  });
});

describe("versions", () => {
  const reports = [report("b", 1, 5), report("a", 2, 3), report("a", 1, 1)];

  it("lists one issue's versions oldest first", () => {
    expect(reportsForIssue(reports, "a").map((r) => r.version)).toEqual([1, 2]);
  });
  it("finds the latest version", () => {
    expect(latestReport(reports, "a")?.version).toBe(2);
    expect(latestReport(reports, "missing")).toBeNull();
  });
  it("lists issues in the order their first report was built", () => {
    expect(reportedIssues(reports).map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("isOutdated", () => {
  it("is false for the canvas the report was built from", () => {
    expect(isOutdated(report("src", 1), GRAPH)).toBe(false);
  });
  it("is true after any node change", () => {
    const changed = { ...GRAPH, nodes: GRAPH.nodes.map((n) => (n.id === "a" ? { ...n, selected: true } : n)) };
    expect(isOutdated(report("src", 1), changed)).toBe(true);
  });
});

describe("carryTasks", () => {
  it("keeps the user's work on tasks the new version still proposes", () => {
    const previous = [task("n1", "Call", { status: "done", notes: "Done Monday", order: 4 })];
    const next = [task("n1", "Call", { order: 0 }), task("n2", "Write", { order: 1 })];
    const carried = carryTasks(previous, next);
    expect(carried[0]).toMatchObject({ status: "done", notes: "Done Monday", order: 0 });
    expect(carried[1]).toMatchObject({ needNodeId: "n2", status: "todo" });
  });
  it("drops tasks the new version no longer proposes", () => {
    expect(carryTasks([task("old", "Gone")], [task("n1", "Call")]).map((t) => t.title)).toEqual(["Call"]);
  });
});
