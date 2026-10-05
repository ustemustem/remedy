"use client";

import { cn } from "@/lib/utils";
import type { DashboardNeed } from "@/lib/graph";
import type { AngleId } from "@/lib/angles";
import { ANGLE_ICON } from "@/components/canvas/dock-icons";

/**
 * The Spark angles that tested a recommendation, shown inside its report
 * card (docs/ideas/dock-functions.md, Spark): who will push back, what to
 * watch out for, and the first step this week. The first step is also the
 * need's first task (lib/tasks-mock.ts).
 */
const ROWS: { id: AngleId; label: string }[] = [
  { id: "pushback", label: "Who will push back" },
  { id: "risk", label: "Watch out" },
  { id: "step", label: "First step · This week" },
];

export function AngleNotes({ need, compact = false }: { need: DashboardNeed; compact?: boolean }) {
  const angles = need.angles;
  if (!angles) return null;
  const rows = ROWS.filter((r) => angles[r.id]);
  if (rows.length === 0) return null;
  return (
    <ul className={cn("space-y-2.5 border-t border-border pt-3", compact && "space-y-1.5")}>
      {rows.map(({ id, label }) => {
        const node = angles[id]!;
        const Icon = ANGLE_ICON[id];
        return (
          <li key={id} className="flex gap-2.5">
            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-mono text-[length:var(--text-meta)] font-bold tracking-wide text-muted-foreground uppercase">
                {label}
              </p>
              <p className={cn("text-[length:var(--text-body)] font-medium text-foreground", compact && "truncate text-[length:var(--text-label)]")}>
                {node.title}
              </p>
              {!compact && (
                <p className="text-[length:var(--text-label)] text-muted-foreground">{node.body}</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
