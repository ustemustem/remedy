"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Reveals `text` word-by-word, like a streamed LLM response, instead of
 * popping in all at once. Runs once per mount — since each node keeps a
 * stable React Flow id for its lifetime, this naturally plays only when a
 * node is first created, not on every re-render.
 */
export function TypewriterText({
  text,
  wordDelayMs = 45,
  startDelayMs = 0,
  unit = "word",
}: {
  text: string;
  /** Delay per token — per word by default, or per character when unit="char". */
  wordDelayMs?: number;
  /** Wait this long before the reveal begins — for staggering a list of items. */
  startDelayMs?: number;
  /** "word" reads like a streamed LLM response; "char" types letter by letter. */
  unit?: "word" | "char";
}) {
  // Split on whitespace but keep the whitespace tokens so spacing survives.
  const tokens = useMemo(
    () => (unit === "char" ? Array.from(text) : text.split(/(\s+)/)),
    [text, unit]
  );
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(startDelayMs <= 0);

  useEffect(() => {
    if (started) return;
    const timer = setTimeout(() => setStarted(true), startDelayMs);
    return () => clearTimeout(timer);
  }, [started, startDelayMs]);

  useEffect(() => {
    if (!started) return;
    if (count >= tokens.length) return;
    const timer = setTimeout(() => setCount((c) => c + 1), wordDelayMs);
    return () => clearTimeout(timer);
  }, [started, count, tokens.length, wordDelayMs]);

  const done = count >= tokens.length;

  return (
    <>
      {tokens.slice(0, count).join("")}
      {!done && (
        <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-foreground/40 align-middle" />
      )}
    </>
  );
}
