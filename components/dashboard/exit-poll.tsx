"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const RATINGS = [1, 2, 3, 4, 5] as const;

/** Shown exactly once per completed session, right after the dashboard mounts. */
export function ExitPoll() {
  // Mounted once, when the dashboard first renders — opening on initial
  // state (rather than via an effect) is what makes this "shown exactly once".
  const [open, setOpen] = useState(true);
  const [rating, setRating] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>How useful was this?</DialogTitle>
          <DialogDescription>
            One quick rating — helps us tell if the recommendations actually landed.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <p className="text-sm text-muted-foreground">Thanks, that&rsquo;s recorded.</p>
        ) : (
          <div className="flex justify-between gap-2 py-2">
            {RATINGS.map((r) => (
              <button
                key={r}
                onClick={() => setRating(r)}
                className={cn(
                  "flex h-10 w-10 items-center justify-center border border-border font-mono text-sm text-foreground transition-colors",
                  rating === r && "border-primary bg-primary/10 text-primary"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        )}

        <DialogFooter>
          {submitted ? (
            <Button size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
          ) : (
            <Button size="sm" disabled={rating === null} onClick={() => setSubmitted(true)}>
              Submit
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
