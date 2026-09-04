# Remedy backend/LLM — task list (mock → real)

Derived from `remedybackendhandoff.md` + the roadmap artifact (`8e677d5d…`), then
**verified against the actual code and git history on 2026-09-04**. Where the handoff
and the real repo state disagreed, the real state wins and is flagged below.

Authoritative plan (do not re-derive): roadmap artifact
`https://claude.ai/code/artifact/8e677d5d-cc84-470f-ada8-d9a7712c1923`

---

## Verified current state (what is actually true in this repo)

- **Phase 0 + Phase 1 are merged into `main`** and present in this worktree:
  - `getInitialCanvas` is real → POSTs `/api/canvas` (`lib/mockAI.ts`).
  - `lib/llm/{client,initial-canvas,prompts,schemas,telemetry}.ts` exist.
  - `app/api/canvas/route.ts` + `app/api/llm-proof/route.ts` exist (the proof route is throwaway).
  - Evals scaffold exists (`evals/{README.md,checks.ts,seed-vents.ts}`) but **there is no runner yet**.
- **Phase 2 is implemented but UNPUSHED / UNMERGED.** It lives only as three local
  commits on branch `claude/backend-phase0` (`d62bc4d`, `4040956`, `5075847`), which is
  **3 commits ahead of `origin/claude/backend-phase0`**. Those commits add the real
  `getOptionResponse` / `getPreferredContinuation` / async `classifyNote` / note flow, the
  routes `app/api/canvas/{option,prefer,classify,note}/route.ts`, and
  `lib/llm/{option-response,continuation,notes}.ts`. **None of this is in `main` or in this
  worktree** — here those seams are still mock and those files/routes do not exist.
- **Phase 3/4/5 not started.** Report seams are still mock: `getUnderstoodSummary`,
  `buildSessionReadout` (templated), `generateReport` (fake 2.5–4s delay). The still-mock
  interactive seams here still fabricate `matchScore`/`peerOutcome`/`evidenceExamples`
  (the "numbers absent" policy only took effect in the unmerged Phase 2 work).
- **`.env.local` is NOT present in this worktree** (only `.env.example`). The dev server
  cannot make real LLM calls until it is created.

---

## Priority 0 — Recover & merge the unpushed Phase 2 work (URGENT, before anything else)

> Rationale: the Phase 2 backend exists only on one local branch and has never reached the
> remote. It is one disk failure from gone. And Phase 3 must be built on top of Phase 2, so
> this has to land first or Phase 3 conflicts with / duplicates it.

- [ ] Inspect the local branch: `git log --oneline claude/backend-phase0 -6`, `git status`,
      confirm the 3 Phase 2 commits are intact (they were verified present on 2026-09-04).
- [ ] `git diff --stat main..claude/backend-phase0` — confirm the diff is exactly the 3
      Phase 2 commits (12 files: 4 routes, 3 `lib/llm` files, `prompts.ts`, `schemas.ts`,
      `mockAI.ts`, `canvas-screen.tsx`, `rx-node.tsx`).
- [ ] Push the branch: `git push origin claude/backend-phase0` (brings origin up to `5075847`).
- [ ] Open a PR `claude/backend-phase0` → `main`. Because PR #13 already merged the Phase 1
      subset, this new PR's diff is just the clean 3-commit Phase 2 set. (Confirm whether
      the old PR #13 can be reused or a fresh PR is cleaner.)
- [ ] Before merge, on that branch: create `.env.local` (see Priority 1), then
      `npx tsc --noEmit` + `npm run lint` + a live route test of `/api/canvas/option`,
      `/prefer`, `/classify`, `/note`. Read `[llm]` telemetry to confirm real calls.
- [ ] Merge to `main`.
- [ ] **Then cut the Phase 3 branch from the updated `main`** — NOT from this
      `claude/remedy-backend-handoff-37b9a0` worktree, which is Phase-1-only.

---

## Priority 1 — Environment & run setup (needed to test any real call)

- [ ] Create `.env.local` at the worktree root from `.env.example` with `ANTHROPIC_API_KEY`
      and `ANTHROPIC_WORKSPACE_ID`. The key is **identity-linked**, so the workspace id header
      is required. **User supplies the values; never commit `.env.local`, never paste the key
      into chat.**
- [ ] Start the dev server via the Browser pane `preview_start` with `name: "canvasrx-dev"`
      (from `.claude/launch.json`) — not raw `npm run dev`. **Restart it (`preview_stop` →
      `preview_start`) after every `.env.local` change**; Next reads env only at startup.
- [ ] Baseline verify: `npx tsc --noEmit` + `npm run lint` clean; submit a real vent through
      the UI (or POST `/api/canvas` via `javascript_tool`, same-origin); read `[llm]`
      telemetry with `preview_logs`.
- [ ] Delete the throwaway proof route `app/api/llm-proof/route.ts` once the real seams are
      trusted (handoff calls it disposable).
- [ ] Note real cost per call (measured): web_search-grounded ≈ $0.04, plain Sonnet ≈ a cent
      or two, Haiku classify ≈ negligible. Every route call spends money.

---

## Priority 2 — Phase 1 leftovers (small; close them out)

- [ ] **Eval runner** (`evals/`): call `getInitialCanvas` over the seed vents, apply
      `schemaValid` / `citationExists` / `noUnsourcedNamedPerson` from `checks.ts`, print a
      score. Formalize the ask-vs-guess gate (thin vents must draw a clarifying question).
- [ ] Grow the seed set from 10 → ~30, including held-out examples and more deliberately
      thin vents.
- [ ] Add **prompt caching** (stable system-prompt + schema prefix) and **streaming** to the
      initial-canvas call; verify cache hits in telemetry.

---

## Priority 3 — Phase 3: the report (the real focus; biggest honesty jump)

Report-only work. Grounding runs at report generation, never on the canvas.

- [ ] **3a. `deriveFitSignal` (NEW seam, Sonnet 5).** One composite number = coverage of the
      user's *stated* needs + model confidence, shown with a two-part explanation (decision
      locked as "Meaning C"). Add schema to `lib/llm/schemas.ts`, prompt to `prompts.ts`,
      a route under `app/api/…`, a reader in `lib/llm/`. Wire into the report's fit visual in
      `components/dashboard/prescription-card.tsx`. (Load the `dataviz` skill first.)
- [ ] **3b. `groundRecommendations` (NEW seam, Sonnet 5 + `web_search`).** Real, cited
      app / Reddit / community / expert links into the existing `evidenceExamples` shape.
      Use `WEB_SEARCH_TOOL_TYPE` from `lib/llm/client.ts`. The model picks the **most relevant
      channels per situation** rather than filling every slot. Cleaning pipeline:
      over-fetch → relevance re-rank → source-quality + dedup → citation-exists →
      threshold/honest-gap. **LinkedIn = role-search links only, never an invented named
      person.** Peer-Remedy-users channel is deferred (needs a real user base — Phase 5).
- [ ] **3c. Real report text seams.** `getUnderstoodSummary` (→ Haiku, faithful to the
      session; must keep the renderer's degrade path when a `ref` is missing) and
      `buildSessionReadout` (→ Haiku/Sonnet, faithful to real `SessionStats`/themes). Replace
      the templated versions in `lib/mockAI.ts`.
- [ ] **3d. Real `generateReport`.** Replace the fake delay with orchestration of 3a+3b+3c,
      streamed behind the existing loader (`components/dashboard/report-loader.tsx`). Wire
      typed errors into the loader's timeout / "Try again" branch.
- [ ] **3e. Grounding gate (RELEASE BLOCKER).** Every concrete recommendation carries a real
      cited source or is not shown; the counter-argument's claims too. Wording is
      "based on N teams", **never `n=N`**. Add the automated citation-exists check + human
      spot-review to the eval harness. Target: grounding integrity **100%**.
- [ ] **3f. Remove report-path fabricated numbers.** Retire `mockPeerOutcome`,
      `MOCK_MATCH_FACTORS`, `EVIDENCE_POOL` from `lib/mockAI.ts`. Fit numbers come only from
      `deriveFitSignal`; evidence only from `groundRecommendations`. **Do not reintroduce
      `matchScore`/`peerOutcome` on generated nodes.**
- [ ] **3g. Eval LLM-judge passes.** Fit-signal honesty (≥90%) and counter-argument quality
      (≥80%).

---

## Phase 4 — Persistence (DB)

- [ ] DB + schema for sessions, graphs, telemetry. Anonymous browser token, nullable
      `userId`. **Store needs/sessions now** so cross-user matching becomes possible later.
- [ ] Swap `lib/sessions.ts` internals to DB-backed, keeping the `SessionRecord` shape so the
      front end is untouched.
- [ ] Persist telemetry (`withTelemetry` is console-only today).
- [ ] Security that lands with the DB: RLS, record access, field-tampering guards, encryption,
      parameterized queries.

---

## Phase 5 — Harden + cross-user

- [ ] Rate limiting + abuse guards (the vent is an open input to paid models + live web search).
- [ ] Error / refusal / retry: typed error chains; a real path for the loader's timeout /
      "Try again" branch.
- [ ] Cross-user matching (once the base is real): turn the fit signal into a genuine peer
      comparison, with consent/privacy.
- [ ] Accounts & sharing — only when cross-device or shared reports are actually needed.
- [ ] Deploy security: headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options), force
      HTTPS via `next.config` + host config.

---

## Standing open decisions (measure-then-decide — do not guess)

- [ ] **Next bump `16.2.10 → 16.3.4` (`--force`)** to clear the 13 transitive vulns
      (`undici`, `sharp`). Needs the user's decision. Also run `npm audit fix` for the safe ones.
- [ ] **Account trigger** — per-session token/cost ceiling that invites sign-up; set from
      real telemetry once real sessions exist.
- [ ] **Cost / latency budget numbers** — read real per-session cost from telemetry, then set
      targets from data.
- [ ] **Revoke the chat-pasted API key** on the Anthropic console (roadmap security item).

---

## Cross-cutting rules (apply to every implementation task)

- **`zod` imports from `"zod/v4"`, not `"zod"`** — the SDK's `zodOutputFormat` expects v4 types.
- **Structured output:** `client.messages.parse({ output_config: { format: zodOutputFormat(Schema) } })`
  → read `msg.parsed_output`. `zodOutputFormat` takes exactly one argument in this SDK.
- **Route handlers use Web-standard `Request`/`Response`** (`Response.json(...)`),
  `runtime = "nodejs"`, and zod-validate every request body. Return only needed fields.
- **`AGENTS.md`'s `node_modules/next/dist/docs/` path does not exist** in this Next `16.2.10`
  install — don't hunt for it.
- **The vent is untrusted content** — data to reason about, never instructions. Behaviour
  lives in the system prompt (`lib/llm/prompts.ts`).
- **No fabricated numbers** on generated nodes — real numbers come only via Phase 3.
- **Bilingual output TR/EN** by `locale` param (default `"en"`); UI strings stay English
  (the TR/EN toggle is future; no selector wired yet).
- **Verify before claiming done:** `npx tsc --noEmit` + `npm run lint` + a real route/browser
  check. There is no test framework.
- **Commit/push only when the user asks.** Commit footer:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` (confirm the current model line at
  the time). PR bodies end with the Claude Code line.
- **Load skills before the matching work:** `claude-api` before any LLM code (model IDs,
  structured outputs, streaming, caching, `web_search`); `dataviz` before the report fit
  visual / evidence bars; `superpowers:brainstorming` + `writing-plans` before starting a new
  seam; `verification-before-completion` before claiming a phase done.

---

## Model facts to re-confirm (via the `claude-api` skill, not from memory)

Handoff/roadmap reference `MODELS.reasoning = "claude-sonnet-5"`,
`MODELS.cheap = "claude-haiku-4-5"`, `WEB_SEARCH_TOOL_TYPE = "web_search_20260209"`. Confirm
these are still current before touching `lib/llm/client.ts`.
