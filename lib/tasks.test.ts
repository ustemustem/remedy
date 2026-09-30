import { describe, expect, it } from "vitest";
import {
  moveTask,
  nextTask,
  progress,
  rankByPriority,
  reviseStuck,
  tasksToIcs,
  tasksToMarkdown,
  type Task,
} from "./tasks";

function task(id: string, patch: Partial<Task> = {}): Task {
  return {
    id,
    needNodeId: `n-${id}`,
    needTitle: id,
    title: `Task ${id}`,
    why: "Because.",
    priority: "medium",
    order: 0,
    status: "todo",
    timeframe: "this-week",
    durationMin: 30,
    contact: { who: "Your manager", channel: "email", draft: "Hi." },
    steps: [{ id: `s-${id}`, text: "Do it.", done: false }],
    notes: "",
    sources: [],
    version: 1,
    history: [{ version: 1, label: "First" }],
    ...patch,
  };
}

describe("rankByPriority", () => {
  it("puts high priority first and keeps order inside a priority", () => {
    const ranked = rankByPriority([
      task("a", { priority: "low", order: 0 }),
      task("b", { priority: "high", order: 1 }),
      task("c", { priority: "high", order: 2 }),
    ]);
    expect(ranked.map((t) => [t.id, t.order])).toEqual([["b", 0], ["c", 1], ["a", 2]]);
  });
});

describe("nextTask", () => {
  it("prefers a task already in progress", () => {
    const tasks = [task("a", { order: 0 }), task("b", { order: 1, status: "doing" })];
    expect(nextTask(tasks)?.id).toBe("b");
  });

  it("is undefined when everything is done", () => {
    expect(nextTask([task("a", { status: "done" })])).toBeUndefined();
  });
});

describe("moveTask", () => {
  it("moves a task to a new status before another task", () => {
    const tasks = [task("a", { order: 0 }), task("b", { order: 1 }), task("c", { order: 2 })];
    const moved = moveTask(tasks, "c", "doing", "a");
    expect(moved.map((t) => t.id)).toEqual(["c", "a", "b"]);
    expect(moved.find((t) => t.id === "c")?.status).toBe("doing");
  });
});

describe("progress", () => {
  it("counts done tasks", () => {
    expect(progress([task("a", { status: "done" }), task("b")])).toEqual({ done: 1, total: 2 });
  });
});

describe("reviseStuck", () => {
  it("adds a version each time it is used", () => {
    const once = reviseStuck(task("a"), "no-time", "");
    const twice = reviseStuck(once, "cant-reach", "on leave");
    expect(twice.version).toBe(3);
    expect(twice.history.map((h) => h.version)).toEqual([1, 2, 3]);
  });

  it("closes the task when it is not needed", () => {
    const closed = reviseStuck(task("a"), "not-needed", "Solved by the team");
    expect(closed.status).toBe("done");
    expect(closed.closedReason).toBe("Solved by the team");
  });
});

describe("export", () => {
  it("writes a Markdown checklist", () => {
    const md = tasksToMarkdown([task("a"), task("b", { status: "done", order: 1 })]);
    expect(md).toContain("- [ ] **Task a**");
    expect(md).toContain("- [x] **Task b**");
    expect(md).toContain("  - [ ] Do it.");
  });

  it("writes an .ics event only for open tasks with a date", () => {
    expect(tasksToIcs([task("a")])).toBeNull();
    const ics = tasksToIcs([task("a", { dueDate: "2026-10-03" }), task("b", { dueDate: "2026-10-04", status: "done" })]);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261003");
    expect(ics).not.toContain("20261004");
  });
});
