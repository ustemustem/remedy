"use client";

import { useState } from "react";
import {
  Check,
  ClipboardCopy,
  ExternalLink,
  History,
  LifeBuoy,
  ListTree,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CHANNEL_LABEL,
  PRIORITY_LABEL,
  STATUS_LABEL,
  STUCK_LABEL,
  TIMEFRAME_LABEL,
  reviseBreakDown,
  reviseStuck,
  type StuckReason,
  type Task,
  type TaskChannel,
  type TaskPriority,
  type TaskStatus,
  type TaskTimeframe,
} from "@/lib/tasks";

const LABEL = "font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground";
const SELECT =
  "h-7 w-full rounded-[var(--radius-control)] border border-border bg-card px-1.5 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={LABEL}>{label}</span>
      {children}
    </label>
  );
}

function Options<T extends string>({ labels }: { labels: Record<T, string> }) {
  return (
    <>
      {(Object.keys(labels) as T[]).map((k) => (
        <option key={k} value={k}>
          {labels[k]}
        </option>
      ))}
    </>
  );
}

/**
 * One task, opened. Everything is editable. "I'm stuck" and "Break into steps"
 * are the AI helpers: each use makes a new version (v2, v3...) instead of a
 * chat thread, so they can be used again at any time and the history shows it.
 */
export function TaskDetail({
  task,
  onChange,
  onDelete,
  onClose,
}: {
  task: Task;
  onChange: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onClose: () => void;
}) {
  const [stuckOpen, setStuckOpen] = useState(false);
  const [reason, setReason] = useState<StuckReason | null>(null);
  const [stuckNote, setStuckNote] = useState("");
  const [newStep, setNewStep] = useState("");
  const [copied, setCopied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const set = (patch: Partial<Task>) => onChange({ ...task, ...patch });

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(task.contact.draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the text stays selectable */
    }
  }

  function submitStuck() {
    if (!reason) return;
    onChange(reviseStuck(task, reason, stuckNote));
    setStuckOpen(false);
    setReason(null);
    setStuckNote("");
  }

  function addStep() {
    const text = newStep.trim();
    if (!text) return;
    set({ steps: [...task.steps, { id: `step-${Date.now()}`, text, done: false }] });
    setNewStep("");
  }

  return (
    <article className="report-card-surface flex flex-col gap-4 rounded-[var(--radius-card-shaped)] [corner-shape:var(--card-corner-shape)] border border-border bg-card p-[var(--card-px)]">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={LABEL}>
            Task · v{task.version}
            {task.needTitle !== task.title && (
              <span className="font-normal normal-case tracking-normal"> · from “{task.needTitle}”</span>
            )}
          </p>
          <textarea
            value={task.title}
            onChange={(e) => set({ title: e.target.value.replace(/\n/g, " ") })}
            aria-label="Task title"
            rows={1}
            className="mt-1 w-full resize-none bg-transparent font-heading text-[17px] font-semibold leading-snug text-foreground outline-none [field-sizing:content]"
          />
          <p className="mt-1 text-[13px] text-muted-foreground">{task.why}</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close task">
          <X />
        </Button>
      </header>

      {task.closedReason && (
        <p className="rounded-[var(--radius-surface)] bg-muted px-3 py-2 text-[13px] text-muted-foreground">
          Closed: {task.closedReason}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <select className={SELECT} value={task.status} onChange={(e) => set({ status: e.target.value as TaskStatus })}>
            <Options labels={STATUS_LABEL} />
          </select>
        </Field>
        <Field label="Priority">
          <select className={SELECT} value={task.priority} onChange={(e) => set({ priority: e.target.value as TaskPriority })}>
            <Options labels={PRIORITY_LABEL} />
          </select>
        </Field>
        <Field label={`When · ~${task.durationMin} min`}>
          <select className={SELECT} value={task.timeframe} onChange={(e) => set({ timeframe: e.target.value as TaskTimeframe })}>
            <Options labels={TIMEFRAME_LABEL} />
          </select>
        </Field>
        <Field label="Date (optional)">
          <input
            type="date"
            className={SELECT}
            value={task.dueDate ?? ""}
            onChange={(e) => set({ dueDate: e.target.value || undefined })}
          />
        </Field>
      </div>

      <section className="flex flex-col gap-2">
        <p className={LABEL}>Contact</p>
        <div className="grid grid-cols-2 gap-3">
          <input
            value={task.contact.who}
            onChange={(e) => set({ contact: { ...task.contact, who: e.target.value } })}
            aria-label="Who to contact"
            className={SELECT}
          />
          <select
            className={SELECT}
            value={task.contact.channel}
            onChange={(e) => set({ contact: { ...task.contact, channel: e.target.value as TaskChannel } })}
            aria-label="Channel"
          >
            <Options labels={CHANNEL_LABEL} />
          </select>
        </div>
        <div className="relative rounded-[var(--radius-surface)] border border-border bg-[color:var(--paper-panel)] px-3 py-2.5 pr-10">
          <p className="text-[13px] leading-relaxed text-foreground">“{task.contact.draft}”</p>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={copyDraft}
            aria-label="Copy opening message"
            className="absolute top-2 right-2"
          >
            {copied ? <Check className="text-primary" /> : <ClipboardCopy />}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-1.5">
        <p className={LABEL}>Steps</p>
        <ul className="flex flex-col gap-0.5">
          {task.steps.map((s) => (
            <li key={s.id} className="group/step flex items-start gap-2 rounded-[4px] px-1 py-1 hover:bg-muted/60">
              <input
                type="checkbox"
                checked={s.done}
                onChange={() =>
                  set({ steps: task.steps.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })
                }
                className="mt-0.5 size-3.5 accent-[var(--primary)]"
                aria-label={s.text}
              />
              <span className={cn("flex-1 text-[13px]", s.done && "text-muted-foreground line-through")}>{s.text}</span>
              <button
                type="button"
                onClick={() => set({ steps: task.steps.filter((x) => x.id !== s.id) })}
                className="opacity-0 transition-opacity group-hover/step:opacity-100"
                aria-label="Remove step"
              >
                <X className="size-3.5 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-1.5">
          <input
            value={newStep}
            onChange={(e) => setNewStep(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addStep()}
            placeholder="Add a step"
            className={cn(SELECT, "flex-1")}
          />
          <Button variant="ghost" size="icon-sm" onClick={addStep} aria-label="Add step">
            <Plus />
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-1.5">
        <p className={LABEL}>My notes</p>
        <Textarea
          value={task.notes}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder="What happened, what you learned, what is next."
          className="min-h-16 bg-card text-[13px]"
        />
      </section>

      {task.sources.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <p className={LABEL}>Sources</p>
          <ul className="flex flex-col gap-1">
            {task.sources.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[13px] text-primary underline-offset-4 hover:underline"
                >
                  {s.label}
                  <ExternalLink className="size-3" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2 border-t border-border pt-3">
        <div className="flex flex-wrap gap-2">
          <Button variant={stuckOpen ? "secondary" : "outline"} size="sm" onClick={() => setStuckOpen((v) => !v)}>
            <LifeBuoy />
            I&apos;m stuck
          </Button>
          <Button variant="outline" size="sm" onClick={() => onChange(reviseBreakDown(task))}>
            <ListTree />
            Break into steps
          </Button>
        </div>
        <div className="see-more-panel" data-open={stuckOpen}>
          <div>
            <div className="flex flex-col gap-2 pt-1">
              <p className="text-[13px] text-muted-foreground">What is in the way? We update the task for you.</p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(STUCK_LABEL) as StuckReason[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={cn(
                      "ns-press rounded-full border px-2.5 py-1 text-[12px] transition-colors",
                      reason === r
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:border-primary/40"
                    )}
                  >
                    {STUCK_LABEL[r]}
                  </button>
                ))}
              </div>
              <input
                value={stuckNote}
                onChange={(e) => setStuckNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitStuck()}
                placeholder="Add a short note (optional)"
                className={SELECT}
              />
              <Button variant="cta" size="sm" disabled={!reason} onClick={submitStuck} className="self-start">
                Update task
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <History className="size-3.5" />
          {task.history.length} version{task.history.length === 1 ? "" : "s"}
        </button>
        <Button variant="ghost" size="xs" onClick={() => onDelete(task.id)} className="text-muted-foreground">
          <Trash2 />
          Delete
        </Button>
      </footer>
      <div className="see-more-panel -mt-2" data-open={historyOpen}>
        <div>
          <ol className="flex flex-col gap-1 border-l border-border pl-3">
            {[...task.history].reverse().map((h) => (
              <li key={h.version} className="text-[12px] text-muted-foreground">
                <span className="font-mono text-foreground">v{h.version}</span> · {h.label}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </article>
  );
}
