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
// Fix C (animation handoff §5, short-term half): was 2100ms, arbitrary and
// unrelated to the real ~2.5-4s generateReport() promise. Aligned to
// MIN_VISIBLE_MS instead so the final "present-continuous" status can never
// appear before the point the loader is guaranteed to still be showing —
// binding it to real mockAI stage signals is the long-term fix, not done here.
const SECOND_STATUS_MS = MIN_VISIBLE_MS;
const CEILING_MS = 15000;
// Safety floor under the exit animation's animationend (rl-erase-kf runs
// 0.72s). Long enough that the animation always wins in the normal case, short
// enough that a missing animationend costs the viewer a few hundred ms rather
// than hanging the report forever.
const EXIT_FALLBACK_MS = 1100;
/** No erase animation runs under reduced motion, so don't wait for one. */
const REDUCED_EXIT_MS = 180;

const STATUS = [
  "Reviewing your session",
  "Matching the evidence",
  "Building your prescription",
] as const;

// Fix F (animation handoff §5): the ceiling timer is pushed into `timers` so
// clearTimers() on retry/unmount actually clears it too — previously it lived
// on regardless of how the race was won.
function timeoutAfter(ms: number, timers: ReturnType<typeof setTimeout>[]): Promise<never> {
  return new Promise((_, reject) => {
    const t = setTimeout(() => reject(new Error("Report generation timed out")), ms);
    timers.push(t);
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
 *
 * Fix A/D (animation handoff §5): phase transitions that correspond to a CSS
 * animation finishing (draw -> working, exit -> onReady) are driven by that
 * animation's own `animationend`, not a hand-matched fixed timeout — a fixed
 * timer starts before the CSS animation actually begins painting (React
 * commit -> style recalc -> first frame) and can fire early, cutting the
 * animation off mid-flight. `prefers-reduced-motion` never runs these
 * animations, so `animationend` never fires there — that path keeps a short
 * fallback timer.
 */
export function ReportLoader({ onReady }: { onReady: () => void }) {
  const [phase, setPhase] = useState<Phase>("draw");
  const [statusIndex, setStatusIndex] = useState(0);
  const reducedMotion = useReducedMotion();
  const attemptRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const finishedRef = useRef(false);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onReady();
  }, [onReady]);

  /** draw -> working, idempotent: whichever of the dot's animationend or the
   *  fallback timer arrives first wins, the other is a no-op. */
  const enterWorking = useCallback((attempt: number) => {
    if (attemptRef.current !== attempt) return;
    setPhase((p) => (p === "draw" ? "working" : p));
    setStatusIndex((i) => (i < 1 ? 1 : i));
  }, []);

  const beginAttempt = useCallback(() => {
    const attempt = ++attemptRef.current;
    clearTimers();
    finishedRef.current = false;

    // The dot's rl-dot-pop-kf animationend is the real signal for draw ->
    // working, but it never fires when the animation doesn't run at all
    // (prefers-reduced-motion, a throttled background tab, an animation
    // cancelled by a re-render). The timer is the floor under that, not the
    // primary path: enterWorking is idempotent, so the first one wins.
    const t1 = setTimeout(() => enterWorking(attempt), WORKING_AFTER_MS);
    const t2 = setTimeout(() => {
      if (attemptRef.current !== attempt) return;
      setStatusIndex((i) => (i < 2 ? 2 : i));
    }, SECOND_STATUS_MS);
    timersRef.current.push(t1, t2);

    withMinDuration(
      Promise.race([generateReport(), timeoutAfter(CEILING_MS, timersRef.current)]),
      MIN_VISIBLE_MS
    )
      .then(() => {
        if (attemptRef.current !== attempt) return;
        setPhase("exit");
        // Same belt and braces on the way out. finish() is guarded by
        // finishedRef, so the erase animation's animationend and this timer
        // cannot both call onReady — and the report can never hang behind an
        // animationend that is never coming.
        const t3 = setTimeout(
          () => {
            if (attemptRef.current !== attempt) return;
            finish();
          },
          reducedMotion ? REDUCED_EXIT_MS : EXIT_FALLBACK_MS
        );
        timersRef.current.push(t3);
      })
      .catch(() => {
        if (attemptRef.current !== attempt) return;
        setPhase("error");
      });
  }, [clearTimers, enterWorking, finish, reducedMotion]);

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

  // Fix E (animation handoff §5): CSS alone owns prefers-reduced-motion (see
  // the @media block in globals.css) — phase classes apply unconditionally
  // instead of also being suppressed here in JS. `reducedMotion` is kept only
  // to pick the fallback-timer path above, where no animationend will fire.
  const markClass = phase === "error" ? "rl-mark" : `rl-mark rl-${phase}`;

  function handleAnimationEnd(e: React.AnimationEvent<SVGSVGElement>) {
    if (phase === "draw" && e.animationName === "rl-dot-pop-kf") {
      enterWorking(attemptRef.current);
    } else if (phase === "exit" && e.animationName === "rl-erase-kf") {
      finish();
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-background">
      <svg
        className={markClass}
        width="88"
        height="92"
        viewBox="0 0 220 231"
        fill="none"
        aria-hidden="true"
        onAnimationEnd={handleAnimationEnd}
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
