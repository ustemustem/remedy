// Client-only session history — no backend, so this is the persistence
// layer: every vent→canvas→dashboard attempt is saved to localStorage as
// soon as it starts, so a page refresh (or picking an old one from the
// sidebar) never loses work. Capped at MAX_SESSIONS; oldest evicted first.

import type { CanvasGraph, Step } from "./types";
import type { Industry } from "./examplePrompts";

export interface SessionRecord {
  id: string;
  chatText: string;
  graph: CanvasGraph;
  step: Step;
  updatedAt: number;
  industry: Industry;
}

// Mock context tagging — same keyword-scan spirit as thoughtTriggers.ts, no
// real NLP. Used to filter sessions in the search overlay.
const HR_KEYWORDS = [
  "candidate",
  "hire",
  "hiring",
  "recruit",
  "sourcing",
  "onboarding",
  "shortlist",
  "interview",
];
const IT_KEYWORDS = [
  "procurement",
  "vendor",
  "license",
  "signoff",
  "sign-off",
  "software",
  "compliance",
  "tool purchase",
];

export function inferIndustry(chatText: string): Industry {
  const lower = chatText.toLowerCase();
  if (HR_KEYWORDS.some((k) => lower.includes(k))) return "hr";
  if (IT_KEYWORDS.some((k) => lower.includes(k))) return "it";
  return "general";
}

const STORAGE_KEY = "remedy.sessions.v1";
const MAX_SESSIONS = 20;

function readAll(): SessionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(sessions: SessionRecord[]) {
  if (typeof window === "undefined") return;
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_SESSIONS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
  } catch {
    // Quota exceeded or storage disabled (e.g. private browsing) — fail
    // silently. The app stays fully usable, just without persistence.
  }
}

/** Most recently updated first. */
export function loadSessions(): SessionRecord[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createSession(chatText: string, graph: CanvasGraph, step: Step): SessionRecord {
  const record: SessionRecord = {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    chatText,
    graph,
    step,
    updatedAt: Date.now(),
    industry: inferIndustry(chatText),
  };
  writeAll([record, ...readAll()]);
  return record;
}

export function updateSession(
  id: string,
  graph: CanvasGraph,
  step: Step
): SessionRecord | null {
  const all = readAll();
  const index = all.findIndex((s) => s.id === id);
  if (index === -1) return null;
  const updated: SessionRecord = { ...all[index], graph, step, updatedAt: Date.now() };
  all[index] = updated;
  writeAll(all);
  return updated;
}
