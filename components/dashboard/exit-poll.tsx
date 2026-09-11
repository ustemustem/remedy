"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const RATINGS = [1, 2, 3, 4, 5] as const;

/**
 * End-of-report feedback, rendered inline as the report's last block (not a
 * modal). A full-width section: prompt + description on the left, the 1–5
 * scale with end labels, and Submit anchored to the right.
 */
export function ExitPoll() {
  const [rating, setRating] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="rounded-[length:var(--radius-surface)] border border-border bg-card/50 px-6 py-6 sm:px-7">
      <p className="font-mono text-[length:var(--text-meta)] font-bold uppercase tracking-[0.08em] text-primary">
        How useful was this?
      </p>
      <p className="mt-1.5 max-w-[54ch] text-sm leading-relaxed text-muted-foreground">
        One quick rating — it tells us whether these recommendations actually landed. Your answer
        sharpens the next prescription, and it takes a second.
      </p>

      {submitted ? (
        <div className="mt-6 flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-mono text-xl font-bold text-primary">
            {rating}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Thanks — that&rsquo;s recorded.</p>
            <p className="text-[length:var(--text-meta)] text-muted-foreground">
              You rated this {rating} of 5.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-6">
          <div className="min-w-0">
            <div className="flex gap-2.5">
              {RATINGS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRating(r)}
                  aria-pressed={rating === r}
                  aria-label={`Rate ${r} of 5`}
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[length:var(--radius-control)] border font-mono text-lg transition-[transform,border-color,background-color,color] duration-150",
                    "hover:border-primary/50 active:scale-[0.96]",
                    rating === r
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              <span>Not useful</span>
              <span>Very useful</span>
            </div>
          </div>

          <Button
            variant="cta"
            size="lg"
            className="ml-auto transition-transform duration-150 active:scale-[0.97]"
            disabled={rating === null}
            onClick={() => setSubmitted(true)}
          >
            Submit rating
          </Button>
        </div>
      )}
    </section>
  );
}
