// Mock "Thought Triggers" for the chat entry screen — PRD Section 6.1.
// Real version would run sentiment/entity extraction on debounce; here we
// just keyword-match the vent text against a fixed taxonomy. No NLP call.

export interface ThoughtTrigger {
  id: string;
  /** Short chip label shown to the user. */
  label: string;
  /** Text inserted at the cursor when the chip is clicked. */
  insertText: string;
}

interface TriggerCategory {
  keywords: string[];
  triggers: ThoughtTrigger[];
}

const CATEGORIES: TriggerCategory[] = [
  {
    keywords: ["ekip", "ekib", "team", "takım"],
    triggers: [
      {
        id: "team-size",
        label: "Team size?",
        insertText: " Our team is about [how many] people.",
      },
      {
        id: "team-comms",
        label: "How's team communication?",
        insertText: " Team communication usually works [how].",
      },
    ],
  },
  {
    keywords: ["araç", "arac", "tool", "tooling", "yazılım"],
    triggers: [
      {
        id: "tools-used",
        label: "Which tools are you using?",
        insertText: " Right now we use [which tools].",
      },
      {
        id: "tools-change",
        label: "Considered switching tools?",
        insertText: " We haven't discussed [whether / why] to switch tools.",
      },
    ],
  },
  {
    keywords: ["süreç", "process", "workflow"],
    triggers: [
      {
        id: "process-age",
        label: "How long has this process been the same?",
        insertText: " This process has worked the same way for about [how long].",
      },
    ],
  },
  {
    keywords: ["deadline", "teslim", "sprint", "planlama"],
    triggers: [
      {
        id: "deadline-def",
        label: "How are deadlines set?",
        insertText: " Deadlines are usually set by [who/when].",
      },
      {
        id: "sprint-length",
        label: "How long are your sprints?",
        insertText: " Our sprints are [how long].",
      },
    ],
  },
];

const FALLBACK_TRIGGERS: ThoughtTrigger[] = [
  {
    id: "since-when",
    label: "How long has this been going on?",
    insertText: " This has been going on for about [how long].",
  },
  {
    id: "most-tiring",
    label: "What's the most draining part?",
    insertText: " The part that wears me out the most is [what].",
  },
  {
    id: "tried-before",
    label: "What have you tried before?",
    insertText: " We've tried [what] before, but [result].",
  },
];

/** Returns 2-3 chip suggestions, biased toward keywords already in the text. */
export function getThoughtTriggers(text: string): ThoughtTrigger[] {
  const lower = text.toLowerCase();
  const matched = CATEGORIES.filter((cat) =>
    cat.keywords.some((kw) => lower.includes(kw))
  ).flatMap((cat) => cat.triggers);

  const pool = matched.length > 0 ? matched : FALLBACK_TRIGGERS;
  const combined = matched.length > 0 && matched.length < 3 ? [...matched, ...FALLBACK_TRIGGERS] : pool;

  // De-dupe by id, cap at 3.
  const seen = new Set<string>();
  const result: ThoughtTrigger[] = [];
  for (const t of combined) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    result.push(t);
    if (result.length === 3) break;
  }
  return result;
}
