# Eval Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone eval runner that calls the real `getInitialCanvas` seam over the seed vents, applies the deterministic checks (schema-valid, structural, ask-vs-guess), and prints a scored report with a pass/fail gate — the measurement backbone every later phase depends on.

**Architecture:** A small set of *pure* modules (env parser, seam-specific structural checks, scoring/report) that are unit-tested with hand-written fixtures, plus one thin `run.ts` orchestrator that does the I/O (loads env, calls the model, prints, sets the exit code). Model calls live only in the orchestrator, so the graded logic stays deterministic and free to test. The runner imports the server-side seam functions directly (`readInitialCanvas` + `assembleInitialGraph`), not over HTTP — no dev server needed.

**Tech Stack:** TypeScript, `tsx` (run TS standalone), `vitest` (unit tests — first test framework in the repo, scoped to `evals/` only), `zod/v4`, `@anthropic-ai/sdk` (via the existing `lib/llm` seam). Model: `claude-sonnet-5` through the existing `readInitialCanvas`.

## Global Constraints

- **Base branch:** cut this work from `main` **after Phase 2 (PR #15) merges**. The runner only touches `evals/` + reads the already-merged Phase 1 seam, so it is independent, but per the task list the branch must sit on top of the full backend.
- **Prerequisite for real runs (Tasks 4–5):** `.env.local` must exist at the worktree root with `ANTHROPIC_API_KEY` + `ANTHROPIC_WORKSPACE_ID` (the key is identity-linked, so the workspace id is required). Unit tests (Tasks 1–3) need no key.
- **Cost is real:** each vent = one Sonnet 5 call (≈ a cent or two). A full ~30-vent run ≈ $0.30–0.60. Use `--limit N` while developing; run the full set deliberately.
- **`zod` is imported from `"zod/v4"`**, never `"zod"`.
- **Structured output** stays as the existing seam does it: `client.messages.parse({ output_config: { format: zodOutputFormat(Schema) } })` → `msg.parsed_output`; `zodOutputFormat` takes one argument. (The runner does not re-implement this; it calls `readInitialCanvas`.)
- **The vent is untrusted data.** The runner passes each vent as the user turn exactly as `readInitialCanvas` already does; it never treats vent text as instructions.
- **No fabricated numbers.** The report prints only real measured values (token counts from `usage`, wall-clock latency). It does **not** print a dollar cost estimate unless wired to real per-token pricing confirmed via the `claude-api` skill — leave cost as a documented follow-up.
- **Imports inside `evals/` use relative paths** (`../lib/llm/…`), not the `@/` alias, so `tsx` resolves them without path-alias config. Type-only imports (`import type`) are erased and may use either.
- **Verification per task:** `npx tsc --noEmit` + `npm run lint` for any TS change; `npm run test` for the unit-tested modules; a real `npm run eval` for the orchestrator.
- **Commit after each task** (local commits only; pushing/PR is a separate step, only when the user asks). Commit-message footer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Load the `claude-api` skill** before any change that touches model IDs, pricing, or the SDK call shape.

---

## File Structure

**Create:**
- `vitest.config.ts` — scopes vitest to `evals/**/*.test.ts`, node environment, `@` alias for safety.
- `evals/env.ts` — `parseEnv(contents)` (pure) + `loadEnvLocal(path?)` (fs wrapper). Loads `.env.local` for the standalone Node process (Next isn't running).
- `evals/env.test.ts` — unit tests for `parseEnv`.
- `evals/initial-canvas-checks.ts` — `checkInitialGraphStructure(graph)` + `checkAskVsGuess(inputQuality, expectThin)` (pure, seam-specific).
- `evals/initial-canvas-checks.test.ts` — unit tests with fixture graphs.
- `evals/score.ts` — `VentResult`/`Aggregate` types, `aggregate(results)`, `formatReport(agg, results)` (pure).
- `evals/score.test.ts` — unit tests for aggregation + gates.
- `evals/run.ts` — the orchestrator (I/O + model calls + exit code). Not unit-tested; verified by a real run.

**Modify:**
- `package.json` — add devDeps `tsx`, `vitest`; add scripts `"test": "vitest run"` and `"eval": "tsx evals/run.ts"`.
- `evals/seed-vents.ts` — grow from 10 → ~30 vents (Task 5).
- `evals/README.md` — update "What comes next" → runner exists; document how to run + cost (Task 5).

**Reuse (do not duplicate):**
- `evals/checks.ts` — `CheckResult`, `schemaValid(schema, value)`, `summarize(results)` already exist.
- `lib/llm/initial-canvas.ts` — `readInitialCanvas(chatText, locale)` → `{ reading, usage }`; `assembleInitialGraph(chatText, reading)` → `CanvasGraph`.
- `lib/llm/schemas.ts` — `InitialReadingSchema`, `InitialReading`.
- `lib/llm/prompts.ts` — `Locale` (`"en" | "tr"`).
- `lib/llm/telemetry.ts` — `Usage` (`{ input_tokens?, output_tokens?, … }`).
- `lib/types.ts` — `CanvasGraph`, `CanvasNodeData` (required fields: `id, kind, title, body, parentId, depth, selected`), `CanvasEdgeData`, `HighlightSpan`, `ChoiceOption`.
- `evals/seed-vents.ts` — `SEED_VENTS`, `SeedVent { id, text, thin, expects }`.

---

## Task 1: Test tooling + `.env.local` loader

**Files:**
- Modify: `package.json` (devDeps + scripts)
- Create: `vitest.config.ts`
- Create: `evals/env.ts`
- Test: `evals/env.test.ts`

**Interfaces:**
- Produces: `parseEnv(contents: string): Record<string, string>`; `loadEnvLocal(path?: string): void` (sets any missing keys onto `process.env`).

- [ ] **Step 1: Install tooling and add scripts**

Run:
```bash
npm install -D tsx vitest
```
Then edit `package.json` `scripts` to add (keep existing entries):
```json
    "test": "vitest run",
    "eval": "tsx evals/run.ts"
```

- [ ] **Step 2: Create the vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    // Safety net for any future `@/…` runtime import pulled in by a test.
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["evals/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 3: Write the failing test**

Create `evals/env.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseEnv } from "./env";

describe("parseEnv", () => {
  it("parses KEY=VALUE lines", () => {
    expect(parseEnv("A=1\nB=two")).toEqual({ A: "1", B: "two" });
  });
  it("ignores blank lines and # comments", () => {
    expect(parseEnv("# c\n\nA=1\n   # d\n")).toEqual({ A: "1" });
  });
  it("keeps '=' inside the value", () => {
    expect(parseEnv("URL=https://x.y/?a=b")).toEqual({ URL: "https://x.y/?a=b" });
  });
  it("strips one layer of surrounding single or double quotes", () => {
    expect(parseEnv(`A="one"\nB='two'`)).toEqual({ A: "one", B: "two" });
  });
  it("trims whitespace around key and value", () => {
    expect(parseEnv("  A =  1 ")).toEqual({ A: "1" });
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm run test`
Expected: FAIL — `Cannot find module './env'` (or `parseEnv is not a function`).

- [ ] **Step 5: Write the minimal implementation**

Create `evals/env.ts`:
```ts
import { readFileSync } from "node:fs";

/**
 * Parse a .env file's CONTENTS (not a path) into key/value pairs. Pure, so the
 * runner's env handling is unit-testable without touching the filesystem.
 * Deliberately tiny — handles KEY=VALUE, comments, blank lines, '=' in values,
 * and one layer of surrounding quotes. Not a full dotenv (no interpolation).
 */
export function parseEnv(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (key === "") continue;
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * Load `.env.local` into process.env for the standalone eval process (Next
 * isn't running, so its automatic env loading doesn't apply). Only sets keys
 * that aren't already present, so an ambient env wins. Silent no-op if the file
 * is missing — the runner then surfaces a clear "key not set" error on first call.
 */
export function loadEnvLocal(path = ".env.local"): void {
  let contents: string;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const [k, v] of Object.entries(parseEnv(contents))) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test`
Expected: PASS (5 tests).

- [ ] **Step 7: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean. (If tsc flags `vitest.config.ts`'s `import.meta`, add `"vitest.config.ts"` to `tsconfig.json`'s `exclude` and re-run.)

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts evals/env.ts evals/env.test.ts
git commit -m "$(cat <<'EOF'
Add eval test tooling + .env.local loader

vitest (scoped to evals/) + tsx, and a tiny pure .env parser so the standalone
eval runner can load ANTHROPIC_* without a running Next server.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Initial-canvas structural + ask-vs-guess checks

**Files:**
- Create: `evals/initial-canvas-checks.ts`
- Test: `evals/initial-canvas-checks.test.ts`

**Interfaces:**
- Consumes: `CheckResult` from `./checks`; `CanvasGraph` from `../lib/types`; `InitialReading["inputQuality"]` (`"workable" | "thin"`).
- Produces: `checkInitialGraphStructure(graph: CanvasGraph): CheckResult[]` (emits checks named `one-source`, `suggestion-choice-3-options`, `counter-argument-present`, `highlights-verbatim`, `edges-resolve`); `checkAskVsGuess(inputQuality: "workable" | "thin", expectThin: boolean): CheckResult` (named `ask-vs-guess`).

- [ ] **Step 1: Write the failing test**

Create `evals/initial-canvas-checks.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { checkInitialGraphStructure, checkAskVsGuess } from "./initial-canvas-checks";
import type { CanvasGraph } from "../lib/types";

function goodGraph(): CanvasGraph {
  return {
    nodes: [
      {
        id: "s", kind: "source", title: "What you wrote",
        body: "our sprint deadlines keep slipping and nobody owns priorities",
        parentId: null, depth: 0, selected: false,
        highlights: [{ id: "h", text: "deadlines keep slipping", primaryTag: "Delivery" }],
      },
      {
        id: "r", kind: "recommendation", title: "Cap work in progress",
        body: "…", parentId: "s", depth: 1, selected: false, cardType: "choice",
        options: [
          { title: "a", subtitle: "x" },
          { title: "b", subtitle: "y" },
          { title: "c", subtitle: "z" },
        ],
      },
      {
        id: "c", kind: "counter-argument", title: "Check the root cause first",
        body: "…", parentId: "s", depth: 1, selected: false, cardType: "plain",
      },
    ],
    edges: [
      { id: "e1", source: "s", target: "r" },
      { id: "e2", source: "s", target: "c" },
    ],
  };
}

describe("checkInitialGraphStructure", () => {
  it("passes a well-formed graph", () => {
    expect(checkInitialGraphStructure(goodGraph()).every((r) => r.pass)).toBe(true);
  });
  it("fails when the counter-argument is missing", () => {
    const g = goodGraph();
    g.nodes = g.nodes.filter((n) => n.kind !== "counter-argument");
    const r = checkInitialGraphStructure(g).find((x) => x.name === "counter-argument-present");
    expect(r?.pass).toBe(false);
  });
  it("fails when the suggestion does not have exactly 3 options", () => {
    const g = goodGraph();
    const rec = g.nodes.find((n) => n.kind === "recommendation")!;
    rec.options = rec.options!.slice(0, 2);
    const r = checkInitialGraphStructure(g).find((x) => x.name === "suggestion-choice-3-options");
    expect(r?.pass).toBe(false);
  });
  it("fails when a highlight is not a verbatim substring of the vent", () => {
    const g = goodGraph();
    const src = g.nodes.find((n) => n.kind === "source")!;
    src.highlights = [{ id: "h", text: "not in the vent", primaryTag: "X" }];
    const r = checkInitialGraphStructure(g).find((x) => x.name === "highlights-verbatim");
    expect(r?.pass).toBe(false);
  });
  it("fails when an edge points at a missing node", () => {
    const g = goodGraph();
    g.edges.push({ id: "e3", source: "s", target: "ghost" });
    const r = checkInitialGraphStructure(g).find((x) => x.name === "edges-resolve");
    expect(r?.pass).toBe(false);
  });
});

describe("checkAskVsGuess", () => {
  it("passes a thin vent judged thin", () => {
    expect(checkAskVsGuess("thin", true).pass).toBe(true);
  });
  it("passes a workable vent judged workable", () => {
    expect(checkAskVsGuess("workable", false).pass).toBe(true);
  });
  it("fails a thin vent judged workable", () => {
    expect(checkAskVsGuess("workable", true).pass).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test`
Expected: FAIL — `Cannot find module './initial-canvas-checks'`.

- [ ] **Step 3: Write the minimal implementation**

Create `evals/initial-canvas-checks.ts`:
```ts
import type { CanvasGraph } from "../lib/types";
import type { CheckResult } from "./checks";

/**
 * Structural gate for a getInitialCanvas graph (roadmap §04 structural
 * validity). Pure — no model calls. Asserts the assembled graph matches the
 * shape the canvas expects: exactly one source at depth 0, a 3-option
 * Suggestion choice card and a Counter-argument at depth 1, highlights that are
 * verbatim substrings of the vent, and edges that resolve to real nodes.
 */
export function checkInitialGraphStructure(graph: CanvasGraph): CheckResult[] {
  const results: CheckResult[] = [];

  const sources = graph.nodes.filter((n) => n.kind === "source");
  results.push({
    name: "one-source",
    pass: sources.length === 1 && sources[0]?.depth === 0,
    detail: sources.length === 1 ? undefined : `${sources.length} source nodes`,
  });

  const rec = graph.nodes.find((n) => n.kind === "recommendation");
  results.push({
    name: "suggestion-choice-3-options",
    pass:
      !!rec &&
      rec.depth === 1 &&
      rec.cardType === "choice" &&
      Array.isArray(rec.options) &&
      rec.options.length === 3,
    detail: !rec
      ? "no recommendation node"
      : rec.options?.length === 3
        ? undefined
        : `options: ${rec.options?.length ?? 0}`,
  });

  const counter = graph.nodes.find((n) => n.kind === "counter-argument");
  results.push({
    name: "counter-argument-present",
    pass: !!counter && counter.depth === 1,
    detail: counter ? undefined : "no counter-argument node",
  });

  const source = sources[0];
  const highlightsVerbatim =
    !source || !source.highlights
      ? true
      : source.highlights.every((h) => source.body.includes(h.text));
  results.push({
    name: "highlights-verbatim",
    pass: highlightsVerbatim,
    detail: highlightsVerbatim ? undefined : "a highlight is not a substring of the vent",
  });

  const ids = new Set(graph.nodes.map((n) => n.id));
  const edgesResolve = graph.edges.every((e) => ids.has(e.source) && ids.has(e.target));
  results.push({
    name: "edges-resolve",
    pass: edgesResolve,
    detail: edgesResolve ? undefined : "an edge points at a missing node",
  });

  return results;
}

/**
 * Ask-vs-guess gate (roadmap §04): a thin vent must be judged 'thin' (which
 * drives a genuinely clarifying question), a workable one 'workable'. Compares
 * the model's own inputQuality judgement against the seed's known thinness.
 */
export function checkAskVsGuess(
  inputQuality: "workable" | "thin",
  expectThin: boolean
): CheckResult {
  const judgedThin = inputQuality === "thin";
  const pass = judgedThin === expectThin;
  return {
    name: "ask-vs-guess",
    pass,
    detail: pass ? undefined : `expected ${expectThin ? "thin" : "workable"}, got ${inputQuality}`,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test`
Expected: PASS (Task 1 + Task 2 tests all green).

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add evals/initial-canvas-checks.ts evals/initial-canvas-checks.test.ts
git commit -m "$(cat <<'EOF'
Add initial-canvas structural + ask-vs-guess eval checks

Pure, unit-tested gates: graph shape (source / 3-option Suggestion /
Counter-argument / verbatim highlights / resolvable edges) and the ask-vs-guess
judgement (thin vent -> 'thin').

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Scoring, gates, and report formatting

**Files:**
- Create: `evals/score.ts`
- Test: `evals/score.test.ts`

**Interfaces:**
- Consumes: `CheckResult` from `./checks`; `Usage` from `../lib/llm/telemetry`.
- Produces:
  - `interface VentResult { id: string; expectThin: boolean; inputQuality: "workable" | "thin" | "error"; checks: CheckResult[]; latencyMs: number; usage: Usage; error?: string }`
  - `interface Aggregate { n: number; structuralPct: number; askVsGuessPct: number; totalInputTokens: number; totalOutputTokens: number; totalLatencyMs: number; gates: { structural: boolean; askVsGuess: boolean } }`
  - `aggregate(results: VentResult[]): Aggregate`
  - `formatReport(agg: Aggregate, results: VentResult[]): string`

- [ ] **Step 1: Write the failing test**

Create `evals/score.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { aggregate, formatReport, type VentResult } from "./score";
import type { CheckResult } from "./checks";

const STRUCTURAL_OK: CheckResult[] = [
  { name: "schema-valid", pass: true },
  { name: "one-source", pass: true },
  { name: "suggestion-choice-3-options", pass: true },
  { name: "counter-argument-present", pass: true },
  { name: "highlights-verbatim", pass: true },
  { name: "edges-resolve", pass: true },
];

function vent(over: Partial<VentResult>): VentResult {
  return {
    id: "v",
    expectThin: false,
    inputQuality: "workable",
    checks: [...STRUCTURAL_OK, { name: "ask-vs-guess", pass: true }],
    latencyMs: 1000,
    usage: { input_tokens: 100, output_tokens: 50 },
    ...over,
  };
}

describe("aggregate", () => {
  it("reports 100% and passes both gates when all vents pass", () => {
    const agg = aggregate([vent({}), vent({}), vent({})]);
    expect(agg.structuralPct).toBe(1);
    expect(agg.askVsGuessPct).toBe(1);
    expect(agg.gates.structural).toBe(true);
    expect(agg.gates.askVsGuess).toBe(true);
  });

  it("fails the structural gate below 99%", () => {
    const broken = vent({
      checks: [
        { name: "schema-valid", pass: true },
        { name: "counter-argument-present", pass: false },
        { name: "ask-vs-guess", pass: true },
      ],
    });
    const agg = aggregate([broken, ...Array.from({ length: 9 }, () => vent({}))]);
    expect(agg.structuralPct).toBeCloseTo(0.9, 5);
    expect(agg.gates.structural).toBe(false);
  });

  it("fails the ask-vs-guess gate below 90%", () => {
    const miss = vent({
      inputQuality: "workable",
      expectThin: true,
      checks: [...STRUCTURAL_OK, { name: "ask-vs-guess", pass: false }],
    });
    const agg = aggregate([miss, miss, ...Array.from({ length: 8 }, () => vent({}))]);
    expect(agg.askVsGuessPct).toBeCloseTo(0.8, 5);
    expect(agg.gates.askVsGuess).toBe(false);
  });

  it("counts an errored vent as a structural failure", () => {
    const agg = aggregate([vent({ inputQuality: "error", checks: [], error: "boom" })]);
    expect(agg.structuralPct).toBe(0);
    expect(agg.gates.structural).toBe(false);
  });

  it("sums tokens and latency", () => {
    const agg = aggregate([vent({}), vent({})]);
    expect(agg.totalInputTokens).toBe(200);
    expect(agg.totalOutputTokens).toBe(100);
    expect(agg.totalLatencyMs).toBe(2000);
  });
});

describe("formatReport", () => {
  it("includes the gate verdicts and headline percentages", () => {
    const out = formatReport(aggregate([vent({})]), [vent({})]);
    expect(out).toContain("Structural");
    expect(out).toContain("Ask-vs-guess");
    expect(out).toMatch(/PASS|FAIL/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test`
Expected: FAIL — `Cannot find module './score'`.

- [ ] **Step 3: Write the minimal implementation**

Create `evals/score.ts`:
```ts
import type { CheckResult } from "./checks";
import type { Usage } from "../lib/llm/telemetry";

/** One vent's outcome — the model's judgement, every check it ran, and its cost. */
export interface VentResult {
  id: string;
  expectThin: boolean;
  inputQuality: "workable" | "thin" | "error";
  checks: CheckResult[];
  latencyMs: number;
  usage: Usage;
  error?: string;
}

/** Rolled-up scores + the roadmap §04 hard gates. */
export interface Aggregate {
  n: number;
  structuralPct: number;
  askVsGuessPct: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalLatencyMs: number;
  gates: { structural: boolean; askVsGuess: boolean };
}

// The deterministic structural checks (roadmap §04 structural validity ≥99%).
// A vent counts as structurally valid only when every one of these it ran passed.
const STRUCTURAL_CHECK_NAMES = new Set([
  "schema-valid",
  "one-source",
  "suggestion-choice-3-options",
  "counter-argument-present",
  "highlights-verbatim",
  "edges-resolve",
]);

const STRUCTURAL_GATE = 0.99;
const ASK_VS_GUESS_GATE = 0.9;

export function aggregate(results: VentResult[]): Aggregate {
  const n = results.length;

  const structuralPass = results.filter((r) => {
    if (r.error) return false;
    const structural = r.checks.filter((c) => STRUCTURAL_CHECK_NAMES.has(c.name));
    return structural.length > 0 && structural.every((c) => c.pass);
  }).length;

  const askPass = results.filter((r) =>
    r.checks.some((c) => c.name === "ask-vs-guess" && c.pass)
  ).length;

  const structuralPct = n === 0 ? 0 : structuralPass / n;
  const askVsGuessPct = n === 0 ? 0 : askPass / n;

  const totalInputTokens = results.reduce((s, r) => s + (r.usage.input_tokens ?? 0), 0);
  const totalOutputTokens = results.reduce((s, r) => s + (r.usage.output_tokens ?? 0), 0);
  const totalLatencyMs = results.reduce((s, r) => s + r.latencyMs, 0);

  return {
    n,
    structuralPct,
    askVsGuessPct,
    totalInputTokens,
    totalOutputTokens,
    totalLatencyMs,
    gates: {
      structural: structuralPct >= STRUCTURAL_GATE,
      askVsGuess: askVsGuessPct >= ASK_VS_GUESS_GATE,
    },
  };
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

/** A plain-text report: per-vent lines (only failures spelled out) + a summary
 *  with the two hard-gate verdicts. Pure — returns a string, prints nowhere. */
export function formatReport(agg: Aggregate, results: VentResult[]): string {
  const lines: string[] = [];
  lines.push("=== getInitialCanvas eval ===");
  for (const r of results) {
    const failed = r.checks.filter((c) => !c.pass).map((c) => c.name);
    const status = r.error ? `ERROR (${r.error})` : failed.length === 0 ? "ok" : `FAIL: ${failed.join(", ")}`;
    lines.push(
      `  ${r.id.padEnd(18)} ${String(r.inputQuality).padEnd(9)} ${r.latencyMs}ms  ${status}`
    );
  }
  lines.push("");
  lines.push(`  Vents:         ${agg.n}`);
  lines.push(
    `  Structural:    ${pct(agg.structuralPct)}  [${agg.gates.structural ? "PASS" : "FAIL"}] (gate ≥99%)`
  );
  lines.push(
    `  Ask-vs-guess:  ${pct(agg.askVsGuessPct)}  [${agg.gates.askVsGuess ? "PASS" : "FAIL"}] (gate ≥90%)`
  );
  lines.push(
    `  Tokens:        in ${agg.totalInputTokens}, out ${agg.totalOutputTokens}  ·  Latency: ${agg.totalLatencyMs}ms total`
  );
  return lines.join("\n");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test`
Expected: PASS (all three tasks' tests green).

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add evals/score.ts evals/score.test.ts
git commit -m "$(cat <<'EOF'
Add eval scoring, gates, and report formatting

Pure aggregate() rolls per-vent checks into structural (≥99%) and ask-vs-guess
(≥90%) gate verdicts plus token/latency totals; formatReport() renders it.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: The runner (orchestration + real smoke run)

**Files:**
- Create: `evals/run.ts`

**Interfaces:**
- Consumes: `loadEnvLocal` (`./env`); `SEED_VENTS` (`./seed-vents`); `readInitialCanvas`, `assembleInitialGraph` (`../lib/llm/initial-canvas`); `InitialReadingSchema` (`../lib/llm/schemas`); `schemaValid` (`./checks`); `checkInitialGraphStructure`, `checkAskVsGuess` (`./initial-canvas-checks`); `aggregate`, `formatReport`, `VentResult` (`./score`); `Locale` (`../lib/llm/prompts`).
- Produces: a CLI (`npm run eval`) with flags `--limit N` and `--locale en|tr`; prints the report; exits `0` when both gates pass, `1` otherwise.

- [ ] **Step 1: Write the runner**

Create `evals/run.ts`:
```ts
/**
 * Eval runner for the getInitialCanvas seam (roadmap §04, Phase 1 leftover).
 * Calls the REAL server-side seam over the seed vents, applies the deterministic
 * checks, and prints a scored report. Run with: `npm run eval -- --limit 3`.
 *
 * Cost: one Sonnet 5 call per vent (≈ a cent or two). Use --limit while iterating.
 */
import { loadEnvLocal } from "./env";
import { SEED_VENTS } from "./seed-vents";
import { schemaValid } from "./checks";
import { checkInitialGraphStructure, checkAskVsGuess } from "./initial-canvas-checks";
import { aggregate, formatReport, type VentResult } from "./score";
import { readInitialCanvas, assembleInitialGraph } from "../lib/llm/initial-canvas";
import { InitialReadingSchema } from "../lib/llm/schemas";
import type { Locale } from "../lib/llm/prompts";

interface Args {
  limit?: number;
  locale: Locale;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { locale: "en" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--limit") args.limit = Number(argv[++i]);
    else if (argv[i] === "--locale") {
      const v = argv[++i];
      if (v === "en" || v === "tr") args.locale = v;
    }
  }
  return args;
}

async function main() {
  // Must run before the first readInitialCanvas call. The client reads the key
  // lazily (getClient at call time), so loading env here — after imports — is
  // fine; the key is not touched at module load.
  loadEnvLocal();

  const args = parseArgs(process.argv.slice(2));
  const vents = args.limit ? SEED_VENTS.slice(0, args.limit) : SEED_VENTS;

  const results: VentResult[] = [];
  for (const vent of vents) {
    const start = Date.now();
    try {
      const { reading, usage } = await readInitialCanvas(vent.text, args.locale);
      const latencyMs = Date.now() - start;
      const graph = assembleInitialGraph(vent.text, reading);
      const checks = [
        schemaValid(InitialReadingSchema, reading),
        ...checkInitialGraphStructure(graph),
        checkAskVsGuess(reading.inputQuality, vent.thin),
      ];
      results.push({
        id: vent.id,
        expectThin: vent.thin,
        inputQuality: reading.inputQuality,
        checks,
        latencyMs,
        usage,
      });
    } catch (err) {
      results.push({
        id: vent.id,
        expectThin: vent.thin,
        inputQuality: "error",
        checks: [],
        latencyMs: Date.now() - start,
        usage: {},
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const agg = aggregate(results);
  console.log(formatReport(agg, results));
  process.exit(agg.gates.structural && agg.gates.askVsGuess ? 0 : 1);
}

void main();
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 3: Confirm `.env.local` is present**

Run: `ls -la .env.local`
Expected: the file exists (contains `ANTHROPIC_API_KEY` + `ANTHROPIC_WORKSPACE_ID`). If missing, create it from `.env.example` before continuing — the runner will otherwise report `ANTHROPIC_API_KEY is not set` for every vent.

- [ ] **Step 4: Real smoke run (2 vents — one workable, one thin)**

Run: `npm run eval -- --limit 6`
Expected: a printed report; the workable vents judged `workable`, the thin ones (`thin-help`, etc., which start at index 5) judged `thin`; structural checks pass. This spends a few cents. Confirm the process exits 0 (gates pass) or prints which gate failed.

- [ ] **Step 5: Commit**

```bash
git add evals/run.ts
git commit -m "$(cat <<'EOF'
Add getInitialCanvas eval runner

Calls the real seam over the seed vents, applies schema/structural/ask-vs-guess
checks, prints a scored report, and exits non-zero when a hard gate fails.
Flags: --limit N, --locale en|tr.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Grow the seed set to ~30 + document; establish the baseline

**Files:**
- Modify: `evals/seed-vents.ts`
- Modify: `evals/README.md`

**Interfaces:**
- Consumes: the existing `SeedVent` shape (`{ id, text, thin, expects }`) — do not change it.
- Produces: ~30 `SEED_VENTS` entries (existing 10 kept).

- [ ] **Step 1: Add ~20 more seed vents**

Append to the `SEED_VENTS` array in `evals/seed-vents.ts` — audience-relevant (HR / recruiting / IT procurement / knowledge work), a realistic mix of workable and thin. Each needs a unique `id`, the `thin` flag, and an `expects` rubric note. Aim for ~24 workable and ~6 thin across the full set (keeps the ask-vs-guess gate meaningful on both sides). Example additions (write ~20 in this style; keep bodies the way a busy professional actually types):
```ts
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
  { id: "thin-busy", text: "so busy", thin: true, expects: "No stated problem — ask what's eating the time." },
  { id: "thin-culture", text: "culture issues", thin: true, expects: "Too broad — ask for a concrete recent example." },
  // …continue to ~30 total.
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 3: Update the README**

In `evals/README.md`, replace the "What comes next → Phase 1 adds the runner" bullet with the current state: the runner exists. Add a "How to run" section:
```markdown
## How to run

- `npm run test` — unit tests for the eval logic (no model calls, free).
- `npm run eval -- --limit 3` — run the real seam over the first 3 vents (spends ~a few cents).
- `npm run eval` — the full set (~30 vents, ≈ $0.30–0.60).

Exit code is 0 when both hard gates pass (structural ≥99%, ask-vs-guess ≥90%), 1 otherwise.
```

- [ ] **Step 4: Establish the baseline (full run)**

Run: `npm run eval`
Record the printed structural % and ask-vs-guess % as the baseline in the commit message.

> **Note — this is the start of a tuning loop, not a one-shot pass.** The runner is the deliverable; clearing the gates is an ongoing prompt-iteration activity (roadmap Phase 1). If a gate is below target, read which vents failed, make ONE targeted, append-only edit to `initialCanvasSystemPrompt` in `lib/llm/prompts.ts` (e.g., sharpen the 'thin' definition if workable vents are being judged thin), re-run, and compare — don't rewrite the prompt wholesale. Keep prompt edits in their own commits, separate from this seed-set commit.

- [ ] **Step 5: Commit**

```bash
git add evals/seed-vents.ts evals/README.md
git commit -m "$(cat <<'EOF'
Grow eval seed set to ~30 and document the runner

Adds ~20 audience-relevant vents (HR / recruiting / IT procurement), updates the
README with how-to-run + cost. Baseline: structural <X%>, ask-vs-guess <Y%>.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Out of scope (separate plans)

- **Prompt caching + streaming** on the initial-canvas call — the other Phase 1 leftover; its own plan.
- **LLM-judge eval passes** (counter-argument quality, fit-signal honesty) — Phase 3; needs a judge harness.
- **The Phase 3 grounding gate** (`citationExists` / `noUnsourcedNamedPerson` applied to real grounded recommendations) — those `evals/checks.ts` primitives already exist but apply to `groundRecommendations`, not to `getInitialCanvas`, which produces no citations.

---

## Self-Review

**1. Spec coverage (task list P2 "eval runner" + roadmap §04):**
- "call getInitialCanvas over the seed vents" → Task 4. ✓
- "apply the checks (schemaValid, citationExists, noUnsourcedNamedPerson)" → `schemaValid` applied (Task 4); `citationExists`/`noUnsourcedNamedPerson` correctly **excluded** here (they gate `groundRecommendations`, not the citation-free initial canvas) — noted in Out of scope. ✓
- "print a score" → `formatReport` (Task 3), printed in Task 4. ✓
- "formalize the ask-vs-guess gate" → `checkAskVsGuess` + the 90% gate in `aggregate` (Tasks 2–3). ✓
- "grow the seed set to ~30" → Task 5. ✓
- Structural validity ≥99% gate → `aggregate` gate (Task 3). ✓

**2. Placeholder scan:** No "TBD"/"handle errors"/"similar to". The one open-ended item (prompt tuning) is explicitly framed as an iterative loop with a concrete example edit, not a checkbox pretending to be deterministic. Cost is reported from real `usage`, not fabricated. ✓

**3. Type consistency:** `CheckResult` (`{ name, pass, detail? }`) reused from `evals/checks.ts` throughout. `checkAskVsGuess(inputQuality: "workable" | "thin", …)` matches `InitialReading["inputQuality"]` and the runner passes `reading.inputQuality`. `VentResult`/`Aggregate` field names match across Tasks 3 and 4. `readInitialCanvas` returns `{ reading, usage }` and `assembleInitialGraph(chatText, reading)` returns `CanvasGraph` — matches `lib/llm/initial-canvas.ts`. Fixture graphs use only real `CanvasNodeData` fields (`id, kind, title, body, parentId, depth, selected` + optional `cardType/options/highlights`). ✓
