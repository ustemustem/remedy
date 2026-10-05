import { describe, expect, it } from "vitest";
import { deriveDashboardNeeds } from "./graph";
import { buildMockTasks } from "./tasks-mock";
import { sortTasks } from "./tasks";
import { usedAngles } from "./angles";
import type { CanvasNodeData } from "./types";

function node(id: string, patch: Partial<CanvasNodeData> = {}): CanvasNodeData {
  return { id, kind: "recommendation", title: id, body: `${id} body`, parentId: "src", depth: 1, selected: false, ...patch };
}

const NODES: CanvasNodeData[] = [
  node("src", { kind: "source", parentId: null, depth: 0, body: "I can't find a job." }),
  node("rec", { selected: true, title: "Rewrite the CV" }),
  node("a-push", { kind: "angle", angle: "pushback", parentId: "rec", depth: 2, title: "Your old manager" }),
  node("a-step", { kind: "angle", angle: "step", parentId: "rec", depth: 2, title: "Fix the summary line", selected: true }),
];

describe("Spark angles in the report", () => {
  it("joins angles to the need they test, never as needs of their own", () => {
    const needs = deriveDashboardNeeds(NODES);
    expect(needs.map((n) => n.node.id)).toEqual(["rec"]);
    expect(needs[0].angles?.pushback?.id).toBe("a-push");
    expect(needs[0].angles?.step?.id).toBe("a-step");
    expect(needs[0].angles?.risk).toBeUndefined();
  });

  it("makes the step angle the need's first task and names the pushback contact", () => {
    const tasks = sortTasks(buildMockTasks(deriveDashboardNeeds(NODES)));
    expect(tasks[0]).toMatchObject({ title: "Fix the summary line", timeframe: "this-week", priority: "high" });
    expect(tasks.some((t) => t.contact.who === "Your old manager")).toBe(true);
  });

  it("lists the angles already open on a card", () => {
    expect(usedAngles(NODES[1], NODES).sort()).toEqual(["pushback", "step"]);
  });
});
