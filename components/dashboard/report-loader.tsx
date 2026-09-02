"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { generateReport } from "@/lib/mockAI";
import { withMinDuration } from "@/lib/timing";

// Canvas -> report loading transition (see animation-handoff.md). The mark
// SVG is public/logo-icon.svg's stroke + dot, redrawn inline so its two
// parts can be animated independently and a shimmer overlay can be layered
// on top (see .rl-* in app/globals.css). Path length is a fixed, precomputed
// constant (505) — NOT read from path.getTotalLength() at runtime, which in
// the reference prototype returned 0 in some render contexts and left only
// the dot animating.
const MARK_PATH =
  "M12.0017 115.739C72.0341 24.2835 74.3089 260 79.8132 88.0518C82.809 -5.5347 201.916 33.9293 141.81 106.5C81.7031 179.071 118.545 209.808 180.309 157.5";

const MIN_VISIBLE_MS = 1700;
const WORKING_AFTER_MS = 1050;
const SECOND_STATUS_MS = 2100;
const EXIT_MS = 720;
const CEILING_MS = 15000;

const STATUS = [
  "Reviewing your session",
  "Matching the evidence",
  "Building your prescription",
] as const;

function timeoutAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Report generation timed out")), ms);
  });
}

type Phase = "draw" | "working" | "exit" | "error";

/**
 * Mounted while the canvas -> report transition is in flight. Owns its own
 * async orchestration (starts `generateReport()` itself) rather than being
 * driven by a promise passed down, per the animation handoff's suggested
 * wiring. Calls `onReady()` once the exit animation has cleared.
 *
 * Timing contract: waits for the real `generateReport()` promise, never a
 * fixed animation length. `MIN_VISIBLE_MS` is a flash-prevention floor only
 * — no artificial delay is added beyond it. A `CEILING_MS` timeout or a
 * rejection both fall through to the error phase with a "Try again" retry,
 * so this can never spin silently forever.
 */
export function ReportLoader({ onReady }: { onReady: () => void }) {
  const [phase, setPhase] = useState<Phase>("draw");
  const [statusIndex, setStatusIndex] = useState(0);
  const reducedMotion = useReducedMotion();
  const attemptRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const beginAttempt = useCallback(() => {
    const attempt = ++attemptRef.current;
    clearTimers();

    const t1 = setTimeout(() => {
      if (attemptRef.current !== attempt) return;
      setPhase("working");
      setStatusIndex(1);
    }, WORKING_AFTER_MS);
    const t2 = setTimeout(() => {
      if (attemptRef.current !== attempt) return;
      setStatusIndex(2);
    }, SECOND_STATUS_MS);
    timersRef.current.push(t1, t2);

    withMinDuration(Promise.race([generateReport(), timeoutAfter(CEILING_MS)]), MIN_VISIBLE_MS)
      .then(() => {
        if (attemptRef.current !== attempt) return;
        setPhase("exit");
        const t3 = setTimeout(() => {
          if (attemptRef.current !== attempt) return;
          onReady();
        }, EXIT_MS);
        timersRef.current.push(t3);
      })
      .catch(() => {
        if (attemptRef.current !== attempt) return;
        setPhase("error");
      });
  }, [clearTimers, onReady]);

  useEffect(() => {
    beginAttempt();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on mount only, retries are explicit via the button
  }, []);

  function handleRetry() {
    setPhase("draw");
    setStatusIndex(0);
    beginAttempt();
  }

  const markClass =
    phase === "error"
      ? "rl-mark"
      : reducedMotion
        ? "rl-mark"
        : `rl-mark rl-${phase}`;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-background">
      <svg
        className={markClass}
        width="88"
        height="92"
        viewBox="0 0 220 231"
        fill="none"
        aria-hidden="true"
      >
        <path className="rl-shimmer" d={MARK_PATH} />
        <path className="rl-stroke" d={MARK_PATH} />
        <ellipse className="rl-dot" cx="207.809" cy="136" rx="11.5" ry="12" />
      </svg>

      <div role="status" aria-live="polite" aria-busy={phase !== "error"} className="text-center">
        {phase === "error" ? (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              Something went wrong generating your prescription.
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-full border border-border px-4 py-1.5 font-mono text-[length:var(--text-label)] uppercase tracking-wide text-foreground hover:border-foreground/30 motion-safe:transition-transform motion-safe:active:scale-[0.98]"
            >
              Try again
            </button>
          </div>
        ) : (
          <p className="font-mono text-[length:var(--text-label)] uppercase tracking-wide text-muted-foreground">
            {STATUS[statusIndex]}
          </p>
        )}
      </div>
    </div>
  );
}
