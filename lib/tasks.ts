/**
 * "My tasks": the action list a report turns into. Each task comes from one
 * kept recommendation (`needNodeId`) and carries everything the user needs to
 * act on it: who to talk to, through which channel, a ready opening message,
 * concrete steps, and sources.
 *
 * MOCK PASS: tasks are built by `lib/tasks-mock.ts` from the report's needs,
 * and "I'm stuck" / "Break into steps" are canned revisions. A real
 * `generateTasks` seam replaces the mock once the design is approved.
 */

export type TaskStatus = "todo" | "doing" | "done";
export type TaskPriority = "high" | "medium" | "low";
export type TaskTimeframe = "today" | "this-week" | "this-month" | "later";
export type TaskChannel = "in-person" | "email" | "slack" | "call";
export type StuckReason = "cant-reach" | "no-time" | "dont-know-start" | "not-needed";

export interface TaskStep {
  id: string;
  text: string;
  done: boolean;
}

export interface TaskRevision {
  version: number;
  /** Short label for what produced this version, e.g. "Stuck: no time". */
  label: string;
}

export interface Task {
  id: string;
  /** The kept recommendation this task comes from. */
  needNodeId: string;
  needTitle: string;
  title: string;
  /** One or two sentences: why this task matters. */
  why: string;
  priority: TaskPriority;
  /** Position inside its status column. Lower comes first. */
  order: number;
  status: TaskStatus;
  timeframe: TaskTimeframe;
  durationMin: number;
  /** ISO date (YYYY-MM-DD) the user picked. Optional. */
  dueDate?: string;
  contact: { who: string; channel: TaskChannel; draft: string };
  steps: TaskStep[];
  notes: string;
  sources: { label: string; url: string }[];
  version: number;
  history: TaskRevision[];
  /** Set when the user closed the task as "not needed". */
  closedReason?: string;
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  doing: "In progress",
  done: "Done",
};
export const STATUS_ORDER: TaskStatus[] = ["todo", "doing", "done"];

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};
const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

export const TIMEFRAME_LABEL: Record<TaskTimeframe, string> = {
  today: "Today",
  "this-week": "This week",
  "this-month": "This month",
  later: "Later",
};

export const CHANNEL_LABEL: Record<TaskChannel, string> = {
  "in-person": "In person",
  email: "Email",
  slack: "Slack",
  call: "Call",
};

export const STUCK_LABEL: Record<StuckReason, string> = {
  "cant-reach": "I can't reach the person",
  "no-time": "I don't have time",
  "dont-know-start": "I don't know where to start",
  "not-needed": "It's not needed anymore",
};

/** Tasks in their current order. The AI sets the first order by priority
 *  (`rankByPriority`); after that, the user's drag-and-drop owns it. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => a.order - b.order);
}

/** Re-number `order` so higher priority comes first. Stable inside a priority. */
export function rankByPriority(tasks: Task[]): Task[] {
  return [...tasks]
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.order - b.order)
    .map((t, i) => ({ ...t, order: i }));
}

/** Move a task into `status`, placed before `beforeId` (or at the end). */
export function moveTask(tasks: Task[], taskId: string, status: TaskStatus, beforeId?: string): Task[] {
  const moving = tasks.find((t) => t.id === taskId);
  if (!moving) return tasks;
  const rest = sortTasks(tasks.filter((t) => t.id !== taskId));
  const updated = { ...moving, status };
  const at = beforeId ? rest.findIndex((t) => t.id === beforeId) : -1;
  const ordered = at === -1 ? [...rest, updated] : [...rest.slice(0, at), updated, ...rest.slice(at)];
  return ordered.map((t, i) => ({ ...t, order: i }));
}

/** The single task to do next: the top open task that is already in progress,
 *  else the top open task. Undefined when every task is done or closed. */
export function nextTask(tasks: Task[]): Task | undefined {
  const open = sortTasks(tasks.filter((t) => t.status !== "done"));
  return open.find((t) => t.status === "doing") ?? open[0];
}

export function progress(tasks: Task[]): { done: number; total: number } {
  return { done: tasks.filter((t) => t.status === "done").length, total: tasks.length };
}

/** Markdown checklist. Notion, Obsidian and Apple Notes turn `- [ ]` into to-dos on paste. */
export function tasksToMarkdown(tasks: Task[], heading = "My tasks from Remedy"): string {
  const lines = [`# ${heading}`, ""];
  for (const t of sortTasks(tasks)) {
    const when = t.dueDate ?? TIMEFRAME_LABEL[t.timeframe];
    lines.push(`- [${t.status === "done" ? "x" : " "}] **${t.title}**`);
    lines.push(`  - Priority: ${PRIORITY_LABEL[t.priority]} · ${when} · ~${t.durationMin} min`);
    lines.push(`  - Why: ${t.why}`);
    lines.push(`  - Contact: ${t.contact.who} (${CHANNEL_LABEL[t.contact.channel]})`);
    lines.push(`  - Opening message: "${t.contact.draft}"`);
    for (const s of t.steps) lines.push(`  - [${s.done ? "x" : " "}] ${s.text}`);
    for (const src of t.sources) lines.push(`  - Source: [${src.label}](${src.url})`);
    if (t.notes.trim()) lines.push(`  - Notes: ${t.notes.trim()}`);
  }
  return lines.join("\n") + "\n";
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** An .ics calendar file with one all-day event per task that has a due date.
 *  Returns null when no task has a date. */
export function tasksToIcs(tasks: Task[]): string | null {
  const dated = tasks.filter((t) => t.dueDate && t.status !== "done");
  if (dated.length === 0) return null;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Remedy//My tasks//EN"];
  for (const t of dated) {
    const day = t.dueDate!.replace(/-/g, "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${t.id}@remedy`,
      `DTSTART;VALUE=DATE:${day}`,
      `SUMMARY:${icsEscape(t.title)}`,
      `DESCRIPTION:${icsEscape(`${t.why}\nContact: ${t.contact.who} (${CHANNEL_LABEL[t.contact.channel]})`)}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

function withRevision(task: Task, label: string, patch: Partial<Task>): Task {
  const version = task.version + 1;
  return { ...task, ...patch, version, history: [...task.history, { version, label }] };
}

let stepSeq = 0;
function step(text: string): TaskStep {
  stepSeq += 1;
  return { id: `step-${Date.now()}-${stepSeq}`, text, done: false };
}

/**
 * MOCK "I'm stuck": returns a new version of the task, reshaped around the
 * reason. The real seam sends the task + reason + note to the model instead.
 * Repeatable: every call adds one version to the history.
 */
export function reviseStuck(task: Task, reason: StuckReason, note: string): Task {
  const label = `Stuck: ${STUCK_LABEL[reason].toLowerCase()}`;
  const noteStep = note.trim() ? [step(`Keep your note in mind: "${note.trim()}".`)] : [];
  switch (reason) {
    case "cant-reach":
      return withRevision(task, label, {
        contact: {
          ...task.contact,
          channel: task.contact.channel === "email" ? "slack" : "email",
          draft: `Hi, a quick one on "${task.title.toLowerCase()}". Can I get 10 minutes this week, or should I talk to someone else?`,
        },
        steps: [
          step("Send a short written message instead of waiting for a meeting."),
          step("Ask who else can decide if they are not the right person."),
          ...noteStep,
        ],
      });
    case "no-time":
      return withRevision(task, label, {
        durationMin: Math.max(10, Math.round(task.durationMin / 3)),
        timeframe: task.timeframe === "today" ? "this-week" : task.timeframe,
        steps: [step(`Do only the first step: ${task.steps[0]?.text ?? task.title}`), ...noteStep],
      });
    case "dont-know-start":
      return withRevision(task, label, {
        steps: [
          step("Write one sentence: what does done look like?"),
          step(`Send the opening message to ${task.contact.who}.`),
          ...task.steps.map((s) => ({ ...s, done: false })),
          ...noteStep,
        ],
      });
    case "not-needed":
      return withRevision(task, label, {
        status: "done",
        closedReason: note.trim() || "Not needed anymore",
      });
  }
}

/** MOCK "Break into steps": splits every open step into two smaller ones. */
export function reviseBreakDown(task: Task): Task {
  const steps = task.steps.flatMap((s) =>
    s.done ? [s] : [step(`Prepare: ${s.text}`), step(`Do: ${s.text}`)]
  );
  return withRevision(task, "Broken into smaller steps", { steps });
}
