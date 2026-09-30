"use client";

import { useState } from "react";
import { ChevronDown, Columns3, List, MessageSquare, Plus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CHANNEL_LABEL,
  PRIORITY_LABEL,
  STATUS_LABEL,
  STATUS_ORDER,
  TIMEFRAME_LABEL,
  moveTask,
  progress,
  sortTasks,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks";
import { Segmented } from "./segmented";
import { TaskDetail } from "./task-detail";
import { ExportMenu } from "./export-menu";

type View = "list" | "board";

const PRIORITY_DOT: Record<TaskPriority, string> = {
  high: "bg-cta",
  medium: "bg-accent",
  low: "bg-muted-foreground/40",
};

function PriorityTag({ priority }: { priority: TaskPriority }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
      <span className={cn("size-1.5 rounded-full", PRIORITY_DOT[priority])} />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

function Meta({ task }: { task: Task }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-muted-foreground">
      <span>{task.dueDate ?? TIMEFRAME_LABEL[task.timeframe]}</span>
      <span className="inline-flex items-center gap-1">
        <User className="size-3" />
        {task.contact.who}
      </span>
      <span className="inline-flex items-center gap-1">
        <MessageSquare className="size-3" />
        {CHANNEL_LABEL[task.contact.channel]}
      </span>
    </span>
  );
}

/**
 * The My tasks tab: every task from this report, as a list or a board, with
 * the opened task on the right. The board's columns are status; the order
 * inside a column starts as the AI's priority ranking and then follows the
 * user's drag-and-drop.
 */
export function TasksView({
  tasks,
  onTasksChange,
  selectedId,
  onSelect,
}: {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  selectedId: string | null;
  onSelect: (taskId: string | null) => void;
}) {
  const [view, setView] = useState<View>("list");
  const [doneOpen, setDoneOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);

  const selected = tasks.find((t) => t.id === selectedId) ?? null;
  const { done, total } = progress(tasks);
  const sorted = sortTasks(tasks);

  const update = (task: Task) => onTasksChange(tasks.map((t) => (t.id === task.id ? task : t)));
  const remove = (id: string) => {
    onTasksChange(tasks.filter((t) => t.id !== id));
    onSelect(null);
  };
  const toggleDone = (task: Task) => update({ ...task, status: task.status === "done" ? "todo" : "done" });

  function addTask() {
    const id = `task-user-${Date.now()}`;
    const task: Task = {
      id,
      needNodeId: "",
      needTitle: "Your own task",
      title: "New task",
      why: "A task you added yourself.",
      priority: "medium",
      order: -1,
      status: "todo",
      timeframe: "this-week",
      durationMin: 30,
      contact: { who: "", channel: "email", draft: "" },
      steps: [],
      notes: "",
      sources: [],
      version: 1,
      history: [{ version: 1, label: "Added by you" }],
    };
    onTasksChange([task, ...tasks]);
    onSelect(id);
  }

  function drop(status: TaskStatus, beforeId?: string) {
    if (dragId && dragId !== beforeId) onTasksChange(moveTask(tasks, dragId, status, beforeId));
    setDragId(null);
    setOverCol(null);
  }

  const row = (task: Task, i: number) => (
    <li key={task.id} className="need-row-in" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
      <div
        className={cn(
          "flex items-start gap-3 rounded-[var(--radius-surface)] border px-3 py-2.5 transition-colors",
          task.id === selectedId ? "border-primary/40 bg-card" : "border-transparent hover:bg-card/70"
        )}
      >
        <input
          type="checkbox"
          checked={task.status === "done"}
          onChange={() => toggleDone(task)}
          className="mt-1 size-3.5 accent-[var(--primary)]"
          aria-label={`Mark "${task.title}" done`}
        />
        <button type="button" onClick={() => onSelect(task.id)} className="min-w-0 flex-1 text-left">
          <span className="flex items-center justify-between gap-3">
            <span
              className={cn(
                "text-[14px] font-medium",
                task.status === "done" ? "text-muted-foreground line-through" : "text-foreground"
              )}
            >
              {task.title}
            </span>
            {task.status === "doing" && (
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                {STATUS_LABEL.doing}
              </span>
            )}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <PriorityTag priority={task.priority} />
            <Meta task={task} />
          </span>
        </button>
      </div>
    </li>
  );

  const open = sorted.filter((t) => t.status !== "done");
  const closed = sorted.filter((t) => t.status === "done");

  return (
    <div className="grid gap-6 min-[1024px]:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">My tasks</h2>
            <p className="text-[13px] text-muted-foreground">
              {done} of {total} done. Ordered by what to do first.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Segmented
              label="Task view"
              value={view}
              onChange={setView}
              options={[
                { value: "list", label: <><List className="size-3.5" />List</> },
                { value: "board", label: <><Columns3 className="size-3.5" />Board</> },
              ]}
            />
            <Button variant="outline" size="sm" onClick={addTask}>
              <Plus />
              Add task
            </Button>
            <ExportMenu
              tasks={tasks}
              trigger={
                <Button variant="outline" size="sm">
                  Export
                  <ChevronDown />
                </Button>
              }
            />
          </div>
        </div>

        {view === "list" ? (
          <div>
            <ul className="flex flex-col gap-1">{open.map(row)}</ul>
            {closed.length > 0 && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setDoneOpen((v) => !v)}
                  className="mb-1 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown className={cn("size-3.5 transition-transform duration-200", !doneOpen && "-rotate-90")} />
                  Done ({closed.length})
                </button>
                <div className="see-more-panel" data-open={doneOpen}>
                  <div>
                    <ul className="flex flex-col gap-1">{closed.map(row)}</ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {STATUS_ORDER.map((status) => {
              const col = sorted.filter((t) => t.status === status);
              return (
                <section
                  key={status}
                  className="task-column flex min-h-40 flex-col gap-2 rounded-[var(--radius-card)] border border-border p-2 transition-colors"
                  data-over={overCol === status}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverCol(status);
                  }}
                  onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
                  onDrop={() => drop(status)}
                >
                  <h3 className="flex items-center justify-between px-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    {STATUS_LABEL[status]}
                    <span className="tabular-nums font-normal">{col.length}</span>
                  </h3>
                  {col.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      draggable
                      onDragStart={() => setDragId(task.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverCol(null);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.stopPropagation();
                        drop(status, task.id);
                      }}
                      onClick={() => onSelect(task.id)}
                      className={cn(
                        "ns-press report-card-surface flex cursor-grab flex-col gap-1.5 rounded-[var(--radius-surface)] border bg-card px-2.5 py-2 text-left active:cursor-grabbing",
                        task.id === selectedId ? "border-primary/40" : "border-border",
                        task.id === dragId && "task-card-dragging"
                      )}
                    >
                      <PriorityTag priority={task.priority} />
                      <span className={cn("text-[13px] font-medium leading-snug", status === "done" && "text-muted-foreground line-through")}>
                        {task.title}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {task.dueDate ?? TIMEFRAME_LABEL[task.timeframe]} · {task.contact.who || "No contact"}
                      </span>
                    </button>
                  ))}
                </section>
              );
            })}
          </div>
        )}
      </div>

      <aside className="min-w-0">
        <div className="min-[1024px]:sticky min-[1024px]:top-0">
          {selected ? (
            <TaskDetail key={selected.id} task={selected} onChange={update} onDelete={remove} onClose={() => onSelect(null)} />
          ) : (
            <div className="rounded-[var(--radius-card)] border border-dashed border-border px-4 py-10 text-center text-[13px] text-muted-foreground">
              Open a task to see its steps, contact, and notes.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
