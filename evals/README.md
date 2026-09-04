# Evals

The quality harness for the LLM seams (backend roadmap §04). Quality is measured
against a set, not judged by demo vibes.

## What's here

- **`seed-vents.ts`** — real-ish inputs, some deliberately thin. The thin ones
  exercise the ask-vs-guess behaviour (a thin vent must draw a clarifying
  question, not a fabricated answer).
- **`checks.ts`** — the cheap, deterministic gates run on every candidate output
  before any LLM-judge or human review: `schemaValid`, `citationExists`,
  `noUnsourcedNamedPerson`. These are the hard release gates (structural
  validity ≥99%, grounding integrity 100%).
- **`run.ts`** — the runner: calls the first real seam (`getInitialCanvas`) over
  the seed vents, applies the checks (including the ask-vs-guess gate), and
  prints a score.

## How to run

- `npm run test` — unit tests for the eval logic (no model calls, free).
- `npm run eval -- --limit 3` — run the real seam over the first 3 vents (spends ~a few cents).
- `npm run eval` — the full set (~30 vents, ≈ $0.30–0.60).

Exit code is 0 when both hard gates pass (structural ≥99%, ask-vs-guess ≥90%), 1 otherwise.

## What comes next

- **Phase 3** adds the grounding gate (every recommendation has a real cited
  source) and the LLM-judge passes for the subjective criteria.
