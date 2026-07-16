# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # start dev server (Turbopack) on http://localhost:3000
npm run build    # production build
npm run lint     # eslint (flat config, eslint-config-next)
npx tsc --noEmit # type-check only — run this + lint after every change, no test suite exists
```

There is no test framework configured. Verification is `tsc --noEmit` + `npm run lint` + manual browser check of the affected flow.

If a change touches CSS custom properties (`app/globals.css`) or anything the Turbopack dev
cache seems to be ignoring, `rm -rf .next` before restarting the dev server — new `@theme`
tokens and some CSS-only edits have repeatedly needed a cache clear to show up.

## What this is

**Remedy** (product name; built under the working codename "CanvasRx" — see `docs/`) is a
clickable prototype: a chat vent turns into an AI-annotated canvas of recommendations, which
the user prunes down to a verified dashboard. No real backend — see "Mock AI" below.

Target audience (steers copy/tone/content choices): general knowledge workers, but weighted
toward headhunters, HR, and IT solution/procurement people — busy, problem-solving,
level-headed professionals, not a consumer-casual audience.

**Language convention:** all UI-facing strings (labels, buttons, mock content) are written in
English going forward, even when the user requests changes in Turkish — the app will get a
TR/EN localization toggle later, so the codebase is deliberately moving toward all-English UI
text now to make that split easier.

## Architecture

### Single-page state machine, no routing

`app/page.tsx` holds one `step: 'chat' | 'canvas' | 'dashboard'` state variable and renders one
of `ChatEntryScreen`, `CanvasScreen`, or `DashboardScreen` — there are no routes. A page refresh
resets `step` to `'chat'`, but the previous session isn't lost (see below) — it's just one click
away in the sidebar. Each screen owns its own local state (`CanvasScreen` owns the whole
`CanvasGraph` while the user is on the canvas) and hands data up via callbacks
(`onSubmit`, `onGraphChange`, `onFinalize`, `onReset`) rather than through global state or context.

### Sessions persist to localStorage, no backend

`lib/sessions.ts` is the only persistence in the app — every chat submission immediately
creates a `SessionRecord` (`{ id, chatText, graph, step, updatedAt }`) in localStorage via
`createSession`, capped at 20 (oldest evicted on write). `CanvasScreen`'s `onGraphChange` fires
on every graph mutation (not just Finalize), so `page.tsx` calls `updateSession` continuously —
resuming a session from `SessionSidebar` always reflects the latest edit, not just the initial
canvas. `CanvasScreen` is remounted with `key={sessionId}` when switching sessions, since its
`initialGraph` prop is only consulted once (by `useState`) — without the key, switching sessions
while already on the canvas would silently keep the old session's in-memory state.

### Session sidebar + search overlay

`components/session-sidebar.tsx` renders as a persistent left rail across all three steps
(mounted once in `page.tsx`, outside the `step` switch) — collapsible via a single animated
`width` transition on one wrapping div, not a conditional swap between two JSX trees (that was
tried first and produced an instant, unanimated jump). Clicking a past session calls
`onSelect`, which restores that session's `graph`/`step` into `page.tsx` state.

The sidebar's search icon opens `components/session-search-overlay.tsx`, built on the
already-installed shadcn `Command`/`CommandDialog` (cmdk) components — filters sessions by
Date (Today/This week/This month/All) and Context (`Industry`), plus free-text search via
cmdk's own built-in filtering. **Gotcha:** in this project's installed version of
`components/ui/command.tsx`, `CommandDialog` does *not* wrap its children in a `<Command>` root
— you must wrap `CommandInput`/`CommandList` in an explicit `<Command>` yourself inside the
dialog, or cmdk's internal store context is `undefined` and it throws
`Cannot read properties of undefined (reading 'subscribe')` at render time.

### Mock AI is the seam for a real backend

Every "AI" behavior lives in `lib/mockAI.ts` behind a 500–1500ms artificial delay. Three
functions are the integration points for a real LLM later:

- `getInitialCanvas(chatText)` — builds the Source node plus the first-pass proactive
  suggestion/counter-argument pairs (one rendered as an A/B/C option set).
- `getNodeResponse(node, commentText, feedbackContext?)` — turns a comment (typed or
  implicit, e.g. "Prefer this option") into a new **revision** node. Depth-caps at
  `MAX_BRANCH_DEPTH` (4) and returns a clarifying-question node instead of branching further.
- `getOptionResponse(node, selectedOptionId, feedbackContext?)` — branches on a picked A/B/C
  choice, returning a fresh recommendation + counter-argument pair (same shape as
  `getInitialCanvas`'s pairs, one level deeper) rather than a single dead-end node.

`lib/thoughtTriggers.ts`, `lib/headlinePrompts.ts`, and `lib/examplePrompts.ts` are smaller,
separate mock-content modules for the chat entry screen — not part of the `mockAI.ts` seam,
since they don't produce canvas nodes:

- `thoughtTriggers.ts` — keyword-matched chips that appear after a typing pause.
- `headlinePrompts.ts` — the rotating "What's going on?"-style headline carousel.
- `examplePrompts.ts` — `EXAMPLE_PROMPTS_BY_INDUSTRY`, grouped by `Industry`
  (`"general" | "hr" | "it"`); the chat entry screen's industry chips switch which group of 3
  example cards is shown. `lib/sessions.ts`'s `inferIndustry()` reuses the same `Industry` type
  to keyword-tag each saved session (for the search overlay's Context filter) — that tagging is
  independent of whichever chip the user had active when they actually submitted, since it's
  inferred from the submitted text itself, not the UI selection.

### The canvas graph is append-only; visibility is derived, not stored

`CanvasScreen` (`components/canvas/canvas-screen.tsx`) keeps the full history of every node
ever created in `CanvasGraph` (`{ nodes, edges }`) — nothing is ever deleted or mutated in
place. When a node is revised, the new revision node is *appended* with
`previousVersionId` pointing at the node it supersedes; the old node is never removed.

What's actually rendered on screen is computed fresh on every graph change:
- `lib/graph.ts`'s `getSupersededIds()` finds every node that has since been revised.
- `resolveVisibleParentId()` walks a node's `parentId` chain forward past any superseded
  (hidden) ancestors, so edges reconnect to whatever is currently visible instead of pointing
  at a hidden node.
- The superseded node's content isn't gone — `RxNode` shows it inline via a `Collapsible`
  ("v1 (previous version)") on the node that replaced it, rather than as a separate node on
  the canvas.

`lib/layout.ts`'s `layoutNodes()` re-derives x/y positions from scratch from this same visible
set on every render (top-to-bottom tree: depth → y, sibling spread → x) — positions are never
persisted, so dragging a node is not preserved across the next graph mutation.

`lib/graph.ts`'s `deriveFeedbackContext()` similarly derives the like/dislike "themes" pool
from `graph.nodes` on every render (from a node's `highlights` tags, or its title as a
fallback) rather than tracking a separate feedback-pool state — this is what `mockAI.ts`'s
`biasFor()` reads to nudge match scores and body text for nodes touching a liked/disliked theme.

### Selection has two independent axes

A node has `selected` (marked "Select" → included on the finalize dashboard) and `feedback`
(`'like' | 'dislike'`, set via the hover action menu) — these are deliberately uncoupled. You
can like a node you never select, and select a node you never gave feedback on. When a
selected node gets revised (comment or "Prefer this option"), `selected` is carried forward
onto the new revision in `canvas-screen.tsx`'s `submitCommentFor()` so the dashboard always
reflects the latest revision, not whichever version happened to be selected first.
`forceSelected` lets "Prefer this option" mark the new revision selected even if the card was
never explicitly selected first (it's an accept-and-continue action, not gated on prior select).

Cards with an `optionSet` (A/B/C picker) are *not* independently selectable by clicking the
card — branching happens exclusively through the option picker's own "Select and continue",
so `RxNode`'s `canSelect` is `false` whenever `nodeData.optionSet` is set.

### Design tokens: two different "primary" concepts

`app/globals.css` defines `--primary` (brand green, `#1F4838` — sampled from `public/logo.svg`)
and a separate `--cta` (`#CD5C1F`, the logo's orange dot), mapped into Tailwind as `bg-primary`/
`bg-cta` etc. via `@theme inline`. They are not interchangeable:

- `--primary` = brand identity / "organic, positive" signal — the Organic transparency badge,
  a selected card's border/background tint, liked-theme chips.
- `--cta` = "click this to act" — Send, Finalize, "Prefer this option", "Select and continue".
  `components/ui/button.tsx` has both a `cta` (filled) and `outline-cta` (bordered, fills on
  hover) variant; which one a button uses is often state-driven (e.g. `option-picker.tsx`
  shows `outline-cta` once a choice is picked but not yet submitted).

`--radius` is 4px project-wide (deliberately sharp/clinical, not shadcn's default rounded-lg)
— see `docs/CanvasRx_DESIGN_GUIDELINES.md` for the full rationale and the rest of the palette.

### React Flow nodes: drag vs. click

Custom nodes (`RxNode`) are draggable by default (no blanket `nodrag` on the node root), but
every interactive control inside one (buttons, the option-picker choice cards, the body `<p>`
that supports text-selection-to-comment) carries its own `nodrag` class. Removing `nodrag` from
an individual control will make React Flow's drag handling swallow its clicks.

### Docs

`docs/BUILD_BRIEF.md` is the index; `docs/CanvasRx_TASKS.md` is the original phased build
checklist; `docs/CanvasRx_DESIGN_GUIDELINES.md` has the full color/type/component spec;
`docs/CanvasRx_PRD_EXCERPT.md` is the only part of the full PRD (`docs/CanvasRx_PRD_v2.docx`)
relevant to this prototype pass. Where `docs/BUILD_BRIEF.md`'s "Flow changes agreed after the
PRD was written" section conflicts with the PRD excerpt, the build brief wins.
