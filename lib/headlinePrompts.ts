// Rotating headline prompts for the chat entry screen. Replaces the static
// "What's going on?" title with a small pool of short, clickable questions —
// mocked inspiration, no real personalization.

export interface HeadlinePrompt {
  id: string;
  question: string;
  /** Text inserted at the cursor when this headline is clicked. */
  insertText: string;
}

export const HEADLINE_PROMPTS: HeadlinePrompt[] = [
  {
    id: "generic",
    question: "What's going on?",
    insertText: "Here's the situation: ",
  },
  {
    id: "deadline",
    question: "Missing your deadlines?",
    insertText: "Our team has missed the last few sprint deadlines. ",
  },
  {
    id: "process",
    question: "Is your process stuck?",
    insertText: "Our process hasn't changed in months and it's not working anymore. ",
  },
  {
    id: "tooling",
    question: "Tools falling short?",
    insertText: "The tools we use don't cover what we need anymore. ",
  },
  {
    id: "comms",
    question: "Communication breaking down?",
    insertText: "Important decisions keep getting lost inside the team. ",
  },
  {
    id: "growth",
    question: "Struggling to keep up?",
    insertText: "As our team has grown, our old habits stopped working. ",
  },
  {
    id: "burnout",
    question: "Signs of burnout?",
    insertText: "I've been noticing signs of burnout on the team lately. ",
  },
];
