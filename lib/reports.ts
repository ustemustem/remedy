/**
 * Saved reports: a report is built once, saved with its session, and opened
 * from storage after that (no loader, no LLM call). Each issue on the canvas
 * keeps its own version list. A new version is built only when the canvas has
 * changed since the latest one and the user reaches the end of a path again.
 *
 * Today a canvas holds one issue, and its id is the source node's id. The
 * multi-issue canvas adds more source nodes; this model already keys on them.
 */

import type { CanvasGraph, ReportData } from "./types";
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

/** The canvas's issue. One source node per canvas for now. */
export function getIssue(graph: CanvasGraph): Issue | null {
  const source = graph.nodes.find((n) => n.kind === "source");
  return source ? { id: source.id, title: source.body } : null;
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

/** True when the canvas changed after this version was built. Any node
 *  change counts: a pick, a note, a select, a like. */
export function isOutdated(report: SavedReport, graph: CanvasGraph): boolean {
  return JSON.stringify(report.graph.nodes) !== JSON.stringify(graph.nodes);
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
