import { describe, expect, it } from "vitest";
import { addLink, followUpTasks, linkContexts, pickedUpFrom, planLink, tallyTasks } from "./links";
import type { SavedReport } from "./reports";
import type { Task } from "./tasks";
import type { CanvasGraph, CanvasNodeData, IssueLink } from "./types";

function node(id: string, patch: Partial<CanvasNodeData> = {}): CanvasNodeData {
  return { id, kind: "recommendation", title: id, body: id, parentId: null, depth: 1, selected: false, ...patch };
}

function graph(links: IssueLink[] = []): CanvasGraph {
  return {
    nodes: [
      node("i1", { kind: "source", body: "Feedback takes three weeks.", depth: 0 }),
      node("sla", { parentId: "i1", title: "Set a 48-hour SLA", selected: true }),
      node("panel", { parentId: "i1", title: "Batch a panel day" }),
      node("i2", { kind: "source", body: "Managers have no time for CVs.", depth: 0, links }),
      node("slot", { parentId: "i2", title: "A CV slot after stand-up", selected: true }),
    ],
    edges: [],
  };
}

function task(title: string, status: Task["status"], patch: Partial<Task> = {}): Task {
  return {
    id: title,
    needNodeId: "sla",
    needTitle: "Set a 48-hour SLA",
    title,
    why: "",
    priority: "high",
    order: 0,
    status,
    timeframe: "this-week",
    durationMin: 15,
    contact: { who: "", channel: "email", draft: "" },
    steps: [],
    notes: "",
    sources: [],
    version: 1,
    history: [],
    ...patch,
  };
}

function report(tasks: Task[], g = graph()): SavedReport {
  return {
    id: "r1",
    issueId: "i1",
    issueTitle: "Feedback takes three weeks.",
    version: 2,
    data: { summary: [], readout: [], fits: [] },
    graph: { nodes: g.nodes.slice(0, 3), edges: [] },
    tasks,
    createdAt: 1,
  };
}

describe("linkContexts", () => {
  it("reads the linked issue's latest report: picks, version and task tally", () => {
    const g = graph([{ to: "i1", type: "follows-up" }]);
    const [ctx] = linkContexts(g, [report([task("Agree the SLA", "done"), task("Weekly chart", "doing")])], "i2");
    expect(ctx).toMatchObject({
      toIssueId: "i1",
      toNumber: 1,
      toTitle: "Feedback takes three weeks.",
      source: "report",
      version: 2,
      picks: ["Set a 48-hour SLA"],
    });
    expect(ctx.tasks).toMatchObject({ done: 1, doing: 1, todo: 0 });
  });

  it("falls back to the linked issue's canvas when it has no report", () => {
    const [ctx] = linkContexts(graph([{ to: "i1", type: "digs-into" }]), [], "i2");
    expect(ctx.source).toBe("canvas");
    expect(ctx.picks).toEqual(["Set a 48-hour SLA"]);
    expect(ctx.tasks).toBeUndefined();
  });

  it("skips suggested links: they never reach a report", () => {
    expect(linkContexts(graph([{ to: "i1", type: "follows-up", suggested: true }]), [], "i2")).toEqual([]);
  });
});

describe("tallyTasks", () => {
  it("names done tasks first and leaves out closed ones", () => {
    const t = tallyTasks([
      task("Todo", "todo"),
      task("Closed", "todo", { closedReason: "Not needed" }),
      task("Done", "done"),
    ]);
    expect(t).toMatchObject({ done: 1, doing: 0, todo: 1 });
    expect(t.named.map((n) => n.title)).toEqual(["Done", "Todo"]);
  });

  it("names a title once, as done when any copy of it is done", () => {
    const t = tallyTasks([task("Same", "todo"), task("Same", "done"), task("Other", "todo")]);
    expect(t.named).toEqual([
      { title: "Same", status: "done" },
      { title: "Other", status: "todo" },
    ]);
  });
});

describe("planLink", () => {
  it("runs newer to older whichever is picked first", () => {
    expect(planLink(graph().nodes, "i1", "i2")).toEqual({ ok: true, from: "i2", to: "i1" });
    expect(planLink(graph().nodes, "i2", "i1")).toEqual({ ok: true, from: "i2", to: "i1" });
  });

  it("refuses the same issue twice and an existing link", () => {
    expect(planLink(graph().nodes, "i1", "i1")).toEqual({ ok: false, reason: "same-issue" });
    expect(planLink(graph([{ to: "i1", type: "follows-up" }]).nodes, "i1", "i2")).toEqual({
      ok: false,
      reason: "already-linked",
    });
  });

  it("lets a manual link take over a suggested one", () => {
    expect(planLink(graph([{ to: "i1", type: "follows-up", suggested: true }]).nodes, "i1", "i2").ok).toBe(true);
  });
});

describe("addLink", () => {
  it("adding replaces a suggestion between the same issues", () => {
    const g = addLink(graph([{ to: "i1", type: "digs-into", suggested: true }]), "i2", "i1", "follows-up");
    expect(g.nodes.find((n) => n.id === "i2")?.links).toEqual([{ to: "i1", type: "follows-up" }]);
  });
});

describe("followUpTasks", () => {
  const fresh = [
    task("Agree on one owner", "todo", { id: "a", order: 0, needNodeId: "slot" }),
    task("Send a one-line rule", "todo", { id: "b", order: 1, needNodeId: "slot" }),
    task("Check the rule at the retro", "todo", { id: "c", order: 2, needNodeId: "slot" }),
    task("Book a CV slot", "todo", { id: "d", order: 3, needNodeId: "slot" }),
  ];
  const earlier = [
    task("Agree on one owner", "done", { order: 0 }),
    task("Send a one-line rule", "done", { order: 1 }),
    task("Check the rule at the retro", "todo", { order: 2 }),
  ];

  it("leaves out what Issue 1 finished and starts with where it stalled", () => {
    const g = graph([{ to: "i1", type: "follows-up" }]);
    const out = followUpTasks(fresh, g, [report(earlier)], "i2");
    expect(out.map((t) => t.title)).toEqual(["Check the rule at the retro", "Book a CV slot"]);
    expect(out.map((t) => t.order)).toEqual([0, 1]);
    expect(out[0].history.at(-1)?.label).toBe("Picked up from Issue 1");
    expect(pickedUpFrom(out[0])).toBe(1);
    expect(pickedUpFrom(out[1])).toBeNull();
  });

  it("brings the stalled task over when this issue does not propose it", () => {
    const g = graph([{ to: "i1", type: "follows-up" }]);
    const stalled = task("Ask HR for the offer data", "doing", { order: 2 });
    const out = followUpTasks(fresh, g, [report([earlier[0], stalled])], "i2");
    expect(out[0]).toMatchObject({ title: "Ask HR for the offer data", status: "doing", order: 0 });
    expect(out[0].id).not.toBe(stalled.id);
    expect(out.map((t) => t.title)).not.toContain("Agree on one owner");
  });

  it("lists the picked-up task once, even when several needs propose it", () => {
    const g = graph([{ to: "i1", type: "follows-up" }]);
    const twice = [...fresh, task("Check the rule at the retro", "todo", { id: "e", order: 4 })];
    const out = followUpTasks(twice, g, [report(earlier)], "i2");
    expect(out.map((t) => t.title)).toEqual(["Check the rule at the retro", "Book a CV slot"]);
  });

  it("does not bring back a title Issue 1 finished in another copy", () => {
    const g = graph([{ to: "i1", type: "follows-up" }]);
    const twice = [task("Agree on one owner", "done", { order: 1 }), task("Agree on one owner", "todo", { order: 0 })];
    const out = followUpTasks(fresh, g, [report(twice)], "i2");
    expect(out.map((t) => t.title)).not.toContain("Agree on one owner");
  });

  it("changes nothing for Explains it, or a follow-up with no report yet", () => {
    expect(followUpTasks(fresh, graph([{ to: "i1", type: "digs-into" }]), [report(earlier)], "i2")).toEqual(fresh);
    expect(followUpTasks(fresh, graph([{ to: "i1", type: "follows-up" }]), [], "i2")).toEqual(fresh);
  });
});
