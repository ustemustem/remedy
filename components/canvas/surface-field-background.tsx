"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useStoreApi, type ReactFlowState } from "reactflow";
import {
  SurfaceField,
  createSurfaceFieldController,
  type SurfaceFieldController,
  type SurfaceFieldRect,
} from "surface-field";
import { pathPoints, segmentBoxes, simplifyRoute } from "@/lib/edge-segments";

/**
 * Canvas background experiment: Surface Field (github.com/angelolibero/surface-field,
 * MIT) in place of React Flow's <Background />. The dot grid pans and zooms with
 * the canvas, every card clears the field under it, and a dragged card carries
 * its clearing with it. Toggled from the Experiments panel ("Canvas background").
 *
 * Adapted from the package's examples/react-flow/FlowWithField.tsx (written for
 * React Flow v12; this app is on v11, so the store reads differ). Differences
 * for Remedy: group frames clear the field too (no dots inside a branch's
 * frame), edges keep a thin empty band along their route, and a press on any
 * node never drops a ripple (cards and frames drag by their whole body).
 */

type SceneRect = SurfaceFieldRect & { id: string; parent: string | null };

/** The knobs the Experiments panel tunes live (see surface-field-controls.tsx). */
export type SurfaceFieldSettings = {
  /** Grid spacing, px. */
  gap: number;
  /** Radius of the pointer light, px. */
  focusRadius: number;
  /** Reach of the connecting lines, px. */
  lineRadius: number;
  /** Draw the fine lines between dots. */
  connected: boolean;
  /** Dot opacity far from the light (0–1). */
  baseOpacity: number;
  /** Dot opacity under the light (0–1). */
  maxOpacity: number;
  /** Extra empty band around each card, px (negative narrows it). */
  surfacePadding: number;
  /** How far dots move away from a resting pointer, px. */
  cursorPush: number;
  /** How far a click ripple pushes dots outward, px. */
  ripplePush: number;
  /** Share of dots that slowly dim on their own (0–1). */
  breathe: number;
  /** Let the light drift on its own when the pointer is away. */
  wander: boolean;
  /** Drop one ring from a card's centre when it first appears on the canvas. */
  arrivalRipple: boolean;
};

// Tuned by the user in the Experiments panel (2026-09-30).
export const SURFACE_FIELD_DEFAULTS: SurfaceFieldSettings = {
  gap: 20,
  focusRadius: 200,
  lineRadius: 200,
  connected: true,
  baseOpacity: 0.05,
  maxOpacity: 0.15,
  surfacePadding: 10,
  cursorPush: 2,
  ripplePush: 5,
  breathe: 0,
  wander: false,
  arrivalRipple: true,
};

/** Gap between arrival rings when several cards land on the same frame, ms. */
const ARRIVAL_STAGGER = 70;

/** Screen-space half-width of the empty band kept along every edge, px. */
const EDGE_CLEARANCE = 6;

/**
 * Every node box (cards AND their group frames) in screen space, CSS px
 * relative to the canvas root. Frames are included so no dot shows inside a
 * branch's frame, between its header bar and its cards.
 */
// Same padding canvas-screen.tsx's computeGroupFrames puts around a path's cards.
const FRAME_PAD = { x: 32, top: 64, bottom: 36 };

type FlowBox = { left: number; top: number; right: number; bottom: number };

const boxKey = (b: FlowBox) => `${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.right)},${Math.round(b.bottom)}`;

/**
 * `stale` remembers, per frame, the box it had while one of its cards was
 * dragged. React Flow drops `dragging` a render BEFORE canvas-screen re-fits
 * the frame, so without it the field would show the stale frame for one frame
 * after the drop, then jump again. A frame keeps its predicted box until its
 * real box changes.
 */
function nodeRects(
  state: ReactFlowState,
  stale: Map<string, string>,
  only?: (id: string, dragging: boolean) => boolean
): SceneRect[] {
  const [x, y, zoom] = state.transform;
  // React Flow v11: nodes live in nodeInternals, measured size is width/height,
  // and the absolute position is positionAbsolute (the example targets v12).
  const nodes = [...state.nodeInternals.values()].filter((n) => !n.hidden && n.width && n.height);
  const boxOf = (n: (typeof nodes)[number]): FlowBox => {
    const p = n.positionAbsolute ?? n.position;
    return { left: p.x, top: p.y, right: p.x + n.width!, bottom: p.y + n.height! };
  };

  // A dragged card's frame only re-fits when the drag ENDS (canvas-screen.tsx
  // commits offsets on drag-stop), so mid-drag the frame box lags behind the
  // card, then jumps on release: a large clearing jumping across the canvas,
  // which is what read as the background suddenly sliding. While a member is
  // dragged, the field uses the box the frame WILL take (its cards' live boxes
  // plus the frame padding), so there is nothing left to jump on release. The
  // stale frame's 24px header strip stays covered too, since Remedy still
  // draws it at the old spot until the drop.
  const HEADER_STRIP = 24;
  const draggingGroups = new Set<string>();
  const membersByGroup = new Map<string, FlowBox>();
  for (const n of nodes) {
    const gid = (n.data as { nodeData?: { groupId?: string } } | undefined)?.nodeData?.groupId;
    if (n.type !== "groupFrame" && gid && n.dragging) draggingGroups.add(gid);
  }
  for (const n of nodes) {
    const groupId = (n.data as { nodeData?: { groupId?: string } } | undefined)?.nodeData?.groupId;
    if (n.type === "groupFrame" || !groupId) continue;
    const b = boxOf(n);
    const padded = { left: b.left - FRAME_PAD.x, top: b.top - FRAME_PAD.top, right: b.right + FRAME_PAD.x, bottom: b.bottom + FRAME_PAD.bottom };
    const acc = membersByGroup.get(groupId);
    membersByGroup.set(
      groupId,
      acc
        ? { left: Math.min(acc.left, padded.left), top: Math.min(acc.top, padded.top), right: Math.max(acc.right, padded.right), bottom: Math.max(acc.bottom, padded.bottom) }
        : padded
    );
  }

  const rects: SceneRect[] = [];
  for (const node of nodes) {
    if (only && !only(node.id, Boolean(node.dragging))) continue;
    let b = boxOf(node);
    if (node.type === "groupFrame") {
      const gid = (node.data as { groupId?: string } | undefined)?.groupId ?? "";
      const members = membersByGroup.get(gid);
      const key = boxKey(b);
      if (draggingGroups.has(gid)) stale.set(node.id, key);
      else if (stale.has(node.id) && stale.get(node.id) !== key) stale.delete(node.id);
      if (members && stale.has(node.id)) {
        // The frame's upcoming box, plus a separate surface for its stale header.
        rects.push({
          id: `${node.id}:header`,
          parent: null,
          left: b.left * zoom + x,
          top: b.top * zoom + y,
          right: b.right * zoom + x,
          bottom: (b.top + HEADER_STRIP) * zoom + y,
          radius: 8 * zoom,
        });
        b = members;
      }
    }
    rects.push({
      id: node.id,
      parent: null,
      left: b.left * zoom + x,
      top: b.top * zoom + y,
      right: b.right * zoom + x,
      bottom: b.bottom * zoom + y,
      // Match the drawn corners: frames use --radius-surface, cards --radius-card-shaped.
      radius: (node.type === "groupFrame" ? 8 : 18) * zoom,
    });
  }
  return rects;
}

/**
 * Thin boxes along every edge's straight runs, read from the rendered SVG
 * paths (RxEdge builds its orthogonal route while rendering, so the DOM is the
 * only place the route exists). Path coordinates are flow space.
 */
function edgeRects(element: HTMLElement, state: ReactFlowState): SceneRect[] {
  const [x, y, zoom] = state.transform;
  const rects: SceneRect[] = [];
  const paths = element.querySelectorAll<SVGPathElement>(
    ".react-flow__edge path:not(.react-flow__edge-interaction)"
  );
  paths.forEach((path, p) => {
    const d = path.getAttribute("d");
    if (!d) return;
    // Ids must name the SAME run from frame to frame (the field fades new ids
    // in and bends dots toward a moved one): React Flow's own edge id, plus the
    // run's ordinal along the route's corners, never the DOM order.
    const edgeId = path.closest(".react-flow__edge")?.getAttribute("data-testid") ?? `edge-${p}`;
    const boxes = segmentBoxes(simplifyRoute(pathPoints(d)), 0);
    boxes.forEach((b, i) => {
      rects.push({
        id: `${edgeId}:${i}`,
        parent: null,
        left: b.left * zoom + x - EDGE_CLEARANCE,
        top: b.top * zoom + y - EDGE_CLEARANCE,
        right: b.right * zoom + x + EDGE_CLEARANCE,
        bottom: b.bottom * zoom + y + EDGE_CLEARANCE,
        radius: EDGE_CLEARANCE,
      });
    });
  });
  return rects;
}

/** A pane press that travels further than this is a pan, not a click, px. */
const PAN_THRESHOLD = 4;

/** Renders nothing: forwards React Flow's store (camera, node boxes, edges) to the field. */
function FieldBridge({
  controller,
  root,
  onArrive,
}: {
  controller: SurfaceFieldController;
  root: RefObject<HTMLDivElement | null>;
  /** A card appeared (field-box px of its centre): the host may drop a ring there. */
  onArrive?: (x: number, y: number) => void;
}) {
  const store = useStoreApi();
  // Read through a ref so a new callback never re-runs the bridge effect.
  const onArriveRef = useRef(onArrive);
  useEffect(() => {
    onArriveRef.current = onArrive;
  }, [onArrive]);

  useEffect(() => {
    const element = root.current;
    if (!element) return;

    // React Flow does not expose the pointer that started a drag, so the
    // bridge remembers the press itself. `nodeId` is the node under the press
    // (card or frame), or null on empty canvas. Footprints are viewport CSS px.
    let press: {
      pointerId: number;
      box: DOMRect;
      initial: boolean;
      nodeId: string | null;
      x: number;
      y: number;
      panning: boolean;
    } | null = null;
    const staleFrames = new Map<string, string>();
    // Visible card ids seen so far; null until the first sync, so the cards
    // already on screen at mount (a resumed session) never ring.
    let knownCards: Set<string> | null = null;

    const sync = (state: ReactFlowState) => {
      const [x, y, zoom] = state.transform;
      controller.setViewport({ x, y, zoom });
      const nodes = nodeRects(state, staleFrames);
      controller.setScene({ root: element, rects: [...nodes, ...edgeRects(element, state)] });

      // Arrival rings: a card that was not visible last sync and is now.
      const cards = new Set<string>();
      for (const n of state.nodeInternals.values()) {
        if (n.type !== "groupFrame" && !n.hidden && n.width && n.height) cards.add(n.id);
      }
      const arrived = knownCards ? [...cards].filter((id) => !knownCards!.has(id)) : [];
      if (arrived.length) {
        // Layout read only on the rare frame a card arrives.
        const { width, height } = element.getBoundingClientRect();
        for (const id of arrived) {
          const r = nodes.find((rect) => rect.id === id);
          if (!r) continue;
          const cx = (r.left + r.right) / 2;
          const cy = (r.top + r.bottom) / 2;
          if (cx >= 0 && cy >= 0 && cx <= width && cy <= height) onArriveRef.current?.(cx, cy);
        }
      }
      knownCards = cards;

      // A press on a node always owns its press: send a footprint at once, so
      // the field never lays a ripple ring under a card being picked up (that
      // ring pushing the dots is what read as the background "scattering").
      if (!press?.nodeId) return;
      const pressedId = press.nodeId;
      const inHand = new Set([pressedId]);
      for (const n of state.nodeInternals.values()) if (n.dragging) inHand.add(n.id);
      const held = nodes.filter((r) => inHand.has(r.id));
      if (!held.length) return;
      const { box } = press;
      controller.setFootprint({
        pointerId: press.pointerId,
        ids: held.map((r) => r.id),
        initial: press.initial || undefined,
        suppressRipple: true,
        rects: held.map((r) => ({
          left: box.left + r.left,
          top: box.top + r.top,
          right: box.left + r.right,
          bottom: box.top + r.bottom,
          radius: r.radius,
        })),
      });
      press.initial = false;
    };

    // Every source of change (store, edge re-routes one render later) goes
    // through one rAF, so the field gets at most one scene per frame.
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        sync(store.getState());
      });
    };
    // Only edge changes matter here (a path's `d`, an edge added or removed);
    // card content changes (the typing reveal, hover toolbars) are ignored,
    // or every one of them would cost a scene sync.
    const observer = new MutationObserver((records) => {
      const edgeChange = records.some(
        (r) =>
          r.type === "attributes" ||
          (r.target instanceof Element && r.target.closest(".react-flow__edges") !== null)
      );
      if (edgeChange) schedule();
    });
    observer.observe(element, { subtree: true, childList: true, attributes: true, attributeFilter: ["d"] });

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const node = event.target instanceof Element ? event.target.closest<HTMLElement>(".react-flow__node") : null;
      press = {
        pointerId: event.pointerId,
        box: element.getBoundingClientRect(),
        initial: true,
        nodeId: node?.dataset.id ?? null,
        x: event.clientX,
        y: event.clientY,
        panning: false,
      };
      if (press.nodeId) sync(store.getState());
    };
    // A pane press that turns into a pan must not drop a ring on release:
    // panning is a tens-a-day action, and a ripple after every pan is noise.
    // A plain click on the pane (no travel) keeps its ring.
    const onMove = (event: PointerEvent) => {
      if (!press || press.nodeId || press.panning || event.pointerId !== press.pointerId) return;
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) <= PAN_THRESHOLD) return;
      press.panning = true;
      controller.setFootprint({ pointerId: press.pointerId, rects: [], suppressRipple: true });
    };
    const onUp = (event: PointerEvent) => {
      if (press?.pointerId === event.pointerId) press = null;
    };
    element.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);

    sync(store.getState());
    // React Flow's store fires several times per pointer move during a drag;
    // the field only needs the geometry once per painted frame.
    const unsubscribe = store.subscribe(schedule);
    return () => {
      unsubscribe();
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      element.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
      controller.setScene(null);
    };
  }, [controller, root, store]);

  return null;
}

/** Draw the field in a worker (OffscreenCanvas); the package falls back to the
 *  main thread where that is not available. Module scope: a stable factory. */
const createFieldWorker = () =>
  new Worker(new URL("./surface-field.worker.ts", import.meta.url), { type: "module" });

/**
 * The field layer plus its bridge. Render it inside ReactFlowProvider, as the
 * FIRST child of the positioned box that also holds <ReactFlow>, and drop
 * <Background /> so the flow stays transparent over it.
 */
export function SurfaceFieldBackground({
  root,
  settings = SURFACE_FIELD_DEFAULTS,
}: {
  root: RefObject<HTMLDivElement | null>;
  settings?: SurfaceFieldSettings;
}) {
  // One controller per mounted field, stable across renders.
  const controller = useMemo(() => createSurfaceFieldController(), []);

  // Arrival rings: the package drops one ring each time `ripple.at` changes.
  // Cards that land together (the first-pass reveal, a pick's recommendation +
  // counter-argument) are queued a beat apart, so each gets its own ring
  // instead of the last one overwriting the rest in a single render.
  const [ripple, setRipple] = useState<{ x: number; y: number; at: number } | null>(null);
  const queueRef = useRef<{ busy: boolean; items: { x: number; y: number }[]; at: number }>({ busy: false, items: [], at: 0 });
  const arrivalOn = settings.arrivalRipple;
  const onArrive = useCallback(
    (x: number, y: number) => {
      if (!arrivalOn) return;
      const q = queueRef.current;
      q.items.push({ x, y });
      if (q.busy) return;
      q.busy = true;
      const next = () => {
        const item = q.items.shift();
        if (!item) {
          q.busy = false;
          return;
        }
        q.at += 1;
        setRipple({ x: item.x, y: item.y, at: q.at });
        window.setTimeout(next, ARRIVAL_STAGGER);
      };
      next();
    },
    [arrivalOn]
  );

  return (
    <>
      <SurfaceField
        controller={controller}
        interactionRoot={root}
        worker={createFieldWorker}
        ripple={ripple}
        gap={settings.gap}
        focusRadius={settings.focusRadius}
        lineRadius={settings.lineRadius}
        connected={settings.connected}
        baseOpacity={settings.baseOpacity}
        maxOpacity={settings.maxOpacity}
        surfacePadding={settings.surfacePadding}
        tint={0}
        breathe={settings.breathe}
        wander={settings.wander}
        cursorPush={settings.cursorPush}
        ripplePush={settings.ripplePush}
        // Neutral gray, same family as the old dot color (--border / --muted-foreground).
        style={{ position: "absolute", inset: 0, color: "var(--muted-foreground)" }}
      />
      <FieldBridge controller={controller} root={root} onArrive={onArrive} />
    </>
  );
}

/**
 * The same field without React Flow. Used behind the chat entry screen, so
 * the ground there matches the canvas. `surface` is the one element the field
 * clears around, as it does around a card on the canvas (the chat box). The
 * pointer still lights the field and a press still drops a ripple.
 */
export function StandaloneSurfaceField({
  root,
  surface,
  settings = SURFACE_FIELD_DEFAULTS,
}: {
  root: RefObject<HTMLElement | null>;
  surface?: RefObject<HTMLElement | null>;
  settings?: SurfaceFieldSettings;
}) {
  const controller = useMemo(() => createSurfaceFieldController(), []);

  // Keep the surface's box in the scene: on mount, and whenever the page or
  // the box resizes (the chat box grows as the user types) or the page scrolls.
  useEffect(() => {
    const rootEl = root.current;
    const surfaceEl = surface?.current;
    if (!rootEl || !surfaceEl) return;
    const sync = () => {
      const r = rootEl.getBoundingClientRect();
      const b = surfaceEl.getBoundingClientRect();
      const radius = parseFloat(getComputedStyle(surfaceEl).borderTopLeftRadius) || 0;
      controller.setScene({
        root: rootEl,
        rects: [
          {
            id: "surface",
            parent: null,
            left: b.left - r.left,
            top: b.top - r.top,
            right: b.right - r.left,
            bottom: b.bottom - r.top,
            radius,
          },
        ],
      });
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(rootEl);
    observer.observe(surfaceEl);
    rootEl.addEventListener("scroll", sync, { passive: true });
    return () => {
      observer.disconnect();
      rootEl.removeEventListener("scroll", sync);
      controller.setScene(null);
    };
  }, [controller, root, surface]);

  return (
    <SurfaceField
      controller={controller}
      interactionRoot={root}
      worker={createFieldWorker}
      gap={settings.gap}
      focusRadius={settings.focusRadius}
      lineRadius={settings.lineRadius}
      connected={settings.connected}
      baseOpacity={settings.baseOpacity}
      maxOpacity={settings.maxOpacity}
      surfacePadding={settings.surfacePadding}
      tint={0}
      breathe={settings.breathe}
      wander={settings.wander}
      cursorPush={settings.cursorPush}
      ripplePush={settings.ripplePush}
      style={{ position: "absolute", inset: 0, color: "var(--muted-foreground)" }}
    />
  );
}
