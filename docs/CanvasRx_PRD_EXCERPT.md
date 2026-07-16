# CanvasRx — PRD Excerpt for This Build Pass

Extracted from CanvasRx_PRD_v2.docx (full doc kept as reference, not needed to open it
for this pass). Only Section 5, 6.1–6.4, and NFR-1/NFR-2 are included — everything else
in the full PRD (vector DB, LinkedIn sourcing, sponsorship governance, release phases)
is out of scope for now; see README.md.

Where this excerpt conflicts with README.md's "Flow changes agreed after the PRD was
written," README.md wins — those changes supersede 6.1/6.2 as written below.

## Section 5 — User Flow (original, superseded in part — see README.md)

| # | Step | Entry Criteria | Exit Criteria |
|---|---|---|---|
| 1 | Free Writing & Venting | User starts a new session | ≥ 40 words written OR user clicks "Continue" |
| 2 | Phrase Selection & Micro-Comments | Draft text exists in editor | ≥ 1 tagged comment created |
| 3 | AI Processing & Canvas Generation | At least 1 tagged comment submitted | Canvas renders with ≥ 1 recommendation node |
| 4 | User Feedback / Node Rerouting | Canvas is visible and interactive | User clicks "Finish Process" |
| 5 | Verified Prescription Dashboard | "Finish Process" triggered | Dashboard rendered; exit poll shown |

**Superseded per README.md:** Step 1 is now a one-shot chat input, not a bare free-write
editor. Step 2 (highlight+tag) now happens inside the canvas on the Source node, not
before the canvas exists. "Finish Process" → renamed "Finalize"; only nodes the user has
explicitly selected ("Seç") count toward the ≥1 recommendation-node exit criterion.

## Section 6.1 — Smart Venting Editor

Free-form text entry that reduces blank-page friction via adaptive "Thought Triggers."

**Acceptance Criteria**
1. Thought Triggers refresh within 2s of a typing pause ≥3s.
2. Clicking a trigger inserts placeholder text at the cursor without discarding existing content.
3. Sentiment/entity extraction runs on debounce, not per keystroke.
4. If the NLP service errors/times out, the editor stays usable and queues text for retry — must never block typing.

**Note:** in this build pass, this becomes the one-shot chat entry input (see README.md).
Thought Triggers are mocked, not a real NLP call.

## Section 6.2 — Contextual Commenting on Canvas

Figma-style highlight-and-comment, attaching structured context + an industry tag to a phrase.

**Acceptance Criteria**
5. Highlighting a run of text shows an "Add Comment" affordance within 300ms.
6. A visible connector line links the highlighted span to its comment card at all zoom levels.
7. Each comment supports exactly one primary tag and up to two secondary tags from a fixed taxonomy.
8. Deleting the underlying text prompts confirmation before the linked comment is orphaned/removed.

**Note:** in this build pass, this interaction happens on any canvas node (Source or
AI-generated), not only pre-canvas free text — see README.md.

## Section 6.3 — Interactive Live Canvas (Node-Based)

FigJam-style canvas rendering the AI's recommendation chain as nodes/edges, bidirectional editing.

**Acceptance Criteria**
9. Canvas sustains 60fps pan/zoom with up to 50 nodes on a mid-tier laptop (NFR-2).
10. Double-clicking a node opens a comment input within 150ms.
11. Submitting a node comment returns a new fallback node or a clarifying question within 8s (p95); loading state shown throughout.
12. Every fallback node retains a visible edge to the node that triggered it.
13. Max branch depth (configurable, default 4); beyond that, AI asks a clarifying question instead of branching further.

**Note:** in this build pass, the AI also branches proactively on canvas load (before any
user comment) with suggestion + counter-argument node pairs, some rendered as A/B/C
option cards. Node comments produce a new **revision** node (v2, v3, ...) rather than
editing in place — see README.md.

## Section 6.4 — Data-Driven Verification Dashboard

Final screen with each recommendation's match score and supporting outcome data.

**Acceptance Criteria**
14. Every recommendation card shows: Match Score (%), a peer-outcome chart, Active Retention Rate, and a Transparency Badge (Organic/Sponsored).
15. Match Score shows top contributing factors on hover/tap — not a black-box number.
16. Peer-outcome charts state cohort size/definition directly on the chart.
17. Sponsored recommendations are visually distinguished and cannot outrank an organic result with a materially higher match score.
18. Exit poll shown exactly once per completed session.

**Note:** in this build pass, only nodes the user explicitly marked "Seç" appear on the
dashboard — see README.md. Sponsorship ranking logic (PRD 6.5) is not implemented; the
badge is visual/mocked only.

## Non-Functional Requirements Used in This Pass

| ID | Requirement |
|---|---|
| NFR-1 | Node comment → AI response round trip: p95 ≤ 8s, p99 ≤ 15s, with a visible progress state throughout. |
| NFR-2 | Canvas maintains 60fps pan/zoom with ≤ 50 nodes on a 2020-era mid-tier laptop. |

All other NFRs (uptime, security/encryption, scale, localization, accessibility) apply to
a later production phase, not this prototype pass.
