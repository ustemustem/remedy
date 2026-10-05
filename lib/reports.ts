/**
 * Saved reports: a report is built once, saved with its session, and opened
 * from storage after that (no loader, no LLM call). Each issue on the canvas
 * keeps its own version list. A new version is built only when the canvas has
 * changed since the latest one and the user reaches the end of a path again.
 *
 * Today a canvas holds one issue, and its id is the source node's id. The
 * multi-issue canvas adds more source nodes; this model already keys on them.
 */

import type { CanvasGraph, CanvasNodeData, ReportData } from "./types";
import type { Task } from "./tasks";

export interface SavedReport {
  id: string;
  /** The source (quote) node this report is about. */
  issueId: string;
  /** The issue's text as it read when the report was built. */
  issueTitle: string;
  /** 1, 2, 3 ... per issue. */
  version: number;
  data: ReportData;
  /** The canvas this version was built from. The report renders from this
   *  snapshot, so later canvas edits never change a saved version. */
  graph: CanvasGraph;
  tasks: Task[];
  createdAt: number;
}

export interface Issue {
  id: string;
  title: string;
}

/** The canvas's first issue. Kept for callers that predate several issues. */
export function getIssue(graph: CanvasGraph): Issue | null {
  return getIssues(graph)[0] ?? null;
}

/** Every written issue on the canvas (each source node that is not a draft),
 *  in the order they were added. */
export function getIssues(graph: CanvasGraph): Issue[] {
  return graph.nodes
    .filter((n) => n.kind === "source" && !n.draft)
    .map((n) => ({ id: n.id, title: n.body }));
}

/** One issue's own tree as a graph: what its report is built from and saved as. */
export function issueGraph(graph: CanvasGraph, issueId: string): CanvasGraph {
  const nodes = issueNodes(graph.nodes, issueId);
  const ids = new Set(nodes.map((n) => n.id));
  return { nodes, edges: graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target)) };
}

/** The issue a card belongs to: the source node at the root of its tree. */
export function issueOf(nodeId: string, nodes: CanvasNodeData[]): string | null {
  return rootOf(nodeId, new Map(nodes.map((n) => [n.id, n])));
}

function rootOf(nodeId: string, byId: Map<string, CanvasNodeData>): string | null {
  let node = byId.get(nodeId);
  const seen = new Set<string>();
  while (node && node.parentId && !seen.has(node.id)) {
    seen.add(node.id);
    node = byId.get(node.parentId);
  }
  return node?.kind === "source" ? node.id : null;
}

/** The nodes in one issue's tree. */
function issueNodes(nodes: CanvasNodeData[], issueId: string): CanvasNodeData[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return nodes.filter((n) => rootOf(n.id, byId) === issueId);
}

export type IssueReportStatus = "none" | "current" | "outdated";

export interface IssueReportState {
  issue: Issue;
  latest: SavedReport | null;
  status: IssueReportStatus;
}

/** Each issue with its latest report and whether its tree changed since. */
export function issueStates(reports: SavedReport[], graph: CanvasGraph): IssueReportState[] {
  return getIssues(graph).map((issue) => {
    const latest = latestReport(reports, issue.id);
    const status: IssueReportStatus = !latest ? "none" : isOutdated(latest, graph) ? "outdated" : "current";
    return { issue, latest, status };
  });
}

/** Versions of one issue, oldest first. */
export function reportsForIssue(reports: SavedReport[], issueId: string): SavedReport[] {
  return reports.filter((r) => r.issueId === issueId).sort((a, b) => a.version - b.version);
}

export function latestReport(reports: SavedReport[], issueId: string): SavedReport | null {
  const versions = reportsForIssue(reports, issueId);
  return versions[versions.length - 1] ?? null;
}

/** Issues that have at least one report, in the order their first report was built. */
export function reportedIssues(reports: SavedReport[]): Issue[] {
  const seen = new Map<string, Issue>();
  for (const r of [...reports].sort((a, b) => a.createdAt - b.createdAt)) {
    if (!seen.has(r.issueId)) seen.set(r.issueId, { id: r.issueId, title: r.issueTitle });
  }
  return [...seen.values()];
}

/** True when this issue's tree changed after the version was built. Any node
 *  change in the tree counts: a pick, a note, a select, a like. Changes in
 *  another issue's tree do not. */
export function isOutdated(report: SavedReport, graph: CanvasGraph): boolean {
  return (
    JSON.stringify(issueNodes(report.graph.nodes, report.issueId)) !==
    JSON.stringify(issueNodes(graph.nodes, report.issueId))
  );
}

/**
 * A new version keeps the user's work. A task that the new version still
 * proposes (same recommendation, same title) keeps its status, steps, notes,
 * and history from the previous version. Only tasks that are really new come
 * in fresh.
 */
export function carryTasks(previous: Task[], next: Task[]): Task[] {
  const key = (t: Task) => `${t.needNodeId}::${t.title}`;
  const byKey = new Map(previous.map((t) => [key(t), t]));
  // The new version sets the order; the user's own work comes from the old task.
  return next.map((t) => {
    const prev = byKey.get(key(t));
    return prev ? { ...prev, order: t.order } : t;
  });
}

export function newReportId(): string {
  return `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
