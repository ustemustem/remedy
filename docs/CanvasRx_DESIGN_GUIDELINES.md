# CanvasRx — Design Guidelines (shadcn/ui base)

Design direction: a diagnostic/prescription-pad aesthetic layered onto a spatial
whiteboard tool. Clinical, calm, precise — not a generic AI-SaaS look.

## 1. Color Tokens

Use these as CSS variables in `globals.css`, mapped onto shadcn's standard variable
names so every shadcn component inherits them automatically.

| Token | Hex | Role |
|---|---|---|
| `--background` | `#F4F6F5` | Chart White — app background |
| `--foreground` | `#12213A` | Ink Navy — primary text |
| `--primary` | `#2F6F62` | Rx Green — primary actions, links, "organic" signal |
| `--primary-foreground` | `#F4F6F5` | Text on primary buttons |
| `--destructive` | `#B54234` | Chart Red — warnings, sponsored badge, errors |
| `--border` | `#C9CDC9` | Grid Grey — card borders, canvas grid lines |
| `--accent` | `#E8B54A` | Highlighter Amber — text-selection highlight, active tag |
| `--muted` | `#E7EAE8` | Card backgrounds, disabled states |
| `--muted-foreground` | `#5B6660` | Secondary text, captions, cohort notes |

```css
:root {
  --background: 160 10% 96%;
  --foreground: 213 54% 14%;
  --primary: 168 39% 31%;
  --primary-foreground: 160 10% 96%;
  --destructive: 8 51% 46%;
  --border: 100 4% 80%;
  --accent: 40 76% 61%;
  --muted: 140 6% 91%;
  --muted-foreground: 155 6% 37%;
  --radius: 4px;
}
```
(HSL triplets given so they drop directly into shadcn's default `globals.css` format.)

**Radius:** override shadcn's default `0.5rem` → `4px` everywhere (`--radius: 4px`).
Sharper corners read clinical, not "rounded SaaS card."

## 2. Typography

| Role | Font | Usage |
|---|---|---|
| Display / headers / labels | `IBM Plex Mono`, bold | Used sparingly — section headers, node titles, badges |
| Body | `Inter` or `Public Sans` | Editor text, comments, general UI copy |
| Numeric / data | `IBM Plex Mono`, regular, `tabular-nums` | Match Score %, retention %, cohort counts |

Load via `next/font/google` for `IBM Plex Mono` and `Inter`. Do not mix in a third
display face — restraint matters more than variety here.

## 3. Signature Element

Two motifs carry the "Rx" identity — keep everything else quiet:

1. **Stamp badges.** The Transparency Badge (`Organic` / `Sponsored`) renders like a
   rubber ink stamp: rotated -4°, `--destructive` (sponsored) or `--primary` (organic)
   colored border with a slightly irregular/double-line edge, uppercase Plex Mono text.
   Implement as a custom shadcn `Badge` variant (`variant="stamp"`).
2. **Doctor's-note connectors.** Edges between canvas nodes are dashed (`stroke-dasharray`),
   1.5px, `--border` color, with a small filled circle ("pin") at each end instead of an
   arrowhead. Configure this as the default `edgeType` in React Flow.

Everything else — cards, popovers, buttons — stays flat, matte, no drop shadows beyond
a 1px border. Spend visual boldness only on these two motifs.

## 4. Chat Entry Screen — Background Texture

Faint grid, cold/muted orange, on the Chart White background — texture only, never
competes with foreground content.

```css
.chat-entry-bg {
  background-color: hsl(var(--background));
  background-image:
    linear-gradient(to right, rgba(168, 98, 62, 0.07) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(168, 98, 62, 0.07) 1px, transparent 1px);
  background-size: 32px 32px;
}
```
- Grid color: `#A8623E` (cold, muted rust-orange — deliberately not a warm/saturated
  orange) at 6–8% opacity. Adjust opacity, not hue, if it needs to recede further.
- Scope this class to the chat entry screen only. Canvas and dashboard keep a plain
  `--background` — the grid texture is specific to the "blank page" moment, it should
  not follow the user into the rest of the app.

## 5. Component Mapping

| Need | shadcn component | Notes |
|---|---|---|
| Chat entry input | `Textarea` + `Button` | One-shot; on submit, transitions to canvas |
| Node cards | `Card` | `--radius: 4px`, 1px `--border`, no shadow |
| Highlight → comment popup | `Popover` + `Textarea` | Triggered on text selection, any node |
| Tag picker | `Command` inside `Popover` | Primary + up to 2 secondary tags |
| AI-proposed options (A/B/C) | `RadioGroup` rendered as `Card` variants | Not plain radio buttons — full clickable cards |
| Transparency badge | `Badge` (custom `stamp` variant) | See Section 3 |
| Match Score breakdown | `HoverCard` | Factor list on hover/tap |
| Cohort definition | `Tooltip` | e.g. "n=412 teams, 1–10 people, last 12 months" |
| Node revision history | `Collapsible` | Collapsed "v1" tucked behind current node, per earlier decision |

## 6. Wireframes (concept only)

**Chat entry**
```
┌─────────────────────────────────────┐
│  (faint orange grid background)     │
│                                      │
│         What's going on?            │
│   ┌───────────────────────────┐    │
│   │  [textarea]                │    │
│   └───────────────────────────┘    │
│                          [Send →]   │
└─────────────────────────────────────┘
```

**Canvas**
```
┌─────────────────────────────────────┐
│ [Source node]                       │
│     ┊·╌╌╌ [Suggestion]              │
│     ┊·╌╌╌ [Counter-argument]        │
│              ┊·╌╌╌ [User comment]   │
│                     ↳ [Revision]    │
│                        [Finalize →] │
└─────────────────────────────────────┘
```

**Dashboard**
```
┌─────────────────────────────────────┐
│  [STAMP: ORGANIC]   Match: 87%      │
│  ▂▃▅▇  peer outcome chart           │
│  Retention: 88%   (n=412, hover)    │
└─────────────────────────────────────┘
```

## 7. What to Avoid

- Default shadcn zinc/slate palette left unedited — it reads as "unstyled shadcn."
- Rounded-lg (0.5rem) corners — too soft for the clinical direction.
- Drop shadows on cards — flat/matte only.
- The orange grid texture leaking into canvas/dashboard — entry screen only.
