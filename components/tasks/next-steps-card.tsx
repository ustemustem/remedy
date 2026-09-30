"use client";

import { ArrowRight, ChevronDown, Clock, MessageSquare, User } from "lucide-react";
import {
  CHANNEL_LABEL,
  TIMEFRAME_LABEL,
  nextTask,
  progress,
  sortTasks,
  type Task,
  type TaskPriority,
} from "@/lib/tasks";
import { ExportMenu } from "./export-menu";

const PRIORITY_DOT: Record<TaskPriority, string> = {
  high: "bg-cta",
  medium: "bg-accent",
  low: "bg-[rgba(244,246,245,0.4)]",
};

/**
 * The report's "Next steps" card: the one inverted (brand-green) surface on
 * the report, with a quietly moving background (see `.next-steps-card` in
 * globals.css). It answers "what do I do now?" with the single next task,
 * the two after it, and progress. Its main action opens the My tasks tab.
 */
export function NextStepsCard({
  tasks,
  onOpenTasks,
  onOpenTask,
}: {
  tasks: Task[];
  onOpenTasks: () => void;
  onOpenTask: (taskId: string) => void;
}) {
  const first = nextTask(tasks);
  const then = sortTasks(tasks.filter((t) => t.status !== "done" && t.id !== first?.id)).slice(0, 2);
  const { done, total } = progress(tasks);

  return (
    <section aria-labelledby="next-steps-title" className="next-steps-card px-[var(--card-px)] py-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="ns-dot" aria-hidden="true" />
          <h2
            id="next-steps-title"
            className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--paper)]"
          >
            Your next step
          </h2>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-[rgba(244,246,245,0.65)]">
          {done}/{total} done
        </span>
      </div>

      {first ? (
        <button
          type="button"
          onClick={() => onOpenTask(first.id)}
          className="ns-first ns-press need-row-in group block w-full px-3 py-3 text-left"
          style={{ animationDelay: "120ms" }}
        >
          <span className="flex items-start justify-between gap-3">
            <span className="text-[15px] font-semibold leading-snug">{first.title}</span>
            <ArrowRight className="mt-0.5 size-4 shrink-0 opacity-60 transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[rgba(244,246,245,0.72)]">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {TIMEFRAME_LABEL[first.timeframe]} · ~{first.durationMin} min
            </span>
            <span className="inline-flex items-center gap-1">
              <User className="size-3" />
              {first.contact.who}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="size-3" />
              {CHANNEL_LABEL[first.contact.channel]}
            </span>
          </span>
        </button>
      ) : (
        <p className="ns-first px-3 py-3 text-sm">
          Every task is done. Good work. Open My tasks to review what you did.
        </p>
      )}

      {then.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[rgba(244,246,245,0.55)]">
            Then
          </p>
          <ul className="space-y-0.5">
            {then.map((t, i) => (
              <li key={t.id} className="need-row-in" style={{ animationDelay: `${180 + i * 50}ms` }}>
                <button
                  type="button"
                  onClick={() => onOpenTask(t.id)}
                  className="flex w-full items-center gap-2 rounded-[4px] px-1 py-1 text-left text-[13px] text-[rgba(244,246,245,0.85)] transition-colors hover:bg-[rgba(244,246,245,0.06)] hover:text-[color:var(--paper)]"
                >
                  <span className={`size-1.5 shrink-0 rounded-full ${PRIORITY_DOT[t.priority]}`} />
                  <span className="truncate">{t.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <div className="ns-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Tasks done">
          <div className="ns-progress-fill" style={{ transform: `scaleX(${total ? done / total : 0})` }} />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenTasks}
          className="ns-press inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-cta px-3 text-sm font-medium text-cta-foreground transition-colors hover:bg-cta/90"
        >
          Open my tasks
          <ArrowRight className="size-3.5" />
        </button>
        <ExportMenu
          tasks={tasks}
          trigger={
            <button
              type="button"
              className="ns-press inline-flex h-8 items-center gap-1 rounded-[var(--radius-control)] border border-[rgba(244,246,245,0.22)] px-2.5 text-sm text-[color:var(--paper)] transition-colors hover:bg-[rgba(244,246,245,0.08)]"
            >
              Export
              <ChevronDown className="size-3.5 opacity-70" />
            </button>
          }
        />
      </div>
    </section>
  );
}
