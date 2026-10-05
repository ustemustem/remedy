# Canvas guidance: what the signals mean

Raised 2026-10-02. **Status: later task.** The owner wants a guideline and an onboarding;
build them after the core features (New issue, Link, tasks), so they explain the finished
vocabulary once instead of chasing it.

The canvas now carries signals that nothing explains: the solid green
report path, dashed gray branches, the selected card's green ring, the Spark angle strip,
"Canvas changed", the hover bar's report button, and the dock tools.

## Problem

How might we tell users what a canvas signal means the first time they meet it, without
sending them to a manual or a tour?

## Direction

Three parts that share one source of truth:

1. **Key (legend).** A small "Key" button next to the zoom controls (bottom left) opens a
   popover with the canvas vocabulary. The `?` key opens the same popover.
2. **First-encounter hints, three moments only:** the path turns green for the first time,
   the first Spark card lands, the first "Canvas changed". Each shows once as a one-line note
   anchored to the signal, then never again (stored in localStorage). At most one hint on
   screen at a time.
3. **Shortcuts** live in the Key: N · L · S · Esc.

## Key content

| Signal | Meaning |
| --- | --- |
| Solid green line | This path goes into your report |
| Dashed gray line | Explored, not in your report |
| Green ring | Selected card: Spark tests it, View report opens its issue |
| Card with a gray strip | A Spark angle; it joins the report with the card it tests |
| Canvas changed | The tree changed after the report; reach the end of a path for a new version |
| N · L · S · Esc | New issue · Link · Spark · clear the selection |

## Motion

| Moment | Spec | Why |
| --- | --- | --- |
| Hint enters | 200ms `--ease-out`, from `scale(0.96)` + opacity, origin at its anchor | Rare moment; short and anchored, never from nothing |
| Hint leaves | 150ms | Exit faster than enter |
| Key opens by click | 150ms popover, origin at the button | Popovers grow from their trigger |
| Key opens with `?` | No animation | Keyboard actions never animate |
| Reduced motion | Opacity only | Keep meaning, drop movement |

## Assumptions to validate

- [ ] Users notice the green path but not what it means. Test: hint dismiss rate, Key opens.
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

## Open questions

- Should the report also link back ("Built from 3 cards on your path · Show on canvas")?
- Where do hints live after New issue and Link add their own signals (link chips, issue
  numbers)? The Key table grows with them.
