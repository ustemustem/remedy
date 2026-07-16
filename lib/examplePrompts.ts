// Mock "what other users asked" example prompts, shown below the chat entry
// input as social proof / inspiration. Static content, no real user data.
// Grouped by industry — see components/chat-entry-screen.tsx's industry chips.

export type Industry = "general" | "hr" | "it";

export const INDUSTRIES: { id: Industry; label: string }[] = [
  { id: "general", label: "General" },
  { id: "hr", label: "HR & Recruiting" },
  { id: "it", label: "IT & Procurement" },
];

export interface ExamplePrompt {
  id: string;
  /** Short topic line shown at the top of the card. */
  label: string;
  /** Full vent scenario inserted verbatim when the card is clicked. */
  scenario: string;
}

export const EXAMPLE_PROMPTS_BY_INDUSTRY: Record<Industry, ExamplePrompt[]> = {
  general: [
    {
      id: "sprint-chaos",
      label: "Sprint planning chaos",
      scenario:
        "Our team has missed the last 3 sprint deadlines. We're a team of 6 and planning meetings keep dragging on, but nothing changes.",
    },
    {
      id: "remote-comms",
      label: "Remote team communication",
      scenario:
        "Our team is fully remote and async, but important decisions keep hanging in the air — nobody lands on a clear conclusion.",
    },
    {
      id: "cross-team-priorities",
      label: "Cross-team priorities colliding",
      scenario:
        "Cross-team priorities keep colliding and nobody agrees on what's actually urgent. Every week the top priority changes.",
    },
  ],
  hr: [
    {
      id: "candidate-pipeline",
      label: "Candidate pipeline stalling",
      scenario:
        "We've had this req open for 2 months and the shortlist keeps falling through in final rounds. Not sure if it's sourcing or the process itself.",
    },
    {
      id: "onboarding-dropoff",
      label: "New hires going quiet",
      scenario:
        "A few new hires have gone quiet in their first month and a couple left before ramping up. I can't tell if it's the onboarding or something else.",
    },
    {
      id: "interview-loop-length",
      label: "Interview loops dragging on",
      scenario:
        "Our interview loops are dragging on so long that good candidates accept other offers before we've even made a decision.",
    },
  ],
  it: [
    {
      id: "procurement-bottleneck",
      label: "Procurement approval bottleneck",
      scenario:
        "Every tool purchase needs three signoffs and it's killing our rollout timelines. By the time approval comes through, priorities have shifted.",
    },
    {
      id: "tool-switch",
      label: "Switching tools",
      scenario:
        "We're thinking about moving from Jira to Linear, but the team doesn't want to give up old habits. I don't know where to start.",
    },
    {
      id: "vendor-evaluation",
      label: "Stuck comparing vendors",
      scenario:
        "We're evaluating three vendors for the same tool and can't agree on criteria to decide. The comparison has stalled for weeks.",
    },
  ],
};
