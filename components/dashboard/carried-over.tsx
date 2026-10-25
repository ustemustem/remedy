"use client";

import { ArrowRight, Check, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LinkReading, LinkVerdict } from "@/lib/types";

/**
 * "Carried over from Issue 1" (docs/ideas/dock-functions.md, Link): what the
 * issues this one is linked to tell its report, as the report's first
 * section. One row per link, in two columns: the linked issue on the left in
 * three or four lines, what it means for this issue on the right.
 *
 * Built from the report's own parts (section head, report card, the need
 * list's row rhythm and type scale) so it reads as part of the document, not
 * as a banner on top of it. The reading was written when this version was
 * built (ReportData.links), so an older version keeps the reading it had.
 */
export function CarriedOver({
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
  return (
    <div className="divide-y divide-border">
      {readings.map((r, i) => (
        <CarriedRow
          key={r.toIssueId}
          reading={r}
          delayMs={i * 40}
          action={
            hasReport(r.toIssueId)
              ? { label: `Open Issue ${r.toNumber}'s report`, run: () => onOpenIssue(r.toIssueId) }
              : { label: `Show Issue ${r.toNumber} on canvas`, run: () => onShowIssue(r.toIssueId) }
          }
        />
      ))}
    </div>
  );
}

/** The section's title: names the issue when there is one link. */
export function carriedOverTitle(readings: LinkReading[]): string {
  return readings.length === 1 ? `Carried over from Issue ${readings[0].toNumber}` : "Carried over";
}

const TYPE_LABEL = { "follows-up": "Follows up", "digs-into": "Explains it" } as const;
const VERDICT_LABEL: Record<LinkVerdict, string> = { likely: "Likely", partly: "Partly", unlikely: "Unlikely" };

function CarriedRow({
  reading: r,
  delayMs,
  action,
}: {
  reading: LinkReading;
  delayMs: number;
  action: { label: string; run: () => void };
}) {
  const source = r.source === "report" ? `Report v${r.version ?? 1}` : "No report yet";
  return (
    <div
      className="need-row-in grid gap-x-8 gap-y-4 px-[var(--card-px)] py-4 min-[640px]:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {/* The linked issue, in its own words. */}
      <div className="flex min-w-0 flex-col gap-2">
        <span className="font-mono text-[length:var(--text-meta)] font-bold tracking-wide text-muted-foreground uppercase">
          Issue {r.toNumber} · {source}
        </span>
        <p className="line-clamp-3 text-[length:var(--text-quote)] text-foreground/78 italic">&ldquo;{r.toTitle}&rdquo;</p>
        {r.topPick && (
          <p className="text-[length:var(--text-label)] text-muted-foreground">
            Picked <span className="font-semibold text-foreground">{r.topPick}</span>
          </p>
        )}
      </div>

      {/* What it means for this issue. */}
      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-[length:var(--text-meta)]">
            {TYPE_LABEL[r.type]}
          </Badge>
          {r.verdict && (
            <Badge variant="outline" className="border-primary/30 bg-primary/8 text-[length:var(--text-meta)] text-primary">
              {VERDICT_LABEL[r.verdict]}
            </Badge>
          )}
        </div>

        {r.type === "follows-up" ? <FollowsUp reading={r} /> : <DigsInto reading={r} />}

        <button
          type="button"
          onClick={action.run}
          className="group mt-1 inline-flex items-center gap-1 self-start text-[length:var(--text-label)] font-medium text-primary transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          {action.label}
          <ArrowRight className="size-3.5 transition-transform duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}

/** Follows up: how far the linked issue got, and what is still open. */
function FollowsUp({ reading: r }: { reading: LinkReading }) {
  const t = r.tasks;
  if (!t) {
    // No report on the linked issue yet: nothing has been tracked.
    return (
      <p className="text-[length:var(--text-body)] text-foreground/80">
        {r.topPick ? "You were leaning toward this, but nothing is tracked yet." : "Nothing picked or tracked yet."}
      </p>
    );
  }
  const total = t.done + t.doing + t.todo;
  const done = t.named.filter((n) => n.status === "done");
  const open = t.named.filter((n) => n.status !== "done");
  return (
    <>
      <p className="text-[length:var(--text-support-title)] font-semibold tracking-[-0.005em] text-foreground">
        {t.done} of {total} tasks done
      </p>
      <div className="flex gap-1" role="img" aria-label={`${t.done} of ${total} tasks done`}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < t.done ? "bg-primary" : "bg-foreground/10"}`} />
        ))}
      </div>
      {(done.length > 0 || open.length > 0) && (
        <ul className="space-y-1 text-[length:var(--text-quote)]">
          {done.map((n) => (
            <li key={n.title} className="flex items-center gap-2 text-muted-foreground">
              <Check className="size-3.5 shrink-0 text-primary" />
              {n.title}
            </li>
          ))}
          {open.map((n) => (
            <li key={n.title} className="flex items-center gap-2 text-foreground">
              <Circle className="size-3 shrink-0 text-muted-foreground" />
              {n.title}
              <span className="text-muted-foreground">· still open</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Explains it: is this issue the cause of the linked one, and why. */
function DigsInto({ reading: r }: { reading: LinkReading }) {
  return (
    <>
      <p className="text-[length:var(--text-support-title)] font-semibold tracking-[-0.005em] text-foreground">
        {r.headline}
      </p>
      <p className="max-w-[62ch] text-[length:var(--text-body)] leading-relaxed text-foreground/80">{r.detail}</p>
    </>
  );
}
