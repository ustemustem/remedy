/**
 * Seed vents for the eval set (roadmap §04, §Phase 0). Real-ish inputs the
 * way the target audience (HR, recruiting, IT procurement, knowledge workers)
 * would actually type them. Some are deliberately THIN — those exercise the
 * ask-vs-guess behaviour (§Phase 1 gate): a thin vent should draw a clarifying
 * question, not a fabricated answer.
 *
 * ~30 total: ~24 workable, ~6 thin.
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
  // --- Phase 1 additions (~20 more, audience-relevant) ---
  {
    id: "vendor-lockin",
    text: "We're mid-contract with a vendor that keeps raising prices and support has gotten worse, but migrating everything off them sounds like a nightmare.",
    thin: false,
    expects: "Suggestion on evaluating switching cost vs. staying; counter should weigh migration risk honestly.",
  },
  {
    id: "interview-inconsistent",
    text: "Every interviewer on my panel scores candidates differently and we end up arguing instead of deciding.",
    thin: false,
    expects: "Structured/rubric-based interview suggestion; counter flags over-rigid scoring.",
  },
  {
    id: "shadow-it",
    text: "Teams keep buying their own SaaS tools on company cards and IT finds out months later.",
    thin: false,
    expects: "Procurement/visibility suggestion; counter warns against blocking teams outright.",
  },
  {
    id: "candidate-ghosting",
    text: "We're seeing more candidates accept an offer and then go dark before their start date, sometimes with no notice at all.",
    thin: false,
    expects: "Suggestion on pre-start engagement/backup candidates; counter should flag over-communicating as annoying.",
  },
  {
    id: "comp-bands-misaligned",
    text: "Our comp bands were set two years ago and haven't kept up with the market, so new hires are coming in above what tenured people make.",
    thin: false,
    expects: "Suggestion on compensation review/benchmarking cadence; counter should address morale/retention risk of re-banding.",
  },
  {
    id: "security-questionnaire-fatigue",
    text: "Every new vendor deal gets stuck for weeks because their security questionnaire response is vague and our infosec team keeps bouncing it back.",
    thin: false,
    expects: "Suggestion on standardizing vendor security review (e.g. shared assessment); counter should flag risk of rubber-stamping to save time.",
  },
  {
    id: "onboarding-paperwork-scattered",
    text: "New hire paperwork lives across three different systems and half the time IT provisioning doesn't happen until day two or three.",
    thin: false,
    expects: "Suggestion to consolidate/automate onboarding provisioning; counter should note integration cost.",
  },
  {
    id: "exit-interview-ignored",
    text: "We run exit interviews on every departure but the themes never make it back to leadership, so the same complaints keep resurfacing.",
    thin: false,
    expects: "Suggestion on closing the feedback loop to leadership; counter should flag over-indexing on departing employees' views.",
  },
  {
    id: "cloud-cost-overrun",
    text: "Our cloud bill has crept up every month this quarter and nobody can point to which team or service is driving it.",
    thin: false,
    expects: "Suggestion on cost allocation/tagging visibility; counter should flag chargeback friction between teams.",
  },
  {
    id: "shadow-ai-usage",
    text: "People on my team are pasting client data into random AI tools to save time and I don't think anyone's tracking what's actually approved.",
    thin: false,
    expects: "Suggestion on an approved-tools policy/governance; counter should flag that banning tools outright drives usage further underground.",
  },
  {
    id: "referral-program-stalled",
    text: "Our employee referral bonus hasn't changed in years and referrals have basically dried up as a hiring channel.",
    thin: false,
    expects: "Suggestion on refreshing referral incentives/visibility; counter should flag throwing more money at it without addressing why people stopped referring.",
  },
  {
    id: "contractor-classification-risk",
    text: "We've got a handful of long-term contractors who work full-time hours and report to a manager just like employees do, and I'm worried how that looks if we're ever audited.",
    thin: false,
    expects: "Suggestion on reviewing worker classification/legal exposure; counter should flag disruption of converting or ending long-standing arrangements.",
  },
  {
    id: "license-true-up-surprise",
    text: "We just got hit with a license true-up bill from a software vendor because seat counts crept past our contract without anyone noticing.",
    thin: false,
    expects: "Suggestion on license tracking/renewal governance; counter should flag the overhead of tracking every seat manually.",
  },
  {
    id: "performance-review-calibration",
    text: "Managers rate their own people generously so calibration meetings turn into negotiations instead of an honest comparison across teams.",
    thin: false,
    expects: "Suggestion on calibration process/forced-distribution alternative; counter should flag risk of one-size-fits-all scoring across different teams.",
  },
  {
    id: "rfp-approval-bottleneck",
    text: "Every RFP we run gets stuck in legal and finance sign-off for weeks even after the business side has already picked a preferred vendor.",
    thin: false,
    expects: "Suggestion on parallelizing or pre-clearing approval steps; counter should flag skipping review steps as a compliance risk.",
  },
  {
    id: "hybrid-attendance-friction",
    text: "We set a three-day in-office policy but enforcement is inconsistent across managers and it's becoming a source of resentment.",
    thin: false,
    expects: "Suggestion on consistent enforcement or a clearer policy; counter should flag rigid enforcement hurting retention.",
  },
  {
    id: "single-sign-on-rollout-stuck",
    text: "We've been trying to roll out SSO across our SaaS tools for six months but keep hitting one-off vendors that don't support it well.",
    thin: false,
    expects: "Suggestion on a phased rollout prioritizing highest-risk apps; counter should flag blocking access to critical tools mid-transition.",
  },
  {
    id: "internal-mobility-blocked",
    text: "We say we support internal mobility but managers quietly block their best people from transferring to other teams.",
    thin: false,
    expects: "Suggestion on formalizing an internal transfer process; counter should flag disruption to team stability if it's too easy to leave.",
  },
  {
    id: "help-desk-ticket-backlog",
    text: "Our IT help desk backlog keeps growing and the same password-reset and access-request tickets make up most of the volume.",
    thin: false,
    expects: "Suggestion on self-service/automation for routine tickets; counter should flag self-service tooling creating its own support burden.",
  },
  { id: "thin-culture", text: "culture issues", thin: true, expects: "Too broad — ask for a concrete recent example." },
];
