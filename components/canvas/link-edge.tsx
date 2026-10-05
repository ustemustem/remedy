"use client";

import { EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "reactflow";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { IssueLinkType } from "@/lib/types";

/**
 * A link between two issues (docs/ideas/dock-functions.md, Link): from the
 * newer issue's quote to the older one's. The same dashed "doctor's note" line
 * as the tree edges, with a chip at its midpoint that names the link type.
 * The chip is the edit point: change the type or remove the link.
 */

export const LINK_LABEL: Record<IssueLinkType, string> = {
  "follows-up": "Follows up",
  "digs-into": "Digs into",
};

const LINK_HINT: Record<IssueLinkType, string> = {
  "follows-up": "Builds on what you tried for that issue",
  "digs-into": "Asks whether this is the cause of that issue",
};

export interface LinkEdgeData {
  type: IssueLinkType;
  /** The older issue's number, for the chip ("Follows up · Issue 1"). */
  toNumber: number;
  onChangeType: (type: IssueLinkType) => void;
  onRemove: () => void;
}

export function LinkEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<LinkEdgeData>) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 4,
  });
  if (!data) return null;
  const color = "color-mix(in srgb, var(--foreground) 45%, transparent)";

  return (
    <>
      <g className="animate-in fade-in-0 duration-500">
        <path d={path} fill="none" style={{ stroke: color, strokeWidth: 1.5, strokeDasharray: "4 4" }} />
        <circle cx={sourceX} cy={sourceY} r={3} fill={color} />
        <circle cx={targetX} cy={targetY} r={3} fill={color} />
      </g>
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "all" }}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 rounded-full border border-border bg-[#fbfcfb] px-2 py-0.5 font-mono text-[10.5px] font-bold tracking-wide whitespace-nowrap text-muted-foreground uppercase shadow-sm transition-colors hover:text-foreground"
              >
                {LINK_LABEL[data.type]} · Issue {data.toNumber}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-64">
              {(Object.keys(LINK_LABEL) as IssueLinkType[]).map((t) => (
                <DropdownMenuItem
                  key={t}
                  onSelect={() => data.onChangeType(t)}
                  className="flex flex-col items-start gap-0"
                >
                  <span className="text-xs font-medium text-foreground">
                    {LINK_LABEL[t]}
                    {t === data.type ? " ✓" : ""}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{LINK_HINT[t]}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={data.onRemove} className="text-xs">
                Remove link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
