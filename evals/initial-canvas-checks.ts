import type { CanvasGraph } from "../lib/types";
import type { CheckResult } from "./checks";

/**
 * Structural gate for a getInitialCanvas graph (roadmap §04 structural
 * validity). Pure — no model calls. Asserts the assembled graph matches the
 * shape the canvas expects: exactly one source at depth 0, a 3-option
 * Suggestion choice card and a Counter-argument at depth 1, and edges that
 * resolve to real nodes. Highlight fidelity is checked separately, against
 * the model's raw output — see checkRawHighlightsVerbatim below.
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
 * Highlight fidelity, checked against the model's RAW output (roadmap §04).
 * assembleInitialGraph silently drops any highlight that isn't a verbatim
 * substring of the vent, so checking the assembled graph can never fail. This
 * runs on what the MODEL actually emitted, so it catches a model that
 * paraphrases highlights (they'd be dropped) instead of copying verbatim.
 * Passes when the model emitted no highlights, or every emitted highlight is a
 * verbatim substring of the vent; fails when it emitted >=1 that is not.
 */
export function checkRawHighlightsVerbatim(
  rawHighlights: ReadonlyArray<{ text: string }>,
  ventText: string
): CheckResult {
  const nonVerbatim = rawHighlights.filter((h) => !ventText.includes(h.text));
  return {
    name: "highlights-verbatim",
    pass: nonVerbatim.length === 0,
    detail:
      nonVerbatim.length === 0
        ? undefined
        : `${nonVerbatim.length} model highlight(s) not verbatim: ${nonVerbatim
            .map((h) => JSON.stringify(h.text))
            .join(", ")}`,
  };
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
