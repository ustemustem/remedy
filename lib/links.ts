/**
 * Links between issues (docs/ideas/dock-functions.md, Link). A link runs from
 * a newer issue's quote to an older one's and is stored on the newer quote
 * (`CanvasNodeData.links`). This module holds the pure parts: making and
 * accepting links, and reading what a linked issue tells the report.
 *
 * The report reads the linked issue's latest report when it has one (its
 * picks and where its tasks stand), otherwise its canvas (the cards picked so
 * far). `lib/mockAI.ts`'s `getLinkReadings` turns that into the band's words.
 */

import { deriveDashboardNeeds } from "./graph";
import { getIssues, issueGraph, latestReport, type SavedReport } from "./reports";
import { nextTask, sortTasks, type Task } from "./tasks";
import type { CanvasGraph, CanvasNodeData, IssueLinkType, LinkTaskTally } from "./types";

/** What the report knows about one linked issue before any words are written. */
export interface LinkContext {
  toIssueId: string;
  toNumber: number;
  toTitle: string;
  type: IssueLinkType;
  source: "report" | "canvas";
  version?: number;
  /** Titles of the recommendations the linked issue kept (its report's needs,
   *  or the cards selected on its canvas). */
  picks: string[];
  /** Report source only. */
  tasks?: LinkTaskTally;
}

/** The accepted links of one issue, with what each linked issue has to say. */
export function linkContexts(graph: CanvasGraph, reports: SavedReport[], issueId: string): LinkContext[] {
  const issues = getIssues(graph);
  const source = graph.nodes.find((n) => n.id === issueId);
  return (source?.links ?? [])
    .filter((l) => !l.suggested)
    .flatMap((link): LinkContext[] => {
      const at = issues.findIndex((i) => i.id === link.to);
      if (at < 0) return [];
      const base = { toIssueId: link.to, toNumber: at + 1, toTitle: issues[at].title, type: link.type };
      const report = latestReport(reports, link.to);
      if (report) {
        return [
          {
            ...base,
            source: "report",
            version: report.version,
            picks: deriveDashboardNeeds(report.graph.nodes).map((n) => n.node.title),
            tasks: tallyTasks(report.tasks),
          },
        ];
      }
      return [
        {
          ...base,
          source: "canvas",
          picks: deriveDashboardNeeds(issueGraph(graph, link.to).nodes).map((n) => n.node.title),
        },
      ];
    });
}

export function tallyTasks(tasks: SavedReport["tasks"]): LinkTaskTally {
  const open = tasks.filter((t) => !t.closedReason);
  const by = (s: "done" | "doing" | "todo") => open.filter((t) => t.status === s);
  // One entry per title: several recommendations can propose the same task,
  // and a title already done is not "still open" too.
  const seen = new Set<string>();
  const named = [...by("done"), ...by("doing"), ...by("todo")]
    .filter((t) => !seen.has(t.title) && seen.add(t.title))
    .slice(0, 3)
    .map((t) => ({ title: t.title, status: t.status }));
  return { done: by("done").length, doing: by("doing").length, todo: by("todo").length, named };
}

/**
 * A "Follows up" link carries work over into this issue's task list: tasks
 * the earlier issue already finished (or closed) are left out, and the task
 * it stalled on comes first, as this issue's own task when it proposes the
 * same one, else brought over. "Explains it" links and follow-ups with no
 * report yet change nothing. Matched by title, like `tallyTasks`.
 */
export function followUpTasks(fresh: Task[], graph: CanvasGraph, reports: SavedReport[], issueId: string): Task[] {
  const followed = linkContexts(graph, reports, issueId).flatMap((ctx) => {
    const report = ctx.type === "follows-up" && ctx.source === "report" ? latestReport(reports, ctx.toIssueId) : null;
    return report ? [{ number: ctx.toNumber, tasks: report.tasks }] : [];
  });
  if (followed.length === 0) return fresh;

  const finished = new Set(
    followed.flatMap((f) => f.tasks.filter((t) => t.status === "done" || t.closedReason).map((t) => t.title))
  );
  const rest = sortTasks(fresh).filter((t) => !finished.has(t.title));

  // The first followed issue that still has open work sets the first step. A
  // title finished once does not count as open, even if another copy is.
  const open = (tasks: Task[]) => tasks.filter((t) => !finished.has(t.title));
  const from = followed.find((f) => nextTask(open(f.tasks)));
  const stalled = from && nextTask(open(from.tasks));
  if (!from || !stalled) return rest.map((t, i) => ({ ...t, order: i }));

  const label = `${PICKED_UP}${from.number}`;
  const own = rest.find((t) => t.title === stalled.title);
  const first: Task = own
    ? { ...own, priority: "high", history: [...own.history, { version: own.version, label }] }
    : { ...stalled, id: `task-follow-${stalled.id}`, history: [{ version: stalled.version, label }] };
  // Picked up once: other copies of the same task are left out.
  return [first, ...rest.filter((t) => t.title !== stalled.title)].map((t, i) => ({ ...t, order: i }));
}

const PICKED_UP = "Picked up from Issue ";

/** The issue number a task was picked up from by followUpTasks, or null. */
export function pickedUpFrom(task: Task): number | null {
  const label = task.history.find((h) => h.label.startsWith(PICKED_UP))?.label;
  return label ? Number(label.slice(PICKED_UP.length)) || null : null;
}

// ---------------------------------------------------------------------------
// Making links (Link mode in the dock, and the suggested link on New issue).
// ---------------------------------------------------------------------------

export type LinkAttempt =
  | { ok: true; from: string; to: string }
  | { ok: false; reason: "same-issue" | "already-linked" };

/**
 * Link two issues picked in any order. The link always runs from the newer
 * issue to the older one (canvas order). A suggested link between the same
 * two issues does not block: linking them accepts it.
 */
export function planLink(nodes: CanvasNodeData[], a: string, b: string): LinkAttempt {
  if (a === b) return { ok: false, reason: "same-issue" };
  const order = nodes.filter((n) => n.kind === "source" && !n.draft).map((n) => n.id);
  const [from, to] = order.indexOf(a) > order.indexOf(b) ? [a, b] : [b, a];
  const existing = nodes.find((n) => n.id === from)?.links?.find((l) => l.to === to);
  if (existing && !existing.suggested) return { ok: false, reason: "already-linked" };
  return { ok: true, from, to };
}

/** Add (or accept) the link from → to. */
export function addLink(graph: CanvasGraph, from: string, to: string, type: IssueLinkType): CanvasGraph {
  return {
    nodes: graph.nodes.map((n) =>
      n.id !== from ? n : { ...n, links: [...(n.links ?? []).filter((l) => l.to !== to), { to, type }] }
    ),
    edges: graph.edges,
  };
}
