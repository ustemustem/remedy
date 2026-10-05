"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import {
  ChevronRight,
  Check,
  GripVertical,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  ArrowDown,
  FileMinus,
  FilePlus,
  Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { OptionPicker } from "./option-picker";
import { TypewriterText } from "./typewriter-text";
import { useSourceStyle } from "./source-style-context";
import { ANGLES } from "@/lib/angles";
import { ANGLE_ICON } from "./dock-icons";
import { useIsSparkTarget } from "./spark-target-context";
import AITextLoading from "@/components/kokonutui/ai-text-loading";
import type { CanvasNodeData, FeedbackContext, HighlightSpan } from "@/lib/types";

// Same shimmering-text loading style as the chat entry screen's Send button
// (components/kokonutui/ai-text-loading.tsx) — just the animation, not the
// same copy. Chat is reading/analyzing a vent; a card here is drafting the
// next recommendation, so the words are different even though the motion
// reads as one consistent "AI is working" language across the app.
const CARD_LOADING_STAGES = ["Thinking…", "Drafting…"];

export interface RxNodeData {
  nodeData: CanvasNodeData;
  pending: boolean;
  predecessor: CanvasNodeData | null;
  /** True once some other visible node has this one as its parent — the
   *  card is no longer the live tip of its path. Purely informational (see
   *  the "Continued" tag below): click-to-select still works exactly the
   *  same either way. */
  hasContinuation: boolean;
  onSelectToggle: (nodeId: string) => void;
  /** Clicking an option card — just changes which one is picked, no async
   *  work yet (see canvas-screen.tsx's handleSelectOption). */
  onSelectOption: (nodeId: string, index: number) => void;
  /** "Select and continue" — commits the currently picked option. */
  onConfirmOption: (nodeId: string) => void;
  onFeedbackToggle: (nodeId: string, type: "like" | "dislike") => void;
  onPreferOption: (nodeId: string) => void;
  /** Context-note submission — the classifier decides refine vs branch;
   *  see canvas-screen.tsx's handleSubmitNote. */
  onSubmitNote: (nodeId: string, note: string) => void;
  /** "Restore this version" inside the `see note` panel — a plain revert,
   *  no branching, no note re-application. */
  onRestoreVersion: (nodeId: string) => void;
  /** "I didn't mean that" — always visible on the origin strip, re-applies
   *  the same note under the opposite interpretation. */
  onFlip: (nodeId: string) => void;
  /** How many currently-visible cards sit downstream of this one — powers
   *  the context box's disclosure line, scaled to the actual cost of a
   *  `refine_in_place` instead of a one-size-fits-all dialog. */
  downstreamCount: number;
  /** For clarifying-question nodes (depth cap reached) — a shortcut straight to the finalize dashboard.
   *  Reaching this card at all means the user preferred their way here, so
   *  its "View report" button is never gated on any selected/finalize
   *  check — there's no separate "select for the report" step in this flow. */
  onViewReport: () => void;
  /** For clarifying-question nodes: how many nodes along THIS node's own
   *  ancestor chain were preferred (see canvas-screen.tsx's
   *  getPathAncestors) — not graph-wide. Informational only (the sub-line
   *  copy), doesn't gate the button. Unused by every other kind. */
  selectedCount: number;
  /** For clarifying-question nodes: liked/disliked themes from THIS node's
   *  own ancestor chain only — lets the conclusion cite the actual theme
   *  the user steered toward or away from on this path, instead of a
   *  generic line. Undefined for every other kind. */
  pathFeedback?: FeedbackContext;
  /** Path-framing hover — lights up the card's path frame when hovering this card. */
  onGroupHoverChange?: (groupId: string | null) => void;
  /** Source cards, when the canvas holds more than one issue: "Issue 2". */
  issueNumber?: number;
  /** Draft source cards (New issue): write the issue and grow its tree. */
  onSubmitIssue?: (nodeId: string, text: string) => void;
  /** Draft source cards: throw the unwritten issue away. */
  onDiscardIssue?: (nodeId: string) => void;
}

const KIND_LABEL: Record<CanvasNodeData["kind"], string> = {
  source: "Source",
  recommendation: "Suggestion",
  "counter-argument": "Counter-argument",
  revision: "Revision",
  "clarifying-question": "Clarifying question",
  angle: "Angle",
};

const SELECTABLE_KINDS: CanvasNodeData["kind"][] = [
  "recommendation",
  "counter-argument",
  "revision",
];

function renderBody(body: string, highlights?: HighlightSpan[]): ReactNode {
  if (!highlights || highlights.length === 0) return body;
  const pieces: ReactNode[] = [];
  let cursor = 0;
  for (const h of highlights) {
    const idx = body.indexOf(h.text, cursor);
    if (idx === -1) continue;
    if (idx > cursor) pieces.push(body.slice(cursor, idx));
    pieces.push(
      <mark
        key={h.id}
        className="rounded-none bg-accent/50 px-0.5 text-foreground"
        title={[h.primaryTag, ...(h.secondaryTags ?? [])].join(" · ")}
      >
        {body.slice(idx, idx + h.text.length)}
      </mark>
    );
    cursor = idx + h.text.length;
  }
  if (cursor < body.length) pieces.push(body.slice(cursor));
  return <Fragment>{pieces}</Fragment>;
}

export function RxNode({ id, data }: NodeProps<RxNodeData>) {
  const {
    nodeData,
    pending,
    predecessor,
    hasContinuation,
    onSelectToggle,
    onSelectOption,
    onConfirmOption,
    onFeedbackToggle,
    onPreferOption,
    onSubmitNote,
    onRestoreVersion,
    onFlip,
    downstreamCount,
    onViewReport,
    selectedCount,
    pathFeedback,
    onGroupHoverChange,
    issueNumber,
    onSubmitIssue,
    onDiscardIssue,
  } = data;

  const isClarifying = nodeData.kind === "clarifying-question";
  const isAngle = nodeData.kind === "angle" && !!nodeData.angle;
  // The card Spark will test (the last one clicked). See spark-target-context.tsx.
  const isSparkTarget = useIsSparkTarget(id);
  const isChoice = nodeData.cardType === "choice";
  // The conclusion cites the actual theme this path leaned toward/away
  // from, when there is one, instead of always repeating the same generic
  // line — falls back to nodeData.title (the generic sentence) when the
  // path carries no like/dislike signal at all.
  const pathLikedTheme = pathFeedback?.liked[0];
  const pathDislikedTheme = pathFeedback?.disliked[0];
  const conclusionLede =
    pathLikedTheme && pathDislikedTheme
      ? `You leaned toward "${pathLikedTheme}" and away from "${pathDislikedTheme}" on this thread. Here's what that means for your report.`
      : pathLikedTheme
        ? `You leaned toward "${pathLikedTheme}" on this thread. Here's what that means for your report.`
        : pathDislikedTheme
          ? `You steered away from "${pathDislikedTheme}" on this thread. Here's what that means for your report.`
          : nodeData.title;

  // A choice card branches exclusively through its own picker (or, once the
  // user's own framing is taken, isn't independently "preferred" either) —
  // the wrapping card itself isn't a redundant second way to do the same
  // thing.
  const canSelect = SELECTABLE_KINDS.includes(nodeData.kind) && !isChoice;
  // Suggestion/counter-argument cards carry a context input; source and the
  // terminal clarifying-question card don't take notes at all.
  const canTakeNote = SELECTABLE_KINDS.includes(nodeData.kind);
  /** Exactly the condition under which OptionPicker renders below — when it
   *  does, it owns the free-text answer and the standalone note panel is
   *  suppressed so the card has a single commit control. */
  const hasPicker = isChoice && Boolean(nodeData.question) && Boolean(nodeData.options);
  const isDraft = nodeData.kind === "source" && !!nodeData.draft;
  const eyebrowLabel =
    nodeData.kind === "source" && issueNumber ? `Issue ${issueNumber}` : KIND_LABEL[nodeData.kind];

  const isSource = nodeData.kind === "source";
  const sourceStyle = useSourceStyle();
  const isRail = isSource && sourceStyle === "rail";

  // Cards use a CSS squircle (Card: --radius-card-shaped + corner-shape,
  // drawn by the browser) and a 1.25px CSS border. A clip-path with an SVG
  // stroke was tried and dropped on 2026-10-01: the stroke never sat cleanly
  // on the clipped edge. The selected
  // card (Spark's target) gets a soft green ring and a faint green tint.
  const selectedStyle = isSparkTarget
    ? {
        boxShadow: "0 0 0 2px color-mix(in srgb, var(--primary) 55%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--primary) 3%, var(--card))",
      }
    : undefined;

  // A click on the card only selects it (Spark's target, View report's issue;
  // canvas-screen.tsx's onNodeClick). It no longer adds the card to the
  // report: that happens through "Prefer this option", "Select and continue",
  // or the card's own "In report" mark below (docs/ideas/dock-functions.md).

  // ---------------------------------------------------------------------
  // Context note — local draft + "see note" panel toggle. Uncontrolled
  // draft text kept here (not lifted to canvas-screen.tsx) so typing
  // doesn't retrigger the parent's node/edge rebuild effect on every
  // keystroke.
  // ---------------------------------------------------------------------
  const [noteDraft, setNoteDraft] = useState("");
  const [noteDetailOpen, setNoteDetailOpen] = useState(false);
  // The correction-note box on non-picker cards is collapsed by default now
  // (design critique, variant B): at rest a card shows only its primary
  // action, and the note opens on a quiet trigger. An always-open textarea
  // competed with the primary control and ate a third of the card's height
  // for a low-frequency action. Picker cards don't use this — their free-text
  // answer lives inside the picker instead (see option-picker.tsx).
  const [noteOpen, setNoteOpen] = useState(false);
  // The loading label is decided once, at submit time, from the note that
  // was actually sent — `pending` alone doesn't say WHY this card is
  // pending (it could be "Prefer this option" instead), so this stays null
  // whenever some other action is what's in flight. Cleared by adjusting
  // state during render (React's documented pattern for resetting state in
  // response to a prop change) rather than in an effect, since a
  // synchronous setState inside an effect body risks a cascading render.
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [prevPending, setPrevPending] = useState(pending);
  if (pending !== prevPending) {
    setPrevPending(pending);
    if (!pending) setPendingLabel(null);
  }

  function handleSubmitNoteClick() {
    const text = noteDraft.trim();
    if (!text) return;
    // The refine-vs-branch intent is now classified server-side in the note
    // flow (canvas-screen.tsx), so it isn't known here without a second call
    // — show one neutral label while that runs.
    setPendingLabel("Working on your note…");
    onSubmitNote(id, text);
    setNoteDraft("");
    setNoteOpen(false);
  }

  const origin = nodeData.origin;
  const isBranchOrigin = origin?.intent === "branch_new_direction";
  // Mono/uppercase/tracked — same treatment as the eyebrow below it. This is
  // a LABEL (what kind of card is this), not an action, and the app already
  // draws that line consistently (SUGGESTION/COUNTER-ARGUMENT vs. "Prefer
  // this option"/"Restore this version"). Single words, measured against the
  // strip's real width alongside the "Not what I meant" action (mono
  // uppercase costs ~10px/char here): "Options revised" and "Took your
  // framing" both overflowed the ~176px label budget, so they're shortened
  // to "Rewritten"/"Reframed" rather than dropping the mono/uppercase
  // treatment. No "from your note" either way — the note itself is one tap
  // away via the strip's own toggle.
  const originLabel = isChoice
    ? isBranchOrigin
      ? "Reframed"
      : "Rewritten"
    : isBranchOrigin
      ? "Redirected"
      : "Revised";
  const previousRevision = origin
    ? nodeData.revisions?.find((r) => r.revision === (nodeData.activeRevision ?? 1) - 1)
    : undefined;

  return (
    <div
      data-node-id={id}
      className="group/node relative"
      onMouseEnter={() => onGroupHoverChange?.(nodeData.groupId ?? null)}
      onMouseLeave={() => onGroupHoverChange?.(null)}
    >
      {/* Source is the user's own original text, not an AI suggestion —
          liking only makes sense on the recommendation/counter-argument
          nodes that actually drive the mock AI's next response and the
          dashboard's eventual solution, so Source skips this menu entirely
          rather than offering an action that doesn't feed into anything.
          The clarifying-question/conclusion card skips it too — it's a
          terminal handoff to the report, not one more reaction-worthy
          suggestion. */}
      {!isSource && !isClarifying && (
        <div className="nodrag nopan absolute -top-9 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-[var(--radius-surface)] border border-border bg-card p-1 opacity-0 shadow-sm transition-opacity group-hover/node:opacity-100">
          {canSelect && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-pressed={nodeData.selected}
                  aria-label={nodeData.selected ? "Remove from report" : "Add to report"}
                  onClick={() => onSelectToggle(id)}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-primary",
                    nodeData.selected && "text-primary"
                  )}
                >
                  {nodeData.selected ? <FileMinus className="h-3.5 w-3.5" /> : <FilePlus className="h-3.5 w-3.5" />}
                </button>
              </TooltipTrigger>
              <TooltipContent>{nodeData.selected ? "Remove from report" : "Add to report"}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onFeedbackToggle(id, "like")}
                className={cn(
                  "flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-primary",
                  nodeData.feedback === "like" && "text-primary"
                )}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Like</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onFeedbackToggle(id, "dislike")}
                className={cn(
                  "flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-destructive",
                  nodeData.feedback === "dislike" && "text-destructive"
                )}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Dislike</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Purely a "this card is grabbable" affordance — the whole card is
          already draggable by default, this icon doesn't need to handle
          events. Floats just past the card's right edge, only visible
          while hovering the card itself (not the path). */}
      <GripVertical className="pointer-events-none absolute top-1/2 -right-5 h-4 w-4 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity group-hover/node:opacity-100" />

      <Card
        style={selectedStyle}
        className={cn(
          "relative w-80 gap-3 border-[1.25px] border-border py-3 shadow-none transition-opacity",
          isClarifying ? "cursor-default" : "cursor-pointer",
          "animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
          pending && "opacity-60",
          nodeData.feedback === "like" && "ring-1 ring-primary/40",
          nodeData.feedback === "dislike" && "ring-1 ring-destructive/40",
          // "Rail" restructures the card into a 2-column grid — a solid
          // accent panel alongside the normal header+body stack — instead
          // of layering a badge/type treatment on an unchanged card.
          // No grid gap here on purpose — CardHeader/CardContent already
          // apply px-[var(--card-px)] as their own left padding, so the
          // text sits exactly --card-px away from the rail's edge, the same
          // distance every other card's text sits from its own border. A
          // grid gap here would stack on top of that padding and make
          // Source's edge-to-text distance larger than every other card's.
          isRail && "grid grid-cols-[40px_1fr] items-stretch gap-0 py-0",
          // The clarifying-question card's own two zones each carry their
          // own py-3 already (matching CardHeader/CardContent's rhythm) —
          // without this, the base py-3 above stacks on top and leaves a
          // plain --card gap above the status zone before it even starts.
          isClarifying && "py-0",
          !isRail && !isClarifying && "py-4"
        )}
      >
        {isRail && (
          <div
            className="flex items-start justify-center pt-2.5"
            style={{
              background:
                "repeating-linear-gradient(45deg, transparent 0 6px, color-mix(in srgb, var(--primary-foreground) 14%, transparent) 6px 7px), var(--primary)",
            }}
          >
            <span
              className="text-2xl leading-none text-primary-foreground"
              style={{ fontFamily: "Georgia, serif" }}
              aria-hidden="true"
            >
              &rdquo;
            </span>
          </div>
        )}

        <Handle type="target" position={Position.Top} className="!bg-border" />
        <Handle type="source" position={Position.Bottom} className="!bg-border" />
        {isSource && (
          // Anchors for links between issues (link-edge.tsx): newer issue's
          // left side to the older issue's right side. Not draggable.
          <>
            <Handle type="source" id="link-out" position={Position.Left} isConnectable={false} className="!opacity-0" />
            <Handle type="target" id="link-in" position={Position.Right} isConnectable={false} className="!opacity-0" />
          </>
        )}

        <div className={isRail ? "flex flex-col py-(--card-spacing)" : "contents"}>
        {isDraft ? (
          <DraftIssueBody
            nodeData={nodeData}
            pending={pending}
            onSubmit={(text) => onSubmitIssue?.(id, text)}
            onDiscard={() => onDiscardIssue?.(id)}
          />
        ) : isAngle ? (
          <AngleCardBody nodeData={nodeData} />
        ) : isClarifying ? (
          <>
            {/* Reached the revision depth cap — this card no longer asks
                another question, it states the conclusion the mock AI has
                reached and hands off to the report. A distinct two-zone
                layout (not CardHeader/CardContent) so it reads as the end
                of a path, not one more recommendation to weigh. */}
            <div className="border-b border-border bg-primary/10 px-[var(--card-px)] py-3">
              <div className="mb-1.5 flex items-center gap-1 font-mono text-[length:var(--text-meta)] font-bold tracking-wide text-primary uppercase">
                <Check className="h-2.5 w-2.5" />
                Ready for your report
              </div>
              <p className="text-sm leading-snug font-semibold text-foreground">{conclusionLede}</p>
            </div>
            <div className="px-[var(--card-px)] py-3">
              <p className="mb-2.5 text-[length:var(--text-meta)] text-muted-foreground">
                {selectedCount > 0
                  ? `${selectedCount} recommendation${selectedCount === 1 ? "" : "s"} preferred along the way. See how they come together.`
                  : "Here's what we put together for you."}
              </p>
              <Button
                size="sm"
                variant="cta"
                className="nodrag w-full justify-center"
                onClick={onViewReport}
              >
                View report
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        ) : (
          <>
        {/* Origin strip — full-bleed to the card's own edges, sitting above
            the eyebrow. Primary tint for a revision, cta tint for a new
            direction. The strip itself is the note-panel toggle (a card is
            only 320px wide, minus padding — there's no room for a separate
            "see note" button alongside the label and the recovery action),
            so only the recovery action ("Not what I meant") sits on the
            right as an actual button; the rest of the strip is one big
            toggle. The recovery action never disappears — it's the safety
            net for classifier error, so it can't be time-limited or hidden
            behind another interaction. */}
        {origin && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => setNoteDetailOpen((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setNoteDetailOpen((v) => !v);
              }
            }}
            aria-expanded={noteDetailOpen}
            className={cn(
              // No border/radius of its own — the outer Card's rounded,
              // overflow-hidden box already shapes this strip's top corners,
              // and the Card's own border is the single border for the card.
              "nodrag -mt-4 mb-3 flex w-full cursor-pointer items-center justify-between gap-2 px-[var(--card-px)] py-2 text-[length:var(--text-meta)] transition-colors",
              isBranchOrigin ? "bg-cta/10 hover:bg-cta/15" : "bg-primary/10 hover:bg-primary/15"
            )}
          >
            <span
              className={cn(
                "flex min-w-0 items-center gap-1 font-mono font-bold tracking-wide uppercase",
                isBranchOrigin ? "text-cta" : "text-primary"
              )}
            >
              <span aria-hidden="true">{isBranchOrigin ? "↷" : "↺"}</span>
              <span className="truncate">{originLabel}</span>
              <ChevronRight
                className={cn(
                  "h-3 w-3 shrink-0 transition-transform duration-200 ease-out",
                  noteDetailOpen && "rotate-90"
                )}
              />
            </span>
            <button
              type="button"
              className="nodrag shrink-0 text-muted-foreground underline underline-offset-2 hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onFlip(id);
              }}
            >
              Not what I meant
            </button>
          </div>
        )}

        {origin && noteDetailOpen && (
          <div
            className={cn(
              // Bottom border only — an internal divider from the header
              // below, not an attempt at the card's own outer edge (the
              // Card's border, same reasoning as the strip above).
              "-mt-6 mb-3 space-y-2 border-b border-border px-[var(--card-px)] py-2.5 text-[length:var(--text-meta)] text-muted-foreground",
              isBranchOrigin ? "bg-cta/5" : "bg-primary/5"
            )}
          >
            <p className="text-foreground italic">&ldquo;{origin.note}&rdquo;</p>
            {previousRevision && (
              <div className="space-y-1 border-t border-dashed border-border pt-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">Previous version</p>
                  <button
                    type="button"
                    className="nodrag text-cta underline underline-offset-2 hover:text-foreground"
                    onClick={() => onRestoreVersion(id)}
                  >
                    Restore this version
                  </button>
                </div>
                {isChoice && previousRevision.options ? (
                  <ul className="space-y-0.5">
                    {previousRevision.options.map((o, i) => (
                      <li key={i}>· {o.title}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="whitespace-pre-wrap">{previousRevision.body}</p>
                )}
              </div>
            )}
          </div>
        )}

        <CardHeader className="px-[var(--card-px)]">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-1.5 font-mono text-[length:var(--text-label)] font-bold uppercase tracking-wide text-muted-foreground">
            {isSource && sourceStyle === "quote" && <Quote className="h-3 w-3 shrink-0" />}
            {eyebrowLabel}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {isSource && sourceStyle === "stamp" && (
              <Badge variant="stamp" className="text-primary">
                Your words
              </Badge>
            )}
            {nodeData.activeRevision != null && nodeData.activeRevision > 1 && (
              <span className="font-mono text-[length:var(--text-meta)] tabular-nums text-muted-foreground">
                rev {nodeData.activeRevision}
              </span>
            )}
            {hasContinuation && (
              <span className="flex items-center gap-0.5 font-mono text-[length:var(--text-meta)] uppercase tracking-wide text-muted-foreground/70">
                <ArrowDown className="h-2.5 w-2.5" />
                Continued
              </span>
            )}
          </div>
        </div>
        <p className="text-base font-semibold text-foreground">{nodeData.title}</p>
      </CardHeader>

      <CardContent className="space-y-3 px-[var(--card-px)]">
        <p
          data-node-id={id}
          className="nodrag cursor-text text-base whitespace-pre-wrap text-foreground select-text"
        >
          {isSource ? (
            sourceStyle === "quote" ? (
              <span className="italic">&ldquo;{nodeData.body}&rdquo;</span>
            ) : sourceStyle === "stamp" || sourceStyle === "rail" ? (
              nodeData.body
            ) : (
              renderBody(nodeData.body, nodeData.highlights)
            )
          ) : (
            <TypewriterText text={nodeData.body} />
          )}
        </p>

        {isChoice && nodeData.userFraming ? (
          // The choice card took the user's own words as the answer —
          // this is the visible acceptance echo (never silent): it
          // confirms the system understood correctly, and it's what
          // "I didn't mean that" operates on if it didn't.
          <div className="rounded-[var(--radius-surface)] border border-primary bg-primary/10 px-3 py-2.5">
            <p className="mb-1 font-mono text-[length:var(--text-meta)] font-bold tracking-wide text-primary uppercase">
              Your own framing — taken as the answer
            </p>
            <p className="text-sm text-foreground italic">&ldquo;{nodeData.userFraming}&rdquo;</p>
          </div>
        ) : isChoice && nodeData.question && nodeData.options ? (
          <OptionPicker
            question={nodeData.question}
            options={nodeData.options}
            picked={nodeData.picked ?? null}
            disabled={pending}
            onSelectOption={(index) => onSelectOption(id, index)}
            onConfirm={() => onConfirmOption(id)}
            noteDraft={noteDraft}
            onNoteDraftChange={setNoteDraft}
            onSubmitNote={handleSubmitNoteClick}
            notePlaceholder="e.g. none of these. Priorities change mid-sprint from outside."
            downstreamCount={downstreamCount}
          />
        ) : null}

        {predecessor && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <button className="nodrag group flex items-center gap-1 font-mono text-[length:var(--text-meta)] uppercase tracking-wide text-muted-foreground hover:text-foreground">
                <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
                v{predecessor.version ?? 1} (previous version)
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 border-l-2 border-border pl-2 text-xs text-muted-foreground whitespace-pre-wrap">
              {predecessor.body}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Choice cards skip this footer entirely — the picker (or the
            framing echo) renders its own action, and a card no longer
            showing either isn't independently "preferred" into the
            report. */}
        {!isChoice && (
          <div className="flex items-center justify-between pt-1">
            {canSelect ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline-cta"
                  className="nodrag btn-thinking"
                  data-thinking={pending}
                  disabled={pending}
                  onClick={() => onPreferOption(id)}
                >
                  {pending ? (
                    <>
                      <span className="btn-sweep" aria-hidden="true" />
                      <AITextLoading
                        texts={CARD_LOADING_STAGES}
                        interval={2000}
                        blur
                        stableWidth
                        className="relative z-[1] text-[length:var(--text-label)] text-current"
                      />
                    </>
                  ) : (
                    <>
                      Prefer this option
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <span />
            )}
          </div>
        )}

        {/* The context note, for cards that don't ask a question. Cards that
            DO (the option pickers) carry their free-text answer as the last
            choice in the picker itself, so they get one commit control
            instead of two competing ones — see option-picker.tsx. The label
            is what tells the user this is a correction channel, not a comment
            box (see lib/mockAI.ts's classifyNote doc comment for the two
            intents this feeds). */}
        {canTakeNote && !hasPicker && (
          <div className="border-t border-dashed border-border pt-3">
            {pending && pendingLabel ? (
              <AITextLoading
                texts={[pendingLabel, pendingLabel]}
                interval={700}
                className="text-[length:var(--text-label)] text-muted-foreground"
              />
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setNoteOpen((v) => !v)}
                  aria-expanded={noteOpen}
                  className="nodrag group flex w-full items-center gap-1 text-left text-[length:var(--text-meta)] text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ChevronRight
                    className={cn("h-3 w-3 shrink-0 transition-transform", noteOpen && "rotate-90")}
                  />
                  {isChoice
                    ? "None of these fit? Tell me how you'd put it."
                    : "Not quite right? Tell me what I'm missing."}
                </button>
                {noteOpen && (
                  <div className="space-y-2">
                    {downstreamCount > 0 && (
                      <p className="text-[length:var(--text-meta)] text-muted-foreground/70">
                        Revising this will replace the {downstreamCount} card
                        {downstreamCount === 1 ? "" : "s"} below it.
                      </p>
                    )}
                    <Textarea
                      autoFocus
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                          e.preventDefault();
                          handleSubmitNoteClick();
                        }
                      }}
                      placeholder={
                        isChoice
                          ? "e.g. none of these. Priorities change mid-sprint from outside."
                          : "e.g. we're a team of two, 3 is too many"
                      }
                      rows={2}
                      disabled={pending}
                      className="nodrag"
                    />
                    <div className="flex justify-start">
                      <Button
                        size="sm"
                        className="nodrag"
                        disabled={!noteDraft.trim() || pending}
                        onClick={handleSubmitNoteClick}
                      >
                        Send
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
          </>
        )}
        </div>

      </Card>
    </div>
  );
}

/**
 * A Spark card: one side of its parent card, seen from an angle (lib/angles.ts).
 * A neutral strip with the angle's icon and question, then the title and body.
 * It has no report toggle: it goes into the report inside the card it tests,
 * whenever that card is in the report (components/dashboard/angle-notes.tsx).
 */
function AngleCardBody({ nodeData }: { nodeData: CanvasNodeData }) {
  const angle = ANGLES[nodeData.angle!];
  const Icon = ANGLE_ICON[angle.id];
  return (
    <>
      <div
        className="-mt-4 mb-1 flex items-center gap-[7px] px-[var(--card-px)] py-2 font-mono text-[11px] font-bold tracking-[0.05em] text-foreground uppercase"
        style={{ background: "color-mix(in srgb, var(--foreground) 7%, var(--card))" }}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
        {angle.question}
      </div>
      <CardHeader className="px-[var(--card-px)]">
        <p className="text-sm font-semibold text-foreground">{nodeData.title}</p>
      </CardHeader>
      <CardContent className="space-y-3 px-[var(--card-px)]">
        <p className="nodrag cursor-text text-[13px] leading-[1.45] text-muted-foreground select-text">
          <TypewriterText text={nodeData.body} />
        </p>
        <p className="font-mono text-[length:var(--text-meta)] tracking-wide text-muted-foreground uppercase">
          Joins the report with the card it tests
        </p>
      </CardContent>
    </>
  );
}

const ISSUE_LOADING_STAGES = ["Reading…", "Analyzing…", "Preparing canvas…"];

/**
 * A new issue the user has not written yet (New issue in the dock). The
 * suggested questions come from the session; the user picks one or writes
 * their own. "Add issue" grows the issue's tree next to the others.
 */
function DraftIssueBody({
  nodeData,
  pending,
  onSubmit,
  onDiscard,
}: {
  nodeData: CanvasNodeData;
  pending: boolean;
  onSubmit: (text: string) => void;
  onDiscard: () => void;
}) {
  const [text, setText] = useState("");
  const canSubmit = text.trim().length > 0 && !pending;
  // Focus after the camera's glide (450ms), without scrolling: autoFocus
  // fires while React Flow is still placing the card and loses the focus.
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const t = window.setTimeout(() => fieldRef.current?.focus({ preventScroll: true }), 500);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <>
      <CardHeader className="px-[var(--card-px)]">
        <CardTitle className="font-mono text-[length:var(--text-label)] font-bold tracking-wide text-muted-foreground uppercase">
          New issue
        </CardTitle>
        <p className="text-base font-semibold text-foreground">Untitled issue</p>
      </CardHeader>
      <CardContent className="space-y-3 px-[var(--card-px)]">
        <Textarea
          ref={fieldRef}
          value={text}
          disabled={pending}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSubmit) {
              e.preventDefault();
              onSubmit(text.trim());
            }
          }}
          placeholder="What else is weighing on you?"
          rows={3}
          className="nodrag"
        />
        {nodeData.suggestions && nodeData.suggestions.length > 0 && !pending && (
          <div className="flex flex-wrap gap-1.5">
            {nodeData.suggestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setText(q)}
                className="nodrag rounded-full border border-border bg-background px-2.5 py-1 text-left text-[length:var(--text-label)] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <Button
            size="sm"
            variant="cta"
            className="nodrag btn-thinking"
            data-thinking={pending}
            disabled={!canSubmit}
            onClick={() => onSubmit(text.trim())}
          >
            {pending ? (
              <>
                <span className="btn-sweep" aria-hidden="true" />
                <AITextLoading
                  texts={ISSUE_LOADING_STAGES}
                  interval={2000}
                  blur
                  stableWidth
                  className="relative z-[1] text-[length:var(--text-label)] text-current"
                />
              </>
            ) : (
              <>
                Add issue
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
          {!pending && (
            <Button size="sm" variant="ghost" className="nodrag" onClick={onDiscard}>
              Discard
            </Button>
          )}
        </div>
      </CardContent>
    </>
  );
}
