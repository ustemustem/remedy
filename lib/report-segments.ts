// Pure, environment-agnostic report-text logic shared by the client seam
// (lib/mockAI.ts) and the server reader's mock branch (lib/llm/report.ts):
// the index->segment mappers for real model output, plus the deterministic
// templates that serve as the error/offline fallback.
import type { SummarySegment, ReadoutSegment, SessionStats } from "./types";
import type { DashboardNeed, ThemeEntry } from "./graph";

/** One segment as the model returns it for the "what we understood" summary:
 *  `refIndex` is a 1-based index into the needs list it was given, or null for
 *  ordinary prose. */
export interface RawSummarySegment {
  content: string;
  refIndex: number | null;
}

/** One segment as the model returns it for the session-reading paragraph. */
export interface RawReadoutSegment {
  content: string;
  emphasis: boolean;
}

function baseTitle(title: string) {
  return title.replace(/\s\(v\d+\)$/, "");
}

/**
 * Maps the model's raw summary segments onto real SummarySegments. A non-null
 * `refIndex` in [1, needs.length] becomes a `ref` pointing at that need's node
 * id; null or an out-of-range index degrades to plain text. The renderer's own
 * unknown-nodeId degrade path (UnderstoodSummary) is the final safety net.
 */
export function mapSummarySegments(
  raw: RawSummarySegment[],
  needs: DashboardNeed[]
): SummarySegment[] {
  return raw.map((seg) => {
    const idx = seg.refIndex;
    if (idx != null && Number.isInteger(idx) && idx >= 1 && idx <= needs.length) {
      return { type: "ref", content: seg.content, nodeId: needs[idx - 1].node.id };
    }
    return { type: "text", content: seg.content };
  });
}

/** Coerces the model's raw readout segments to ReadoutSegment[] (drops a false
 *  emphasis to undefined so the renderer's `font-medium` check stays clean). */
export function mapReadoutSegments(raw: RawReadoutSegment[]): ReadoutSegment[] {
  return raw.map((seg) => ({
    content: seg.content,
    ...(seg.emphasis ? { emphasis: true } : {}),
  }));
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** The composite fit number (Phase 3a): a locked 50/50 blend of the two parts,
 *  computed in code so the headline number always equals its two bars. */
export function computeCompositeFit(coverageScore: number, confidenceScore: number): number {
  return Math.round((clampScore(coverageScore) + clampScore(confidenceScore)) / 2);
}

function refFor(n: DashboardNeed): SummarySegment {
  return {
    type: "ref",
    content: baseTitle(n.node.title).toLowerCase(),
    nodeId: n.node.id,
  };
}
function text(content: string): SummarySegment {
  return { type: "text", content };
}

/** Deterministic "what we understood" summary from real derived needs — the
 *  error/offline fallback for getUnderstoodSummary (was mockAI's template). */
export function fallbackUnderstoodSummary(needs: DashboardNeed[]): SummarySegment[] {
  if (needs.length === 0) return [];
  if (needs.length === 1) {
    return [text("You came in with one clear need: "), refFor(needs[0]), text(` — ${needs[0].quote}`)];
  }
  if (needs.length === 2) {
    return [text("You came in with two needs: "), refFor(needs[0]), text(" and "), refFor(needs[1]), text(".")];
  }
  const [first, ...rest] = needs;
  const segments: SummarySegment[] = [
    text(`You came in with ${needs.length} needs. The one shaping everything else was `),
    refFor(first),
    text(` — ${first.quote}. Around it sat `),
  ];
  rest.forEach((n, i) => {
    segments.push(refFor(n));
    if (i < rest.length - 2) segments.push(text(", "));
    else if (i === rest.length - 2) segments.push(text(", and "));
  });
  segments.push(text("."));
  return segments;
}

function emphasis(content: string): ReadoutSegment {
  return { content, emphasis: true };
}
function plain(content: string): ReadoutSegment {
  return { content };
}

/** Deterministic session-reading paragraph from real stats/themes — the
 *  error/offline fallback for getSessionReadout (was mockAI's template). */
export function fallbackSessionReadout(stats: SessionStats, themes: ThemeEntry[]): ReadoutSegment[] {
  const segments: ReadoutSegment[] = [];
  const liked = themes.filter((t) => t.type === "like");
  const disliked = themes.filter((t) => t.type === "dislike");

  if (stats.pathCount === 0) {
    segments.push(plain("Nothing here needed a detour, "), emphasis("you knew what fit"), plain(" from the first pass."));
  } else if (stats.pathCount <= stats.selectedCount) {
    segments.push(plain("A "), emphasis("focused search"), plain(": what you explored converged fast."));
  } else {
    segments.push(plain("You "), emphasis("cast a wide net"), plain(" before narrowing down. What made the cut had to earn it."));
  }

  if (disliked.length === 0 && liked.length > 0) {
    segments.push(plain(" Nothing drew pushback, "), emphasis("a strong signal"), plain(" this shortlist holds up."));
  } else if (disliked.length > 0 && liked.length > disliked.length) {
    segments.push(plain(" More approval than pushback here: it survived "), emphasis("real scrutiny"), plain(", not just a first look."));
  } else if (disliked.length > 0) {
    segments.push(plain(" You read this "), emphasis("critically"), plain(": what's left reflects genuine scrutiny, not a first impression."));
  }

  const steeringCount = stats.noteCount + stats.ownFramingCount;
  if (steeringCount === 0 && (stats.pathCount > 0 || liked.length + disliked.length > 0)) {
    segments.push(plain(" And it took "), emphasis("little correcting"), plain(" along the way."));
  } else if (steeringCount > 0) {
    segments.push(
      plain(" You "),
      emphasis("steered it directly"),
      plain(steeringCount > 1 ? ", in your own words, more than once." : ", in your own words, at least once.")
    );
  }

  return segments;
}
