"use client";

import type { ThemeEntry } from "@/lib/graph";
import { ThemesPopover } from "./themes-popover";
import type { CanvasNodeData } from "@/lib/types";

export function SessionSummarySection({
  nodes,
  themes,
}: {
  nodes: CanvasNodeData[];
  themes: ThemeEntry[];
}) {
  return (
    <div className="space-y-4">
      <ThemesPopover themes={themes} />
    </div>
  );
}
