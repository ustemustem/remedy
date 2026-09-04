# Evals

The quality harness for the LLM seams (backend roadmap §04). Quality is measured
against a set, not judged by demo vibes.

## What's here (Phase 0)

- **`seed-vents.ts`** — real-ish inputs, some deliberately thin. The thin ones
  exercise the ask-vs-guess behaviour (a thin vent must draw a clarifying
  question, not a fabricated answer).
- **`checks.ts`** — the cheap, deterministic gates run on every candidate output
  before any LLM-judge or human review: `schemaValid`, `citationExists`,
  `noUnsourcedNamedPerson`. These are the hard release gates (structural
  validity ≥99%, grounding integrity 100%).

## What comes next

- **Phase 1** adds the runner: it calls the first real seam (`getInitialCanvas`)
  over the seed vents, applies the checks, and prints a score. The seed set grows
  to ~30 with held-out examples. There is nothing to run until a real seam exists,
  which is why there's no runner yet.
- **Phase 3** adds the grounding gate (every recommendation has a real cited
  source) and the LLM-judge passes for the subjective criteria.
