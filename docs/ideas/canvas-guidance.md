# Canvas guidance: what the signals mean

Raised 2026-10-02. **Status: later task.** The owner wants a guideline and an onboarding;
build them after the core features (New issue, Link, tasks), so they explain the finished
vocabulary once instead of chasing it.

The canvas now carries signals that nothing explains: the darker gray
report path, lighter dashed branches, the link pill between issues, the selected card's green ring, the Spark angle strip,
"Canvas changed", the hover bar's report button, and the dock tools.

## Problem

How might we tell users what a canvas signal means the first time they meet it, without
sending them to a manual or a tour?

## Direction

Three parts that share one source of truth:

1. **Key (legend).** A small "Key" button next to the zoom controls (bottom left) opens a
   popover with the canvas vocabulary. The `?` key opens the same popover.
2. **First-encounter hints, three moments only:** the report path appears for the first time,
   the first Spark card lands, the first "Canvas changed". Each shows once as a one-line note
   anchored to the signal, then never again (stored in localStorage). At most one hint on
   screen at a time.
3. **Shortcuts** live in the Key: N · S · Esc.

## Key content

| Signal | Meaning |
| --- | --- |
| Darker gray line | This path goes into your report |
| Lighter dashed line | Explored, not in your report |
| Green ring | Selected card: Spark tests it, View report opens its issue |
| Card with a gray strip | A Spark angle; it joins the report with the card it tests |
| Canvas changed | The tree changed after the report; reach the end of a path for a new version |
| Green line between two quotes, pill "Follows up  Issue 1 \| 2/3" | A link: this issue's report reads Issue 1 |
| N · S · Esc | New issue · Spark · clear the selection |

## Motion

| Moment | Spec | Why |
| --- | --- | --- |
| Hint enters | 200ms `--ease-out`, from `scale(0.96)` + opacity, origin at its anchor | Rare moment; short and anchored, never from nothing |
| Hint leaves | 150ms | Exit faster than enter |
| Key opens by click | 150ms popover, origin at the button | Popovers grow from their trigger |
| Key opens with `?` | No animation | Keyboard actions never animate |
| Reduced motion | Opacity only | Keep meaning, drop movement |

## Assumptions to validate

- [ ] Users notice the report path but not what it means. Test: hint dismiss rate, Key opens.
- [ ] Three hints do not feel like a tour. Test: never more than one at a time; watch a
      first session.

## MVP scope

The Key popover with the table above, the `?` shortcut, and the first-path hint. The Spark
and "Canvas changed" hints follow once the first one feels right.

## Onboarding (in scope, owner decision 2026-10-02)

A first-run onboarding is needed on top of the Key and the hints. To design later; open
questions for that pass:
- Where it starts: before the first vent (chat screen), or on the first canvas?
- Form: a short guided walk through one real session (vent → pick → end card → report), or
  a few coach marks on the live canvas?
- How to keep it skippable and re-openable (from the Key, or a sidebar "How Remedy works").
- It must not delay the first vent; the user came with a problem.

## Not doing

- Video or a separate help page: too far from the signal it explains.
- Tooltips on edges: thin targets, hard to hit with a pointer.

## Feature guide (the onboarding's source material)

Owner rule (2026-10-05): every feature whose use is not obvious on its own gets an entry
here, in the same PR as the feature. The Key, the hints and the onboarding are written from
these entries. "Why" records the decision behind the behavior, so the copy can explain it.

### Report path (canvas)
- **For:** seeing which cards your report is made of.
- **How:** "Prefer this option" or "Select and continue" adds a card; the hover bar's "Add to
  report" / "Remove from report" adds or removes one by hand. Edges into report cards draw in
  a darker gray.
- **Why:** a card click only selects (for Spark and View report); adding to the report is a
  separate, deliberate act. Not green: the owner rejected every green treatment (2026-10-20).
- **Key:** darker gray line / lighter dashed line. **Hint:** first time the path appears:
  "This path goes into your report."
- **Onboarding:** the step where the user prefers a first card.

### Spark (dock, S)
- **For:** testing a card from another angle: who pushes back, what could go wrong, the
  smallest step this week.
- **How:** click a card, press Spark. An angle card opens under it. Up to three per card.
- **Why:** it tests an existing idea instead of inventing a new one (the name is still open).
- **Report effect:** the angle joins the card it tests (step → first task, pushback → who to
  talk to, risk → "Watch out").
- **Key:** card with a gray strip. **Hint:** first angle card: "This angle joins the report
  with the card it tests."
- **Onboarding:** optional step after the first pick.

### New issue (dock, N)
- **For:** a second problem in the same session that builds on the first.
- **How:** press New issue, pick a suggested question or write one, "Add issue". The new tree
  grows next to the others; the camera glides to it.
- **Why:** an older, separate case is referenced from the chat screen, not with New issue.
- **Key:** "Issue n" eyebrows. **Hint:** none (the draft card explains itself).

### View report and "Canvas changed" (header, report)
- **For:** reopening a saved report; knowing when it is behind the canvas.
- **How:** the header button opens the selected card's issue; its arrow lists every issue
  (v2, Canvas changed, No report yet). A new version is built only from the end-of-path card.
- **Why:** saved versions never change; rebuilding is the user's call.
- **Key:** Canvas changed. **Hint:** first "Canvas changed": "Reach the end of a path for a
  new version."

### Link (New issue card, quote card's "Link…" menu)
- **For:** telling Remedy that one issue builds on another, so its report reads the other.
- **How:** in the New issue card, answer "How does this relate to Issue n?" with Follows up /
  Explains it / Unrelated (Remedy's guess is pre-selected). Later, hover a quote card and use
  "Link…" (issue → type), or hover the pill on the line and use Change (type or Remove link).
  The link always runs newer → older.
- **Why:** a link changes the report, so the user sets it where the issue is born, not in a
  separate mode (owner decision 2026-10-20; Link mode and suggested links are gone).
- **Types, in plain words:** *Follows up* = "I tried something for that issue; pick up from
  there." *Explains it* = "Is this the cause of that issue?"
- **Key:** green line between quotes with a pill "Follows up  Issue 1 | 2/3". **Hint:** first
  link made: "Issue 2's report will now read Issue 1."
- **Onboarding:** show after the user adds a second issue, not before.

### Follow-up tasks (report, My tasks)
- **For:** not being told again to do what you already did.
- **What happens:** in a Follows up report, tasks the linked issue finished are left out, and
  the one it stalled on is "Your next step" (its history says "Picked up from Issue 1").
- **Why:** the link has to change what you do next, or it is decoration.
- **Hint:** none. **Onboarding:** the payoff of the Link step.

### Where you left off (report header, Next step)
- **For:** seeing at a glance that this report knows what you did on the linked issue.
- **What happens:** the line under "Your Prescription" says it: "Follows up Issue 1: leaves
  out the 2 tasks you finished there and starts with the one that stalled." "Issue 1" opens
  its report. On the Next step card, the stalled task carries an orange "From Issue 1" tag.
- **Why:** a separate section only repeated the canvas pill and the Next step card (owner
  decision 2026-10-28, after text, track, ring, bar and sankey versions).
- **Hint:** none. **Onboarding:** the payoff of the Link step, together with Follow-up tasks.

## Open questions

- Should the report also link back ("Built from 3 cards on your path · Show on canvas")?
- Where do hints live after New issue and Link add their own signals (link chips, issue
  numbers)? The Key table grows with them.
