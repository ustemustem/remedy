"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
  type SVGProps,
} from "react";
import AITextLoading from "@/components/kokonutui/ai-text-loading";
import {
  PinConnectorDashedIcon,
  QuoteCardPlusIcon,
  SparkOrbitFromIcon,
  playSparkOrbit,
} from "./dock-icons";

/**
 * The canvas dock: the thinking tools, floating at the bottom center.
 * New issue adds another quote to the session, Link connects two quotes so
 * one issue's report reads the other's, and Spark tests the selected card
 * from another angle. Spec: docs/handoff-canvas-dock.md.
 *
 * New issue and Link need the multi-issue canvas, which is not built yet:
 * they shake and say "Coming next". Spark works today.
 *
 * Motion rule: motion only on state changes caused by a pointer. Keyboard
 * actions (N, L, S, Esc) change state with no motion.
 */

export type DockTool = "new" | "link" | "spark";
export type SparkStatus = "ready" | "no-selection" | "all-used";
/** A tool doing AI work, with the stage labels its button cycles through. */
export type DockBusy = { tool: DockTool; stages: string[] } | null;

type ToolDef = {
  id: DockTool;
  label: string;
  hint: string;
  shortcut: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Not built yet: the tool shakes and its tooltip says "Coming next". */
  soon?: boolean;
};

const TOOLS: ToolDef[] = [
  { id: "new", label: "New issue", hint: "Add another problem to this session", shortcut: "N", icon: QuoteCardPlusIcon },
  { id: "link", label: "Link", hint: "Connect two issues so one builds on the other", shortcut: "L", icon: PinConnectorDashedIcon, soon: true },
  { id: "spark", label: "Spark", hint: "See this card from another angle", shortcut: "S", icon: SparkOrbitFromIcon },
];

const SPARK_DETAIL: Record<SparkStatus, string> = {
  ready: "Pushback, risk, or a first step",
  "no-selection": "Select a card first",
  "all-used": "All three angles are open",
};

const TIP_DELAY_MS = 350;
const TIP_GRACE_MS = 300;

/** Event-time clock for the tooltip's grace period. */
const now = () => performance.now();

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function finePointer() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}
/** Shortcuts never fire while the user types or holds a modifier. */
function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t?.closest?.("input, textarea, select, [contenteditable=''], [contenteditable='true']");
}

export function CanvasDock({
  onNewIssue,
  sparkStatus,
  busy,
  onSpark,
  onEscape,
}: {
  /** Open a draft issue card (or go back to the open draft). */
  onNewIssue: (viaKey: boolean) => void;
  sparkStatus: SparkStatus;
  busy: DockBusy;
  /** Run Spark on the selected card. Called only when sparkStatus is "ready". */
  onSpark: () => void;
  /** Esc: clear the card selection. */
  onEscape: () => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const toolRefs = useRef<Record<DockTool, HTMLButtonElement | null>>({ new: null, link: null, spark: null });


  // ── Hover pill and shared tooltip.
  const [pill, setPill] = useState({ x: 0, w: 0, show: false, instant: true });
  const [tip, setTip] = useState<{ tool: DockTool | null; show: boolean; x: number; instant: boolean }>({
    tool: null,
    show: false,
    x: 0,
    instant: true,
  });
  const tipShownRef = useRef(false);
  const graceUntilRef = useRef(0);
  const showTimerRef = useRef<number | undefined>(undefined);

  const boxOf = (tool: DockTool) => {
    const el = toolRefs.current[tool];
    return el ? { x: el.offsetLeft, w: el.offsetWidth } : null;
  };

  const placePill = useCallback((tool: DockTool) => {
    const b = boxOf(tool);
    if (!b) return;
    setPill((p) => ({ x: b.x, w: b.w, show: true, instant: !p.show || reducedMotion() }));
  }, []);

  const showTip = useCallback((tool: DockTool) => {
    const b = boxOf(tool);
    if (!b) return;
    const glide = tipShownRef.current && !reducedMotion();
    tipShownRef.current = true;
    setTip({ tool, show: true, x: b.x + b.w / 2, instant: !glide });
  }, []);

  const hideAll = useCallback(() => {
    window.clearTimeout(showTimerRef.current);
    if (tipShownRef.current) graceUntilRef.current = now() + TIP_GRACE_MS;
    tipShownRef.current = false;
    setTip((t) => ({ ...t, show: false }));
    setPill((p) => ({ ...p, show: false }));
  }, []);

  function handlePointerEnter(tool: DockTool) {
    if (busy) return;
    window.clearTimeout(showTimerRef.current);
    if (finePointer()) placePill(tool);
    if (tipShownRef.current || now() < graceUntilRef.current) showTip(tool);
    else showTimerRef.current = window.setTimeout(() => showTip(tool), TIP_DELAY_MS);
  }

  // ── Reject: an unavailable tool shakes (a fill flash under reduced motion),
  // then its tooltip says why. Pointer only.
  const [rejecting, setRejecting] = useState<{ tool: DockTool; kind: "shake" | "flash"; n: number } | null>(null);
  const reject = useCallback(
    (tool: DockTool) => {
      setRejecting((r) => ({ tool, kind: reducedMotion() ? "flash" : "shake", n: (r?.n ?? 0) + 1 }));
      placePill(tool);
      showTip(tool);
    },
    [placePill, showTip]
  );

  // ── Actions.
  const run = useCallback(
    (tool: DockTool, viaKey: boolean) => {
      if (busy) return;
      const def = TOOLS.find((t) => t.id === tool)!;
      if (def.soon) {
        if (!viaKey) reject(tool);
        return;
      }
      if (tool === "new") {
        hideAll();
        onNewIssue(viaKey);
        return;
      }
      if (tool === "spark") {
        if (sparkStatus !== "ready") {
          if (!viaKey) reject(tool);
          return;
        }
        const svg = toolRefs.current.spark?.querySelector("svg");
        if (!viaKey && svg) playSparkOrbit(svg);
        hideAll(); // a busy dock shows no hover or tooltip
        onSpark();
      }
    },
    [busy, reject, sparkStatus, onSpark, onNewIssue, hideAll]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      if (e.key === "Escape") {
        onEscape();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      const tool = TOOLS.find((t) => t.shortcut.toLowerCase() === key);
      if (tool) {
        e.preventDefault();
        run(tool.id, true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [run, onEscape]);

  // Arrow keys move between tools (toolbar pattern).
  function handleRowKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const order = TOOLS.map((t) => toolRefs.current[t.id]);
    const i = order.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const next = (i + (e.key === "ArrowRight" ? 1 : -1) + order.length) % order.length;
    order[next]?.focus();
  }

  const tipDef = TOOLS.find((t) => t.id === tip.tool);
  const tipLine2 = tipDef
    ? tipDef.soon
      ? "Coming next"
      : tipDef.id === "spark"
        ? SPARK_DETAIL[sparkStatus]
        : null
    : null;

  return (
    <div className="canvas-dock">
      <div className="canvas-dock-shape" aria-hidden="true">
        <div className="canvas-dock-bg" />
      </div>

      <div className="canvas-dock-tipx" data-instant={tip.instant} style={{ transform: `translateX(${tip.x}px)` }}>
        <div className="canvas-dock-tip" role="tooltip" id="canvas-dock-tip" data-show={tip.show && !!tipDef && !busy}>
          {tipDef && (
            <>
              <div className="canvas-dock-tip-l1">{tipDef.hint}</div>
              <div className="canvas-dock-tip-l2">
                {tipLine2 && <span className="canvas-dock-tip-sub">{tipLine2}</span>}
                <kbd>{tipDef.shortcut}</kbd>
              </div>
            </>
          )}
        </div>
      </div>

      <div
        ref={rowRef}
        role="toolbar"
        aria-label="Canvas tools"
        className="canvas-dock-row"
        onPointerLeave={hideAll}
        onKeyDown={handleRowKeyDown}
      >
        <span
          className="canvas-dock-pill"
          aria-hidden="true"
          data-instant={pill.instant}
          style={{ width: pill.w, transform: `translateX(${pill.x}px)`, opacity: pill.show && !busy ? 1 : 0 }}
        />
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const thinking = busy?.tool === tool.id;
          const unavailable = tool.soon || (tool.id === "spark" && sparkStatus !== "ready");
          return (
            <button
              key={tool.id}
              ref={(el) => {
                toolRefs.current[tool.id] = el;
              }}
              type="button"
              className={thinking ? "canvas-dock-tool btn-thinking" : "canvas-dock-tool"}
              aria-disabled={unavailable || undefined}
              aria-busy={thinking || undefined}
              aria-keyshortcuts={tool.shortcut}
              aria-describedby={tip.show && tip.tool === tool.id ? "canvas-dock-tip" : undefined}
              data-thinking={thinking}
              data-reject={rejecting?.tool === tool.id ? rejecting.kind : undefined}
              onAnimationEnd={() => setRejecting(null)}
              onPointerEnter={() => handlePointerEnter(tool.id)}
              onFocus={(e) => {
                // Keyboard focus opens the tooltip with no delay.
                if (!busy && e.currentTarget.matches(":focus-visible")) showTip(tool.id);
              }}
              onBlur={hideAll}
              onClick={() => run(tool.id, false)}
            >
              {thinking && <span className="btn-sweep" aria-hidden="true" />}
              <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
              <ToolLabel label={tool.label} stages={thinking ? busy!.stages : null} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The visible label, which is also the accessible name. While the tool works
 * it morphs through the stage labels: the width eases to the widest stage,
 * and each stage swaps with a short rise and blur (AITextLoading).
 */
function ToolLabel({ label, stages }: { label: string; stages: string[] | null }) {
  const innerRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | undefined>(undefined);
  const key = stages ? stages.join("|") : label;
  useLayoutEffect(() => {
    const el = innerRef.current;
    if (el) setWidth(el.offsetWidth);
  }, [key]);
  return (
    <span
      className="canvas-dock-label"
      style={{ width, clipPath: stages ? "inset(-10px 0 -10px 0)" : undefined }}
    >
      <span ref={innerRef} className="inline-block whitespace-nowrap">
        {stages ? <AITextLoading texts={stages} interval={2000} blur stableWidth className="text-sm font-medium" /> : label}
      </span>
    </span>
  );
}
