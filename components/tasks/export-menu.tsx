"use client";

import { useState, type ReactNode } from "react";
import { CalendarPlus, Check, ClipboardCopy, Download } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { tasksToIcs, tasksToMarkdown, type Task } from "@/lib/tasks";

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export the task list to a note app. Copy gives a Markdown checklist that
 * Notion, Obsidian and Apple Notes turn into to-dos on paste. The .ics option
 * only shows when at least one open task has a date.
 */
export function ExportMenu({ tasks, trigger }: { tasks: Task[]; trigger: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const ics = tasksToIcs(tasks);

  async function copy() {
    try {
      await navigator.clipboard.writeText(tasksToMarkdown(tasks));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      download("remedy-tasks.md", tasksToMarkdown(tasks), "text/markdown");
    }
  }

  const item =
    "flex w-full items-center gap-2 rounded-[calc(var(--radius-surface)-2px)] px-2 py-1.5 text-left text-sm hover:bg-muted";

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1">
        <button type="button" className={item} onClick={copy}>
          {copied ? <Check className="size-4 text-primary" /> : <ClipboardCopy className="size-4" />}
          <span className="flex-1">{copied ? "Copied" : "Copy for Notion or Notes"}</span>
        </button>
        <button
          type="button"
          className={item}
          onClick={() => download("remedy-tasks.md", tasksToMarkdown(tasks), "text/markdown")}
        >
          <Download className="size-4" />
          <span className="flex-1">Download .md file</span>
        </button>
        <button
          type="button"
          className={item}
          disabled={!ics}
          onClick={() => ics && download("remedy-tasks.ics", ics, "text/calendar")}
          title={ics ? undefined : "Pick a date on a task first"}
        >
          <CalendarPlus className="size-4" />
          <span className="flex-1">{ics ? "Add dated tasks to calendar" : "Calendar (pick a date first)"}</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}
