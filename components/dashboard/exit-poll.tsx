"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const RATINGS = [1, 2, 3, 4, 5] as const;

/**
 * End-of-report feedback. Rendered inline as the last block of the report
 * (not a modal on mount) — the report is read first, the rating is asked for
 * once the user has reached the bottom.
 */
export function ExitPoll() {
  const [rating, setRating] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-[length:var(--radius-surface)] border border-border bg-card/60 px-5 py-4">
      <div className="min-w-0">
        <p className="font-mono text-[length:var(--text-meta)] font-bold uppercase tracking-wide text-primary">
          How useful was this?
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          One quick rating. It helps us tell if the recommendations actually landed.
        </p>
      </div>

      {submitted ? (
        <p className="text-sm text-muted-foreground">Thanks, that&rsquo;s recorded.</p>
      ) : (
        <div className="flex items-center gap-2">
          {RATINGS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRating(r)}
              aria-pressed={rating === r}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-[length:var(--radius-control)] border border-border font-mono text-sm text-foreground transition-[transform,border-color,background-color,color] duration-150 hover:border-primary/40 active:scale-[0.97]",
                rating === r && "border-primary bg-primary/10 text-primary"
              )}
            >
              {r}
            </button>
          ))}
          <Button
            variant="cta"
            size="sm"
            className="ml-1 transition-transform duration-150 active:scale-[0.97]"
            disabled={rating === null}
            onClick={() => setSubmitted(true)}
          >
            Submit
          </Button>
        </div>
      )}
    </section>
  );
}
