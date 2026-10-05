"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { latestReport, reportedIssues, reportsForIssue, type SavedReport } from "@/lib/reports";

/**
 * Two-step report switcher: pick the issue, then the version. Picking an
 * issue opens its latest version. Each issue keeps its own versions, so the
 * version list only ever shows the chosen issue's reports.
 */
export function ReportPicker({
  report,
  reports,
  issueOrder = [],
  onSelect,
}: {
  report: SavedReport;
  reports: SavedReport[];
  /** Issue ids in canvas order, so "Issue 2" here is "Issue 2" on the canvas. */
  issueOrder?: string[];
  onSelect: (reportId: string) => void;
}) {
  const rank = (id: string) => {
    const i = issueOrder.indexOf(id);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const issues = [...reportedIssues(reports)].sort((a, b) => rank(a.id) - rank(b.id));
  const numberOf = (id: string) =>
    issueOrder.includes(id) ? issueOrder.indexOf(id) + 1 : issues.findIndex((i) => i.id === id) + 1;
  const versions = reportsForIssue(reports, report.issueId);
  const issueLabel = numberOf(report.issueId);

  return (
    <div className="flex items-center gap-1">
      <PickerMenu
        label="Issue"
        trigger={<span className="max-w-[18ch] truncate">Issue {issueLabel}</span>}
        items={issues.map((issue) => ({
          id: issue.id,
          primary: `Issue ${numberOf(issue.id)}`,
          secondary: issue.title,
          active: issue.id === report.issueId,
          onPick: () => {
            const latest = latestReport(reports, issue.id);
            if (latest) onSelect(latest.id);
          },
        }))}
      />
      <span aria-hidden="true" className="text-muted-foreground">/</span>
      <PickerMenu
        label="Version"
        trigger={<span>v{report.version}</span>}
        items={[...versions].reverse().map((v, i) => ({
          id: v.id,
          primary: `v${v.version}${i === 0 ? " · latest" : ""}`,
          secondary: new Date(v.createdAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          active: v.id === report.id,
          onPick: () => onSelect(v.id),
        }))}
      />
    </div>
  );
}

function PickerMenu({
  label,
  trigger,
  items,
}: {
  label: string;
  trigger: ReactNode;
  items: { id: string; primary: string; secondary: string; active: boolean; onPick: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Choose ${label.toLowerCase()}`}
          className="flex items-center gap-1 rounded-[var(--radius-control)] px-2 py-1 font-mono text-xs font-bold text-foreground transition-colors hover:bg-muted"
        >
          {trigger}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <p className="px-2 pt-1.5 pb-1 font-mono text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              item.onPick();
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-start gap-2 rounded-[var(--radius-control)] px-2 py-1.5 text-left transition-colors hover:bg-muted",
              item.active && "bg-muted"
            )}
          >
            <Check className={cn("mt-0.5 h-3 w-3 shrink-0", !item.active && "invisible")} />
            <span className="min-w-0">
              <span className="block text-xs font-medium text-foreground">{item.primary}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{item.secondary}</span>
            </span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
