# Slice 3b — Grounded evidence (groundRecommendations)

Date: 2026-09-15 · Branch: `claude/remaining-tasks-13dc05` · Phase 3, sub-task 3b

## Status / constraint (locked in grilling)

Built **code-only against `LLM_MOCK`**. Its value — real cited links, citation-exists,
no-invented-people — is **NOT verifiable under mock** and stays UNVERIFIED until the
user adds `ANTHROPIC_API_KEY` and does a real run (backlog: `memory/3b-grounding-real-verify-pending.md`;
remind continually). **Structural-complete** but **defer** the 3e gate (hiding
ungrounded recs) and relevance/quality tuning to the real-key session.

## Goal

Each report recommendation shows **real, cited evidence links** (app / community /
role channels) via web_search, replacing the retired fabricated evidence. Honest by
construction: a link is shown only if web_search actually returned it.

## Data

- `EvidenceExample` → `{ kind: "app" | "community" | "role"; label: string; detail: string; url: string }`
  (**`url` added, required**; kinds repurposed from linkedin/app/company).
- Grounded evidence lives on **`DashboardNeed.evidence?: EvidenceExample[]`**
  (report-derived, like `fit`) — never on `node.evidenceExamples` (dead field; 3f removes).

## Seam + pipeline (two-step, per need)

`getGroundedEvidence(vent, needs)` (the tasklist's `groundRecommendations`) →
`POST /api/report/ground` with `{ vent, needs: [{label, body}] }`. The route runs
**all needs in parallel**; per need, `readGroundedEvidenceForOne`:

1. **web_search call** — `messages.create({ tools: [{ type: WEB_SEARCH_TOOL_TYPE, name: "web_search", max_uses }] })`
   (Sonnet). Extract text + the real citation URLs from `web_search_tool_result`
   blocks (defensive, like `app/api/llm-proof/route.ts`).
2. If no citations → return `[]` (honest gap).
3. **extraction call** — `messages.parse` (Haiku, `GroundedEvidenceSchema`) given the
   recommendation + search text + the **list of real URLs** → up to 3 items, using
   ONLY those URLs; picks the most relevant channels (may return fewer/none).
4. **code-side clean** — `filterGroundedEvidence(items, allowedUrls, 3)`: keep only
   items whose `url` ∈ `allowedUrls` (citation-exists), dedup by url, cap 3.

Returns `EvidenceExample[][]` indexed to `needs`. `LLM_MOCK` branch returns realistic
fixtures ("(mock)") with plausible urls. On any error/offline → `[]` (omit, no fake).
Models: web_search = `MODELS.reasoning` (Sonnet), extraction = `MODELS.cheap` (Haiku).

## UI

- `EvidenceRow`: headings repurposed — `app`→"Tool", `community`→"Discussion",
  `role`→"Role search"; each item is a **clickable link** (`url`, `target="_blank"
  rel="noopener noreferrer"`); `key` by `url` (not `kind`). Kept on **compact**
  (existing collapsible) and **added to the hero** (new section under the fit meter).
- **Per-card, non-gating load.** Fit still gates the cards section (ranking needs
  it). Grounding loads *after*, independently: while `evidence === null` the card's
  evidence slot shows a brief "Finding evidence…"; then the `EvidenceRow` (or nothing
  if `[]`). web_search is slow, so it must not block the whole section.

## Report wiring (`prescription-report.tsx`)

On mount fire `getGroundedEvidence(vent, needs)` in parallel with the fit call; hold
`evidence: EvidenceExample[][] | null`. `needsEnriched = needs.map((n,i) => ({...n,
fit: fits?.[i], evidence: evidence?.[i]}))`; `feed = deriveDashboardFeed(needsEnriched)`
(ranking still by fit — evidence never reorders). Pass `evidenceLoading = evidence === null`
to the cards.

## Plumbing (mirrors 3a/3c)

`GroundedEvidenceSchema` (`lib/llm/schemas.ts`); `groundingSearchSystemPrompt` +
`groundingExtractSystemPrompt` (`lib/llm/prompts.ts`); `readGroundedEvidenceForOne`
(`lib/llm/report.ts`, telemetry seam `groundEvidence`); route
`app/api/report/ground/route.ts`; seam `getGroundedEvidence` (`lib/mockAI.ts`); pure
`filterGroundedEvidence` (`lib/report-segments.ts`, unit-tested).

## Cross-cutting rules

- The recommendation is data in the **user** turn; behavior in the system prompt.
- **role = LinkedIn role-search URL only, never an invented named person** (prompt rule).
- No invented statistics; a link only if web_search returned it (code-enforced).
- `zod/v4`; route `runtime="nodejs"`, zod-validated. Locale default `"en"`.

## Deferred (not this slice)

3e grounding gate (hide ungrounded recs), relevance/source-quality tuning, 3f
dead-code + peer-comparison-bar removal, peer channel (Phase 5).

## Verification

- `tsc` + `lint` + vitest (`filterGroundedEvidence`: citation-exists drop, dedup, cap).
- Existing Playwright E2E stays green; live `LLM_MOCK` run: cards show the grounded
  EvidenceRow (Tool/Discussion/Role search links) after a brief "Finding evidence…",
  and forcing `/api/report/ground` to 500 omits evidence with no crash.
- **Real web_search grounding UNVERIFIED** — backlog until the key is added.
