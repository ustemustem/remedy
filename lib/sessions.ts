// Client-only session history — no backend, so this is the persistence
// layer: every vent→canvas→dashboard attempt is saved to localStorage as
// soon as it starts, so a page refresh (or picking an old one from the
// sidebar) never loses work. Capped at MAX_SESSIONS; oldest evicted first.

import type { CanvasGraph, Step } from "./types";
import type { Industry } from "./examplePrompts";
import type { SavedReport } from "./reports";

export interface SessionRecord {
  id: string;
  chatText: string;
  graph: CanvasGraph;
  step: Step;
  updatedAt: number;
  industry: Industry;
  /** Set when the user renames the session. The sidebar falls back to chatText. */
  title?: string;
  /** Saved report versions, all issues. Absent on sessions saved before reports were stored. */
  reports?: SavedReport[];
  /** When the user pinned it. Pinned sessions list first, newest pin on top,
   *  and are never evicted by the MAX_SESSIONS cap. */
  pinnedAt?: number;
}

export function sessionLabel(session: SessionRecord): string {
  return session.title?.trim() || session.chatText || "Untitled session";
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
  // The cap applies to unpinned sessions only: a pin is a promise to keep it.
  const pinned = sessions.filter((s) => s.pinnedAt);
  const recent = sessions
    .filter((s) => !s.pinnedAt)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SESSIONS);
  const sorted = [...pinned, ...recent];
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
  return patchSession(id, () => ({ graph, step }));
}

/** `touch: false` keeps updatedAt, so the session keeps its place in the sidebar. */
function patchSession(
  id: string,
  patch: (s: SessionRecord) => Partial<SessionRecord>,
  { touch = true }: { touch?: boolean } = {}
): SessionRecord | null {
  const all = readAll();
  const index = all.findIndex((s) => s.id === id);
  if (index === -1) return null;
  const updated: SessionRecord = {
    ...all[index],
    ...patch(all[index]),
    updatedAt: touch ? Date.now() : all[index].updatedAt,
  };
  all[index] = updated;
  writeAll(all);
  return updated;
}

/** An empty title clears the rename, so the sidebar shows the vent again. */
export function renameSession(id: string, title: string): SessionRecord | null {
  return patchSession(id, () => ({ title: title.trim() || undefined }), { touch: false });
}

export function setPinned(id: string, pinned: boolean): SessionRecord | null {
  return patchSession(id, () => ({ pinnedAt: pinned ? Date.now() : undefined }), { touch: false });
}

export function addReport(id: string, report: SavedReport): SessionRecord | null {
  return patchSession(id, (s) => ({ reports: [...(s.reports ?? []), report] }));
}

/** Saves later changes to one version: task edits, evidence that arrived after it opened. */
export function updateReport(
  id: string,
  reportId: string,
  patch: Partial<Pick<SavedReport, "tasks" | "data">>
): SessionRecord | null {
  return patchSession(id, (s) => ({
    reports: (s.reports ?? []).map((r) => (r.id === reportId ? { ...r, ...patch } : r)),
  }));
}
