"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { EdgeLabelRenderer, getSmoothStepPath, useStore, type EdgeProps } from "reactflow";
import type { IssueLinkType } from "@/lib/types";

/** Where a link meets a quote card, from the card's top (px): the "What you
 *  wrote" line. Shared with rx-node.tsx's link handles. */
export const LINK_ANCHOR_TOP = 60;

/**
 * A link between two issues (docs/ideas/dock-functions.md, Link): from the
 * newer issue's quote to the older one's. A solid brand-green line with a pill
 * at its midpoint: "Follows up  Issue 1 | 2/6". Hovering the pill opens a panel
 * under it (what the link means, Change, Open Issue 1). The pill itself never
 * changes size or shape; only the panel moves, with transform and opacity.
 */

export const LINK_LABEL: Record<IssueLinkType, string> = {
  "follows-up": "Follows up",
  "digs-into": "Explains it",
};

export interface LinkEdgeData {
  type: IssueLinkType;
  /** The older issue's number ("Issue 1"). */
  toNumber: number;
  /** The newer issue's number, for the panel's question. */
  fromNumber: number;
  /** Short status after the divider: "2/6" (the linked issue's tasks) or a
   *  verdict ("Likely"). Absent when there is nothing to show yet. */
  status?: string;
  /** One sentence for the panel (may carry a bold part). */
  say: ReactNode;
  /** The linked issue's task track, when it has a report. */
  tasks?: { done: number; total: number };
  /** Open the linked issue's latest report (absent when it has none). */
  onOpenIssue?: () => void;
  onChangeType: (type: IssueLinkType) => void;
  onRemove: () => void;
}

const OPEN_DELAY_MS = 120;
const CLOSE_GRACE_MS = 100;

export function LinkEdge({
  source,
  target,
  sourceX,
  sourceY: measuredSourceY,
  targetX,
  targetY: measuredTargetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<LinkEdgeData>) {
  // Both ends from the cards' real positions, not the measured handles: a new
  // card's handles are measured while it is still sliding in, which leaves one
  // end a few pixels low and puts a step under the pill.
  const sourceTop = useStore((s) => s.nodeInternals.get(source)?.positionAbsolute?.y);
  const targetTop = useStore((s) => s.nodeInternals.get(target)?.positionAbsolute?.y);
  const sourceY = sourceTop != null ? sourceTop + LINK_ANCHOR_TOP : measuredSourceY;
  const targetY = targetTop != null ? targetTop + LINK_ANCHOR_TOP : measuredTargetY;
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 4,
  });
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  if (!data) return null;

  // Hover intent: a short wait before opening, a short grace before closing,
  // so passing over the pill does not flash the panel and moving down into
  // the panel does not close it.
  const enter = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), open ? 0 : OPEN_DELAY_MS);
  };
  const leave = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setOpen(false);
      setChanging(false);
    }, CLOSE_GRACE_MS);
  };
  const green = "var(--primary)";

  return (
    <>
      <g className="animate-in fade-in-0 duration-500">
        <path d={path} fill="none" style={{ stroke: green, strokeWidth: 1.75 }} />
        <circle cx={sourceX} cy={sourceY} r={3.5} fill={green} />
        <circle cx={targetX} cy={targetY} r={3.5} fill={green} />
      </g>
      <EdgeLabelRenderer>
        <div
          className="link-pill-anchor nodrag nopan absolute"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "all" }}
          onMouseEnter={enter}
          onMouseLeave={leave}
          data-open={open}
        >
          <button
            type="button"
            className="link-pill"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            onFocus={() => setOpen(true)}
          >
            {LINK_LABEL[data.type]}
            <span className="link-pill-issue">Issue {data.toNumber}</span>
            {data.status && <span className="link-pill-status">{data.status}</span>}
          </button>

          <div className="link-pill-panel" role="dialog" aria-label={`Link to Issue ${data.toNumber}`}>
            <div className="link-pill-panel-inner">
              {changing ? (
                <>
                  <p className="link-pill-say">
                    How does Issue {data.fromNumber} relate to <b>Issue {data.toNumber}</b>?
                  </p>
                  <div className="link-pill-answers">
                    {(Object.keys(LINK_LABEL) as IssueLinkType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        data-on={t === data.type}
                        onClick={() => {
                          data.onChangeType(t);
                          setChanging(false);
                        }}
                      >
                        {LINK_LABEL[t]}
                      </button>
                    ))}
                  </div>
                  <div className="link-pill-actions">
                    <span />
                    <button type="button" className="link-pill-text danger" onClick={data.onRemove}>
                      Remove link
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="link-pill-say">{data.say}</p>
                  {data.tasks && data.tasks.total > 0 && (
                    <div className="link-pill-track" role="img" aria-label={`${data.tasks.done} of ${data.tasks.total} tasks done`}>
                      {Array.from({ length: Math.min(data.tasks.total, 8) }, (_, i) => (
                        <i
                          key={i}
                          data-on={i < Math.round((data.tasks!.done / data.tasks!.total) * Math.min(data.tasks!.total, 8))}
                        />
                      ))}
                    </div>
                  )}
                  <div className="link-pill-actions">
                    <button type="button" className="link-pill-text" onClick={() => setChanging(true)}>
                      Change
                    </button>
                    {data.onOpenIssue && (
                      <button type="button" className="link-pill-text" onClick={data.onOpenIssue}>
                        Open Issue {data.toNumber}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
