// Shared timing helpers for async mock-AI actions that drive a shimmering
// multi-stage loading indicator (see components/kokonutui/ai-text-loading.tsx).
// Every one of these mock calls resolves at a random, unpredictable moment —
// without a floor, the UI can swap away from the loading button/card mid-cycle,
// before the viewer has ever seen the full stage sequence play out once. This
// is the single place that floor lives, so every call site pads consistently
// instead of hand-rolling its own MIN_LOADING_MS constant.

/**
 * Full duration (ms) of one shimmer cycle through every stage — the natural
 * "clean" minimum wait for an action tied to that indicator.
 */
export function loadingCycleMs(stageCount: number, interval: number): number {
  return stageCount * interval;
}

/**
 * Awaits `promise`, then also waits out whatever's left of `minMs` since this
 * call started — so the result is never applied before the loading indicator
 * has finished at least one full cycle, however fast the mock call itself
 * resolves.
 */
export async function withMinDuration<T>(promise: Promise<T>, minMs: number): Promise<T> {
  const started = Date.now();
  const result = await promise;
  const elapsed = Date.now() - started;
  if (elapsed < minMs) {
    await new Promise((resolve) => setTimeout(resolve, minMs - elapsed));
  }
  return result;
}
