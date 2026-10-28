"use client";

import { Fragment } from "react";
import type { LinkReading } from "@/lib/types";

/**
 * What the linked issues mean for this report, said in the report's own
 * subtitle (the line under "Your Prescription"). It replaced a Section 01
 * band on 2026-10-28: the band repeated what the canvas link pill and the
 * Next step card already show, so the owner asked for one plain sentence that
 * belongs to the header instead. "Issue N" opens the linked issue's report,
 * or its place on the canvas when it has none.
 */
export function LinkedIntro({
  readings,
  hasReport,
  onOpenIssue,
  onShowIssue,
}: {
  readings: LinkReading[];
  /** Whether the linked issue has a saved report to open now. */
  hasReport: (issueId: string) => boolean;
  onOpenIssue: (issueId: string) => void;
  onShowIssue: (issueId: string) => void;
}) {
  return readings.map((r, i) => (
    <Fragment key={r.toIssueId}>
      {i > 0 && " "}
      <span className="font-medium text-foreground">
        {r.type === "follows-up" ? "Follows up " : "Explains "}
        <button
          type="button"
          onClick={() => (hasReport(r.toIssueId) ? onOpenIssue(r.toIssueId) : onShowIssue(r.toIssueId))}
          className="rounded-[2px] font-medium underline decoration-primary/40 decoration-1 underline-offset-[3px] transition-colors hover:decoration-primary"
        >
          Issue {r.toNumber}
        </button>
      </span>
      {rest(r)}
    </Fragment>
  ));
}

/** The rest of the sentence after "Follows up Issue N" / "Explains Issue N". */
function rest(r: LinkReading): string {
  if (r.type === "digs-into") return `. ${r.detail}`;
  const t = r.tasks;
  const total = t ? t.done + t.doing + t.todo : 0;
  if (!t || total === 0) return ".";
  if (t.done === total) return `: you finished all ${total} tasks there, so this starts from that.`;
  if (t.done === 0) return ": this starts with the task that stalled there.";
  const tasks = t.done === 1 ? "the task" : `the ${t.done} tasks`;
  return `: leaves out ${tasks} you finished there and starts with the one that stalled.`;
}
