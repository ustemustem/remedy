# CanvasRx — Build Brief Index (for Claude Code)

Read in this order:

1. **CanvasRx_TASKS.md** — start here. Phased, checkbox task list for this build pass
   (clickable prototype, mock AI, no real backend).
2. **CanvasRx_DESIGN_GUIDELINES.md** — read before writing any UI code. Colors,
   type, shadcn component mapping, the two signature motifs (stamp badges,
   dashed connectors), and the chat-entry grid texture spec.
3. **CanvasRx_PRD_EXCERPT.md** — the only PRD material needed for this pass
   (Section 5, 6.1–6.4, NFR-1/NFR-2), already extracted to markdown so there's
   no need to open the .docx. The full **CanvasRx_PRD_v2.docx** is kept only
   as a reference for later, production-phase work.

## Ignore for this pass

These PRD sections describe a later, production phase — do not build against them now:

- Section 7 (vector DB, LinkedIn/GitHub sourcing) — everything is mocked in `mockAI.ts`
- Section 6.5 (sponsorship ranking governance) — no real sponsored content yet
- Section 8 NFRs beyond NFR-1/NFR-2 (uptime, scale, localization)
- Section 12 (phased release plan) — superseded by CanvasRx_TASKS.md for this pass

## Flow changes agreed after the PRD was written

The PRD's Section 5/6.1/6.2 describe a slightly different flow than what's being
built now. The authoritative flow is the one in CanvasRx_TASKS.md:

- Entry point is a one-shot chat input, not a persistent chat and not the PRD's
  bare free-write editor.
- Highlight-and-tag (originally PRD 6.2, pre-canvas) now happens **inside** the
  canvas, on the Source node — not before the canvas exists.
- The AI proactively highlights and branches on the Source node before the user
  does anything, including paired suggestion + counter-argument nodes.
- Node interaction is universal: highlight any text on any node (including the
  AI's own nodes) to comment; each comment produces a new revision node
  (tagged v2, v3, ...) rather than editing the original in place.
- A/B/C option pickers exist alongside free-text node comments — pickers for
  first-pass branching, free text for refinement afterward.
- "Finalize" requires ≥1 node explicitly marked **"Seç"** (Select) by the user.
  Only "Seç"-marked nodes appear on the dashboard — not every node that exists
  on the canvas, and not just whichever nodes the AI answered first.
- Single-page app: one `step` state variable (`'chat' | 'canvas' | 'dashboard'`),
  no routing. A page refresh resets to `'chat'` — acceptable for this pass.

If anything in the PRD conflicts with this list or with CanvasRx_TASKS.md,
this list and TASKS.md win.
