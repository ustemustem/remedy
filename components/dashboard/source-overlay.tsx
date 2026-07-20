"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DashboardNeed } from "@/lib/graph";

/** "View source" drill-down — shows exactly what on the canvas produced a need. */
export function SourceOverlay({
  need,
  onOpenChange,
}: {
  need: DashboardNeed | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={need !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {need && (
          <>
            <DialogHeader>
              <p className="font-mono text-[length:var(--text-label)] text-muted-foreground">
                canvas source · {need.node.id}
              </p>
              <DialogTitle>Where this came from</DialogTitle>
            </DialogHeader>

            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm italic text-foreground">&ldquo;{need.quote}&rdquo;</p>
              <p className="mt-1 text-[length:var(--text-label)] text-muted-foreground">
                your words, from the session
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <p className="font-mono text-[length:var(--text-meta)] font-bold uppercase tracking-wide text-primary">
                  Chosen path
                </p>
                <p className="mt-0.5 text-sm text-foreground">{need.node.title}</p>
              </div>
              {need.eliminated && (
                <div>
                  <p className="font-mono text-[length:var(--text-meta)] font-bold uppercase tracking-wide text-muted-foreground">
                    Set aside
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {need.eliminated.title}
                  </p>
                </div>
              )}
              <div>
                <p className="font-mono text-[length:var(--text-meta)] font-bold uppercase tracking-wide text-muted-foreground">
                  Revisions
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {need.revisionCount === 0
                    ? "No revisions"
                    : `${need.revisionCount} revision${need.revisionCount > 1 ? "s" : ""}`}
                </p>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
