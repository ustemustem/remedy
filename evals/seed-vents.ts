/**
 * Seed vents for the eval set (roadmap §04, §Phase 0). Real-ish inputs the
 * way the target audience (HR, recruiting, IT procurement, knowledge workers)
 * would actually type them. Some are deliberately THIN — those exercise the
 * ask-vs-guess behaviour (§Phase 1 gate): a thin vent should draw a clarifying
 * question, not a fabricated answer.
 *
 * Phase 0 ships ~10; Phase 1 grows this to ~30 with held-out examples.
 */

export interface SeedVent {
  id: string;
  text: string;
  /** True when the input is intentionally too thin to answer well. */
  thin: boolean;
  /** Free-text note on what a good response should satisfy (the rubric seed). */
  expects: string;
}

export const SEED_VENTS: SeedVent[] = [
  {
    id: "sprint-slip",
    text: "Our sprint deadlines keep slipping and nobody owns priorities. We're a team of 6 and planning meetings drag on, but nothing changes.",
    thin: false,
    expects: "A concrete process suggestion + a constructive counter-argument; needs cover ownership and planning.",
  },
  {
    id: "remote-decisions",
    text: "We're fully remote and async, but important decisions keep hanging in the air and nobody lands a clear conclusion.",
    thin: false,
    expects: "Suggestion about decision-making cadence/ownership; counter should flag when async is the wrong tool.",
  },
  {
    id: "hiring-slow",
    text: "Hiring is taking forever. Roles sit open for months and candidates drop off before we even schedule a second round.",
    thin: false,
    expects: "Recommendation on pipeline speed; grounded app/community suggestions should be relevant to recruiting.",
  },
  {
    id: "tool-sprawl",
    text: "We have too many tools and nobody knows which one is the source of truth for what.",
    thin: false,
    expects: "Consolidation suggestion; counter should warn against ripping out tools people depend on.",
  },
  {
    id: "onboarding-messy",
    text: "New hires take way too long to get productive. Onboarding is ad-hoc and depends on who happens to be free.",
    thin: false,
    expects: "Structured onboarding suggestion; recommendations may point to real onboarding tools/resources.",
  },
  // --- deliberately thin ---
  { id: "thin-help", text: "help", thin: true, expects: "Must ask a clarifying question, not invent a problem." },
  { id: "thin-stressed", text: "everything is a mess lately", thin: true, expects: "Too vague — ask what specifically is going wrong." },
  { id: "thin-team", text: "my team", thin: true, expects: "No stated problem — ask what about the team." },
  { id: "thin-slow", text: "we are slow", thin: true, expects: "Ambiguous — ask slow at what." },
  { id: "thin-fix", text: "how do I fix this", thin: true, expects: "No referent — ask what 'this' is." },
];
