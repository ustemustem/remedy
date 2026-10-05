import type { DashboardNeed } from "./graph";
import { rankByPriority, type Task, type TaskChannel, type TaskPriority, type TaskTimeframe } from "./tasks";

/**
 * MOCK task generator for the design pass. Turns each kept recommendation into
 * three tasks (talk, act, check), so the list reflects the user's real
 * session. The copy is canned and marked "(mock)". The real generateTasks seam
 * (an LLM call made while the report loads) replaces this after the design is
 * approved, and returns 1-3 tasks per recommendation.
 */

interface Template {
  title: string;
  priority: TaskPriority;
  timeframe: TaskTimeframe;
  durationMin: number;
  who: string;
  channel: TaskChannel;
  why: string;
  draft: string;
  steps: string[];
}

const TEMPLATES: Template[] = [
  {
    title: "Agree on one owner with your manager",
    priority: "high",
    timeframe: "this-week",
    durationMin: 30,
    who: "Your manager",
    channel: "in-person",
    why: "The fix needs one owner and a clear yes. A short talk gets both. (mock)",
    draft: "Hi, I want to fix how new requests reach the team. Can we take 30 minutes this week to agree on one owner?",
    steps: [
      "Write the problem in two sentences.",
      "Book 30 minutes with your manager.",
      "Agree on one owner and one date.",
    ],
  },
  {
    title: "Send a one-line rule for new requests",
    priority: "high",
    timeframe: "today",
    durationMin: 15,
    who: "The lead who sends requests",
    channel: "slack",
    why: "Requests arrive from outside the plan. One written rule stops that. (mock)",
    draft: "Quick idea: during the sprint, new requests go through one place. Can I share a one-line rule for us to try?",
    steps: [
      "Draft a one-line rule for new requests.",
      "Send it to the lead for a quick check.",
      "Try the rule for one sprint.",
    ],
  },
  {
    title: "Check the rule at the next retro",
    priority: "medium",
    timeframe: "this-month",
    durationMin: 20,
    who: "Your team",
    channel: "call",
    why: "After two weeks, keep what helps and drop the rest. (mock)",
    draft: "Let's take 20 minutes at the next retro to check if the new rule helped. Bring one example.",
    steps: [
      "Put a 20-minute review in the next retro.",
      "Collect one example from each person.",
      "Keep, change, or drop the rule.",
    ],
  },
];

function searchLink(label: string, query: string) {
  return { label, url: `https://www.google.com/search?q=${encodeURIComponent(query)}` };
}

export function buildMockTasks(needs: DashboardNeed[]): Task[] {
  const tasks = needs.flatMap((need, n) => {
    const fromTemplates = TEMPLATES.map((tpl, i): Task => {
      const id = `${need.node.id}-${i}`;
      return {
        id: `task-${id}`,
        needNodeId: need.node.id,
        needTitle: need.node.title,
        title: tpl.title,
        why: tpl.why,
        priority: tpl.priority,
        order: n * TEMPLATES.length + i,
        status: "todo",
        timeframe: tpl.timeframe,
        durationMin: tpl.durationMin,
        contact: { who: tpl.who, channel: tpl.channel, draft: tpl.draft },
        steps: tpl.steps.map((text, j) => ({ id: `step-${id}-${j}`, text, done: false })),
        notes: "",
        sources: [searchLink(`Search: ${tpl.title}`, tpl.title)],
        version: 1,
        history: [{ version: 1, label: "First version from your report" }],
      };
    });
    return withAngles(need, fromTemplates, n * (TEMPLATES.length + 1));
  });
  return rankByPriority(tasks);
}

/**
 * Spark angles shape the need's tasks (docs/ideas/dock-functions.md, Spark):
 * the step angle becomes the need's first task, this week; the pushback
 * angle names who to talk to on the need's first conversation task.
 */
function withAngles(need: DashboardNeed, tasks: Task[], baseOrder: number): Task[] {
  const { step, pushback } = need.angles ?? {};
  let out = tasks.map((t, i) => ({ ...t, order: baseOrder + i + 1 }));
  if (pushback) {
    const talk = out.findIndex((t) => t.contact.channel === "in-person" || t.contact.channel === "call");
    if (talk >= 0) {
      const t = out[talk];
      out[talk] = {
        ...t,
        contact: { ...t.contact, who: pushback.title },
        why: `${t.why} Expect pushback: ${pushback.body}`,
      };
    }
  }
  if (step) {
    const id = `${need.node.id}-step`;
    out = [
      {
        id: `task-${id}`,
        needNodeId: need.node.id,
        needTitle: need.node.title,
        title: step.title,
        why: step.body,
        priority: "high",
        order: baseOrder,
        status: "todo",
        timeframe: "this-week",
        durationMin: 15,
        contact: { who: "Just you", channel: "in-person", draft: "" },
        steps: [{ id: `step-${id}-0`, text: step.title, done: false }],
        notes: "",
        sources: [],
        version: 1,
        history: [{ version: 1, label: "First step, from Spark" }],
      },
      ...out,
    ];
  }
  return out;
}
