# Grounded Evidence (Slice 3b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`. This session executes inline. Code-only vs LLM_MOCK; real grounding UNVERIFIED (backlog).

**Goal:** Real cited evidence links (app/community/role) per recommendation via web_search, into EvidenceRow, honest-by-construction (a link only if web_search returned it).

**Architecture:** Mirror 3a seams. Per-need two-step: web_search (Sonnet) → structured extraction (Haiku, only real URLs) → code citation-exists + dedup. Evidence on `DashboardNeed.evidence`; loads per-card, non-gating (fit still gates the section).

## Global Constraints

- `zod/v4`; `messages.parse` + `zodOutputFormat` → `parsed_output`; web_search via `messages.create({ tools:[{type: WEB_SEARCH_TOOL_TYPE, name:"web_search"}] })`.
- web_search = `MODELS.reasoning`; extraction = `MODELS.cheap`. Route `runtime="nodejs"`, zod-validated.
- No fabricated data on nodes; a link only if in the real web_search citation set (code-enforced). role = LinkedIn role-search URL only, never a named person (prompt).
- Commit only as part of this session's push to `claude/remaining-tasks-13dc05` (footer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`); bundle into PR #20.
- Verify each task with `tsc`+`lint`; pure logic with vitest.

## File map

- Modify `lib/types.ts` — `EvidenceExample` gains `url`; kinds → app/community/role.
- Modify `lib/report-segments.ts` (+`.test.ts`) — `filterGroundedEvidence`.
- Modify `lib/graph.ts` — `DashboardNeed.evidence?`.
- Modify `lib/llm/schemas.ts` — `GroundedEvidenceSchema`.
- Modify `lib/llm/prompts.ts` — `groundingSearchSystemPrompt`, `groundingExtractSystemPrompt`.
- Modify `lib/llm/report.ts` — `readGroundedEvidenceForOne` (+ `extractText`/`extractCitations` helpers).
- Create `app/api/report/ground/route.ts`.
- Modify `lib/mockAI.ts` — `getGroundedEvidence`.
- Modify `components/dashboard/evidence-row.tsx` — headings, links, key.
- Modify `components/dashboard/prescription-card.tsx` — hero EvidenceRow + evidenceLoading.
- Modify `components/dashboard/prescription-card-compact.tsx` — need.evidence + evidenceLoading.
- Modify `components/dashboard/prescription-report.tsx` — grounding fetch + enrich + pass.

---

### Task 1: EvidenceExample shape + filterGroundedEvidence + test

- [ ] **Step 1:** In `lib/types.ts` replace the `EvidenceExample` interface:

```ts
export interface EvidenceExample {
  kind: "app" | "community" | "role";
  label: string;
  detail: string;
  url: string;
}
```

- [ ] **Step 2:** Append to `lib/report-segments.ts` (imports `EvidenceExample` from `./types`):

```ts
import type { SummarySegment, ReadoutSegment, SessionStats, EvidenceExample } from "./types";
// ...
/** Keep only evidence whose url is one web_search actually returned (citation-
 *  exists), dedup by url, cap at `max`. The guarantee the model cannot invent a
 *  link: allowedUrls comes from the real web_search_tool_result blocks. */
export function filterGroundedEvidence(
  items: EvidenceExample[],
  allowedUrls: string[],
  max = 3
): EvidenceExample[] {
  const allowed = new Set(allowedUrls);
  const seen = new Set<string>();
  const out: EvidenceExample[] = [];
  for (const it of items) {
    const url = typeof it.url === "string" ? it.url.trim() : "";
    if (!url || !allowed.has(url) || seen.has(url)) continue;
    seen.add(url);
    out.push({ ...it, url });
    if (out.length >= max) break;
  }
  return out;
}
```

- [ ] **Step 3:** Append tests to `lib/report-segments.test.ts`:

```ts
import { mapSummarySegments, mapReadoutSegments, computeCompositeFit, filterGroundedEvidence } from "./report-segments";
import type { EvidenceExample } from "./types";

function ev(url: string, kind: EvidenceExample["kind"] = "app"): EvidenceExample {
  return { kind, label: "L", detail: "D", url };
}

describe("filterGroundedEvidence", () => {
  const allowed = ["https://a.com", "https://b.com", "https://c.com"];
  it("drops urls not in the real citation set", () => {
    const out = filterGroundedEvidence([ev("https://a.com"), ev("https://evil.com")], allowed);
    expect(out.map((e) => e.url)).toEqual(["https://a.com"]);
  });
  it("dedups by url and caps at max", () => {
    const out = filterGroundedEvidence(
      [ev("https://a.com"), ev("https://a.com"), ev("https://b.com"), ev("https://c.com")],
      allowed,
      2
    );
    expect(out.map((e) => e.url)).toEqual(["https://a.com", "https://b.com"]);
  });
  it("returns [] when nothing matches", () => {
    expect(filterGroundedEvidence([ev("https://x.com")], allowed)).toEqual([]);
  });
});
```

- [ ] **Step 4:** `npm test -- report-segments` (9 passed) + `npx tsc --noEmit`. Note: this will surface type errors in EvidenceRow/compact card (old kinds/no url) — those are fixed in Task 6; tsc may error until then, so run `npm test` here and defer full tsc-green to Task 6. (Acceptable coupled boundary.)

---

### Task 2: Schema + prompts

- [ ] **Step 1:** Append to `lib/llm/schemas.ts`:

```ts
/**
 * Grounded evidence extraction (Phase 3b). Shapes web_search findings into up to
 * 3 cited items. `url` MUST be one of the real URLs provided to the model; the
 * server drops any that isn't (filterGroundedEvidence). Empty is valid (honest gap).
 */
export const GroundedEvidenceSchema = z.object({
  items: z
    .array(
      z.object({
        kind: z.enum(["app", "community", "role"]).describe("app = a tool/app; community = a discussion/write-up (Reddit/forum/blog); role = a LinkedIn role-search."),
        label: z.string().describe("Short source label (<= 6 words)."),
        detail: z.string().describe("One line on why this source supports the recommendation."),
        url: z.string().describe("The source URL — MUST be copied from the provided list of real URLs."),
      })
    )
    .max(3)
    .describe("0-3 most relevant grounded sources; return fewer or none rather than weak matches."),
});
export type GroundedEvidenceResult = z.infer<typeof GroundedEvidenceSchema>;
```

- [ ] **Step 2:** Append to `lib/llm/prompts.ts`:

```ts
/** groundRecommendations step 1 — web_search for real supporting sources. */
export function groundingSearchSystemPrompt(locale: Locale): string {
  return [
    "You are Remedy, finding real, credible sources that support a recommendation for a busy professional.",
    "Search the web for up to three kinds of source, choosing only those genuinely relevant:",
    "- a specific tool/app that helps enact the recommendation,",
    "- a practitioner discussion or write-up (Reddit, a forum, or a reputable blog),",
    "- ONLY if the recommendation involves hiring or a role, a LinkedIn role-search (people in that role) — never a specific named person.",
    "Cite real URLs you actually find. Do not invent sources, statistics, or named people. If little is out there, that is fine — find what genuinely exists.",
    languageLine(locale),
  ].join("\n");
}

/** groundRecommendations step 2 — shape the findings into cited evidence items. */
export function groundingExtractSystemPrompt(locale: Locale): string {
  return [
    "You turn web-search findings into up to three cited evidence items for a recommendation.",
    "You are given the recommendation, the search findings, and a LIST OF REAL URLS.",
    "Rules:",
    "- Use ONLY urls from the provided list — copy them exactly. Never invent a url.",
    "- kind: app (a tool/app), community (a discussion/write-up), role (a LinkedIn role-search link only, never a named person).",
    "- Pick the most relevant sources; return fewer or an empty list rather than weak or off-topic matches.",
    "- No invented statistics or claims.",
    languageLine(locale),
  ].join("\n");
}
```

- [ ] **Step 3:** `npx tsc --noEmit && npm run lint` (Task 1's EvidenceRow type errors may persist — that's expected until Task 6; lint/tsc on the new files themselves should be clean).

---

### Task 3: Reader (two-step)

- [ ] **Step 1:** In `lib/llm/report.ts` add imports: `WEB_SEARCH_TOOL_TYPE` from `./client`; `GroundedEvidenceSchema` from `./schemas`; `groundingSearchSystemPrompt`, `groundingExtractSystemPrompt` from `./prompts`; `EvidenceExample` from `../types`; `filterGroundedEvidence` from `../report-segments`; `import type Anthropic from "@anthropic-ai/sdk";`.

- [ ] **Step 2:** Append the helpers + reader:

```ts
function extractText(content: Anthropic.ContentBlock[]): string {
  return content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
}
function extractCitations(content: Anthropic.ContentBlock[]): string[] {
  const urls: string[] = [];
  for (const block of content) {
    const b = block as unknown as { type: string; content?: unknown };
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content) {
        const rr = r as { url?: string };
        if (typeof rr.url === "string") urls.push(rr.url);
      }
    }
  }
  return urls;
}

export interface GroundNeedInput {
  label: string;
  body: string;
}

/** groundRecommendations for ONE recommendation: web_search -> extract -> clean. */
export async function readGroundedEvidenceForOne(
  input: { vent: string; recommendation: GroundNeedInput },
  locale: Locale
): Promise<{ result: EvidenceExample[]; usage: Usage }> {
  if (isLlmMock()) {
    await new Promise((r) => setTimeout(r, 700));
    const slug = encodeURIComponent(input.recommendation.label.toLowerCase().replace(/\s+/g, "-").slice(0, 40));
    const result: EvidenceExample[] = [
      { kind: "app", label: "A fitting tool", detail: "A tool that helps enact this. (mock)", url: `https://example.com/tool/${slug}` },
      { kind: "community", label: "Practitioner thread", detail: "Others who tried this discuss how. (mock)", url: `https://example.com/discussion/${slug}` },
    ];
    return { result, usage: {} };
  }

  const client = getClient();
  // 1) web_search
  const search = await client.messages.create({
    model: MODELS.reasoning,
    max_tokens: 1024,
    system: groundingSearchSystemPrompt(locale),
    tools: [{ type: WEB_SEARCH_TOOL_TYPE, name: "web_search", max_uses: 3 }],
    messages: [
      {
        role: "user",
        content:
          `The user's situation:\n"${input.vent}"\n\n` +
          `The recommendation to support:\n${input.recommendation.label} — ${input.recommendation.body}`,
      },
    ],
  });
  const searchText = extractText(search.content);
  const allowedUrls = extractCitations(search.content);
  if (allowedUrls.length === 0) {
    return { result: [], usage: search.usage };
  }

  // 2) structured extraction, constrained to the real urls
  const extract = await client.messages.parse({
    model: MODELS.cheap,
    max_tokens: 768,
    system: groundingExtractSystemPrompt(locale),
    output_config: { format: zodOutputFormat(GroundedEvidenceSchema) },
    messages: [
      {
        role: "user",
        content:
          `Recommendation:\n${input.recommendation.label} — ${input.recommendation.body}\n\n` +
          `Search findings:\n${searchText}\n\n` +
          `Real URLs (use only these):\n${allowedUrls.join("\n")}`,
      },
    ],
  });
  const items = extract.parsed_output?.items ?? [];
  return { result: filterGroundedEvidence(items, allowedUrls, 3), usage: extract.usage };
}
```

- [ ] **Step 3:** `npx tsc --noEmit` (new file clean; card errors persist until Task 6).

---

### Task 4: Route

- [ ] **Step 1:** Create `app/api/report/ground/route.ts`:

```ts
import { z } from "zod/v4";
import { MODELS } from "@/lib/llm/client";
import { withTelemetry } from "@/lib/llm/telemetry";
import { readGroundedEvidenceForOne } from "@/lib/llm/report";

/** POST /api/report/ground — Phase 3b grounding. Grounds every recommendation in
 *  parallel; each is a web_search + extraction. Returns evidence[] per need. */
export const runtime = "nodejs";

const RequestSchema = z.object({
  vent: z.string().trim().max(8000),
  needs: z.array(z.object({ label: z.string().trim().max(200), body: z.string().trim().max(2000) })).min(1).max(12),
  locale: z.enum(["en", "tr"]).optional(),
});

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "Invalid input.", detail: parsed.error.issues.map((i) => i.message) }, { status: 400 });
  }
  const { vent, needs, locale = "en" } = parsed.data;

  try {
    const evidence = await Promise.all(
      needs.map((recommendation) =>
        withTelemetry("groundEvidence", MODELS.reasoning, async () => {
          const { result, usage } = await readGroundedEvidenceForOne({ vent, recommendation }, locale);
          return { result, usage };
        })
      )
    );
    return Response.json({ evidence });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2:** `npx tsc --noEmit` (new file clean).

---

### Task 5: DashboardNeed.evidence + seam

- [ ] **Step 1:** In `lib/graph.ts` add `EvidenceExample` to the types import and to `DashboardNeed`:

```ts
import type { CanvasNodeData, FeedbackContext, PeerOutcome, SessionStats, FitSignal, EvidenceExample } from "./types";
```
```ts
  /** Grounded evidence (Phase 3b), attached by the report after the async call. */
  evidence?: EvidenceExample[];
```

- [ ] **Step 2:** In `lib/mockAI.ts` add `EvidenceExample` to the `./types` import, then append the seam:

```ts
/**
 * Real getGroundedEvidence (Phase 3b) — POSTs vent + recommendations to the
 * ground route (web_search + extraction per need), returning cited evidence per
 * need in order. On any error/offline returns [] per need so evidence is omitted.
 */
export async function getGroundedEvidence(
  vent: string,
  needs: DashboardNeed[]
): Promise<EvidenceExample[][]> {
  if (needs.length === 0) return [];
  try {
    const res = await fetch("/api/report/ground", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vent, needs: needs.map((n) => ({ label: baseTitle(n.node), body: n.node.body })) }),
    });
    if (!res.ok) throw new Error(`ground ${res.status}`);
    const { evidence } = (await res.json()) as { evidence: EvidenceExample[][] };
    return evidence;
  } catch {
    return needs.map(() => []);
  }
}
```

- [ ] **Step 3:** `npx tsc --noEmit` (card errors persist until Task 6).

---

### Task 6: EvidenceRow + cards + report wiring (tsc-green boundary)

- [ ] **Step 1:** Rewrite `components/dashboard/evidence-row.tsx`:

```tsx
"use client";

import type { EvidenceExample } from "@/lib/types";

const KIND_HEADING: Record<EvidenceExample["kind"], string> = {
  app: "Tool",
  community: "Discussion",
  role: "Role search",
};

export function EvidenceRow({ examples }: { examples: EvidenceExample[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-3">
      {examples.map((example) => (
        <div key={example.url} className="space-y-1">
          <p className="font-mono text-[length:var(--text-label)] font-bold uppercase tracking-wide text-muted-foreground">
            {KIND_HEADING[example.kind]}
          </p>
          <a
            href={example.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[length:var(--text-label)] text-muted-foreground underline decoration-1 decoration-primary/40 underline-offset-2 hover:decoration-primary hover:text-foreground"
          >
            {example.label} — {example.detail}
          </a>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2:** Compact card (`prescription-card-compact.tsx`): swap fabricated evidence for `need.evidence` + loading. Replace the `evidenceCount`/`hasStatLine` derivation and the `{evidenceCount > 0 && (...)}` collapsible so it reads from `need.evidence` and shows a "Finding evidence…" line when `evidenceLoading`. Add `evidenceLoading` to the component props. Concretely:
  - Add prop: `export function PrescriptionCardCompact({ need, evidenceLoading }: { need: DashboardNeed; evidenceLoading?: boolean })`.
  - Replace `const evidenceCount = ...` with `const evidence = need.evidence ?? [];`.
  - Replace the evidence collapsible block with:

```tsx
        {evidenceLoading ? (
          <p className="text-[length:var(--text-label)] text-muted-foreground">Finding evidence…</p>
        ) : evidence.length > 0 ? (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="group flex items-center gap-1 rounded-full border border-border px-3 py-1 font-mono text-[length:var(--text-label)] uppercase tracking-wide text-muted-foreground motion-safe:transition-transform hover:border-foreground/30 hover:text-foreground motion-safe:active:scale-[0.98]"
              >
                <ChevronRight className="h-3 w-3 motion-safe:transition-transform group-data-[state=open]:rotate-90" />
                View evidence &middot; {evidence.length}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              <EvidenceRow examples={evidence} />
            </CollapsibleContent>
          </Collapsible>
        ) : null}
```
  - Remove now-unused `deriveEvidenceComparison`/`peerOutcome`/`comparison`/`hasStatLine`/the peer stat line? NO — leave the dead peer stat line as-is (deferred 3f), it just never renders. Only swap the evidence collapsible + evidenceCount. Keep imports used elsewhere; run lint to drop any now-unused (`EvidenceRow` still used).

- [ ] **Step 3:** Hero card (`prescription-card.tsx`): add `import { EvidenceRow } from "./evidence-row";`, add `evidenceLoading` prop, and render the grounded evidence under the FitBars section:

```tsx
        {need.evidence && need.evidence.length > 0 && (
          <div className="border-t border-border pt-3">
            <EvidenceRow examples={need.evidence} />
          </div>
        )}
        {evidenceLoading && !need.evidence?.length && (
          <p className="border-t border-border pt-3 text-[length:var(--text-label)] text-muted-foreground">
            Finding evidence…
          </p>
        )}
```
  Signature: `export function PrescriptionCard({ need, evidenceLoading }: { need: DashboardNeed; evidenceLoading?: boolean })`.

- [ ] **Step 4:** Report wiring (`prescription-report.tsx`): add grounding state + fetch alongside fit, enrich needs, pass `evidenceLoading` to cards.
  - Import: `getGroundedEvidence` (from `@/lib/mockAI`), `EvidenceExample` (from `@/lib/types`).
  - After the fit block add:

```tsx
  const [evidence, setEvidence] = useState<EvidenceExample[][] | null>(null);
  const [trackedForEvidence, setTrackedForEvidence] = useState(needs);
  if (needs !== trackedForEvidence) {
    setTrackedForEvidence(needs);
    setEvidence(null);
  }
  useEffect(() => {
    let cancelled = false;
    getGroundedEvidence(vent, needs).then((r) => {
      if (!cancelled) setEvidence(r);
    });
    return () => {
      cancelled = true;
    };
  }, [needs, vent]);
```
  - Change `needsWithFit` to also attach evidence (rename to `needsEnriched`):

```tsx
  const needsEnriched = useMemo(
    () => needs.map((n, i) => ({ ...n, fit: fits?.[i], evidence: evidence?.[i] })),
    [needs, fits, evidence]
  );
  const feed = useMemo(() => deriveDashboardFeed(needsEnriched), [needsEnriched]);
```
  (remove the old `needsWithFit` memo.)
  - Pass loading to the cards in the render: `<PrescriptionCard need={feed.hero} evidenceLoading={evidence === null} />` and each `<PrescriptionCardCompact key=... need={n} evidenceLoading={evidence === null} />` (hero + support + hidden).

- [ ] **Step 5:** `npx tsc --noEmit && npm run lint && npm test` — all green (this is the tsc-green boundary; fix any residual unused imports lint flags).

---

### Task 7: Integration verification (LLM_MOCK)

- [ ] **Step 1:** Dev server with `LLM_MOCK=1`; reach the report (resume the finalized session, or chat→prefer→finalize-anyway). If nested API routes 404, `rm -rf .next` + restart (known Turbopack cache gotcha).
- [ ] **Step 2:** Confirm each card shows a brief "Finding evidence…", then the grounded EvidenceRow (Tool / Discussion links, clickable). Telemetry logs `groundEvidence`.
- [ ] **Step 3 (fallback):** force `/api/report/ground` to 500; confirm cards render with no evidence and no crash; revert.
- [ ] **Step 4:** `npx playwright test` — existing E2E still green.
- [ ] **Step 5:** Spawn the real-verification task chip; report results; note real grounding remains UNVERIFIED (backlog).

## Self-Review

**Spec coverage:** shape+url (T1), filter/citation-exists+dedup (T1), schema/prompts (T2), two-step reader with web_search + real-url constraint (T3), parallel route (T4), DashboardNeed.evidence + seam (T5), EvidenceRow links + hero/compact + per-card non-gating load + report wiring (T6), verify + backlog chip (T7). Deferred items (3e gate, tuning, 3f, peer bars) untouched ✓.

**Placeholder scan:** none.

**Type consistency:** `EvidenceExample` (T1) used by `filterGroundedEvidence` (T1), schema mirrors its fields (T2), reader returns `EvidenceExample[]` (T3), route `EvidenceExample[][]` (T4), seam `getGroundedEvidence(vent, needs): EvidenceExample[][]` (T5) consumed in T6; `readGroundedEvidenceForOne` name consistent T3→T4; `need.evidence` (T5 field) read in T6 cards; `evidenceLoading` prop added to both cards (T6) and passed from report (T6).

**Note:** Task 1 intentionally leaves tsc red (card type errors) until Task 6 — the shape change and its consumers are one coupled boundary; vitest is the Task 1 gate.
