"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import {
  ChevronRight,
  Loader2,
  Check,
  GripVertical,
  MessageSquarePlus,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { OptionPicker } from "./option-picker";
import { TypewriterText } from "./typewriter-text";
import { useSoftness } from "./softness-context";
import { getSquirclePath } from "@/lib/squircle";
import type { CanvasNodeData, HighlightSpan } from "@/lib/types";

export interface RxNodeData {
  nodeData: CanvasNodeData;
  pending: boolean;
  predecessor: CanvasNodeData | null;
  atDepthCap: boolean;
  onSelectToggle: (nodeId: string) => void;
  onOptionPick: (nodeId: string, choiceId: string) => void;
  onFeedbackToggle: (nodeId: string, type: "like" | "dislike") => void;
  onOpenComment: (nodeId: string, pos: { x: number; y: number }) => void;
  onPreferOption: (nodeId: string) => void;
  /** For clarifying-question nodes (depth cap reached) — a shortcut straight to the finalize dashboard. */
  onViewReport: () => void;
  /** Mirrors the header's own Finalize gating — dashboard needs at least one selected node. */
  canFinalize: boolean;
  /** Path-framing hover — lights up the card's path frame when hovering this card. */
  onGroupHoverChange?: (groupId: string | null) => void;
}

const KIND_LABEL: Record<CanvasNodeData["kind"], string> = {
  source: "Source",
  recommendation: "Suggestion",
  "counter-argument": "Counter-argument",
  revision: "Revision",
  "clarifying-question": "Clarifying question",
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
    atDepthCap,
    onSelectToggle,
    onOptionPick,
    onFeedbackToggle,
    onOpenComment,
    onPreferOption,
    onViewReport,
    canFinalize,
    onGroupHoverChange,
  } = data;

  // Cards with an option set branch exclusively through their own "Select
  // and continue" picker — the wrapping card itself isn't independently
  // selectable, that would be a redundant second way to do the same thing.
  const canSelect = SELECTABLE_KINDS.includes(nodeData.kind) && !nodeData.optionSet;

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
  const [clipPath, setClipPath] = useState<string | undefined>(undefined);
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
          setClipPath(
            softnessRadius > 0
              ? `path('${getSquirclePath(width, height, softnessRadius, smoothing)}')`
              : undefined
          );
        }
      }
      raf = requestAnimationFrame(measure);
    };
    raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [softnessRadius, smoothing]);

  function handleOpenComment(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    onOpenComment(id, { x: rect.left + rect.width / 2, y: rect.bottom + 6 });
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
      <div className="nodrag nopan absolute -top-9 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-none border border-border bg-card p-1 opacity-0 shadow-sm transition-opacity group-hover/node:opacity-100">
        <button
          type="button"
          title="Add comment"
          onClick={handleOpenComment}
          className="flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Like"
          onClick={() => onFeedbackToggle(id, "like")}
          className={cn(
            "flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-primary",
            nodeData.feedback === "like" && "text-primary"
          )}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Dislike"
          onClick={() => onFeedbackToggle(id, "dislike")}
          className={cn(
            "flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-destructive",
            nodeData.feedback === "dislike" && "text-destructive"
          )}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Purely a "this card is grabbable" affordance — the whole card is
          already draggable by default, this icon doesn't need to handle
          events. Floats just past the card's right edge, only visible
          while hovering the card itself (not the path). */}
      <GripVertical className="pointer-events-none absolute top-1/2 -right-5 h-4 w-4 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity group-hover/node:opacity-100" />

      <Card
        ref={squircleRef}
        onClick={handleCardClick}
        style={clipPath ? { clipPath, borderRadius: 0 } : undefined}
        className={cn(
          "w-80 gap-3 border-border py-3 shadow-none transition-opacity",
          canSelect ? "cursor-pointer" : "cursor-default",
          "animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
          pending && "opacity-60",
          nodeData.selected && "border-primary bg-primary/5",
          nodeData.feedback === "like" && "ring-1 ring-primary/40",
          nodeData.feedback === "dislike" && "ring-1 ring-destructive/40"
        )}
      >
        <Handle type="target" position={Position.Top} className="!bg-border" />
        <Handle type="source" position={Position.Bottom} className="!bg-border" />

        <CardHeader className="px-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="font-mono text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            {KIND_LABEL[nodeData.kind]}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {nodeData.selected && (
              <span className="flex items-center gap-0.5 font-mono text-[10px] uppercase tracking-wide text-primary/60">
                <Check className="h-3 w-3" />
                Selected
              </span>
            )}
            {nodeData.version && nodeData.version > 1 && (
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                v{nodeData.version}
              </span>
            )}
          </div>
        </div>
        <p className="text-sm font-semibold text-foreground">{nodeData.title}</p>
      </CardHeader>

      <CardContent className="space-y-3 px-3">
        <p
          data-node-id={id}
          className="nodrag cursor-text text-sm whitespace-pre-wrap text-foreground select-text"
        >
          {nodeData.kind === "source" ? (
            renderBody(nodeData.body, nodeData.highlights)
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
              <button className="nodrag group flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground">
                <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
                v{predecessor.version ?? 1} (previous version)
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 border-l-2 border-border pl-2 text-xs text-muted-foreground whitespace-pre-wrap">
              {predecessor.body}
            </CollapsibleContent>
          </Collapsible>
        )}

        {atDepthCap && nodeData.kind !== "clarifying-question" && (
          <p className="text-[10px] text-muted-foreground">
            Max revision depth reached — further comments will ask a clarifying question.
          </p>
        )}

        {/* Option-set cards skip this footer entirely — OptionPicker
            renders its own "Select and continue" action row already, and
            keeping this one too left a second, empty trailing row below
            it, throwing the button out of alignment with every other
            card's own action button. */}
        {!nodeData.optionSet && (
          <div className="flex items-center justify-between pt-1">
            {nodeData.kind === "clarifying-question" ? (
              <Button
                size="sm"
                variant={canFinalize ? "cta" : "outline-cta"}
                className="nodrag"
                disabled={!canFinalize}
                title={canFinalize ? undefined : "Select at least one card first"}
                onClick={onViewReport}
              >
                View report
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : canSelect ? (
              <Button
                size="sm"
                variant={nodeData.selected ? "cta" : "outline-cta"}
                className="nodrag"
                disabled={pending}
                onClick={() => onPreferOption(id)}
              >
                Prefer this option
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <span />
            )}
            {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        )}
      </CardContent>
      </Card>
    </div>
  );
}
