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
- **Decided 2026-10-05 (with the owner):**
  - **Suggest, don't link.** New issue no longer links by itself: it proposes a link to the
    latest issue (faint dotted line, "Link to Issue 1? · Follows up", Accept / ✕). A
    suggestion never reaches a report; only links the user made or accepted do. Why: a
    link now changes the report, so the user must know it is there.
  - **No report yet:** the reading falls back to the linked issue's canvas (its selected
    cards). The band says which one it read ("From its report · v1" / "From its canvas").
  - **Where it shows:** a band above Section 01, one stub per link.
  - **Built when the version is built** and saved with it (`ReportData.links`), so a saved
    version never changes. Telling the user that the linked issue moved on is the
    "Linked report changed" item under Reports (not built yet).
- **Built (2026-10-05):**
  - Link mode in the dock (`components/canvas/link-mode.tsx`): L or click, status segment
    "Pick the first issue" → "Now pick the second" → "Linked", live dashed connector, a
    click on any card picks its issue, newer → older whatever the pick order, the AI picks
    the type (`pickLinkType`), "Pick a different issue" / "Already linked" shake, and with
    one issue the button shakes ("Add a second issue first"). Esc or Link again leaves.
  - Suggested links (`IssueLink.suggested`, `SuggestedChip` in `link-edge.tsx`).
  - Readings (`lib/links.ts` `linkContexts` → `lib/mockAI.ts` `getLinkReadings`, mock) and
    the band (`components/dashboard/link-band.tsx`): Follows up shows the linked issue's
    task track ("You did 2 of 6 … is still open"); Digs into shows a verdict on an
    Unlikely / Partly / Likely scale. "Open Issue 1's report" or, with no report, "Show on
    canvas" (the canvas opens on that issue).
- **Revised 2026-10-20 (with the owner), supersedes "Suggest, don't link" and Link mode above:**
  - Link left the dock (dock = New issue + Spark; L shortcut gone; `link-mode.tsx` deleted).
    Links are born in the New issue card: under its suggestions, "How does this relate to
    Issue n?" with Follows up / Explains it / Unrelated. Remedy's guess (`pickLinkType`) is
    pre-selected and follows the text until the user picks. Unrelated adds no link.
  - Fixed later from the quote card's hover "Link…" menu (`LinkIssueMenu` in `rx-node.tsx`).
  - No suggested links any more; old sessions' suggested links are skipped on the canvas and
    in reports.
  - "Digs into" is called **Explains it** in the UI (data value still `digs-into`).
  - The link draws as a straight brand-green line with a pill (`link-edge.tsx`):
    "Follows up  Issue 1 | 2/3" (tasks done, or the verdict for Explains it). Hover opens a
    panel under it: sentence, task track, Change (type or Remove link), Open Issue 1.
  - The band is gone. Section 01 of the report (`carried-over.tsx`) is a placeholder: its
    design is **still undecided** (text layouts were rejected; graphic versions are being
    compared, see `docs/handoffs/2026-10-20.md`).
- **Built 2026-10-25:** "New tasks do not repeat finished work". In a Follows up report
  (`followUpTasks` in `lib/links.ts`), tasks the linked issue finished or closed are left out,
  and the task it stalled on is the first step (picked up once, with "Picked up from Issue n"
  in its history). The mock gives a follow-up issue its own task templates.
- **Not yet:** the real LLM reading (the seam is `getLinkReadings`); Explains it's task order
  (waits for real task generation); "Issue 1 has a newer report"; "Refresh suggestions" on a
  draft.

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
  instead: edges into every card in the report (and every card above one) draw in a darker
  gray, `hsl(100 4% 44%)`, with the same dash as the rest (revised 2026-10-20: the owner
  rejected every green treatment). Adding or removing a card by hand is a button in
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
5. Link (done 2026-10-20: links from the New issue card, link pill, follow-up tasks; the
   report section's design is still open, see Link)
6. Real task generation and a cross-session "My tasks" screen
7. Like / dislike redesign
8. Redesign the report's recommendation card (see "Open" above)
9. Guideline and onboarding: Key popover, `?` shortcut, first-encounter hints, first-run
   onboarding (`docs/ideas/canvas-guidance.md`)
