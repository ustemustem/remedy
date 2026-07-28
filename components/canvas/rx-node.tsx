"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import {
  ChevronRight,
  Minus,
  Check,
  GripVertical,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  ArrowDown,
  Quote,
  X,
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
import { useSoftness } from "./softness-context";
import { useSourceStyle } from "./source-style-context";
import { getSquirclePath } from "@/lib/squircle";
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
  onOptionPick: (nodeId: string, choiceId: string) => void;
  onFeedbackToggle: (nodeId: string, type: "like" | "dislike") => void;
  /** Opens the comment box on this card — `quotedText` is set when
   *  triggered by a text selection, omitted for the plain toolbar icon. */
  onOpenComment: (nodeId: string, quotedText?: string) => void;
  onPreferOption: (nodeId: string) => void;
  /** True while THIS card has its comment box open — at most one card on
   *  the canvas has this true at once (see canvas-screen.tsx's
   *  CommentBoxState). Submitting appends a real "comment" child node
   *  instantly and closes the box — there's no multi-turn "thread" state to
   *  track here anymore; continuing a specific conversation just means
   *  opening the box again on whichever card (the original, or one of the
   *  comment/AI cards it produced) the user wants to keep talking to. */
  commentOpen: boolean;
  /** Selected-text quote to show above the draft. */
  commentQuotedText: string;
  onSubmitComment: (text: string) => void;
  onCloseComment: () => void;
  /** Reddit-style comment threading — how many "comment" ancestors this
   *  node has (see lib/layout.ts's commentIndentLevel). 0 for anything on
   *  the main suggestion path; climbs by one each time a NEW comment
   *  appears deeper in the chain (an AI reply inherits its parent comment's
   *  level rather than adding its own). Drives the left indent + thread
   *  guide line so a comment conversation reads visually distinct from the
   *  main path, without changing how positions are computed elsewhere. */
  threadIndentLevel: number;
  /** True while this "comment" node's own replies are collapsed (see
   *  canvas-screen.tsx's collapsedThreadIds) — every other kind ignores
   *  this, only a comment can be the head of a collapsible thread. */
  isThreadCollapsed: boolean;
  /** How many descendants are currently hidden by the collapse above —
   *  shown in the "N replies" summary row. 0 when not collapsed. */
  collapsedReplyCount: number;
  /** Set when the hidden subtree already reached a conclusion (a
   *  clarifying-question card) — shown as an outcome tag on the collapsed
   *  row so collapsing a thread doesn't also hide whether it went
   *  anywhere. Undefined when the branch is still open-ended. */
  collapsedOutcome?: string;
  onToggleThreadCollapse: (nodeId: string) => void;
  /** True when this card's visible parent is a "comment" node — i.e. this
   *  suggestion/counter-argument is the AI's own reaction to a comment, not
   *  a main-path continuation. Drives the "REFINED BASED ON YOUR COMMENT"
   *  accent treatment below (a green left border + swapped eyebrow copy),
   *  so a comment-triggered card reads differently from one at a glance. */
  repliedToComment: boolean;
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
}

const KIND_LABEL: Record<CanvasNodeData["kind"], string> = {
  source: "Source",
  recommendation: "Suggestion",
  "counter-argument": "Counter-argument",
  revision: "Revision",
  "clarifying-question": "Clarifying question",
  comment: "Comment",
};

const SELECTABLE_KINDS: CanvasNodeData["kind"][] = [
  "recommendation",
  "counter-argument",
  "revision",
];

// Comment cards join the selectable kinds for commentability (you can keep
// a conversation going on your own comment, same as any AI card) but stay
// out of SELECTABLE_KINDS on purpose — see canSelect below, a comment is
// never itself "preferred" into the report.
const COMMENTABLE_KINDS: CanvasNodeData["kind"][] = [...SELECTABLE_KINDS, "comment"];

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
    onOptionPick,
    onFeedbackToggle,
    onOpenComment,
    onPreferOption,
    onViewReport,
    selectedCount,
    pathFeedback,
    onGroupHoverChange,
    commentOpen,
    commentQuotedText,
    onSubmitComment,
    onCloseComment,
    isThreadCollapsed,
    collapsedReplyCount,
    collapsedOutcome,
    onToggleThreadCollapse,
    repliedToComment,
  } = data;

  // Local, uncontrolled draft text — kept in this component (not lifted to
  // canvas-screen.tsx) so typing doesn't retrigger the parent's node/edge
  // rebuild effect on every keystroke. Resets whenever the thread box closes,
  // whether the user closed it or another card's thread took over (see
  // canvas-screen.tsx's CommentThread — only one is open at a time).
  const [commentDraft, setCommentDraft] = useState("");
  // Reset during render (not an effect) when the box just closed — the
  // sanctioned "adjust state while rendering" pattern for state derived from
  // a prop transition, avoiding an extra cascading render.
  const [prevCommentOpen, setPrevCommentOpen] = useState(commentOpen);
  if (commentOpen !== prevCommentOpen) {
    setPrevCommentOpen(commentOpen);
    if (!commentOpen) setCommentDraft("");
  }

  const isClarifying = nodeData.kind === "clarifying-question";
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

  // Cards with an option set branch exclusively through their own "Select
  // and continue" picker — the wrapping card itself isn't independently
  // selectable, that would be a redundant second way to do the same thing.
  const canSelect = SELECTABLE_KINDS.includes(nodeData.kind) && !nodeData.optionSet;
  // Comment cards can be commented on too (that's how a live conversation
  // goes deeper — see canvas-screen.tsx's addCommentNode), even though
  // they're never selectable for the report.
  const canComment = COMMENTABLE_KINDS.includes(nodeData.kind) && !nodeData.optionSet;
  const isComment = nodeData.kind === "comment";
  // "You replied" (amber accent) for the comment itself, "Refined based on
  // your comment" (green left-accent, see the Card below) for the AI's own
  // reaction to it — both replace the generic KIND_LABEL so a
  // comment-triggered exchange reads distinctly from the main path.
  const eyebrowLabel = isComment
    ? "You replied"
    : repliedToComment
      ? "Refined based on your comment"
      : KIND_LABEL[nodeData.kind];
  // A comment-thread card (the comment itself, or the AI's reply to one)
  // reads one step smaller than a main-path card — text-sm/px-3 vs.
  // text-base/px-4 — so a branch visually de-emphasizes against the tree
  // it hangs off of.
  const isBranchCard = isComment || repliedToComment;

  const isSource = nodeData.kind === "source";
  const sourceStyle = useSourceStyle();
  const isRail = isSource && sourceStyle === "rail";

  // Apple-style corner smoothing (see softness-context.tsx / lib/squircle.ts)
  // — replaces the plain circular border-radius with a superellipse curve.
  // Inlined directly (not a separate custom hook) — a custom hook wrapping
  // this exact ref+effect pattern silently never ran its effect for this
  // React Flow custom node (every other hook in the component fires fine;
  // isolating it down to "hook defined in another file" vs "hook inlined
  // here" was the only thing that made the difference, root cause unclear).
  // Must read offsetWidth/offsetHeight, not getBoundingClientRect() — this
  // card lives inside React Flow's canvas, scaled by the current zoom via a
  // CSS transform on an ancestor, and clip-path's own coordinate space is
  // the element's untransformed layout box, not its on-screen (zoomed) box.
  // A polling loop, not ResizeObserver, for the same reason as
  // canvas-screen.tsx's own measuredSizes loop: ResizeObserver never fires
  // in this project's dev environment.
  const { radius: softnessRadius, smoothing } = useSoftness();
  const squircleRef = useRef<HTMLDivElement>(null);
  // Holds the raw path `d` string plus the box it was measured for — reused
  // both for the clip-path (which reshapes the card) and for an SVG stroke
  // overlay that draws the actual border. A plain CSS `border` can't be used
  // here: it's painted as a sharp rectangle (borderRadius stays 0 so the
  // corner math is exact), and clip-path then cuts that rectangle down to
  // the curve — anywhere the curve pulls in from the straight edge by more
  // than the border's own width, the 1px border band falls outside the
  // curve and gets clipped away entirely, leaving the corner borderless.
  // Stroking the exact same path sidesteps that: the stroke IS the curve.
  const [squircle, setSquircle] = useState<
    { path: string; width: number; height: number } | undefined
  >(undefined);
  const lastSquircleSizeRef = useRef({ width: 0, height: 0 });
  useEffect(() => {
    lastSquircleSizeRef.current = { width: 0, height: 0 };
    let raf: number;
    const measure = () => {
      const el = squircleRef.current;
      if (el) {
        const width = el.offsetWidth;
        const height = el.offsetHeight;
        const last = lastSquircleSizeRef.current;
        if (width > 0 && height > 0 && (width !== last.width || height !== last.height)) {
          lastSquircleSizeRef.current = { width, height };
          // "Stamp" identity deliberately drops the squircle — a plain sharp
          // corner is one more way Source reads as "not an AI suggestion
          // card" rather than another shape variant of the same thing.
          // "Rail" also drops it: the approved mockup (source-rail-textures.html)
          // clips its rail with plain `border-radius` + `overflow-hidden`, not
          // a clip-path — the squircle's SVG stroke overlay is only ever
          // half-visible at any curve (half its width is clipped away by the
          // very same clip-path it's meant to outline), which reads fine
          // against a flat card but reads as the rail "spilling past the
          // border" wherever the rail's solid color meets the curve. Plain
          // CSS radius + overflow-hidden clips the rail's corner exactly,
          // with no stroke-alignment illusion to fight. The clarifying-
          // question card's two-zone layout has the exact same problem —
          // its status-zone div is a flat rectangle sitting flush against
          // the card's own rounded top corners, so it drops the squircle
          // too rather than fighting the same corner-bleed illusion again.
          const skipSquircle =
            (isSource && (sourceStyle === "stamp" || sourceStyle === "rail")) || isClarifying;
          setSquircle(
            softnessRadius > 0 && !skipSquircle
              ? { path: getSquirclePath(width, height, softnessRadius, smoothing), width, height }
              : undefined
          );
        }
      }
      raf = requestAnimationFrame(measure);
    };
    raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [softnessRadius, smoothing, isSource, sourceStyle, isClarifying]);

  function handleOpenComment() {
    onOpenComment(id);
  }

  // Reddit-style collapsed comment: replaces the whole card with a single
  // "N replies" row. The node itself never leaves the graph — only its
  // descendants drop out of the visible set (see canvas-screen.tsx's
  // resolveVisibleGraph) — so re-expanding just brings them straight back.
  if (isThreadCollapsed) {
    // The connecting line itself comes from thread-edge.tsx (a real React
    // Flow edge with exact source/target coordinates) — this card doesn't
    // draw its own local guide line, which used to run at a slightly
    // different inset and read as a kink where the two disagreed.
    return (
      <div data-node-id={id} className="group/node relative">
        <button
          type="button"
          onClick={() => onToggleThreadCollapse(id)}
          className="nodrag flex items-center gap-1.5 rounded-[var(--radius-control)] border border-dashed border-border bg-muted/40 px-3 py-1.5 text-[length:var(--text-label)] text-muted-foreground animate-in fade-in-0 zoom-in-95 duration-200 hover:border-foreground/40 hover:text-foreground"
        >
          <ChevronRight className="h-3 w-3" />
          <MessageSquare className="h-3 w-3" />
          {collapsedReplyCount} {collapsedReplyCount === 1 ? "reply" : "replies"}
          {collapsedOutcome && (
            <span className="ml-0.5 border-l border-border pl-1.5 text-muted-foreground/70">
              {collapsedOutcome}
            </span>
          )}
        </button>
      </div>
    );
  }

  // Click anywhere on the card to toggle "Select" — except on a nested
  // button (the option picker, the collapsible trigger, "Prefer this option"...).
  function handleCardClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!canSelect) return;
    if ((e.target as HTMLElement).closest("button")) return;
    onSelectToggle(id);
  }

  return (
    <div
      data-node-id={id}
      className="group/node relative"
      onMouseEnter={() => onGroupHoverChange?.(nodeData.groupId ?? null)}
      onMouseLeave={() => onGroupHoverChange?.(null)}
    >
      {/* Source is the user's own original text, not an AI suggestion —
          commenting/liking only makes sense on the recommendation/
          counter-argument nodes that actually drive the mock AI's next
          response and the dashboard's eventual solution, so Source skips
          this menu entirely rather than offering an action that doesn't
          feed into anything. The clarifying-question/conclusion card skips
          it too — it's a terminal handoff to the report, not one more
          reaction-worthy suggestion. */}
      {!isSource && !isClarifying && (
        <div className="nodrag nopan absolute -top-9 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-[var(--radius-surface)] border border-border bg-card p-1 opacity-0 shadow-sm transition-opacity group-hover/node:opacity-100">
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
          {/* Comment lives in this same top toolbar as Like/Dislike, not a
              separate hover affordance below the card — one discoverable
              place for every per-card reaction. The tooltip doubles as the
              only explanation that selecting text on the card's body opens
              this same box pre-quoted with that selection (see
              handleMouseUp in canvas-screen.tsx). */}
          {canComment && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleOpenComment}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-foreground",
                    commentOpen && "text-foreground"
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Add comment — or select text on the card to comment on it</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {/* Purely a "this card is grabbable" affordance — the whole card is
          already draggable by default, this icon doesn't need to handle
          events. Floats just past the card's right edge, only visible
          while hovering the card itself (not the path). */}
      <GripVertical className="pointer-events-none absolute top-1/2 -right-5 h-4 w-4 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity group-hover/node:opacity-100" />

      {/* Collapse control lives on the thread line itself (a floating
          circle, matching thread-edge.tsx's cap), not inside the card's own
          header — collapsing is an action on the BRANCH, not on the card's
          content. Only a comment with something under it can collapse.
          The connecting dashed line itself comes entirely from
          thread-edge.tsx now — this card no longer draws its own local
          guide line alongside it (see the removed threadIndentLevel div;
          two independently-computed lines never lined up pixel-for-pixel
          and read as a kink). */}
      {isComment && hasContinuation && (
        <button
          type="button"
          onClick={() => onToggleThreadCollapse(id)}
          title="Collapse thread"
          className="nodrag absolute -top-2 -left-3 z-10 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border border-cta bg-card text-cta hover:bg-cta hover:text-cta-foreground"
        >
          <Minus className="h-3 w-3" />
        </button>
      )}

      <Card
        ref={squircleRef}
        onClick={handleCardClick}
        style={
          squircle
            ? // The SVG overlay below draws the real border along this same
              // path — the box's own CSS border is switched off so it can't
              // show through as a sharp-cornered rectangle behind the curve.
              { clipPath: `path('${squircle.path}')`, borderRadius: 0, borderColor: "transparent" }
            : undefined
        }
        className={cn(
          "relative w-80 gap-3 border-border py-3 shadow-none transition-opacity",
          canSelect ? "cursor-pointer" : "cursor-default",
          "animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
          pending && "opacity-60",
          nodeData.feedback === "like" && "ring-1 ring-primary/40",
          nodeData.feedback === "dislike" && "ring-1 ring-destructive/40",
          // "You replied" — a visible amber tint (the design system's
          // --accent token, not --cta) so a comment reads at a glance as
          // "I said this", distinct from both an AI suggestion card and
          // the cta-orange "reply to this" affordances.
          isComment && "border-accent/40 bg-accent/10",
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
          // Main-path cards read one density step larger than a
          // comment-thread branch card (text-base/p-4 vs. text-sm/p-3).
          !isRail && !isClarifying && !isBranchCard && "py-4"
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

        {squircle && (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox={`0 0 ${squircle.width} ${squircle.height}`}
            aria-hidden="true"
          >
            <path
              d={squircle.path}
              fill="none"
              stroke="var(--border)"
              strokeWidth={2}
            />
          </svg>
        )}

        {/* "Refined based on your comment" left accent — a separate strip
            rather than a CSS border-left, since squircle (above) disables
            the card's own plain border whenever softness > 0; this stays
            visible either way. */}
        {repliedToComment && (
          <div
            className="pointer-events-none absolute inset-y-2 left-0 w-1 rounded-full bg-primary"
            aria-hidden="true"
          />
        )}

        <Handle type="target" position={Position.Top} className="!bg-border" />
        <Handle type="source" position={Position.Bottom} className="!bg-border" />

        <div className={isRail ? "flex flex-col py-(--card-spacing)" : "contents"}>
        {isClarifying ? (
          <>
            {/* Reached the revision depth cap — this card no longer asks
                another question, it states the conclusion the mock AI has
                reached and hands off to the report. A distinct two-zone
                layout (not CardHeader/CardContent) so it reads as the end
                of a path, not one more recommendation to weigh. */}
            <div className="border-b border-border bg-primary/10 px-[var(--card-px)] py-3">
              <div className="mb-1.5 flex items-center gap-1 font-mono text-[9.5px] font-bold tracking-wide text-primary uppercase">
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
        <CardHeader className={isBranchCard ? "px-3" : "px-[var(--card-px)]"}>
        <div className="flex items-center justify-between gap-2">
          <CardTitle
            className={cn(
              "flex items-center gap-1.5 font-mono text-[length:var(--text-label)] font-bold uppercase tracking-wide",
              isComment ? "text-cta" : repliedToComment ? "text-primary" : "text-muted-foreground"
            )}
          >
            {isSource && sourceStyle === "quote" && <Quote className="h-3 w-3 shrink-0" />}
            {isComment && (
              // Small filled "avatar" dot standing in for the commenter —
              // there's no user-identity system in this prototype, so a
              // plain accent-colored dot (not a fake name/initial) is the
              // honest version of the reference's avatar circle.
              <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-cta" aria-hidden="true" />
            )}
            {repliedToComment && <span aria-hidden="true">↺</span>}
            {eyebrowLabel}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {isSource && sourceStyle === "stamp" && (
              <Badge variant="stamp" className="text-primary">
                Your words
              </Badge>
            )}
            {nodeData.version && nodeData.version > 1 && (
              <span className="font-mono text-[length:var(--text-meta)] tabular-nums text-muted-foreground">
                v{nodeData.version}
              </span>
            )}
            {/* Main-path only — a comment's own "N replies" collapse
                control already communicates continuation for a thread,
                so repeating "Continued" on the comment card itself is
                redundant noise on top of that. */}
            {hasContinuation && !isComment && (
              <span className="flex items-center gap-0.5 font-mono text-[length:var(--text-meta)] uppercase tracking-wide text-muted-foreground/70">
                <ArrowDown className="h-2.5 w-2.5" />
                Continued
              </span>
            )}
          </div>
        </div>
        {/* The comment's own title is always the literal word "Comment"
            (see canvas-screen.tsx's addCommentNode) — redundant once the
            "You replied" eyebrow above already says so, so it's dropped
            here rather than shown twice. */}
        {!isComment && (
          <p className={cn("font-semibold text-foreground", isBranchCard ? "text-sm" : "text-base")}>
            {nodeData.title}
          </p>
        )}
      </CardHeader>

      <CardContent className={cn("space-y-3", isBranchCard ? "px-3" : "px-[var(--card-px)]")}>
        <p
          data-node-id={id}
          className={cn(
            "nodrag cursor-text whitespace-pre-wrap text-foreground select-text",
            isBranchCard ? "text-sm" : "text-base"
          )}
        >
          {isSource ? (
            sourceStyle === "quote" ? (
              <span className="italic">&ldquo;{nodeData.body}&rdquo;</span>
            ) : sourceStyle === "stamp" || sourceStyle === "rail" ? (
              nodeData.body
            ) : (
              renderBody(nodeData.body, nodeData.highlights)
            )
          ) : isComment ? (
            // Your own words appear instantly, already complete — replaying
            // them through the typewriter reveal (built for AI-authored
            // text streaming in) would look like the app is re-typing
            // something you already typed. Quoted/italicized to read as
            // your own voice, matching Source's own "quote" treatment.
            <span className="italic">&ldquo;{nodeData.body}&rdquo;</span>
          ) : (
            <TypewriterText text={nodeData.body} />
          )}
        </p>

        {nodeData.optionSet && (
          <OptionPicker
            optionSet={nodeData.optionSet}
            disabled={pending}
            onPick={(choiceId) => onOptionPick(id, choiceId)}
          />
        )}

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

        {/* Option-set cards skip this footer entirely — OptionPicker
            renders its own "Select and continue" action row already, and
            keeping this one too left a second, empty trailing row below
            it, throwing the button out of alignment with every other
            card's own action button. */}
        {!nodeData.optionSet && (
          <div className="flex items-center justify-between pt-1">
            {canSelect ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline-cta"
                  className="nodrag"
                  disabled={pending}
                  onClick={() => onPreferOption(id)}
                >
                  {pending ? (
                    <AITextLoading
                      texts={CARD_LOADING_STAGES}
                      interval={700}
                      className="text-[length:var(--text-label)] text-current"
                    />
                  ) : (
                    <>
                      Prefer this option
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              </div>
            ) : pending ? (
              // Comment cards have no "Prefer" button, but still show the
              // same shimmer while the AI's reaction to this comment
              // (a suggestion/counter-argument pair) is being drafted —
              // see canvas-screen.tsx's generateCommentResponse.
              <AITextLoading
                texts={CARD_LOADING_STAGES}
                interval={700}
                className="text-[length:var(--text-label)] text-muted-foreground"
              />
            ) : (
              <span />
            )}
          </div>
        )}
      </CardContent>
          </>
        )}
        </div>
      </Card>

      {/* Opened only from the top toolbar's comment icon (or a text
          selection, see canvas-screen.tsx's handleMouseUp) — rendered in
          normal flow (not absolutely positioned like the toolbar above) so
          the expanded box actually grows this node's measured height and
          pushes anything below it down (see canvas-screen.tsx's polling
          size-measure effect). */}
      {canComment && commentOpen && (
        <div className="nodrag nopan mt-2 w-80 space-y-2 rounded-[var(--radius-card)] border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1 font-mono text-[length:var(--text-meta)] uppercase tracking-wide text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              Comment
            </p>
            <button
              type="button"
              onClick={onCloseComment}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {commentQuotedText && (
            <p className="text-[length:var(--text-meta)] text-muted-foreground">
              Commenting on:{" "}
              <span className="font-medium text-foreground">&ldquo;{commentQuotedText}&rdquo;</span>
            </p>
          )}

          <Textarea
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={onCloseComment}>
              Close
            </Button>
            <Button
              size="sm"
              disabled={!commentDraft.trim()}
              onClick={() => {
                onSubmitComment(commentDraft);
                setCommentDraft("");
              }}
            >
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
