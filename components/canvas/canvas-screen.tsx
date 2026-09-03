"use client";

import { useMemo, useState, useCallback, useEffect, useRef, type MutableRefObject } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useUpdateNodeInternals,
  type Node,
  type Edge,
  type NodeChange,
} from "reactflow";
import "reactflow/dist/style.css";
import { RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RxNode, type RxNodeData } from "./rx-node";
import { RxEdge } from "./rx-edge";
import { GroupFrameNode, type GroupFrameNodeData } from "./group-frame-node";
import { ThemePanel } from "./theme-panel";
import { SoftnessProvider } from "./softness-context";
import { SourceStyleProvider, type SourceStyle } from "./source-style-context";
import { layoutNodes } from "@/lib/layout";
import {
  getOptionResponse,
  getPreferredContinuation,
  classifyNote,
  refinePlainCard,
  refineChoiceOptions,
  branchFromNote,
  branchFromChoiceFraming,
} from "@/lib/mockAI";
import {
  getSupersededIds,
  resolveVisibleParentId,
  deriveFeedbackContext,
  deriveThemeEntries,
  isStale,
} from "@/lib/graph";
import { loadingCycleMs, withMinDuration } from "@/lib/timing";
import type { CanvasGraph, CanvasNodeData, CardOrigin, ChoiceOption } from "@/lib/types";

// Matches rx-node.tsx's CARD_LOADING_STAGES and option-picker.tsx's
// PICK_LOADING_STAGES — both two stages at a 700ms interval. Every mock AI
// call below is floored to this so its button's shimmer always finishes one
// full cycle before the resulting card/thread-jump/close actually happens
// (see lib/timing.ts).
const ACTION_LOADING_MS = loadingCycleMs(2, 700);

// Browsers only recompute a hovered element's :hover state on an actual
// pointer event — they do NOT re-run hit-testing just because the DOM
// shifted under a stationary cursor. This canvas repositions nodes
// constantly (a card's height changes all through its TypewriterText
// reveal, feeding the patch effect below), so a card that slides out from
// under the cursor can keep showing its hover-only toolbar, or a card that
// slides underneath the cursor won't get one — a real, well-documented
// browser quirk, not a bug in the hover markup itself. Toggling
// pointer-events off and back on across two frames forces the browser to
// redo hit-testing against wherever the cursor actually is right now.
function forceHoverRecompute() {
  requestAnimationFrame(() => {
    document.body.style.pointerEvents = "none";
    requestAnimationFrame(() => {
      document.body.style.pointerEvents = "";
    });
  });
}

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
const ROW_MARGIN = 150;
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
  measuredSizes: Record<string, { width: number; height: number }>,
  topGroupId?: string | null
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

  return Array.from(groups.entries()).map(([groupId, g], index) => {
    const width = g.xMax - g.xMin + FRAME_PADDING_X * 2;
    const height = g.yMax - g.yMin + FRAME_PADDING_Y_TOP + FRAME_PADDING_Y_BOTTOM;
    return {
      id: `frame-${groupId}`,
      type: "groupFrame",
      position: { x: g.xMin - FRAME_PADDING_X, y: g.yMin - FRAME_PADDING_Y_TOP },
      // Top-level width/height, not just style.width/height — @reactflow/
      // core's createNodeInternals seeds its internal node record as
      // `{ ...node, positionAbsolute }`, carrying forward whatever's on the
      // object WE hand it. Its own SEPARATE `handleBounds` cache (used to
      // compute edge endpoints) is preserved across a fresh push, but plain
      // `width`/`height` only exists if we put it there ourselves — style
      // alone (a CSS value) isn't read for this. Without it, every fresh
      // frame object we push (every drag tick) leaves internals.width/height
      // undefined until React Flow's own next DOM remeasure fills them back
      // in — and that remeasure is unconditionally routed through
      // requestAnimationFrame inside React Flow itself (see
      // useUpdateNodeInternals), so there's no way to close that gap from
      // our side quickly enough. An edge attached to a momentarily
      // width/height-less node fails EdgeRenderer's validity check and
      // renders `null` for that tick, which — since nothing existed to
      // reconcile against — remounts as a brand-new instance (replaying its
      // entrance fade) the next tick it's valid again. Setting these
      // explicitly means the value is simply always present on the object
      // itself, no measurement or timing involved.
      width,
      height,
      // Whichever path was most recently grabbed renders above the rest —
      // otherwise two overlapping frames fight over plain DOM order (whoever
      // happens to come later in the array), which reads as "random" and
      // means the one you're actively dragging can end up BEHIND the one
      // you just dropped it on.
      style: {
        width,
        height,
        zIndex: groupId === topGroupId ? 10 : 0,
      },
      draggable: true,
      selectable: false,
      data: {
        groupId,
        originTitle: g.originTitle,
        color: index % 2 === 0 ? "primary" : "cta",
        active: false,
      },
    };
  });
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

/**
 * A revision (see lib/graph.ts's getSupersededIds) hides the node it
 * replaced, and a stale subtree (lib/graph.ts's isStale — a downstream card
 * created under a premise its parent has since revised away) hides itself
 * without ever being deleted. Both are derived from scratch on every
 * render rather than stored as their own state, so a hidden node's
 * descendants always re-point at whatever is actually on screen.
 */
function resolveVisibleGraph(graph: CanvasGraph) {
  const supersededIds = getSupersededIds(graph.nodes);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  const visibleNodes = graph.nodes
    .filter((n) => !supersededIds.has(n.id) && !isStale(n, byId))
    .map((n) => ({
      ...n,
      parentId: resolveVisibleParentId(n.parentId, byId, supersededIds),
    }));

  return { visibleNodes, byId };
}

/** Every descendant id of `nodeId`, walking the RAW (unfiltered) graph —
 *  used by flip() to actually remove a branch card (and anything the user
 *  built further on it) rather than merely hiding it, since there's no
 *  revision to hang staleness off of for a card that's being deleted
 *  outright. */
function collectDescendantIds(nodeId: string, allNodes: CanvasNodeData[]): Set<string> {
  const byParent = new Map<string, CanvasNodeData[]>();
  for (const n of allNodes) {
    if (!n.parentId) continue;
    if (!byParent.has(n.parentId)) byParent.set(n.parentId, []);
    byParent.get(n.parentId)!.push(n);
  }
  const result = new Set<string>();
  const stack = [...(byParent.get(nodeId) ?? [])];
  while (stack.length > 0) {
    const n = stack.pop()!;
    result.add(n.id);
    stack.push(...(byParent.get(n.id) ?? []));
  }
  return result;
}

/** How many currently-visible cards sit downstream of this one on the main
 *  path — powers the context box's disclosure line ("Revising this will
 *  replace the N cards below it"), which scales with the actual cost of a
 *  `refine_in_place` instead of a one-size-fits-all confirmation dialog. */
function countVisibleDownstream(nodeId: string, visibleNodes: CanvasNodeData[]): number {
  const byParent = new Map<string, CanvasNodeData[]>();
  for (const n of visibleNodes) {
    if (!n.parentId) continue;
    if (!byParent.has(n.parentId)) byParent.set(n.parentId, []);
    byParent.get(n.parentId)!.push(n);
  }
  let count = 0;
  const stack = [...(byParent.get(nodeId) ?? [])];
  while (stack.length > 0) {
    const n = stack.pop()!;
    count++;
    stack.push(...(byParent.get(n.id) ?? []));
  }
  return count;
}

/** Pushes a new revision onto a PLAIN card and makes it the active one —
 *  `refine_in_place`. Downstream cards are never touched here; they go
 *  stale on their own (see lib/graph.ts's isStale) the moment this card's
 *  `activeRevision` no longer matches what they were `createdUnderRevision`. */
function pushPlainRevision(
  node: CanvasNodeData,
  title: string,
  body: string,
  note: string
): CanvasNodeData {
  const nextRevisionNum = (node.activeRevision ?? 1) + 1;
  const revisions = [
    ...(node.revisions ?? []),
    { revision: nextRevisionNum, title, body, note, createdAt: new Date().toISOString() },
  ];
  return {
    ...node,
    title,
    body,
    revisions,
    activeRevision: nextRevisionNum,
    origin: { intent: "refine_in_place", note },
  };
}

/** Same as pushPlainRevision, but for a CHOICE card — the option SET
 *  regenerates, not the card's own title/body (per the design: correcting
 *  a question means "these options don't fit," not "the prose is wrong").
 *  Any prior pick clears. */
function pushChoiceRevision(
  node: CanvasNodeData,
  options: ChoiceOption[],
  note: string
): CanvasNodeData {
  const nextRevisionNum = (node.activeRevision ?? 1) + 1;
  const revisions = [
    ...(node.revisions ?? []),
    {
      revision: nextRevisionNum,
      title: node.title,
      body: node.body,
      options,
      note,
      createdAt: new Date().toISOString(),
    },
  ];
  return {
    ...node,
    options,
    picked: null,
    revisions,
    activeRevision: nextRevisionNum,
    origin: { intent: "refine_in_place", note },
  };
}

/**
 * "Restore this version" — a plain revert (no branching, no note
 * re-application) back to the revision just before the current one.
 * Truncates any revisions ahead of the restored one, so a later fresh
 * `refine_in_place` doesn't collide on revision numbers with a "redo"
 * history nothing ever re-attaches to.
 */
function restoreVersion(node: CanvasNodeData): CanvasNodeData {
  // A choice card that took the user's own framing has no revision to step
  // back to — there's simply the framing to drop, back to the question.
  if (node.userFraming != null) {
    return { ...node, userFraming: null, origin: null, picked: null };
  }
  const prevRevisionNum = (node.activeRevision ?? 1) - 1;
  if (prevRevisionNum < 1) return node;
  const prevRevision = node.revisions?.find((r) => r.revision === prevRevisionNum);
  if (!prevRevision) return node;
  const truncatedRevisions = (node.revisions ?? []).filter((r) => r.revision <= prevRevisionNum);
  const origin: CardOrigin | null =
    prevRevisionNum === 1 ? null : { intent: "refine_in_place", note: prevRevision.note ?? "" };
  return {
    ...node,
    title: prevRevision.title,
    body: prevRevision.body,
    ...(node.cardType === "choice" ? { options: prevRevision.options, picked: null } : {}),
    revisions: truncatedRevisions,
    activeRevision: prevRevisionNum,
    origin,
  };
}

/**
 * Every node along THIS specific node's own ancestor chain, not graph-wide —
 * a clarifying-question card's conclusion (selected count, liked/disliked
 * themes) only means something if it's reading the path that actually led
 * here, not anything selected or liked/disliked anywhere else on the
 * canvas. `visibleById` must be keyed by nodes whose `parentId` has already
 * been resolved past superseded (hidden) ancestors, e.g. the `visibleNodes`
 * resolveVisibleGraph returns — walking raw parentId would double-count a
 * selection or feedback tag carried forward from a superseded node onto its
 * own revision.
 */
function getPathAncestors(
  startParentId: string | null,
  visibleById: Map<string, CanvasNodeData>
): CanvasNodeData[] {
  const ancestors: CanvasNodeData[] = [];
  let pid = startParentId;
  while (pid) {
    const node = visibleById.get(pid);
    if (!node) break;
    ancestors.push(node);
    pid = node.parentId;
  }
  return ancestors;
}

/**
 * Drains `pendingRef` (node ids whose measured size changed this tick, set
 * by the measuring rAF loop below) into React Flow's own
 * `updateNodeInternals` — the piece that actually refreshes edge handle
 * coordinates. `useUpdateNodeInternals` only works inside `ReactFlowProvider`,
 * which is why this is a separate component rendered alongside `<ReactFlow>`
 * rather than called directly in CanvasScreen's body.
 *
 * `directRef` is a second, faster path for group frames specifically:
 * unlike a card's height (which genuinely needs polling to *detect* a
 * change), we already know the exact instant a frame's node object gets
 * recreated — the patch effect that does it, in CanvasScreen. That effect
 * lives outside ReactFlowProvider, so it can't call `useUpdateNodeInternals`
 * itself; stashing the function here (on mount) lets it call the function
 * DIRECTLY and synchronously right after patching a frame's position,
 * rather than queuing the id and waiting for this component's own
 * RAF-polled drain loop to pick it up up to one animation frame later.
 * That gap mattered: @reactflow/core's own EdgeRenderer treats a node with
 * no cached width/height as invalid and renders its edges as `null` for
 * that tick, and since nothing existed to reconcile against, the edge
 * mounts as a brand-new instance (replaying its entrance fade) the next
 * tick it's valid again — which is what dragging a frame looked like
 * before this.
 */
function NodeInternalsSync({
  pendingRef,
  directRef,
}: {
  pendingRef: MutableRefObject<Set<string>>;
  directRef: MutableRefObject<((ids: string[]) => void) | null>;
}) {
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    directRef.current = updateNodeInternals;
    return () => {
      directRef.current = null;
    };
  }, [updateNodeInternals, directRef]);
  useEffect(() => {
    let raf: number;
    const drain = () => {
      if (pendingRef.current.size > 0) {
        updateNodeInternals(Array.from(pendingRef.current));
        pendingRef.current.clear();
      }
      raf = requestAnimationFrame(drain);
    };
    raf = requestAnimationFrame(drain);
    return () => cancelAnimationFrame(raf);
  }, [updateNodeInternals, pendingRef]);
  return null;
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
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const [measuredSizes, setMeasuredSizes] = useState<
    Record<string, { width: number; height: number }>
  >({});
  // Node ids whose measured size changed this tick but React Flow doesn't
  // know about yet — our own position-patching effect corrects a node's
  // `position` directly (bypassing React Flow's normal flow), but edges
  // read handle coordinates from React Flow's own internal "handle bounds"
  // cache, which only React Flow's `updateNodeInternals` refreshes. Without
  // draining this into that call (see NodeInternalsSync below, rendered
  // inside ReactFlowProvider since the hook needs that context), every edge
  // stays permanently anchored to whatever fallback size was measured on a
  // node's very first render — visible as a cramped, multi-bend connector
  // right out of the Source card that never self-corrects.
  const pendingInternalsUpdateRef = useRef<Set<string>>(new Set());
  // Faster, non-polled sibling of pendingInternalsUpdateRef for group
  // frames specifically — see NodeInternalsSync's doc comment.
  const updateNodeInternalsDirectRef = useRef<((ids: string[]) => void) | null>(null);
  // Effective (lerped) vertical space each card needs below it before its
  // own children start, keyed by that card's node id — derived from
  // measuredSizes each tick (see the measuring effect below). Deliberately
  // per-node rather than per-depth: a branch's y only ever depends on its
  // own ancestors' heights, never on an unrelated branch's card that
  // happens to sit at the same depth. lib/layout.ts's layoutNodes turns
  // this into each node's absolute Y by walking its own ancestor chain.
  // Seeded from ROW_HEIGHT_FLOOR for every node already in the initial graph
  // (not {}) — the measuring rAF loop below needs at least one frame to
  // populate real heights, and until it does, layoutNodes.ts falls back to
  // `nodeHeights[parentId] ?? 0`. A `{}` seed meant every child briefly
  // rendered at the exact same y as its parent on first paint (zero gap),
  // which forced getSmoothStepPath into a cramped multi-bend "staircase"
  // route for the very first frame — most visible right at the Source card,
  // since it's the one guaranteed to already have children on canvas load.
  const [nodeRowHeights, setNodeRowHeights] = useState<Record<string, number>>(() =>
    Object.fromEntries(initialGraph.nodes.map((n) => [n.id, ROW_HEIGHT_FLOOR]))
  );
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
  // The most recently grabbed path — rendered above every other frame (see
  // computeGroupFrames's zIndex), so dropping one path onto another always
  // leaves the one you were actually holding on top, not whichever happens
  // to sit later in the array.
  const [topGroupId, setTopGroupId] = useState<string | null>(null);
  // Anchors for drag-delta math: the un-offset (pure auto-layout) position of
  // every card and every frame, refreshed by the patch effect below. Reading
  // "current position minus this anchor" gives an absolute offset directly
  // from React Flow's reported drag position — no dependency on the previous
  // render's node array, so drag handling can't race a stale closure.
  const basePositionsRef = useRef<{
    nodes: Record<string, { x: number; y: number }>;
    frames: Record<string, { x: number; y: number }>;
  }>({ nodes: {}, frames: {} });
  // Last live position seen for each dragged node — @reactflow/core's own
  // drag-stop change carries `dragging: false` but deliberately OMITS
  // `.position` (see updateNodePositions in its source, called with
  // `positionChanged=false` at drag end), so the drop point has to be
  // remembered from the preceding `dragging: true` ticks. Without this, the
  // final "commit the offset" step in handleNodesChange below had nothing
  // to commit and silently no-opped — the frame LOOKED dropped where you
  // left it, but the very next unrelated re-render snapped it straight back
  // to its un-offset auto-layout position, since groupOffsets/nodeOffsets
  // never actually picked up the drop.
  const lastDragPositionRef = useRef<Record<string, { x: number; y: number }>>({});

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

  // Clicking an option card just changes which one is picked — no async
  // work, no commitment yet (see lib/mockAI.ts's getOptionResponse doc
  // comment: changing a selection is not a note). `picked` lives on the
  // node's own data, not local component state, so a `refine_in_place` note
  // on the choice card can clear it when the option set regenerates.
  const handleSelectOption = useCallback((nodeId: string, index: number) => {
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.map((n) => (n.id === nodeId ? { ...n, picked: index } : n)),
    }));
  }, []);

  const handleConfirmOption = useCallback(
    async (nodeId: string) => {
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (!node || node.picked == null) return;
      // A choice card holds at most one live branch at a time — confirming a
      // (possibly different) option discards whatever was previously built
      // on this card, the same hard-removal treatment flip() already gives
      // an abandoned framing, so the two ways of branching from a choice
      // card can't both leave a card live at once.
      const toRemove = collectDescendantIds(nodeId, graph.nodes);
      setPendingNodeIds((prev) => new Set(prev).add(nodeId));
      const { nodes: newNodes, edges: newEdges } = await withMinDuration(
        getOptionResponse(node, node.picked, feedbackContext),
        ACTION_LOADING_MS
      );
      // getOptionResponse always returns the picked branch first, with its
      // rebuttal counter-argument (if any) second — picking an A/B/C choice
      // is the user's decision, same as "Prefer this option", so the branch
      // is auto-selected. The counter-argument alongside it is the system's
      // own pushback, not something the user chose, so it stays unselected
      // until the user picks (prefers) it instead.
      const carriedNodes = newNodes.map((n, i) => (i === 0 ? { ...n, selected: true } : n));
      setGraph((g) => ({
        nodes: [...g.nodes.filter((n) => !toRemove.has(n.id)), ...carriedNodes],
        edges: [...g.edges.filter((e) => !toRemove.has(e.target)), ...newEdges],
      }));
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

  /**
   * Context-note submission — the classifier decides between the two
   * intents, and each combination of card type × intent maps onto a
   * different mock call (see lib/mockAI.ts). This is the ONE place that
   * decision fans out from, so the fan-out itself never has to be
   * re-derived at any call site.
   */
  const handleSubmitNote = useCallback(
    async (nodeId: string, rawNote: string) => {
      const note = rawNote.trim();
      if (!note) return;
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const intent = classifyNote(note);
      setPendingNodeIds((prev) => new Set(prev).add(nodeId));

      if (node.cardType === "choice") {
        if (intent === "branch_new_direction") {
          // Skip the question entirely — the user's own words become the
          // accepted framing (echoed back, not silently swapped in — see
          // rx-node.tsx's userFraming block). The choice card itself keeps
          // whatever revision/options it already had; only userFraming and
          // origin change on it. Same one-live-branch invariant as
          // handleConfirmOption — discard whatever was built on a prior pick
          // or a prior framing before adding this one.
          const toRemove = collectDescendantIds(nodeId, graph.nodes);
          setGraph((g) => ({
            nodes: g.nodes
              .filter((n) => !toRemove.has(n.id))
              .map((n) =>
                n.id === nodeId
                  ? { ...n, userFraming: note, origin: { intent, note } as CardOrigin, picked: null }
                  : n
              ),
            edges: g.edges.filter((e) => !toRemove.has(e.target)),
          }));
          const { node: newNode, edge: newEdge } = await withMinDuration(
            branchFromChoiceFraming(node, note, feedbackContext),
            ACTION_LOADING_MS
          );
          const carried: CanvasNodeData = {
            ...newNode,
            selected: newNode.kind !== "clarifying-question",
          };
          setGraph((g) => ({ nodes: [...g.nodes, carried], edges: [...g.edges, newEdge] }));
          carryNodeOffset(nodeId, carried.id);
        } else {
          const newOptions = await withMinDuration(
            refineChoiceOptions(node, note, feedbackContext),
            ACTION_LOADING_MS
          );
          setGraph((g) => ({
            ...g,
            nodes: g.nodes.map((n) => (n.id === nodeId ? pushChoiceRevision(n, newOptions, note) : n)),
          }));
        }
      } else {
        if (intent === "branch_new_direction") {
          const { node: newNode, edge: newEdge } = await withMinDuration(
            branchFromNote(node, note, feedbackContext),
            ACTION_LOADING_MS
          );
          const carried: CanvasNodeData = {
            ...newNode,
            selected: newNode.kind !== "clarifying-question",
          };
          setGraph((g) => ({ nodes: [...g.nodes, carried], edges: [...g.edges, newEdge] }));
          carryNodeOffset(nodeId, carried.id);
        } else {
          const { title, body } = await withMinDuration(
            refinePlainCard(node, note, feedbackContext),
            ACTION_LOADING_MS
          );
          setGraph((g) => ({
            ...g,
            nodes: g.nodes.map((n) => (n.id === nodeId ? pushPlainRevision(n, title, body, note) : n)),
          }));
        }
      }

      setPendingNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    },
    [graph, feedbackContext, carryNodeOffset]
  );

  // "Restore this version" — lives inside the origin strip's `see note`
  // panel, right next to the previous version it's restoring. A plain
  // revert: no branching, no note re-application, unlike flip() below.
  const handleRestoreVersion = useCallback((nodeId: string) => {
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.map((n) => (n.id === nodeId ? restoreVersion(n) : n)),
    }));
  }, []);

  /**
   * "I didn't mean that" — re-runs the SAME note under the OPPOSITE
   * interpretation. Never a plain undo: every press re-applies the note, so
   * it always produces a fresh side effect (a restored revision that then
   * branches, or a removed branch that then revises its parent) rather than
   * walking backward through history.
   */
  const handleFlip = useCallback(
    async (nodeId: string) => {
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (!node) return;

      // A choice card that took the user's own framing — undo that,
      // regenerate options instead. The continuation built on the
      // abandoned framing is removed outright (there's no revision to hang
      // staleness off of here, since taking a framing doesn't bump
      // activeRevision).
      if (node.cardType === "choice" && node.userFraming != null) {
        const note = node.userFraming;
        const toRemove = collectDescendantIds(nodeId, graph.nodes);
        setPendingNodeIds((prev) => new Set(prev).add(nodeId));
        setGraph((g) => ({
          nodes: g.nodes
            .filter((n) => !toRemove.has(n.id))
            .map((n) => (n.id === nodeId ? { ...n, userFraming: null, origin: null, picked: null } : n)),
          edges: g.edges.filter((e) => !toRemove.has(e.target)),
        }));
        const newOptions = await withMinDuration(
          refineChoiceOptions(node, note, feedbackContext),
          ACTION_LOADING_MS
        );
        setGraph((g) => ({
          ...g,
          nodes: g.nodes.map((n) => (n.id === nodeId ? pushChoiceRevision(n, newOptions, note) : n)),
        }));
        setPendingNodeIds((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
        return;
      }

      // This card was refined in place — restore the previous revision,
      // then branch from it using the same note under the opposite
      // interpretation.
      if (node.origin?.intent === "refine_in_place") {
        const note = node.origin.note;
        setPendingNodeIds((prev) => new Set(prev).add(nodeId));
        const restored = restoreVersion(node);
        setGraph((g) => ({
          ...g,
          nodes: g.nodes.map((n) => (n.id === nodeId ? restored : n)),
        }));

        if (restored.cardType === "choice") {
          setGraph((g) => ({
            ...g,
            nodes: g.nodes.map((n) =>
              n.id === nodeId
                ? { ...n, userFraming: note, origin: { intent: "branch_new_direction", note }, picked: null }
                : n
            ),
          }));
          const { node: newNode, edge: newEdge } = await withMinDuration(
            branchFromChoiceFraming(restored, note, feedbackContext),
            ACTION_LOADING_MS
          );
          const carried: CanvasNodeData = {
            ...newNode,
            selected: newNode.kind !== "clarifying-question",
          };
          setGraph((g) => ({ nodes: [...g.nodes, carried], edges: [...g.edges, newEdge] }));
          carryNodeOffset(nodeId, carried.id);
        } else {
          const { node: newNode, edge: newEdge } = await withMinDuration(
            branchFromNote(restored, note, feedbackContext),
            ACTION_LOADING_MS
          );
          const carried: CanvasNodeData = {
            ...newNode,
            selected: newNode.kind !== "clarifying-question",
          };
          setGraph((g) => ({ nodes: [...g.nodes, carried], edges: [...g.edges, newEdge] }));
          carryNodeOffset(nodeId, carried.id);
        }
        setPendingNodeIds((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
        return;
      }

      // This card IS a branch itself — remove it (and anything the user
      // built further on it), then revise the PARENT using the same note.
      if (node.origin?.intent === "branch_new_direction" && node.parentId) {
        const note = node.origin.note;
        const parentId = node.parentId;
        const parent = graph.nodes.find((n) => n.id === parentId);
        if (!parent) return;
        const toRemove = collectDescendantIds(nodeId, graph.nodes);
        toRemove.add(nodeId);
        setPendingNodeIds((prev) => new Set(prev).add(parentId));
        setGraph((g) => ({
          nodes: g.nodes.filter((n) => !toRemove.has(n.id)),
          edges: g.edges.filter((e) => !toRemove.has(e.target) && !toRemove.has(e.source)),
        }));

        if (parent.cardType === "choice") {
          const newOptions = await withMinDuration(
            refineChoiceOptions(parent, note, feedbackContext),
            ACTION_LOADING_MS
          );
          setGraph((g) => ({
            ...g,
            nodes: g.nodes.map((n) => (n.id === parentId ? pushChoiceRevision(n, newOptions, note) : n)),
          }));
        } else {
          const { title, body } = await withMinDuration(
            refinePlainCard(parent, note, feedbackContext),
            ACTION_LOADING_MS
          );
          setGraph((g) => ({
            ...g,
            nodes: g.nodes.map((n) => (n.id === parentId ? pushPlainRevision(n, title, body, note) : n)),
          }));
        }
        setPendingNodeIds((prev) => {
          const next = new Set(prev);
          next.delete(parentId);
          return next;
        });
      }
    },
    [graph, feedbackContext, carryNodeOffset]
  );

  // Accept-and-continue: appends a brand new child node one depth below the
  // preferred card — the preferred card itself stays fully visible (never
  // hidden the way a revision hides the node it replaces). It stays in the
  // same path as the card it continues — a suggestion chain is one path no
  // matter how many times it's picked, revised, or preferred; only a
  // counter-argument ever starts its own separate path (see mockAI.ts).
  // "Prefer this option" IS the user's decision for the report, not a
  // separate exploratory step from it — the new continuation is
  // auto-selected (silently — no badge/border on the card itself, see
  // rx-node.tsx) so the report still knows which cards to include without
  // the user ever re-selecting anything. Except when depth cap is reached:
  // getPreferredContinuation then returns the clarifying-question card
  // itself, which is never a "recommendation" to carry into the report —
  // only the real continuation cards should ever end up `selected`.
  const handlePreferOption = useCallback(
    async (nodeId: string) => {
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      setPendingNodeIds((prev) => new Set(prev).add(nodeId));
      const { node: newNode, edge: newEdge } = await withMinDuration(
        getPreferredContinuation(node, feedbackContext),
        ACTION_LOADING_MS
      );
      const carried: CanvasNodeData = {
        ...newNode,
        selected: newNode.kind !== "clarifying-question",
      };
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

  const hasSelectedNode = graph.nodes.some((n) => n.selected);
  const selectedCount = graph.nodes.filter((n) => n.selected).length;
  // A user who only ever follows the one path the canvas first suggests
  // tends to keep following it rather than doubling back to try another —
  // finalizing with a single selection (and no like/dislike feedback given
  // anywhere) is the tunneling case the report's Section 02/03 read sparse
  // for. This is a one-time confirmation, not a hard block.
  const feedbackCount = graph.nodes.filter((n) => n.feedback).length;
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);

  function handleFinalizeClick() {
    if (selectedCount < 2 && feedbackCount === 0) {
      setShowFinalizeConfirm(true);
      return;
    }
    onFinalize(graph);
  }

  // Rebuild React Flow nodes/edges whenever the domain graph or pending set
  // changes. Cards are placed at their RAW auto-layout position here — drag
  // offsets are applied by the patch effect below, not here, so dragging
  // (which changes groupOffsets/nodeOffsets on every pointer move) never
  // recreates these `data` objects and retriggers their mount-in animation.
  useEffect(() => {
    const { visibleNodes, byId } = resolveVisibleGraph(graph);
    const rawPositions = layoutNodes(visibleNodes, nodeRowHeightsRef.current);
    const visibleById = new Map(visibleNodes.map((n) => [n.id, n]));
    // Cards whose id shows up as someone else's (visible) parentId already
    // have a continuation below them — the click-to-select interaction on
    // them doesn't change (still a legitimate way to also include a card
    // the user never continued from), but the card visibly stops looking
    // like the live tip of its path.
    const continuedIds = new Set(
      visibleNodes.map((n) => n.parentId).filter((pid): pid is string => pid != null)
    );

    const nextNodes: Node<RxNodeData | GroupFrameNodeData>[] = visibleNodes.map((n) => {
      const original = byId.get(n.id) as CanvasNodeData;
      const predecessor = original.previousVersionId
        ? byId.get(original.previousVersionId) ?? null
        : null;
      // The clarifying-question card's own conclusion only reads choices,
      // likes, and dislikes made along the path that led to it, not
      // anything preferred/liked/disliked anywhere else on the canvas —
      // the "based on what you picked" line shouldn't cite a theme, or a
      // count, from a path the user never went down. It's purely
      // informational copy now: reaching this card at all already means
      // the user preferred their way here, so "View report" is never
      // gated on it (see rx-node.tsx).
      const pathAncestors =
        original.kind === "clarifying-question" ? getPathAncestors(n.parentId, visibleById) : null;
      const pathSelectedCount = pathAncestors ? pathAncestors.filter((a) => a.selected).length : selectedCount;
      const pathFeedback = pathAncestors ? deriveFeedbackContext(pathAncestors) : undefined;
      return {
        id: n.id,
        type: "rxNode",
        position: rawPositions[n.id] ?? { x: 0, y: 0 },
        data: {
          nodeData: original,
          pending: pendingNodeIds.has(n.id),
          predecessor,
          hasContinuation: continuedIds.has(n.id),
          onSelectToggle: handleSelectToggle,
          onSelectOption: handleSelectOption,
          onConfirmOption: handleConfirmOption,
          onFeedbackToggle: handleFeedbackToggle,
          onPreferOption: handlePreferOption,
          onSubmitNote: handleSubmitNote,
          onRestoreVersion: handleRestoreVersion,
          onFlip: handleFlip,
          downstreamCount: countVisibleDownstream(n.id, visibleNodes),
          onViewReport: () => onFinalizeRef.current(graph),
          selectedCount: pathSelectedCount,
          pathFeedback,
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
    selectedCount,
    handleSelectToggle,
    handleSelectOption,
    handleConfirmOption,
    handleFeedbackToggle,
    handlePreferOption,
    handleSubmitNote,
    handleRestoreVersion,
    handleFlip,
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
        // A group frame's own geometry is entirely DERIVED from its members'
        // positions/sizes (computeGroupFrames) — measuredSizes is never read
        // for a `frame-` id, so tracking it here only risked flagging a
        // subpixel width/height rounding wobble as a "real" size change on
        // every drag tick, which drained into updateNodeInternals below and
        // made React Flow invalidate/rebuild the edge attached to that
        // frame's Handle mid-drag (the "connectors look like they're
        // rebuilding" bug) — for geometry that was never actually changing.
        if (!nodeId || nodeId.startsWith("frame-")) return;
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
            pendingInternalsUpdateRef.current.add(nodeId);
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

  // The expensive part of layout — full structural placement plus
  // cross-frame overlap avoidance — memoized separately from the offset
  // application below. This is what used to cause a dragged frame (and any
  // OTHER frame it happened to graze) to visibly jump mid-gesture: it lived
  // inside the same effect that re-ran on every single `groupOffsets`/
  // `nodeOffsets` update, i.e. on every pointer-move of a drag, so React
  // Flow's own smooth native drag tracking was fighting a full
  // layoutNodes + resolveFrameOverlaps recompute on every tick — and
  // resolveFrameOverlaps in particular can shift a DIFFERENT frame's
  // position as soon as the dragged one's (still-structural, pre-offset)
  // bounds graze it, which reads as something jumping out from under the
  // cursor. None of this needs to happen at drag speed — it only needs to
  // reflect the current `graph`/`measuredSizes`/`nodeRowHeights`, which
  // don't change mid-drag, so it's now a useMemo instead of effect state:
  // dragging only re-runs the cheap offset-application effect further down.
  const autoLayout = useMemo(() => {
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

    // Drag-delta math anchors off the auto (avoidance-corrected) position,
    // not the raw structural one — otherwise starting a drag on a path that
    // got auto-nudged would jump by the avoidance amount on the first move.
    const autoFrames = computeGroupFrames(visibleNodes, autoPositions, measuredSizes);
    const autoFramePositions: Record<string, { x: number; y: number }> = {};
    for (const f of autoFrames) {
      autoFramePositions[(f.data as GroupFrameNodeData).groupId] = f.position;
    }

    return { visibleNodes, autoPositions, autoFramePositions };
  }, [graph, measuredSizes, nodeRowHeights]);

  // Sole writer of basePositionsRef, the un-offset anchor drag math reads
  // from — updates whenever the structural layout above changes, never on a
  // drag tick itself (autoLayout's own deps don't include groupOffsets/
  // nodeOffsets), so a drag's delta math always anchors off a stable base.
  useEffect(() => {
    basePositionsRef.current = {
      nodes: autoLayout.autoPositions,
      frames: autoLayout.autoFramePositions,
    };
  }, [autoLayout]);

  // Kept out of the main rebuild effect so dragging/measuring/hovering never
  // recreates a card's `data` object (which would retrigger its mount-in
  // animation) — this effect only ever patches `position` on existing nodes,
  // plus geometry/hover state on the groupFrame nodes. Cheap on purpose: it
  // just applies the current drag offsets to the memoized auto-layout above,
  // so it can re-run on every drag tick (groupOffsets/nodeOffsets change)
  // without redoing the expensive structural recompute — see autoLayout.
  useEffect(() => {
    const { visibleNodes, autoPositions } = autoLayout;

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

    const groupFrames = computeGroupFrames(visibleNodes, adjustedPositions, measuredSizes, topGroupId);
    const framesById = new Map(groupFrames.map((f) => [f.id, f]));

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
    // Every fresh object pushed for a frame below wipes React Flow's own
    // cached width/height for it (see the comment above) — a card gets this
    // closed again by the measuring loop's own updateNodeInternals call, but
    // frames are excluded from that loop (their SIZE is derived, never
    // actually needs remeasuring). Their POSITION still gets pushed as a
    // fresh object on every drag tick though, and each push reopens the
    // same width/height gap — if an edge attached to this frame renders
    // while it's open, EdgeRenderer's validity check fails and the edge
    // unmounts, then remounts (replaying its entrance fade) once the gap
    // closes. Collected here and flushed via NodeInternalsSync's
    // `dirtyFrameIds` prop — a same-commit effect, not the RAF-polled
    // pendingInternalsUpdateRef — so the gap closes before the next paint
    // instead of up to one animation frame later.
    const touchedFrameIds: string[] = [];

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
            n.style?.height === nextFrame.style?.height &&
            n.style?.zIndex === nextFrame.style?.zIndex;
          const nextFrameData = nextFrame.data as GroupFrameNodeData;
          const sameData =
            currData.active === active &&
            currData.originTitle === nextFrameData.originTitle &&
            currData.onHoverChange === setHoveredGroupId;
          if (sameGeometry && sameData) return n;
          changed = true;
          touchedFrameIds.push(n.id);
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
        // A card needs the same top-of-stack treatment as its own frame —
        // the frame's zIndex alone only lifts its (mostly empty) background
        // chrome, not the actual card content sitting inside it, which
        // still stacked by plain array order otherwise. That's why dragging
        // one path onto another looked one-directional: whichever path's
        // cards happened to come later in `visibleNodes` always "won" the
        // overlap, regardless of which one you'd actually just picked up.
        const cardGroupId = (n.data as RxNodeData).nodeData.groupId;
        const nextZIndex = cardGroupId && cardGroupId === topGroupId ? 10 : 0;
        const positionChanged = !!pos && (n.position.x !== pos.x || n.position.y !== pos.y);
        const zIndexChanged = (n.style?.zIndex ?? 0) !== nextZIndex;
        if (!positionChanged && !zIndexChanged) return n;
        changed = true;
        return {
          ...n,
          position: pos ?? n.position,
          style: { ...n.style, zIndex: nextZIndex },
        };
      });
      if (changed) forceHoverRecompute();
      return changed ? next : nodes;
    });
    if (touchedFrameIds.length > 0) {
      updateNodeInternalsDirectRef.current?.(touchedFrameIds);
    }
  }, [autoLayout, groupOffsets, nodeOffsets, measuredSizes, hoveredGroupId, topGroupId, setRfNodes]);

  // Dragging a group frame moves every card in its path together; dragging a
  // single card nudges just that card (still inside its path — see
  // computeGroupFrames). Both are computed as an ABSOLUTE offset from each
  // element's un-offset auto-layout anchor (basePositionsRef), not as an
  // incremental delta from the previous render's position — so this has no
  // dependency on rfNodes and can't be thrown off by a stale closure mid-drag.
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Extra position changes for a dragged frame's member cards, folded
      // into the SAME onNodesChange call as the frame's own change below —
      // moves both through React Flow's own position reducer in one batch
      // instead of leaving the cards for our groupOffsets-driven effect to
      // pick up a render later.
      //
      // Committing groupOffsets/nodeOffsets STATE, though, is deliberately
      // held back until the gesture actually ends (`dragging: false`/
      // undefined) rather than on every intermediate tick. That state is
      // what the heavier patch effect below depends on, and — per
      // @reactflow/core's own createNodeInternals, which spreads an incoming
      // node over the old internal one WITHOUT carrying its measured
      // width/height forward (see that effect's own comment) — every object
      // it pushes for the dragged frame wipes React Flow's cached
      // width/height for that node until the next remeasure. An edge whose
      // target briefly has no width/height fails EdgeRenderer's validity
      // check and renders `null` for that tick — which, since nothing was
      // there to reconcile against, mounts as a brand-new instance (fresh
      // fade-in) the next tick it's valid again. That's what "connectors
      // look like they're rebuilding" actually was: our own effect
      // recreating the dragged frame's node object on every pointer-move.
      // Committing once at drag-end still keeps the rest of the layout
      // system (staleness, avoidance, basePositions) correctly reconciled —
      // it just doesn't need to happen at pointer-move frequency, since
      // React Flow's native reducer already tracks the live position.
      const extraChanges: NodeChange[] = [];
      for (const change of changes) {
        if (change.type !== "position") continue;
        const isMidDrag = change.dragging === true;
        // Remember every live position we DO see, so the position-less
        // drag-stop change (see lastDragPositionRef's doc comment) still has
        // something to commit with.
        if (change.position) {
          lastDragPositionRef.current[change.id] = change.position;
        }
        const pos = change.position ?? lastDragPositionRef.current[change.id];
        if (!pos) continue;

        if (change.id.startsWith("frame-")) {
          const groupId = change.id.slice("frame-".length);
          const base = basePositionsRef.current.frames[groupId];
          if (!base) continue;
          const offset = { x: pos.x - base.x, y: pos.y - base.y };
          setTopGroupId((prev) => (prev === groupId ? prev : groupId));
          if (!isMidDrag) {
            setGroupOffsets((prev) => ({ ...prev, [groupId]: offset }));
          }

          const { visibleNodes } = resolveVisibleGraph(graph);
          for (const n of visibleNodes) {
            if (n.groupId !== groupId) continue;
            const nodeBase = basePositionsRef.current.nodes[n.id];
            if (!nodeBase) continue;
            const nodeOffset = nodeOffsets[n.id];
            extraChanges.push({
              id: n.id,
              type: "position",
              dragging: change.dragging,
              position: {
                x: nodeBase.x + offset.x + (nodeOffset?.x ?? 0),
                y: nodeBase.y + offset.y + (nodeOffset?.y ?? 0),
              },
            });
          }
        } else {
          const base = basePositionsRef.current.nodes[change.id];
          if (!base) continue;
          if (!isMidDrag) {
            setNodeOffsets((prev) => ({
              ...prev,
              [change.id]: { x: pos.x - base.x, y: pos.y - base.y },
            }));
          }
        }
      }
      onNodesChange(extraChanges.length > 0 ? [...changes, ...extraChanges] : changes);
    },
    [onNodesChange, graph, nodeOffsets]
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
    <div className="flex h-full flex-col bg-background">
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
            onClick={handleFinalizeClick}
          >
            <Send className="h-3.5 w-3.5" />
            Finalize
          </Button>
        </div>
      </header>

      <Dialog open={showFinalizeConfirm} onOpenChange={setShowFinalizeConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Finalize with just one recommendation?</DialogTitle>
            <DialogDescription>
              You&rsquo;ve selected one path and haven&rsquo;t reacted to any cards. Exploring
              another suggestion, or liking/disliking a few, gives your report more to work with.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowFinalizeConfirm(false)}>
              Keep exploring
            </Button>
            <Button
              variant="cta"
              size="sm"
              onClick={() => {
                setShowFinalizeConfirm(false);
                onFinalize(graph);
              }}
            >
              Finalize anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

            <NodeInternalsSync pendingRef={pendingInternalsUpdateRef} directRef={updateNodeInternalsDirectRef} />

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
      </div>
    </div>
  );
}
