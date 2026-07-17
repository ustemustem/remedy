"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Node,
  type Edge,
  type NodeChange,
} from "reactflow";
import "reactflow/dist/style.css";
import { RotateCcw, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { RxNode, type RxNodeData } from "./rx-node";
import { RxEdge } from "./rx-edge";
import { GroupFrameNode, type FrameVariant, type GroupFrameNodeData } from "./group-frame-node";
import { layoutNodes } from "@/lib/layout";
import { getNodeResponse, getOptionResponse, MAX_BRANCH_DEPTH } from "@/lib/mockAI";
import {
  getSupersededIds,
  resolveVisibleParentId,
  deriveFeedbackContext,
} from "@/lib/graph";
import type { CanvasGraph, CanvasNodeData } from "@/lib/types";

const nodeTypes = { rxNode: RxNode, groupFrame: GroupFrameNode };
const edgeTypes = { rxEdge: RxEdge };

// PROTOTYPE ONLY — branch-framing hover comparison. Remove alongside
// group-frame-node.tsx and the groupId/groupLabel fields once a variant wins.
const FRAME_PADDING_X = 28;
const FRAME_PADDING_Y = 36;
// Fallback size for a card that hasn't been measured in the DOM yet (first paint).
const CARD_WIDTH_FALLBACK = 320;
const CARD_HEIGHT_FALLBACK = 160;

type Offset = { x: number; y: number };

/**
 * Applies a group's manual drag offset (moving the whole path) and a node's
 * own manual drag offset (moving just that card within its path) on top of
 * the auto-layout position. Both stack — dragging the frame carries every
 * member along, and a member individually nudged out of its path keeps that
 * nudge when the whole path is later dragged too.
 */
function applyOffsets(
  nodeId: string,
  groupId: string | undefined,
  pos: { x: number; y: number },
  groupOffsets: Record<string, Offset>,
  nodeOffsets: Record<string, Offset>
): { x: number; y: number } {
  let x = pos.x;
  let y = pos.y;
  const groupOff = groupId ? groupOffsets[groupId] : undefined;
  if (groupOff) {
    x += groupOff.x;
    y += groupOff.y;
  }
  const nodeOff = nodeOffsets[nodeId];
  if (nodeOff) {
    x += nodeOff.x;
    y += nodeOff.y;
  }
  return { x, y };
}

/**
 * A path's frame always wraps the union of its members' actual rendered
 * boxes — group membership (groupId) never changes, so a card can never
 * "leave" its path; if it's dragged past the auto-layout bounds, or simply
 * renders taller/wider than the fallback guess, the frame grows to still
 * fully contain it.
 */
function computeGroupFrames(
  nodes: CanvasNodeData[],
  positions: Record<string, { x: number; y: number }>,
  measuredSizes: Record<string, { width: number; height: number }>
): Node<GroupFrameNodeData>[] {
  const groups = new Map<
    string,
    { label: string; xMin: number; xMax: number; yMin: number; yMax: number }
  >();

  for (const n of nodes) {
    if (!n.groupId) continue;
    const pos = positions[n.id];
    if (!pos) continue;
    const size = measuredSizes[n.id];
    const width = size?.width ?? CARD_WIDTH_FALLBACK;
    const height = size?.height ?? CARD_HEIGHT_FALLBACK;
    const right = pos.x + width;
    const bottom = pos.y + height;
    const existing = groups.get(n.groupId);
    if (!existing) {
      groups.set(n.groupId, {
        label: n.groupLabel ?? "Path",
        xMin: pos.x,
        xMax: right,
        yMin: pos.y,
        yMax: bottom,
      });
    } else {
      existing.xMin = Math.min(existing.xMin, pos.x);
      existing.xMax = Math.max(existing.xMax, right);
      existing.yMin = Math.min(existing.yMin, pos.y);
      existing.yMax = Math.max(existing.yMax, bottom);
    }
  }

  return Array.from(groups.entries()).map(([groupId, g], index) => ({
    id: `frame-${groupId}`,
    type: "groupFrame",
    position: { x: g.xMin - FRAME_PADDING_X, y: g.yMin - FRAME_PADDING_Y },
    style: {
      width: g.xMax - g.xMin + FRAME_PADDING_X * 2,
      height: g.yMax - g.yMin + FRAME_PADDING_Y * 2,
      zIndex: 0,
    },
    draggable: true,
    selectable: false,
    data: {
      groupId,
      label: g.label,
      color: index % 2 === 0 ? "primary" : "cta",
      variant: "onlyOnHover" as FrameVariant,
      active: false,
    },
  }));
}

interface Selection {
  nodeId: string;
  text: string;
  x: number;
  y: number;
}

function resolveVisibleGraph(graph: CanvasGraph) {
  const supersededIds = getSupersededIds(graph.nodes);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  const visibleNodes = graph.nodes
    .filter((n) => !supersededIds.has(n.id))
    .map((n) => ({
      ...n,
      parentId: resolveVisibleParentId(n.parentId, byId, supersededIds),
    }));

  return { visibleNodes, byId };
}

export function CanvasScreen({
  initialGraph,
  onGraphChange,
  onFinalize,
  onReset,
}: {
  initialGraph: CanvasGraph;
  /** Fires whenever the graph changes — lets the caller autosave to a session. */
  onGraphChange?: (graph: CanvasGraph) => void;
  onFinalize: (graph: CanvasGraph) => void;
  onReset: () => void;
}) {
  const [graph, setGraph] = useState<CanvasGraph>(initialGraph);

  useEffect(() => {
    onGraphChange?.(graph);
    // Only re-fire when the graph itself changes — onGraphChange is a fresh
    // closure on every parent render and isn't meant to gate this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);
  const [pendingNodeIds, setPendingNodeIds] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<Selection | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentOpen, setCommentOpen] = useState(false);

  // PROTOTYPE ONLY — branch-framing hover comparison.
  const [frameVariant, setFrameVariant] = useState<FrameVariant>("onlyOnHover");
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const [measuredSizes, setMeasuredSizes] = useState<
    Record<string, { width: number; height: number }>
  >({});
  // Manual per-path drag offset — grabbing a group frame moves every card in
  // that group together. Layered on top of the auto-layout position rather
  // than replacing it, since layout is re-derived from scratch on every
  // graph change.
  const [groupOffsets, setGroupOffsets] = useState<Record<string, Offset>>({});
  // Manual per-card drag offset — a card can be nudged within (or past) its
  // path's auto-layout bounds without leaving the path's group; the frame
  // grows to keep containing it (see computeGroupFrames).
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, Offset>>({});
  // Anchors for drag-delta math: the un-offset (pure auto-layout) position of
  // every card and every frame, refreshed by the patch effect below. Reading
  // "current position minus this anchor" gives an absolute offset directly
  // from React Flow's reported drag position — no dependency on the previous
  // render's node array, so drag handling can't race a stale closure.
  const basePositionsRef = useRef<{
    nodes: Record<string, { x: number; y: number }>;
    frames: Record<string, { x: number; y: number }>;
  }>({ nodes: {}, frames: {} });

  const [rfNodes, setRfNodes, onNodesChange] =
    useNodesState<RxNodeData | GroupFrameNodeData>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Liked/disliked themes, independent of "Select" — steers the mock AI's
  // next outputs and surfaces in the header strip below.
  const feedbackContext = useMemo(() => deriveFeedbackContext(graph.nodes), [graph.nodes]);

  const handleSelectToggle = useCallback((nodeId: string) => {
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.map((n) => (n.id === nodeId ? { ...n, selected: !n.selected } : n)),
    }));
  }, []);

  const handleFeedbackToggle = useCallback((nodeId: string, type: "like" | "dislike") => {
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.map((n) =>
        n.id === nodeId ? { ...n, feedback: n.feedback === type ? undefined : type } : n
      ),
    }));
  }, []);

  const handleOptionPick = useCallback(
    async (nodeId: string, choiceId: string) => {
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      setPendingNodeIds((prev) => new Set(prev).add(nodeId));
      const { nodes: newNodes, edges: newEdges } = await getOptionResponse(
        node,
        choiceId,
        feedbackContext
      );
      setGraph((g) => ({ nodes: [...g.nodes, ...newNodes], edges: [...g.edges, ...newEdges] }));
      setPendingNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    },
    [graph, feedbackContext]
  );

  // Shared by the comment popover AND the "Prefer this option" card
  // action — both are just "comment on this node," one with typed text, the
  // other with an implicit preference.
  const submitCommentFor = useCallback(
    async (nodeId: string, commentText: string, forceSelected?: boolean) => {
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      setPendingNodeIds((prev) => new Set(prev).add(nodeId));
      const { node: newNode, edge: newEdge } = await getNodeResponse(
        node,
        commentText,
        feedbackContext
      );
      // Every comment refines the same recommendation — carry the "Select"
      // mark forward so the dashboard always reflects the latest revision's
      // data, not whatever version happened to be selected first. A forced
      // value wins — "Prefer this option" always accepts the new revision,
      // even if the card wasn't explicitly selected beforehand.
      const carried: CanvasNodeData = { ...newNode, selected: forceSelected ?? node.selected };
      // Finalizing ("Prefer this option") a node that only exists because of
      // an option-set pick is the moment it stops being exploratory — it
      // graduates out of its parent's path into a new one of its own, rather
      // than staying folded into the frame it was drafted under.
      if (forceSelected && node.fromOptionPick) {
        carried.groupId = `group-${Math.random().toString(36).slice(2, 9)}`;
        carried.groupLabel = node.optionChoiceLabel ?? "New path";
        carried.fromOptionPick = false;
      }
      setGraph((g) => ({ nodes: [...g.nodes, carried], edges: [...g.edges, newEdge] }));
      setPendingNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    },
    [graph, feedbackContext]
  );

  const handleSubmitComment = useCallback(() => {
    if (!selection) return;
    const nodeId = selection.nodeId;
    const commentText = commentDraft;
    setCommentOpen(false);
    setSelection(null);
    setCommentDraft("");
    submitCommentFor(nodeId, commentText);
  }, [selection, commentDraft, submitCommentFor]);

  // Accept-and-continue: always marks the resulting revision "Select",
  // whether or not the card was explicitly selected first — no separate
  // "click the card, then click this" step required.
  const handlePreferOption = useCallback(
    (nodeId: string) => {
      submitCommentFor(nodeId, "I prefer this — please continue in this direction.", true);
    },
    [submitCommentFor]
  );

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.toString().trim().length === 0) return;
    const anchorNode = sel.anchorNode;
    const anchorEl =
      anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement ?? null;
    const nodeEl = anchorEl?.closest("[data-node-id]");
    if (!nodeEl) return;
    const nodeId = nodeEl.getAttribute("data-node-id");
    if (!nodeId) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setSelection({
      nodeId,
      text: sel.toString().trim(),
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
    setCommentDraft("");
    setCommentOpen(true);
  }, []);

  // General "Add comment" from the hover menu — no text selection required.
  const handleOpenComment = useCallback((nodeId: string, pos: { x: number; y: number }) => {
    setSelection({ nodeId, text: "", x: pos.x, y: pos.y });
    setCommentDraft("");
    setCommentOpen(true);
  }, []);

  const hasSelectedNode = graph.nodes.some((n) => n.selected);

  // Rebuild React Flow nodes/edges whenever the domain graph or pending set
  // changes. Cards are placed at their RAW auto-layout position here — drag
  // offsets are applied by the patch effect below, not here, so dragging
  // (which changes groupOffsets/nodeOffsets on every pointer move) never
  // recreates these `data` objects and retriggers their mount-in animation.
  useEffect(() => {
    const { visibleNodes, byId } = resolveVisibleGraph(graph);
    const rawPositions = layoutNodes(visibleNodes);

    const nextNodes: Node<RxNodeData | GroupFrameNodeData>[] = visibleNodes.map((n) => {
      const original = byId.get(n.id) as CanvasNodeData;
      const predecessor = original.previousVersionId
        ? byId.get(original.previousVersionId) ?? null
        : null;
      return {
        id: n.id,
        type: "rxNode",
        position: rawPositions[n.id] ?? { x: 0, y: 0 },
        data: {
          nodeData: original,
          pending: pendingNodeIds.has(n.id),
          predecessor,
          atDepthCap: original.depth >= MAX_BRANCH_DEPTH,
          onSelectToggle: handleSelectToggle,
          onOptionPick: handleOptionPick,
          onFeedbackToggle: handleFeedbackToggle,
          onOpenComment: handleOpenComment,
          onPreferOption: handlePreferOption,
          onGroupHoverChange: setHoveredGroupId,
        } satisfies RxNodeData,
      };
    });

    // Placeholder geometry — the patch effect (which also depends on `graph`,
    // so it runs right after this) immediately overwrites position/size with
    // offsets and real measurements applied.
    const groupFrameNodes = computeGroupFrames(visibleNodes, rawPositions, {});

    const nextEdges: Edge[] = visibleNodes
      .filter((n) => n.parentId)
      .map((n) => ({
        id: `e-${n.parentId}-${n.id}`,
        source: n.parentId as string,
        target: n.id,
        type: "rxEdge",
      }));

    setRfNodes([...groupFrameNodes, ...nextNodes]);
    setRfEdges(nextEdges);
  }, [
    graph,
    pendingNodeIds,
    handleSelectToggle,
    handleOptionPick,
    handleFeedbackToggle,
    handleOpenComment,
    handlePreferOption,
    setRfNodes,
    setRfEdges,
  ]);

  // Measures each card's actual rendered box continuously — not just once
  // after mount — so a group frame keeps growing while a card's content is
  // still being typed out (TypewriterText reveals text over ~1-2s, which
  // keeps changing the card's height the whole time) and while a brand new
  // card streams in. A polling rAF loop rather than ResizeObserver: measured
  // against this same environment, ResizeObserver's callback (including its
  // required initial firing) never ran at all — a polling loop that only
  // writes state on an actual size delta is nearly free when nothing's
  // changing, and it's what actually keeps frames in sync during a reveal.
  useEffect(() => {
    let raf: number;
    const measure = () => {
      setMeasuredSizes((prev) => {
        let changed = false;
        const next = { ...prev };
        document.querySelectorAll<HTMLElement>(".react-flow__node[data-id]").forEach((el) => {
          const nodeId = el.getAttribute("data-id");
          if (!nodeId) return;
          const w = el.offsetWidth;
          const h = el.offsetHeight;
          const prevSize = prev[nodeId];
          if (!prevSize || Math.abs(prevSize.width - w) > 1 || Math.abs(prevSize.height - h) > 1) {
            next[nodeId] = { width: w, height: h };
            changed = true;
          }
        });
        return changed ? next : prev;
      });
      raf = requestAnimationFrame(measure);
    };
    raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Kept out of the main rebuild effect so dragging/measuring/hovering never
  // recreates a card's `data` object (which would retrigger its mount-in
  // animation) — this effect only ever patches `position` on existing nodes,
  // plus geometry/hover/variant on the groupFrame nodes. It's also the sole
  // writer of basePositionsRef, the un-offset anchor drag math reads from.
  useEffect(() => {
    const { visibleNodes } = resolveVisibleGraph(graph);
    const rawPositions = layoutNodes(visibleNodes);
    const adjustedPositions: Record<string, { x: number; y: number }> = {};
    for (const n of visibleNodes) {
      adjustedPositions[n.id] = applyOffsets(
        n.id,
        n.groupId,
        rawPositions[n.id] ?? { x: 0, y: 0 },
        groupOffsets,
        nodeOffsets
      );
    }

    const groupFrames = computeGroupFrames(visibleNodes, adjustedPositions, measuredSizes);
    const framesById = new Map(groupFrames.map((f) => [f.id, f]));

    const rawFrames = computeGroupFrames(visibleNodes, rawPositions, measuredSizes);
    const rawFramePositions: Record<string, { x: number; y: number }> = {};
    for (const f of rawFrames) {
      rawFramePositions[(f.data as GroupFrameNodeData).groupId] = f.position;
    }
    basePositionsRef.current = { nodes: rawPositions, frames: rawFramePositions };

    setRfNodes((nodes) =>
      nodes.map((n) => {
        if (n.type === "groupFrame") {
          const next = framesById.get(n.id);
          if (!next) return n;
          return {
            ...next,
            data: {
              ...next.data,
              variant: frameVariant,
              active: n.id === `frame-${hoveredGroupId}`,
              onHoverChange: setHoveredGroupId,
            },
          };
        }
        const pos = adjustedPositions[n.id];
        if (!pos) return n;
        return { ...n, position: pos };
      })
    );
  }, [graph, groupOffsets, nodeOffsets, measuredSizes, frameVariant, hoveredGroupId, setRfNodes]);

  // Dragging a group frame moves every card in its path together; dragging a
  // single card nudges just that card (still inside its path — see
  // computeGroupFrames). Both are computed as an ABSOLUTE offset from each
  // element's un-offset auto-layout anchor (basePositionsRef), not as an
  // incremental delta from the previous render's position — so this has no
  // dependency on rfNodes and can't be thrown off by a stale closure mid-drag.
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type !== "position" || !change.position) continue;
        const pos = change.position;

        if (change.id.startsWith("frame-")) {
          const groupId = change.id.slice("frame-".length);
          const base = basePositionsRef.current.frames[groupId];
          if (!base) continue;
          setGroupOffsets((prev) => ({
            ...prev,
            [groupId]: { x: pos.x - base.x, y: pos.y - base.y },
          }));
        } else {
          const base = basePositionsRef.current.nodes[change.id];
          if (!base) continue;
          setNodeOffsets((prev) => ({
            ...prev,
            [change.id]: { x: pos.x - base.x, y: pos.y - base.y },
          }));
        }
      }
      onNodesChange(changes);
    },
    [onNodesChange]
  );

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);
  const hasFeedback = feedbackContext.liked.length > 0 || feedbackContext.disliked.length > 0;

  return (
    <div className="flex h-full flex-col bg-background" onMouseUp={handleMouseUp}>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- static local SVG, no optimization needed */}
          <img src="/logo.svg" alt="Remedy" className="h-7 w-auto" />
          {hasFeedback && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">Themes that influenced this:</span>
              {feedbackContext.liked.map((theme) => (
                <Badge
                  key={`liked-${theme}`}
                  variant="outline"
                  className="border-primary/40 bg-primary/10 text-primary"
                >
                  {theme}
                </Badge>
              ))}
              {feedbackContext.disliked.map((theme) => (
                <Badge
                  key={`disliked-${theme}`}
                  variant="outline"
                  className="border-destructive/40 bg-destructive/10 text-destructive"
                >
                  {theme}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* PROTOTYPE ONLY — branch-framing hover comparison, remove after decision. */}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setFrameVariant((v) => (v === "onlyOnHover" ? "alwaysFaint" : "onlyOnHover"))
            }
          >
            Frame: {frameVariant === "onlyOnHover" ? "Hover only" : "Always faint"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset session
          </Button>
          <Button
            variant="cta"
            size="sm"
            disabled={!hasSelectedNode}
            onClick={() => onFinalize(graph)}
          >
            <Send className="h-3.5 w-3.5" />
            Finalize
          </Button>
        </div>
      </header>

      <div className="relative flex-1">
        <ReactFlowProvider>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={{ type: "rxEdge" }}
            proOptions={proOptions}
            fitView
            minZoom={0.2}
          >
            <Background color="var(--border)" gap={24} size={1} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!bg-card" />
          </ReactFlow>
        </ReactFlowProvider>

        {selection && (
          <Popover
            open={commentOpen}
            onOpenChange={(open) => {
              setCommentOpen(open);
              if (!open) setSelection(null);
            }}
          >
            <PopoverTrigger asChild>
              <span
                style={{
                  position: "fixed",
                  left: selection.x,
                  top: selection.y,
                  width: 1,
                  height: 1,
                }}
              />
            </PopoverTrigger>
            <PopoverContent className="w-72 space-y-2" side="top">
              <p className="text-xs text-muted-foreground">
                {selection.text ? (
                  <>
                    Commenting on:{" "}
                    <span className="font-medium text-foreground">
                      &ldquo;{selection.text}&rdquo;
                    </span>
                  </>
                ) : (
                  "A general comment on this node"
                )}
              </p>
              <Textarea
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="Add a comment…"
                rows={3}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setCommentOpen(false);
                    setSelection(null);
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" disabled={!commentDraft.trim()} onClick={handleSubmitComment}>
                  Submit
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
