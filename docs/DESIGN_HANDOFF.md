# Design Handoff: Remedy (CanvasRx) — All Screens

Generated from the current implementation (not a pre-build spec) — this documents what's actually built and shipped, for anyone picking up the codebase or re-implementing it on another stack. Tech stack: Next.js (Turbopack) + React 19 + Tailwind v4 + shadcn/ui + React Flow (canvas). No backend — see "Mock AI" note in each relevant section.

**App structure:** one page (`app/page.tsx`), no routing. A single `step` variable (`'chat' | 'canvas' | 'dashboard'`) selects which screen renders. A persistent left sidebar (Session Sidebar) is mounted once, outside the step switch, and shows on all three screens.

---

## Global Design Tokens

| Token | Value | Usage |
|---|---|---|
| `--background` | `hsl(160 10% 96%)` | Page background |
| `--foreground` | `hsl(213 54% 14%)` | Primary text |
| `--primary` | `#1F4838` (brand green) | Organic/positive signal — selected-card border/tint, liked-theme chips, Organic transparency badge |
| `--cta` | `#CD5C1F` (brand orange) | "Click to act" — Send, Finalize, Prefer this option, Select and continue |
| `--secondary` / `--muted` | `hsl(140 6% 91%)` | Secondary surfaces, muted backgrounds |
| `--muted-foreground` | `hsl(155 6% 37%)` | Secondary text |
| `--destructive` | `hsl(8 51% 46%)` | Dislike state, error/sponsored signal |
| `--border` | `hsl(100 4% 80%)` | All hairline borders |
| `--radius` | `4px` default | Base corner radius — deliberately sharp/clinical, not shadcn's default `rounded-lg`. `--radius-sm/md/lg/xl/2xl/3xl/4xl` scale multiplicatively from this one value (0.6× to 2.6×) |
| Font — sans | Inter (`--font-inter`) | Body text |
| Font — mono | IBM Plex Mono (`--font-plex-mono`) | Headings, labels, kind tags, all-caps eyebrow text — used deliberately for a "clinical/prescription" register |

**Dark mode** tokens exist in `.dark` but the product has no theme toggle currently — dark values are defined but unused.

**Design rationale:** `--primary` and `--cta` are NOT interchangeable. Primary = brand identity/organic signal. CTA = "this button does the important thing." A selected card gets a primary tint; the button that advances you to the next state is always CTA-colored.

---

## Persistent Chrome: Session Sidebar

Mounted once in `app/page.tsx`, outside the step switch — visible on Chat, Canvas, and Dashboard identically.

### Layout
- Fixed left rail, full height, `border-r border-border`, `bg-card`.
- Two states: **expanded** (`w-64`) and **collapsed** (`w-12`) — animated via a single `transition-[width] duration-300 ease-in-out` on the wrapping div (not a conditional swap between two trees — that was tried first and produced an instant unanimated jump).
- Header row: "SESSIONS" label (hidden when collapsed, mono, 11px, uppercase, muted) + collapse/expand icon button (`PanelLeftClose` / `PanelLeftOpen`).
- Action row: "New session" button (icon-only when collapsed) + search icon button.
- Session list: scrollable, each item is a full-width button.

### Session list item
- `rounded-xl border border-transparent p-2`, hover → `border-border`.
- Active session → `border-primary bg-primary/5`.
- Title: `line-clamp-2`, session's chat text or "Untitled session".
- Meta row: step label (`Draft` / `Canvas` / `Finalized`) · relative time (`just now`, `Xm ago`, `Xh ago`, `Xd ago`).
- Empty state: "Your past sessions will show up here."

### Data
- Every chat submission creates a `SessionRecord` in `localStorage` immediately, capped at 20 (oldest evicted on write).
- `onGraphChange` on the Canvas screen fires on **every graph mutation**, not just Finalize — resuming a session always reflects the latest edit.

### Collapsed state
- Content area gets `pointer-events-none overflow-hidden opacity-0` (not `display:none` — preserves the width transition).

---

## Persistent Chrome: Session Search Overlay

Triggered by the sidebar's search icon. Built on shadcn's `Command`/`CommandDialog` (cmdk).

- **Gotcha for re-implementers:** this project's installed `CommandDialog` does *not* wrap children in a `<Command>` root automatically — you must add your own `<Command>` wrapper around `CommandInput`/`CommandList`, or cmdk's internal store context is `undefined` and throws at render.
- Filters: **Date** (Today / This week / This month / All) and **Context** (Industry: General / HR & Recruiting / IT & Procurement / All), plus free-text search via cmdk's built-in fuzzy filtering on session text.
- Selecting a result calls `onSelect` then closes the dialog.

---

## Screen 1: Chat Entry

### Overview
Landing screen. User writes a free-text "vent," optionally nudged by rotating headline prompts, thought-trigger chips, and industry-tagged example cards. Submitting kicks off the mock AI (500–1500ms artificial delay) and transitions to Canvas.

### Layout
- Centered column, `max-w-xl`, vertically centered in viewport (`min-h-full flex items-center justify-center`).
- Custom background: `.chat-entry-bg` — a subtle diagonal dot/line grid rendered on a `::before` pseudo-element (kept off the real element so its top-fade mask never touches actual content), masked to fade out by 65% down the page.

### Components (top to bottom)
| Component | Notes |
|---|---|
| Logo | `h-7`, centered |
| Rotating headline | Mono, 20px, bold, centered, `w-96` fixed width. Prev/Next chevron buttons flank it. Auto-rotates every 5s, **paused on hover of the headline row or while the textarea has focus**. Clicking the headline text itself inserts its `insertText` at the cursor (not just decorative). Text reveals via `TypewriterText` (char-by-char, 28ms/word delay). |
| Subheading | "What do you need help figuring out?" — muted, 14px |
| Textarea | `h-[100px]`, grows to `h-[150px]` on focus (`transition-[height] duration-300`). ⌘/Ctrl+Enter submits. `autoFocus` on mount. |
| Thought-trigger chips | Appear **only after a ≥3s pause** in typing (debounced), keyword-matched to the current text. Pill buttons, insert their text at cursor on click. Hidden while `loading`. |
| Send row | Left: "⌘/Ctrl + Enter to send" hint. Right: Send button (CTA variant) — disabled when text is empty or loading. |
| Example prompts | Hidden while loading. Industry filter chips (General/HR & Recruiting/IT & Procurement) above a 3-card grid (`grid-cols-1 sm:grid-cols-3`) of scenario cards for the selected industry. Each card: label + 2-line-clamped scenario text, full text in a hover tooltip. Clicking fills the textarea and focuses it with cursor at the end. |

### States
- **Idle**: as above.
- **Loading**: Send button becomes a 3-stage rotating status ("Reading…" → "Extracting themes…" → "Preparing canvas…", 900ms/stage) with a spinner; textarea disabled; trigger chips and example grid hidden.
- **Error**: (handled one level up, in `page.tsx`) a fixed bottom-center toast: `"Something went wrong generating your canvas. Please try again."`

### Content specs
- Thought triggers: keyword-matched, max shown = however many `getThoughtTriggers` returns (no explicit cap observed in this component — governed by `lib/thoughtTriggers.ts`).
- Example scenario text: 2-line clamp in the card, full text available via `Tooltip` on the same trigger.
- Headline questions: rotate through a fixed list (`lib/headlinePrompts.ts`); order is sequential, not random.

### Edge cases
- Empty text → Send stays disabled regardless of loading state.
- Whitespace-only text → treated as empty (`text.trim()` gate).
- No session history → sidebar shows its own empty state, chat screen itself has no dependency on prior sessions.

### Animation / Motion
| Element | Trigger | Animation | Duration |
|---|---|---|---|
| Textarea | Focus/blur | Height 100px ↔ 150px | 300ms |
| Trigger chips | Appear (after 3s pause) | `fade-in-0 slide-in-from-bottom-1` | Tailwind default |
| Headline text | Every rotation | Char-by-char typewriter reveal | 28ms/word |

### Accessibility
- Prev/Next headline buttons have `aria-label`.
- Textarea has a visible placeholder ("Start typing…") but relies on the subheading text for a labeled purpose — no explicit `<label>` element.

---

## Screen 2: Canvas

### Overview
The core interaction surface. The user's chat text becomes a "Source" card; the mock AI proactively generates suggestion/counter-argument pairs branching below it. The user can comment (spawns a revision), pick from A/B/C option sets (branches), like/dislike (steers future mock AI bias), drag cards/paths around, and mark cards "Select" before finalizing to the Dashboard. Built on React Flow.

### Layout
- Full-height flex column: thin header bar (`border-b`, `py-2.5`) + flex-1 canvas area.
- Header: logo (left) — "Reset session" (ghost) + "Finalize" (CTA, disabled until ≥1 card selected) on the right.
- Canvas area is a `ReactFlow` instance with a dotted `Background` (24px grid), zoom `Controls` (zoom in/out/fit — the "interactive" drag-to-select control is disabled), and a `MiniMap` (bottom-right, pannable/zoomable, neutral gray node color, group frames excluded from minimap dots).
- Two floating overlays layer on top of the canvas: **Theme panel** (top-center) and **Experiments panel** (top-right, collapsed to a flask icon by default).

### Layout algorithm (not free-form drag-and-drop by default)
- Nodes auto-position in a top-to-bottom tree: **Y = depth × 520px**, **X** via sibling-averaging with a 412px gap between same-depth leaves.
- These numbers aren't arbitrary — Y (520px) was deliberately widened after a real bug: a fully-expanded option-set card can render past 400px tall, and a child positioned exactly one depth-gap below it was visually overlapping the parent. X (412px, paired with 32px path-frame padding) was widened from an earlier, tighter pass specifically so a "path" (see below) has a ~28px margin that's actually possible to grab with a cursor.
- The user *can* manually drag an individual card or an entire path frame — that manual offset layers on top of the auto-layout position and persists until the next full graph rebuild. A card spawned as a continuation of a manually-dragged parent inherits the parent's same manual offset, so it appears near the parent's actual on-screen position rather than snapping back to the un-dragged structural spot.

### Card (`RxNode`) — the atomic unit
- **Size**: fixed `w-80` (320px), height auto (content-driven).
- **Shape**: `rounded-xl` by default, or an Apple-style squircle `clip-path` when Softness/Smoothing > 0 (see Experiments panel).
- **Header**: kind label (mono, 11px, uppercase, muted — "Source" / "Suggestion" / "Counter-argument" / "Revision" / "Clarifying question") + right-aligned state badges: a `Selected` check-badge (primary) when selected, a `vN` version tag when `version > 1`.
- **Title**: 14px semibold.
- **Body**: reveals via `TypewriterText` (character stream) for anything except the Source card, which renders instantly with inline `<mark>` highlights (proactive AI-tagged spans, hover shows the tag via `title`).
- **Selection**: click anywhere on the card body (except a nested button) toggles "Select" — but *only* for select­able kinds (`recommendation` / `counter-argument` / `revision`) **without** an option set. Option-set cards are never independently clickable; branching happens exclusively through the option picker's own submit button.
- **Hover toolbar**: floats 36px above the card, centered, opacity 0→100 on card hover (`nodrag` so it doesn't trigger a canvas drag). Three icon buttons: Add comment (opens a popover), Like, Dislike (both toggle, mutually exclusive per card, tinted primary/destructive when active).
- **Drag handle**: a `GripVertical` icon floats just outside the card's right edge, visible on card hover only (`opacity-0` → `100`).
- **Previous version**: if this card supersedes another (a revision), a `Collapsible` trigger ("v{N} (previous version)") reveals the old body text indented with a left border.
- **Depth-cap notice**: once `depth >= MAX_BRANCH_DEPTH` (4), a small muted line: "Max revision depth reached — further comments will ask a clarifying question."
- **Footer action** (mutually exclusive by kind — only one renders):
  - `clarifying-question` kind → **"View report"** CTA button, disabled until ≥1 card is selected anywhere on the canvas (same gate as the header's Finalize), routes straight to Dashboard.
  - Selectable kind, no option set → **"Prefer this option"** button (filled CTA if already selected, outline-CTA otherwise) — appends a new child continuation card one depth below, in the *same* path, never auto-selects.
  - Card with an option set → **no footer row at all** (the option picker below renders its own submit action; an empty extra footer row was a real bug that threw the button out of vertical alignment with every other card — fixed by omitting the row entirely for option-set cards).
- **States**: `pending` (0.6 opacity, spinner in footer, while a mock AI call is in flight), `selected` (primary border + 5% primary tint), `feedback: like/dislike` (1px ring, primary or destructive).
- **Entrance animation**: `fade-in-0 slide-in-from-bottom-2`, 300ms, on genuine mount only (not on drag/position patches — those are deliberately kept out of the effect that rebuilds card `data`, specifically so dragging never re-triggers this).

### Option Picker (inside a card with an `optionSet`)
- Prompt text, then each choice as its own bordered card (`rounded-xl border p-2`), staggered entrance (`CARD_ENTRANCE_DELAY_MS` = 300ms base + 220ms × index), each choice's label/description also typewriter-reveals.
- Single-select (`aria-pressed`), picked choice → `border-primary bg-primary/5`.
- Submit button: **"Select and continue"**, outline-CTA, same icon/label pattern as "Prefer this option" (`ArrowRight` icon) — deliberately matches the other cards' action-button styling exactly, disabled until a choice is picked.

### Path Frames (`GroupFrameNode`) — grouping suggestion/counter-argument chains
- A **path** = one continuous chain of cards that are all the "same idea" as it gets revised/continued. A suggestion (recommendation) chain and its counter-argument are **always separate paths from the moment each is created** — they diverge, so they're never grouped together, no matter how many revisions/continuations happen.
- Rendered as a large background rectangle (`rounded-lg border`) behind its member cards, `zIndex: 0` (cards paint above), `draggable` (drags the whole path — every member's position shifts together), not individually `selectable`.
- Color alternates primary/CTA (green/orange) by creation order — doubles as a lightweight "which path is which" legend.
- Border/tint only shows on **hover** (of the frame's own empty background, or of any card inside it — both drive the same `active` state) — otherwise fully transparent.
- **Header strip** (locked-in design): a solid 24px-tall bar across the frame's own top edge (genuinely inside the frame's hit-testing box — an earlier "floating label above the border" approach was scrapped because that floating area isn't part of the frame `<div>`'s own layout box, so hovering it never registered). Background always faintly visible (10–20% tint) so it's a real, discoverable, generously-sized grab target — not hover-gated like the old approach.
- **Header content** (locked-in): "Minimal" — just a kind icon (`Lightbulb` for a suggestion path, `ShieldAlert` for a counter-argument path) + the drag-grip icon (50% opacity idle, 100% on hover). The path's own founding-card title is available as a native `title` tooltip on hover, not printed as text.
- **Edge attachment**: an edge whose child starts a *brand-new* path (different `groupId` from its parent) targets the frame's own header (a React Flow `Handle` sits at the frame's top-center) instead of the first card underneath it — otherwise the connector visually terminates mid-air above the header strip.
- **Top padding is asymmetric by design**: 64px above the topmost card (vs. 36px below the bottommost) — the extra room exists specifically so the card's own hover toolbar (which floats 36px above the card) doesn't collide with the 24px header strip; there's only 12px of true slack in a plain 36px gap, not enough.

### Connector (`RxEdge`)
- **Locked-in style**: right-angle ("step") connector, `getSmoothStepPath` with `borderRadius: 4`, dashed (`4 4`), with a small filled circle "pin" at each end instead of an arrowhead — referred to internally as the "doctor's-note" connector.
- Fades in (`fade-in-0`, 500ms) only on genuine mount of a new edge — re-renders (drag, resize) reuse the same DOM node so it never replays.

### Theme Panel (top-center overlay)
- Only renders when at least one liked/disliked theme exists.
- Horizontal pill row, **max 3 themes per page**, with a First/Prev/Next/Last pager (4 icon buttons in a rounded pill) beneath it when there are more than 3.
- Each theme chip: theme label (click → pans the camera to that theme's originating card) + a thumb icon (click → removes that like/dislike from every card that contributed the theme).
- Theme text = either the AI-tagged highlight spans on a liked/disliked node, or a cleaned-up version of its title as a fallback.

### Experiments Overlay (top-right, collapsed to a flask icon)
This is the one part of the canvas that's still a **live-tunable control panel**, not a locked design decision — everything else on this screen (connector style, path-frame hover behavior, minimap style, grip placement, path-grab affordance, header content, spacing) was compared here across many rounds and is now hardcoded; only **Softness** remains exposed.

- **Corner radius**: 0–24px, number input + 4 named presets (Sharp/Soft/Rounded/Pill) + slider. Also drives the global `--radius` CSS variable (affects `rounded-*` utility classes app-wide, not just the canvas).
- **Smoothing**: 0–100% slider. Independent from radius — this is Apple-style "corner smoothing" (a superellipse curve whose exponent interpolates 2→5 as smoothing goes 0→100%), not a bigger circular radius. Applied via a computed `clip-path: path(...)` on each card, re-measured continuously (a polling loop, not `ResizeObserver` — see Engineering Notes) so it tracks a card's real, currently-changing size (e.g. mid `TypewriterText` reveal) rather than a stale one-time measurement.

### States and Interactions
| Element | State | Behavior |
|---|---|---|
| Card | Hover | Toolbar + grip icon fade in |
| Card | Selected | Primary border + tint; footer button becomes filled CTA |
| Card | Pending (AI call in flight) | 60% opacity, spinner |
| Card | Liked / Disliked | 1px primary/destructive ring |
| Path frame | Hover (frame or any member card) | Border/tint appears, header strip brightens |
| "Finalize" (header) / "View report" (card) | Disabled | No card selected anywhere |
| Comment popover | Text selected in a card body | Opens anchored to the selection, prefilled with the quoted text as context |
| Comment popover | "Add comment" button click | Opens anchored under the toolbar, no quoted text |

### Edge cases
- **Depth cap** (4 revisions/continuations deep): next comment/prefer action returns a clarifying-question card instead of continuing the chain, gated by `atDepthCap`.
- **No card selected**: Finalize and View-report stay disabled indefinitely; no forced selection.
- **Superseded (revised-over) cards**: never deleted, just hidden from the visible graph and tucked into the replacing card's "previous version" collapsible.

### Animation / Motion summary
| Element | Trigger | Animation | Duration |
|---|---|---|---|
| Card | New card mounts | `fade-in-0 slide-in-from-bottom-2` | 300ms |
| Edge | New edge mounts | `fade-in-0` | 500ms |
| Option choice | Card mounts, staggered | `fade-in-0 slide-in-from-bottom-1` | 300ms base + 220ms/index stagger |
| Path frame border | Hover in/out | Color/opacity transition | 150ms |
| Session sidebar | Collapse/expand | Width transition | 300ms |

### Accessibility notes
- Toolbar icon buttons have `title` attributes (tooltips) but not all have explicit `aria-label` — icon-only buttons should get one for screen readers.
- Option picker choices use `aria-pressed` for selection state.
- No explicit focus-order documentation exists in the source; canvas is primarily mouse/drag-driven (React Flow's own keyboard nav — arrow keys to move a selected node, Delete to remove, Escape to cancel — is present via React Flow defaults but not customized).

### Engineering notes worth carrying into any re-implementation
- **`ResizeObserver` does not reliably fire in this project's dev environment** — every place that needs continuous element-size tracking (path-frame sizing, squircle clip-path) uses a `requestAnimationFrame` polling loop instead, diffing against the last known size before writing state.
- **`clip-path: path(...)` coordinates are in the element's own untransformed layout space** — inside React Flow's canvas (scaled by the current zoom via a CSS transform), you must read `offsetWidth`/`offsetHeight`, not `getBoundingClientRect()`, or the clip shape is sized for the *on-screen* (zoomed) box and clips real content at any zoom other than 100%.
- Node `data` objects are only rebuilt when the underlying domain graph changes — purely visual/experimental toggles (connector style, grip placement, etc., back when those were still variable) were patched into the existing React Flow node array in a separate, lighter effect specifically so flipping a toggle never replays a card's mount-in animation.

---

## Screen 3: Dashboard

### Overview
Read-only summary of every card the user marked "Select" during the canvas step. Terminal screen of the flow (only exit is "Reset session," back to Chat Entry).

### Layout
- Header: logo + "Verified prescription" (mono, 18px, bold) stacked on the left; "Reset session" (ghost) on the right.
- Body: `max-w-5xl` centered, responsive grid — 1 col (mobile) / 2 col (`sm:`) / 3 col (`lg:`) — of `RecommendationCard`s.
- Empty state (no selected cards): plain muted text, "No recommendations were marked "Select" before finalizing."
- An `ExitPoll` dialog mounts alongside, open by default.

### Recommendation Card
- Header: title (16px semibold) + a rotated "stamp" badge, top-right — `Organic` (primary) or `Sponsored` (destructive), 2px border, dashed-outline-offset, `-4deg` rotation, monospace uppercase — a deliberate literal "rubber stamp" visual metaphor for the transparency signal.
- Body: recommendation text (muted).
- **Match score** (left): large mono number + `%`, dotted-underline label acting as a `HoverCard` trigger — hovering reveals a "Contributing factors" breakdown list (label + weight % per factor).
- **Active retention** (right): same large-number treatment, no breakdown (static).
- **Peer outcomes** (if present): a small bar chart (flex row of `bg-primary/70` bars, height = data value as %), dotted-underline caption "Peer outcomes, n={cohortSize}" as a `Tooltip` trigger revealing the cohort definition text.

### Exit Poll (Dialog)
- Opens automatically, exactly once, the moment the Dashboard mounts (state initialized to `open: true`, not triggered by an effect — that's specifically what makes it "exactly once").
- "How useful was this?" + 1–5 rating buttons (square, mono number, selected → primary border/tint) → Submit → "Thanks, that's recorded." → Close.
- No skip/dismiss-without-rating path other than the dialog's own close affordance (`onOpenChange`).

### Content specs
- Match score / retention: render `—%` when the underlying value is `undefined` (mock data doesn't always populate every field).
- Peer chart bars: only rendered if `peerOutcome` exists on the node at all.

### Edge cases
- Zero selected cards → empty-state message, no card grid.
- A card that was selected then later revised → the dashboard shows the **latest revision's** data, not whichever version was selected first (selection state carries forward through revisions in the canvas step).

### Animation / Motion
- None specific to this screen beyond the shared `Dialog` open/close transition (Radix default) for the Exit Poll.

### Accessibility notes
- Rating buttons are plain `<button>`s with no `aria-label`/`aria-pressed` — the number is the only accessible name, and selection state isn't announced beyond the visual border/tint.

---

## Cross-Screen Notes

### Responsive behavior
No documented breakpoint system for Canvas or the Sidebar — both assume desktop-width usage (React Flow's own canvas is inherently a large-viewport interaction pattern; the Sidebar's collapsed state is a manual toggle, not a responsive auto-collapse). Chat Entry and Dashboard have real responsive grids (`sm:`/`lg:` breakpoints) for their card grids.

### Mock AI seam (relevant to every screen's content)
There is no real backend. `lib/mockAI.ts` is the explicit integration seam for a future real LLM — three functions (`getInitialCanvas`, `getNodeResponse`, `getOptionResponse`) are the points a real implementation would replace, each currently returning canned/templated content behind a 500–1500ms artificial delay to simulate latency.

### Language
All UI-facing copy is English by design (a future TR/EN locale toggle is planned; the codebase is deliberately English-only now to make that split easier later) — do not introduce non-English strings into components.
