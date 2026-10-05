# Dock functions: what New issue, Link and Spark do

Decided with the owner on 2026-10-01 (grilling session). The visual spec of the dock is
`docs/handoff-canvas-dock.md`; this file is the functional spec.

## New issue

- **Purpose:** open a second question in the same case. The first stays, and the new one
  uses its answer. A separate, older case is referenced later from the chat screen
  (session reference), not with New issue.
- **Writing:** an empty quote card opens with 2 or 3 AI-suggested question chips under it,
  drawn from the session. The user picks one or writes their own. The button's stages
  ("Reading the session…", "Drafting an issue…") are the time the chips take.
- **Placement:** issues sit side by side as roots, left to right in time order. The camera
  glides to the new card (400 to 500ms) and the card grows out of the dock button. With the
  N key, both happen instantly.
- **Link to earlier issues (provisional, revisit):**
  - The new issue links automatically to the latest issue. The AI picks the type.
  - The link shapes the tree lightly (do not repeat what the linked report and tasks
    already say) and the report strongly.
  - When a link changes, the quote card shows "Context changed · Refresh suggestions".
    Refresh is a new revision of the quote: the old tree hides (not deleted) and comes back
    if the link goes back (the existing `createdUnderRevision` mechanism).

- **Built (2026-10-02):** draft quote card with mock suggestion chips (`suggestNextIssues`),
  "Add issue" grows the tree from `getInitialCanvas`, issues side by side, camera glide
  (`FocusDirector`, instant with N), "Issue n" eyebrows, auto-link to the latest issue with a
  mock type (`pickLinkType`) and an editable chip (`link-edge.tsx`: change type, remove),
  each report built from its own issue's tree (`issueGraph`). Drafts are discardable and are
  not issues. **Not yet:** the card growing out of the dock button, "Refresh suggestions"
  when a link changes, and links feeding the report (task Link).

## Link

- **Dock job:** add an extra link. A quote can link to several quotes. Edit and remove
  live on the link's chip, not in the dock.
- **Direction:** from the newer issue to the older one.
- **Types:**
  - **Follows up:** reads the linked issue's task status (done, stuck, not started). The
    report opens with "Last time you set out to X. You did Y; Z stalled." New tasks do
    not repeat finished work.
  - **Digs into:** reads the linked issue's report. The report opens with a verdict ("Is
    this the reason…? Partly / Likely / Unlikely, and why"). Its tasks go before the
    linked issue's open tasks.
  - **Conflicts with:** not in the first version. Add it if users often find neither type
    fits.

## Reports

- **View report (header):** opens the report of the selected card's issue. A small arrow
  next to it opens a menu with every issue and its state (v2, Canvas changed, No report
  yet). With no selection, it opens the issue with the latest report.
- **Built (2026-10-02):** the split "View report" button and issue menu
  (`ViewReportButton` in `canvas-screen.tsx`), per-issue state and outdated checks
  (`issueStates`, `issueOf`, `isOutdated` in `lib/reports.ts`), and the end card builds the
  report of its own issue. The menu only shows with two or more issues.
- **Linked report changed:** the issue counts as outdated even if its own tree did not
  change. A new version is still built only from the end-of-path card. No cascading
  rebuilds; only the warning ("Issue 1 has a newer report").

## Spark

- Tests the selected card from one of three angles (Who pushes back, What could go wrong,
  Smallest step this week). Remedy picks the angle.
- **In the report, the angle joins the card it tests:**
  - pushback: a "Who will push back" line under the recommendation, with what to say
    (feeds the task's contact and opening message)
  - risk: a "Watch out" note
  - step: the recommendation's first task, "This week"
- **Built (2026-10-02):** angles join their card's report card (`components/dashboard/angle-notes.tsx`)
  and its tasks (`lib/tasks-mock.ts` `withAngles`). The angle card's "Add to report" button is
  replaced by the note "Joins the report with the card it tests". **Open:** confirm this, or
  bring back a per-angle toggle.
- **Open:** the name. "Spark" suggests a new idea; the tool now tests an existing one.

## Cards

- A click only selects a card (Spark target, View report's issue). It no longer adds the
  card to the report.
- **Revised 2026-10-02:** no mark on the card. The report path shows on the canvas
  instead: edges into every card in the report (and every card above one) draw solid and
  soft green; the rest stay dashed gray. Adding or removing a card by hand is a button in
  the card's hover bar (next to like / dislike).

## Open: the report's recommendation card

Raised 2026-10-02, to discuss before building. The hero card reads like a form: five layers
split by four rules, all the same weight. "Our suggestion" + "Top match" repeat each other; the
big fit score repeats its own bars; the Spark angles (the most actionable part) sit in the
middle in the smallest type; the card has no link to its tasks; evidence is two small links.
On narrow canvas cards the "In report" mark wraps next to long eyebrows
("COUNTER-ARGUMENT"). First question: is the card's job (a) deciding ("does this fit me?") or (b) acting ("what do
I do first?")? A (b) sketch: title + small "80 fit" chip, one-line why, first step on top with
"Open task", pushback and risk as one-line rows, fit bars and evidence collapsed.

## Order

1. Click selects; report path on the canvas (done)
2. Spark angles in the report (done)
3. View report menu (done)
4. New issue (done)
5. Link
6. Real task generation and a cross-session "My tasks" screen
7. Like / dislike redesign
8. Redesign the report's recommendation card (see "Open" above)
9. Guideline and onboarding: Key popover, `?` shortcut, first-encounter hints, first-run
   onboarding (`docs/ideas/canvas-guidance.md`)
