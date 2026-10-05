# Handoff: Canvas dock (New issue, Link, Spark), final

> **Implementation status (2026-10-01, branch `claude/multi-issue-foundation`)**
>
> - Done: surface (A), layout (B), icons (C), hover pill, shared gliding tooltip with delay and
>   grace, press, mount, shake / flash, keyboard N / L / S / Esc, arrow keys, thinking sweep and
>   label morph, Spark orbit motion, Spark flow and angle cards (E), copy (F), sweep comment
>   fixed (open question 3).
> - Spark selection: the last clicked card (`components/canvas/spark-target-context.tsx`), shown
>   with a 3px `--primary` stroke. Clicking a plain card still also toggles its report
>   selection (existing behavior). Angle cards join the report through their own
>   "Add to report" button.
> - Changed after the handoff (2026-10-01): the dock shape is the cards' CSS squircle
>   (`--radius-card-shaped` 18px + `corner-shape: superellipse(2)`) with a 1.25px CSS border,
>   not `getSquirclePath` + an SVG stroke. `lib/squircle.ts` is removed.
> - Not done yet: New issue and Link need the multi-issue canvas. Both shake and say "Coming
>   next". Link mode, the connector draw, and the card emerge animation (new cards use the
>   existing fade-in) wait for that pass.

**This is the target state of the canvas dock**, not a description of today's code. Where it
conflicts with older docs (`CanvasRx_DESIGN_GUIDELINES.md`, `DESIGN_HANDOFF.md`, `CLAUDE.md`),
**this file wins**.

**Prototype:** `dock_icons.html`. It holds the final picks and is the reference for motion and
behavior. `dock_lab.html` is the older experiments lab that the surface CSS was exported from.

**Values:** Prototype hex values are placeholders. Always use the `app/globals.css` tokens.

**Target files:**

- `components/canvas/canvas-dock.tsx`: the dock.
- The canvas node component (`rx-node.tsx`): selection and the new Spark card variant.
- `lib/mockAI.ts`: the Spark copy and the angle pick.
- `lib/squircle.ts`: dock shape. Reuse it, no changes.
- `app/globals.css`: dock CSS and keyframes.
- The shared tooltip component.

---

## Why this is changing

The shipped dock reads as a generic toolbar. It has a flat gray pill, stock icons, a `bg-muted`
hover that is invisible because `--muted` equals `--card`, and Sparkles on a tool that does not
make ideas.

This pass does three things:

- **Material:** the dock becomes the same paper sheet as the cards.
- **Icons:** all three tools get their own icons, drawn in one visual language.
- **Spark:** it is redefined as what it really is, a way to test a card from another angle.

---

## A. Surface (owner approved, exported from Dock Lab)

```css
.canvas-dock {
  --dock-fill: #fbfcfb;              /* white sheet on the #f4f6f5 paper */
  --dock-radius: 12px;
  --dock-smoothing: 0.8;             /* squircle via getSquirclePath(w, h, radius, smoothing); stroke drawn by an SVG path, like rx-node.tsx */
  --dock-stroke: var(--border);      /* 2px, on the SVG path */
  --dock-edge: inset 0 1px 0 rgb(255 255 255 / .8);
  --dock-stripes: rgb(143 154 149 / 0.09); /* 55deg, .7px line, 5px gap: the .paper-bg motif */
  --dock-grain: 0.6;                 /* .paper-bg grain SVG, soft-light */
  --dock-shadow: drop-shadow(0 1px 2px rgb(18 33 58 / .14)) drop-shadow(0 10px 18px rgb(18 33 58 / .14));
  --dock-tool: var(--muted-foreground);
  --dock-tool-hover: var(--foreground);
  --dock-tool-hover-fill: hsl(140 6% 90%); /* replaces bg-muted: --muted equals --card */
  --dock-press: 0.97;
  --dock-glide: 200ms;
}
.canvas-dock .tool:active { transform: scale(var(--dock-press)); transition: transform 140ms var(--ease-out); }
.canvas-dock .tool[aria-pressed="true"] { background: var(--foreground); color: var(--background); }
.canvas-dock { animation: dock-in-kf 420ms var(--ease-out) 120ms both; } /* translateY(14px) + opacity 0 -> 1; keep translateX(-50%) in the keyframes */

/* Thinking sweep: globals.css .btn-sweep with these values */
.canvas-dock .btn-thinking { --btn-sweep-color: var(--foreground); }
.btn-thinking[data-thinking="true"] .btn-sweep { opacity: 0.4; }
.btn-sweep::before { padding: 2px; }
.btn-thinking[data-thinking="true"] .btn-sweep::before,
.btn-thinking[data-thinking="true"] .btn-sweep::after { animation: btn-spin 4s linear infinite; }
```

**Layers, from back to front:**

1. **Wrapper:** carries `filter: var(--dock-shadow)`. It must be the wrapper, so the clip-path
   does not cut the shadow.
2. **Background:** clipped by the squircle path. It holds the fill, `--dock-edge`, the stripes
   layer and the grain layer (`mix-blend-mode: soft-light`, `opacity: var(--dock-grain)`).
3. **Stroke:** an SVG path on top, using the same `d`.

Recompute the path when the dock resizes, because the Link status segment changes its width.
Use a `ResizeObserver`, or the same polling `rx-node.tsx` uses.

**Not used:** no `--cta` (orange), no `--accent` (yellow) and no glass anywhere in the dock.

---

## B. Layout

- **One group:** `New issue`, `Link`, `Spark`. **No divider before Spark** (owner decision).
- **Dock:** padding 7px, gap 4px, centered at the bottom of the canvas (`left: 50%`, `bottom: 40px`).
- **Tool:** height 40px, padding `0 16px`, radius `--radius-control` (6px), gap 8px between
  icon and label.
- **Icon:** **18px, stroke 2** (it was 16px). Use `className="h-[18px] w-[18px]" strokeWidth={2}`.
- **Label:** 14px, weight 500, Geist. Labels are always visible.
- **Focus:** `focus-visible` gives a 2px outline in `--dock-tool` with a 1px offset.

---

## C. Icons (final)

The three icons share one language. The card comes from New issue, and the dashed path and
filled pin come from Link. Spark combines both: the same card, seen from a moved viewpoint.

```tsx
import { Hand, TriangleAlert, Footprints } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

type ToolIcon = ComponentType<{ className?: string; strokeWidth?: number }>;

/** Custom, drawn on the Lucide grid: 24 x 24, stroke 2, round caps and joins. */
function QuoteCardPlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="2.5" y="6" width="14" height="14" rx="3" />
      <path d="M7.5 11v3" />
      <path d="M11.5 11v3" />
      <path d="M20 2v6" />
      <path d="M17 5h6" />
    </svg>
  );
}

function PinConnectorDashedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle fill="currentColor" stroke="none" cx="5" cy="5.5" r="2.4" />
      <circle fill="currentColor" stroke="none" cx="19" cy="18.5" r="2.4" />
      <path d="M5 8.5v2a2 2 0 0 0 2 2h10a2 2 0 0 1 2 2v1" strokeDasharray="2.2 2.6" />
    </svg>
  );
}

/** Spark: the card stays; the viewpoint (pin) has moved from the front (ring) around to the side. */
function SparkOrbitFromIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="2.5" y="9" width="12" height="12.5" rx="3" />
      <circle cx="4.95" cy="4.31" r="1.3" />
      <path data-part="orbit" d="M8.1 3.76A11.5 11.5 0 0 1 19.89 13.65" strokeDasharray="2.2 2.6" />
      <circle data-part="pin" fill="currentColor" stroke="none" cx="19.89" cy="13.65" r="2.4" />
    </svg>
  );
}

const TOOLS: { label: string; hint: string; detail?: string; key: string; icon: ToolIcon }[] = [
  { label: "New issue", hint: "Add another problem to this session", key: "N", icon: QuoteCardPlusIcon },
  { label: "Link", hint: "Connect two issues so one builds on the other", key: "L", icon: PinConnectorDashedIcon },
  { label: "Spark", hint: "See this card from another angle", detail: "Pushback, risk, or a first step", key: "S", icon: SparkOrbitFromIcon },
];
```

**Off-limits icons:**

- **Flask or beaker:** never use them for any dock tool. The flask belongs to the team's
  Experiments tool.
- **Sparkles:** do not bring it back for Spark.

---

## D. Interaction and motion

**Rule for all motion:**

- Motion happens **only on state changes caused by a pointer.**
- No icon motion on hover.
- **No motion at all for keyboard actions** (N, L, S, Esc): the state changes instantly.
- Hover styles are gated behind `@media (hover: hover) and (pointer: fine)`.

| Moment | Spec |
|---|---|
| Dock mount | `dock-in` 420ms `--ease-out`, 120ms delay. translateY(14px) and opacity 0 -> 1. |
| Hover | One shared pill glides between tools: transform + width, 200ms `--ease-out`. Opacity 140ms. Fill `--dock-tool-hover-fill`. Text goes to `--dock-tool-hover`. |
| Press | scale(0.97), 140ms `--ease-out`. |
| Tooltip | Inverted: background `--foreground`, text `--background`, radius 8px, padding 6px 12px. Enters from translateY(6px) scale(.95), 150ms `--ease-out`, origin bottom center, with a 9px arrow. **Delay 350ms**; once one is open, the next one is instant (Radix `skipDelayDuration`, 300ms grace). Prefer one shared tooltip that glides with the pill, 200ms. If that fights Radix, per-button Radix tooltips with the same delays are acceptable. |
| Tooltip content | Line 1: hint, 12px. Line 2: detail at 70% opacity, 10px, plus a kbd chip (Courier Prime 10.5px, 1px border at `hsl(0 0% 100% / .25)`). |
| Unavailable tool | Shake 320ms `--ease-out` (±3px, ±2px), then the tooltip shows why. Under reduced motion: a 260ms fill flash instead. |
| Thinking (New issue, Spark) | `.btn-thinking` / `.btn-sweep` with the values in section A. The label morphs through stages every 2s: width 260ms `--ease-out`; each stage swaps over 300ms (in from translateY(6px) blur(3px), out to translateY(-6px)); text shimmer while thinking. The button is `aria-busy`, and its tooltip is hidden while busy. |
| New card lands | It grows out of its trigger: translate from the origin's center plus scale(.5) -> none over 460ms `--ease-out`, opacity over 220ms. New issue's origin is the button. Spark's origin is the **source card**. |
| Connector | Dashed step edge (1.5px, `4 4`, 4px corner radius) with pins r=3. It draws in over 480ms `--ease-in-out` through a mask. The start pin shows first; the end pin pops in (opacity, scale .5 -> 1, 160ms) when the line arrives. Spark edges start 160ms after the card lands. |

### Link mode

- **On (click or L):** Link inverts (`aria-pressed="true"`). A status segment grows right after
  Link: width 0 -> content, 240ms `--ease-out`, opacity 160ms. It reads **"Pick the first issue"**
  plus an `Esc` kbd.
- **First pick:** the text swaps to **"Now pick the second"** (120ms opacity and blur(2px)). A live
  dashed connector follows the pointer.
- **Second pick:** the connector draws, a chip **"Follows up"** pops at its midpoint (180ms, at
  60% of the draw), and the status reads **"Linked"**. After 900ms, Link turns off and the segment
  collapses.
- **Off:** Esc, a second click, or a click on any other tool. While Link is on, the tooltip reads
  "Exit Link mode" with an `Esc` kbd.
- **Icon draw:** only when Link mode turns on by click. Give each solid stroke `pathLength="1"`
  and run dashoffset 1 -> 0 over 280ms `--ease-out`. Pins fade in (160ms, 180ms delay). The
  dashed path fades in while its dashoffset runs 9.6 -> 0 over 320ms.

### Spark icon motion (Orbit, from and to)

This runs when Spark starts working by click, never by the S key. The pin leaves the ring and
travels the orbit once.

```tsx
// Pin travels the orbit once. Call it when Spark starts working via click.
function playSparkOrbit(svg: SVGSVGElement) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const orbit = svg.querySelector<SVGPathElement>('[data-part="orbit"]');
  const pin = svg.querySelector<SVGCircleElement>('[data-part="pin"]');
  if (!orbit || !pin) return;
  const len = orbit.getTotalLength();
  const end = { cx: pin.getAttribute("cx")!, cy: pin.getAttribute("cy")! };
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // close to --ease-in-out
  const dur = 600;
  orbit.animate(
    [{ opacity: 0, strokeDashoffset: 9.6 }, { opacity: 1, strokeDashoffset: 0 }],
    { duration: dur, easing: "cubic-bezier(0.77, 0, 0.175, 1)" },
  );
  let t0: number | null = null;
  const step = (ts: number) => {
    t0 ??= ts;
    const t = Math.min(1, (ts - t0) / dur);
    const p = orbit.getPointAtLength(ease(t) * len);
    pin.setAttribute("cx", p.x.toFixed(2));
    pin.setAttribute("cy", p.y.toFixed(2));
    pin.style.opacity = String(Math.min(1, t * 5));
    if (t < 1) requestAnimationFrame(step);
    else { pin.setAttribute("cx", end.cx); pin.setAttribute("cy", end.cy); pin.style.opacity = ""; }
  };
  requestAnimationFrame(step);
}
```

### Keyboard

| Key | Action |
|---|---|
| N | New issue. |
| L | Toggle Link mode. |
| S | Spark. |
| Esc | Exit Link mode; otherwise clear the selection. |

Ignore these keys while focus is in an input, textarea, select or contenteditable, or while a
modifier (Cmd, Ctrl, Alt) is held. Expose them with `aria-keyshortcuts` on each button.

### Reduced motion

Under reduced motion:

- **Off:** pill glide, press scale, label morph transforms, shimmer, sweep spin, icon draw and
  orbit, card emerge (fade 200ms instead), and connector draw (instant).
- **Replaced:** the mount becomes a 240ms fade; the tooltip and the status segment keep only
  opacity.

---

## E. Spark (redefined)

**What it does:** Spark tests one card on the canvas from another angle. It opens a **new card**
that shows the side of that card you missed. The angle is one of three:

| id | Question (card strip) | Stage label while working | Icon |
|---|---|---|---|
| `pushback` | Who pushes back | Finding who pushes back… | `Hand` |
| `risk` | What could go wrong | Looking for what breaks… | `TriangleAlert` |
| `step` | Smallest step this week | Shrinking it to one step… | `Footprints` |

**Spark does not make new ideas.** It tests an existing one against the real world. The new
card is selectable like any other card. If the user selects it, it goes into the report and the
tasks.

### Flow (default: Remedy picks the angle)

1. **One card must be selected.** With no selection, Spark shakes and its tooltip line 2 reads
   **"Select a card first"**.
2. **Click Spark (or press S).** Remedy picks the angle where the selected card is **weakest**.
   The label stages read "Turning the card…" and then that angle's stage label.
3. **The new card lands** out of the source card and gets a dashed connector from it (no chip).
   The selection clears.
4. **Spark on the same card again** opens the next unused angle. Each card holds at most three
   Spark children, one per angle.
5. **All three used:** Spark shakes and line 2 reads **"All three angles are open"**.

### Data

- **New card fields:** `data.kind = "angle"`, `data.angle = "pushback" | "risk" | "step"`,
  `data.sourceId`.
- **Source card:** tracks `usedAngles`, or derive it from its children.
- **`lib/mockAI.ts`:**
  - `pickWeakestAngle(card, used): AngleId | null` (mock: a fixed order per card).
  - `sparkAngle(card, angle): { title, body }`.

Sample copy from the prototype, for the card "Pick one visible first step":

- **pushback:** "Whoever owns the parked work" / "Parking their task reads as a no. Say when it comes back, not only that it waits."
- **risk:** "The first step is too big" / "If today's one task takes all day, the list wins again. Keep it under 90 minutes."
- **step:** "Name tomorrow's task tonight" / "Before you log off, write one line on a sticky note. Nothing else goes on it."

### The angle card

It has the same card shell as the other cards (squircle 12px, 2px SVG stroke), with a **strip**
on top.

- **Strip:** full bleed, padding 8px 16px, Courier Prime 11px bold, uppercase, letter-spacing .05em.
- **Strip colors:** background `color-mix(in srgb, var(--foreground) 7%, var(--card))`, text
  `--foreground`. Neutral, **not** `--cta`.
- **Strip content:** the angle icon at 14px, stroke 2, then the question.
- **Below the strip:** title (14px, 600) and body (13px, `--muted-foreground`).
- **Placement:** near the source card. In the prototype, it goes 40px below the lowest source
  card, in the nearest free column. In React Flow, offset it below the source and never overlap
  an existing node.

---

## F. Copy (all UI strings; no em dash anywhere)

| Where | Text |
|---|---|
| Labels | New issue · Link · Spark |
| Tooltip, New issue | Add another problem to this session · `N` |
| Tooltip, Link | Connect two issues so one builds on the other · `L` |
| Tooltip, Link on | Exit Link mode · `Esc` |
| Tooltip, Spark | See this card from another angle / Pushback, risk, or a first step · `S` |
| Tooltip, Spark, no selection | line 2: Select a card first · `S` |
| Tooltip, Spark, all used | line 2: All three angles are open · `S` |
| Link status | Pick the first issue · Now pick the second · Linked |
| Link edge chip | Follows up |
| New issue stages | Reading the session… · Drafting an issue… |
| New issue card | Eyebrow "New issue", title "Untitled issue", placeholder "What else is weighing on you?" |
| Spark stages | Turning the card… then the angle stage (table in E) |

The current code tooltip "Look at a card through a new lens" is replaced.

---

## G. Accessibility

- **Dock:** `role="toolbar"`, `aria-label="Canvas tools"`. Arrow keys move between tools.
- **Link:** `aria-pressed`. The status segment is `aria-live="polite"`.
- **Thinking button:** `aria-busy="true"`. Icons are `aria-hidden`; the visible label is the
  accessible name.
- **Tooltips:** they also open on keyboard focus, with no delay.

---

## H. Do not touch

- **Flask / experiment icon:** off-limits. Do not move, restyle or reuse it.
- **No em dash in UI copy.**
- **No `--cta` in the dock.** `--cta` means "click to act"; no dock tool uses it.

---

## Open questions (surface, do not resolve here)

1. **Spark name.** "Spark" means ignition, a new idea, which is the opposite of the new
   definition. Alternatives tried: "Second opinion" (fits Remedy's medical language), "Angles"
   (short). It stays "Spark" until the owner decides.
2. **Who picks the angle.** Default: Remedy picks, because the point is the side you do not see.
   The alternative was prototyped and kept as an option:
   - A menu grows from the Spark button (origin = button center, scale .97 -> 1, 150ms in,
     120ms out).
   - Keys 1 2 3 pick, arrows move, Esc closes. Opened with S, there is no animation.
   - Used angles show "done".
3. **Sweep values.** The exported values are opacity .4, 2px ring, 4s per turn. A comment in
   `globals.css` still says .5 / 1.2px / 4.5s. Use the exported values and update the comment.
4. **Weakest-angle logic is mock.** `pickWeakestAngle` is a fixed order today. Real scoring is
   not specified.
5. **Angle cards in the report.** Spec the section and label they get in the report and tasks.
6. **Outdated docs.** `CanvasRx_DESIGN_GUIDELINES.md`, `DESIGN_HANDOFF.md` and `CLAUDE.md` still
   say: 4px radius, IBM Plex / Inter, `#2F6F62`, "no shadows". The live system is:
   - radii 6 / 8 / 12
   - Geist and Courier Prime
   - `--primary #1f4838`
   - soft shadows on lifted surfaces

   Update them, or mark them superseded.
