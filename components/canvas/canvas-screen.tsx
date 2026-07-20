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
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { RxNode, type RxNodeData } from "./rx-node";
import { RxEdge } from "./rx-edge";
import { GroupFrameNode, type GroupFrameNodeData } from "./group-frame-node";
import { ThemePanel } from "./theme-panel";
import { SoftnessProvider } from "./softness-context";
import { SourceStyleProvider, type SourceStyle } from "./source-style-context";
import { layoutNodes } from "@/lib/layout";
import {
  getNodeResponse,
  getOptionResponse,
  getPreferredContinuation,
  MAX_BRANCH_DEPTH,
} from "@/lib/mockAI";
import {
  getSupersededIds,
  resolveVisibleParentId,
  deriveFeedbackContext,
  deriveThemeEntries,
} from "@/lib/graph";
import type { CanvasGraph, CanvasNodeData } from "@/lib/types";

const nodeTypes = { rxNode: RxNode, groupFrame: GroupFrameNode };
const edgeTypes = { rxEdge: RxEdge };

// Branch-framing settings, finalized after comparing variants in the
// Experiments overlay: right-angle connectors, hover-only path frames,
// header-bar path grab affordance (minimal content), wide spacing. Only
// corner radius ("Softness" in the overlay) is still a live experiment.
const FRAME_PADDING_X = 32;
// The header strip is 24px tall and sits right at the frame's top edge; a
// card's hover toolbar floats 36px above the card, so the frame's top
// padding needs to clear both with room to spare.
const FRAME_PADDING_Y_TOP = 64;
const FRAME_PADDING_Y_BOTTOM = 36;
// Fallback size for a card that hasn't been measured in the DOM yet (first paint).
const CARD_WIDTH_FALLBACK = 320;
const CARD_HEIGHT_FALLBACK = 160;
// Vertical space reserved above a depth row's tallest measured card — clears
// the card's own hover toolbar plus room for the connector down to the next
// row, in the same spirit as FRAME_PADDING_Y_TOP/_BOTTOM above.
const ROW_MARGIN = 100;
// Even an all-short-cards row (e.g. a chain of Counter-argument "Prefer this
// option" cards) keeps this much breathing room, so rows never feel cramped.
const ROW_HEIGHT_FLOOR = 260;
// How fast a row's effective height chases its measured target each tick —
// settles in ~10-12 frames (~200ms at 60fps) so a card growing via
// TypewriterText doesn't snap the rows below it in one frame.
const ROW_HEIGHT_LERP = 0.2;

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
    { originTitle: string; originDepth: number; xMin: number; xMax: number; yMin: number; yMax: number }
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
        originTitle: n.title,
        originDepth: n.depth,
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
      // The path's "origin idea" is its shallowest (founding) card's title,
      // regardless of node creation order.
      if (n.depth < existing.originDepth) {
        existing.originTitle = n.title;
        existing.originDepth = n.depth;
      }
    }
  }

  return Array.from(groups.entries()).map(([groupId, g], index) => ({
    id: `frame-${groupId}`,
    type: "groupFrame",
    position: { x: g.xMin - FRAME_PADDING_X, y: g.yMin - FRAME_PADDING_Y_TOP },
    style: {
      width: g.xMax - g.xMin + FRAME_PADDING_X * 2,
      height: g.yMax - g.yMin + FRAME_PADDING_Y_TOP + FRAME_PADDING_Y_BOTTOM,
      zIndex: 0,
    },
    draggable: true,
    selectable: false,
    data: {
      groupId,
      originTitle: g.originTitle,
      color: index % 2 === 0 ? "primary" : "cta",
      active: false,
    },
  }));
}

/**
 * A newly-graduated path (or any path whose chain has grown deep) can end
 * up structurally positioned where an older, already-placed path's frame
 * already sits. Rather than letting them overlap — or pushing the older
 * frame out of the way — only the newer one nudges sideways just far enough
 * to clear the collision, and stops as soon as there's room; it never moves
 * anything else. `frames` must be in creation order (older paths first) so
 * earlier frames act as fixed obstacles for later ones.
 */
function resolveFrameOverlaps(frames: Node<GroupFrameNodeData>[]): Record<string, number> {
  const shiftByGroupId: Record<string, number> = {};
  const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];

  for (const f of frames) {
    const groupId = (f.data as GroupFrameNodeData).groupId;
    const width = typeof f.style?.width === "number" ? f.style.width : 0;
    const height = typeof f.style?.height === "number" ? f.style.height : 0;
    let x0 = f.position.x;
    let x1 = x0 + width;
    const y0 = f.position.y;
    const y1 = y0 + height;

    let shift = 0;
    for (let guard = 0; guard < 20; guard++) {
      const blocker = placed.find((p) => x0 < p.x1 && x1 > p.x0 && y0 < p.y1 && y1 > p.y0);
      if (!blocker) break;
      const push = blocker.x1 - x0 + FRAME_PADDING_X;
      shift += push;
      x0 += push;
      x1 += push;
    }

    shiftByGroupId[groupId] = shift;
    placed.push({ x0, x1, y0, y1 });
  }

  return shiftByGroupId;
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
  softness,
  sourceStyle,
}: {
  initialGraph: CanvasGraph;
  /** Fires whenever the graph changes — lets the caller autosave to a session. */
  onGraphChange?: (graph: CanvasGraph) => void;
  onFinalize: (graph: CanvasGraph) => void;
  onReset: () => void;
  /** Corner radius + Apple-style squircle smoothing — lifted to page.tsx so the
   * same Experiments panel is reachable from every screen. */
  softness: { radius: number; smoothing: number };
  /** Source card visual identity experiment — see source-style-context.tsx. */
  sourceStyle: SourceStyle;
}) {
  const [graph, setGraph] = useState<CanvasGraph>(initialGraph);

  useEffect(() => {
    onGraphChange?.(graph);
    // Only re-fire when the graph itself changes — onGraphChange is a fresh
    // closure on every parent render and isn't meant to gate this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  // Lets the size-measuring rAF loop below read the latest graph (to know
  // each visible node's depth) without depending on it directly — restarting
  // that loop on every graph change would reset its row-height smoothing.
  const graphRef = useRef(graph);
  useEffect(() => {
    graphRef.current = graph;
  }, [graph]);

  // Lets the rebuild effect read the latest onFinalize without depending on
  // it directly — the parent (page.tsx) passes a fresh closure every render,
  // which would otherwise force a full node/edge rebuild on unrelated state.
  const onFinalizeRef = useRef(onFinalize);
  useEffect(() => {
    onFinalizeRef.current = onFinalize;
  }, [onFinalize]);
  const [pendingNodeIds, setPendingNodeIds] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<Selection | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentOpen, setCommentOpen] = useState(false);

  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const [measuredSizes, setMeasuredSizes] = useState<
    Record<string, { width: number; height: number }>
  >({});
  // Effective (lerped) vertical space each card needs below it before its
  // own children start, keyed by that card's node id — derived from
  // measuredSizes each tick (see the measuring effect below). Deliberately
  // per-node rather than per-depth: a branch's y only ever depends on its
  // own ancestors' heights, never on an unrelated branch's card that
  // happens to sit at the same depth. lib/layout.ts's layoutNodes turns
  // this into each node's absolute Y by walking its own ancestor chain.
  const [nodeRowHeights, setNodeRowHeights] = useState<Record<string, number>>({});
  // Lets the node-rebuild effect below read the latest row heights for a
  // brand-new card's very first raw position, without depending on
  // nodeRowHeights directly — that would recreate every card's `data`
  // object (and retrigger its mount-in animation) on every measurement
  // tick. The patch effect further down (which DOES depend on
  // nodeRowHeights) corrects the position again immediately after.
  const nodeRowHeightsRef = useRef(nodeRowHeights);
  useEffect(() => {
    nodeRowHeightsRef.current = nodeRowHeights;
  }, [nodeRowHeights]);
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
  const themeEntries = useMemo(() => deriveThemeEntries(graph.nodes), [graph.nodes]);

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

  // A new child's own position always starts from the pure auto-layout spot
  // (offset 0) — if its parent had been manually dragged (nodeOffsets isn't
  // inherited by anything downstream automatically, unlike groupOffsets,
  // which every member of a group already shares), the child pops up at the
  // structurally "correct" but visually unrelated spot, nowhere near where
  // the parent actually sits on screen. Carrying the parent's own nudge
  // forward keeps the child appearing right where the parent visually is.
  // Only makes sense for a child that stays in the SAME path as its parent
  // (a continuation) — a child that starts a brand new path (a fresh
  // counter-argument) is independent and should use its own natural spot.
  const carryNodeOffset = useCallback((parentId: string, childId: string) => {
    setNodeOffsets((prev) => {
      const parentOffset = prev[parentId];
      if (!parentOffset) return prev;
      return { ...prev, [childId]: parentOffset };
    });
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
      for (const newNode of newNodes) {
        if (newNode.groupId === node.groupId) carryNodeOffset(nodeId, newNode.id);
      }
      setPendingNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    },
    [graph, feedbackContext, carryNodeOffset]
  );

  // Typed comment from the popover — refines the SAME card in place (a
  // revision, collapsed behind the card that replaces it). "Prefer this
  // option" is a different action (handlePreferOption, below): committing
  // to a direction and continuing, not rewording this one card.
  const submitCommentFor = useCallback(
    async (nodeId: string, commentText: string) => {
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      setPendingNodeIds((prev) => new Set(prev).add(nodeId));
      const { node: newNode, edge: newEdge } = await getNodeResponse(
        node,
        commentText,
        feedbackContext
      );
      const carried: CanvasNodeData = { ...newNode, selected: node.selected };
      setGraph((g) => ({ nodes: [...g.nodes, carried], edges: [...g.edges, newEdge] }));
      carryNodeOffset(nodeId, carried.id);
      setPendingNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    },
    [graph, feedbackContext, carryNodeOffset]
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

  // Accept-and-continue: appends a brand new child node one depth below the
  // preferred card — the preferred card itself stays fully visible (never
  // hidden the way a revision hides the node it replaces). It stays in the
  // same path as the card it continues — a suggestion chain is one path no
  // matter how many times it's picked, revised, or preferred; only a
  // counter-argument ever starts its own separate path (see mockAI.ts).
  // "Prefer this option" is about which DIRECTION to explore next, not a
  // dashboard commitment — the new continuation is never auto-selected, so
  // the user is free to prefer several branches in parallel and pick which
  // one to actually finalize later, as its own separate action.
  const handlePreferOption = useCallback(
    async (nodeId: string) => {
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      setPendingNodeIds((prev) => new Set(prev).add(nodeId));
      const { node: newNode, edge: newEdge } = await getPreferredContinuation(
        node,
        feedbackContext
      );
      const carried: CanvasNodeData = { ...newNode, selected: false };
      setGraph((g) => ({ nodes: [...g.nodes, carried], edges: [...g.edges, newEdge] }));
      carryNodeOffset(nodeId, carried.id);
      setPendingNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    },
    [graph, feedbackContext, carryNodeOffset]
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
    // Source is the user's own text, not commentable (see rx-node.tsx) — a
    // text selection there should stay a plain copy-paste selection, not
    // open the comment popover.
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node || node.kind === "source") return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setSelection({
      nodeId,
      text: sel.toString().trim(),
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
    setCommentDraft("");
    setCommentOpen(true);
  }, [graph]);

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
    const rawPositions = layoutNodes(visibleNodes, nodeRowHeightsRef.current);

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
          onViewReport: () => onFinalizeRef.current(graph),
          canFinalize: hasSelectedNode,
          onGroupHoverChange: setHoveredGroupId,
        } satisfies RxNodeData,
      };
    });

    // Placeholder geometry — the patch effect (which also depends on `graph`,
    // so it runs right after this) immediately overwrites position/size with
    // offsets and real measurements applied.
    const groupFrameNodes = computeGroupFrames(visibleNodes, rawPositions, {});

    setRfNodes([...groupFrameNodes, ...nextNodes]);

    // Edges are built here too — a path-entry edge (its child starts a new
    // groupId) attaches to that path's own frame header instead of poking
    // into the first card underneath it; group-frame-node.tsx renders a
    // matching target Handle at the header's position.
    const nextEdges: Edge[] = visibleNodes
      .filter((n) => n.parentId)
      .map((n) => {
        const parent = byId.get(n.parentId as string);
        const entersNewPath = !!n.groupId && parent?.groupId !== n.groupId;
        return {
          id: `e-${n.parentId}-${n.id}`,
          source: n.parentId as string,
          target: entersNewPath ? `frame-${n.groupId}` : n.id,
          type: "rxEdge",
        };
      });
    setRfEdges(nextEdges);
  }, [
    graph,
    pendingNodeIds,
    hasSelectedNode,
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
      const sizesThisTick: Record<string, { width: number; height: number }> = {};
      document.querySelectorAll<HTMLElement>(".react-flow__node[data-id]").forEach((el) => {
        const nodeId = el.getAttribute("data-id");
        if (!nodeId) return;
        sizesThisTick[nodeId] = { width: el.offsetWidth, height: el.offsetHeight };
      });

      setMeasuredSizes((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [nodeId, size] of Object.entries(sizesThisTick)) {
          const prevSize = prev[nodeId];
          if (
            !prevSize ||
            Math.abs(prevSize.width - size.width) > 1 ||
            Math.abs(prevSize.height - size.height) > 1
          ) {
            next[nodeId] = size;
            changed = true;
          }
        }
        return changed ? next : prev;
      });

      // Each card's own target row height is its measured height (this same
      // tick, falling back to CARD_HEIGHT_FALLBACK if it hasn't rendered
      // into the DOM yet) plus breathing room, floored so even a short card
      // never feels cramped. Kept per-node (not per-depth) so one branch's
      // tall card never affects another branch's spacing.
      const { visibleNodes } = resolveVisibleGraph(graphRef.current);
      const targetByNode: Record<string, number> = {};
      for (const n of visibleNodes) {
        const height = sizesThisTick[n.id]?.height ?? CARD_HEIGHT_FALLBACK;
        targetByNode[n.id] = Math.max(height + ROW_MARGIN, ROW_HEIGHT_FLOOR);
      }

      setNodeRowHeights((prev) => {
        let changed = false;
        const next: Record<string, number> = {};
        for (const [nodeId, target] of Object.entries(targetByNode)) {
          const hadPrev = Object.prototype.hasOwnProperty.call(prev, nodeId);
          // A card seen for the first time starts right at its target — no
          // growing-from-zero pop, since it never had a "before" size.
          const current = hadPrev ? prev[nodeId] : target;
          const eased = current + (target - current) * ROW_HEIGHT_LERP;
          next[nodeId] = eased;
          if (!hadPrev || Math.abs(prev[nodeId] - eased) > 0.5) changed = true;
        }
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
  // plus geometry/hover state on the groupFrame nodes. It's also the sole
  // writer of basePositionsRef, the un-offset anchor drag math reads from.
  useEffect(() => {
    const { visibleNodes } = resolveVisibleGraph(graph);
    const rawPositions = layoutNodes(visibleNodes, nodeRowHeights);

    // A newly-graduated (or deeply-grown) path can structurally land where
    // an older path's frame already sits — nudge only the newer one sideways
    // to clear it (see resolveFrameOverlaps), computed from the PURE
    // structural layout so it's independent of anyone's manual drag.
    const structuralFrames = computeGroupFrames(visibleNodes, rawPositions, measuredSizes);
    const avoidanceShifts = resolveFrameOverlaps(structuralFrames);
    const autoPositions: Record<string, { x: number; y: number }> = {};
    for (const n of visibleNodes) {
      const raw = rawPositions[n.id] ?? { x: 0, y: 0 };
      const shift = n.groupId ? avoidanceShifts[n.groupId] ?? 0 : 0;
      autoPositions[n.id] = { x: raw.x + shift, y: raw.y };
    }

    const adjustedPositions: Record<string, { x: number; y: number }> = {};
    for (const n of visibleNodes) {
      adjustedPositions[n.id] = applyOffsets(
        n.id,
        n.groupId,
        autoPositions[n.id],
        groupOffsets,
        nodeOffsets
      );
    }

    const groupFrames = computeGroupFrames(visibleNodes, adjustedPositions, measuredSizes);
    const framesById = new Map(groupFrames.map((f) => [f.id, f]));

    // Drag-delta math anchors off the auto (avoidance-corrected) position,
    // not the raw structural one — otherwise starting a drag on a path that
    // got auto-nudged would jump by the avoidance amount on the first move.
    const autoFrames = computeGroupFrames(visibleNodes, autoPositions, measuredSizes);
    const autoFramePositions: Record<string, { x: number; y: number }> = {};
    for (const f of autoFrames) {
      autoFramePositions[(f.data as GroupFrameNodeData).groupId] = f.position;
    }
    basePositionsRef.current = { nodes: autoPositions, frames: autoFramePositions };

    // React Flow measures each node's real DOM size via its own internal
    // ResizeObserver, but re-derives that measurement from scratch every
    // time the controlled `nodes` prop gets a new array/object reference
    // (see @reactflow/core's createNodeInternals, which spreads the incoming
    // node over the old internal one WITHOUT carrying width/height forward)
    // — so passing a fresh object even when nothing actually moved keeps
    // wiping node.width/height before the minimap (or anything else reading
    // measured size) ever sees a settled value. Bail out to the exact same
    // reference, at both the node and array level, whenever there's truly
    // nothing to patch.
    setRfNodes((nodes) => {
      let changed = false;
      const next = nodes.map((n) => {
        if (n.type === "groupFrame") {
          const nextFrame = framesById.get(n.id);
          if (!nextFrame) return n;
          const currData = n.data as GroupFrameNodeData;
          const active = n.id === `frame-${hoveredGroupId}`;
          const sameGeometry =
            n.position.x === nextFrame.position.x &&
            n.position.y === nextFrame.position.y &&
            n.style?.width === nextFrame.style?.width &&
            n.style?.height === nextFrame.style?.height;
          const nextFrameData = nextFrame.data as GroupFrameNodeData;
          const sameData =
            currData.active === active &&
            currData.originTitle === nextFrameData.originTitle &&
            currData.onHoverChange === setHoveredGroupId;
          if (sameGeometry && sameData) return n;
          changed = true;
          return {
            ...nextFrame,
            data: {
              ...nextFrame.data,
              active,
              onHoverChange: setHoveredGroupId,
            },
          };
        }
        const pos = adjustedPositions[n.id];
        if (!pos || (n.position.x === pos.x && n.position.y === pos.y)) return n;
        changed = true;
        return { ...n, position: pos };
      });
      return changed ? next : nodes;
    });
  }, [graph, groupOffsets, nodeOffsets, measuredSizes, nodeRowHeights, hoveredGroupId, setRfNodes]);

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

  const minimapNodeColor = useCallback(
    (n: Node<RxNodeData | GroupFrameNodeData>) => (n.type === "groupFrame" ? "transparent" : "#94a3b8"),
    []
  );
  const minimapNodeStrokeColor = useCallback(
    (n: Node<RxNodeData | GroupFrameNodeData>) => (n.type === "groupFrame" ? "transparent" : "#d4d8d0"),
    []
  );

  return (
    <div className="flex h-full flex-col bg-background" onMouseUp={handleMouseUp}>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- static local SVG, no optimization needed */}
          <img src="/logo.svg" alt="Remedy" className="h-7 w-auto" />
        </div>
        <div className="flex items-center gap-2">
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
        <SoftnessProvider value={softness}>
        <SourceStyleProvider value={sourceStyle}>
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
              <MiniMap
                pannable
                zoomable
                className="!bg-card"
                nodeColor={minimapNodeColor}
                nodeStrokeColor={minimapNodeStrokeColor}
              />
            </ReactFlow>

            <ThemePanel
              themes={themeEntries}
              nodes={rfNodes.filter((n) => n.type === "rxNode") as Node<RxNodeData>[]}
              onToggleFeedback={(nodeIds, type) =>
                nodeIds.forEach((id) => handleFeedbackToggle(id, type))
              }
            />
          </ReactFlowProvider>
        </SourceStyleProvider>
        </SoftnessProvider>

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
