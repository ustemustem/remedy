"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { getThoughtTriggers, type ThoughtTrigger } from "@/lib/thoughtTriggers";
import { TypewriterText } from "@/components/canvas/typewriter-text";
import { HEADLINE_PROMPTS } from "@/lib/headlinePrompts";
import { INDUSTRIES, EXAMPLE_PROMPTS_BY_INDUSTRY, type Industry } from "@/lib/examplePrompts";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const TRIGGER_DEBOUNCE_MS = 3000;
const LOADING_STAGES = ["Reading…", "Extracting themes…", "Preparing canvas…"];
const LOADING_STAGE_MS = 900;
const HEADLINE_ROTATE_MS = 5000;

export function ChatEntryScreen({
  onSubmit,
  loading,
}: {
  onSubmit: (text: string) => void;
  loading: boolean;
}) {
  const [text, setText] = useState("");
  const [triggers, setTriggers] = useState<ThoughtTrigger[]>([]);
  const [loadingStage, setLoadingStage] = useState(0);
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [headlinePaused, setHeadlinePaused] = useState(false);
  const [textareaFocused, setTextareaFocused] = useState(false);
  const [industry, setIndustry] = useState<Industry>("general");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const headline = HEADLINE_PROMPTS[headlineIndex];

  // PRD 6.1 AC1: refresh Thought Triggers after a ≥3s typing pause.
  useEffect(() => {
    const delay = text.trim() ? TRIGGER_DEBOUNCE_MS : 0;
    const timer = setTimeout(() => {
      setTriggers(text.trim() ? getThoughtTriggers(text) : []);
    }, delay);
    return () => clearTimeout(timer);
  }, [text]);

  // Cycle the loading button's stage message while the mock request is in flight.
  useEffect(() => {
    if (!loading) {
      const reset = setTimeout(() => setLoadingStage(0), 0);
      return () => clearTimeout(reset);
    }
    const interval = setInterval(() => {
      setLoadingStage((s) => (s + 1) % LOADING_STAGES.length);
    }, LOADING_STAGE_MS);
    return () => clearInterval(interval);
  }, [loading]);

  // Auto-rotate the headline every 5s — paused while hovered or while the
  // textarea has focus, so it never distracts mid-read or mid-write.
  useEffect(() => {
    if (headlinePaused || textareaFocused) return;
    const timer = setInterval(() => {
      setHeadlineIndex((i) => (i + 1) % HEADLINE_PROMPTS.length);
    }, HEADLINE_ROTATE_MS);
    return () => clearInterval(timer);
  }, [headlinePaused, textareaFocused]);

  function goToHeadline(step: 1 | -1) {
    setHeadlineIndex((i) => (i + step + HEADLINE_PROMPTS.length) % HEADLINE_PROMPTS.length);
  }

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    onSubmit(trimmed);
  }

  function insertAtCursor(insertText: string) {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + insertText + text.slice(end);
    setText(next);

    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const cursor = start + insertText.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  function handleExampleClick(scenario: string) {
    setText(scenario);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(scenario.length, scenario.length);
    });
  }

  return (
    <main className="chat-entry-bg flex min-h-full flex-col items-center justify-center px-6 py-12">
      <div className="relative z-10 w-full max-w-xl space-y-6">
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- static local SVG, no optimization needed */}
          <img src="/logo.svg" alt="Remedy" className="h-7 w-auto" />
        </div>

        <div
          className="space-y-2 text-center"
          onMouseEnter={() => setHeadlinePaused(true)}
          onMouseLeave={() => setHeadlinePaused(false)}
        >
          <div className="mx-auto flex w-fit items-center gap-2">
            <button
              type="button"
              onClick={() => goToHeadline(-1)}
              aria-label="Previous suggestion"
              className="flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => insertAtCursor(headline.insertText)}
              className="w-96 overflow-hidden text-center font-mono text-xl font-bold tracking-tight text-foreground transition-colors hover:text-primary"
            >
              <span key={headline.id} className="block">
                <TypewriterText text={headline.question} unit="char" wordDelayMs={28} />
              </span>
            </button>
            <button
              type="button"
              onClick={() => goToHeadline(1)}
              aria-label="Next suggestion"
              className="flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">What do you need help figuring out?</p>
        </div>

        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setTextareaFocused(true)}
          onBlur={() => setTextareaFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Start typing…"
          disabled={loading}
          className={cn(
            "h-[100px] resize-none border-border bg-card text-base transition-[height] duration-300",
            textareaFocused && "h-[150px]"
          )}
          autoFocus
        />

        {triggers.length > 0 && !loading && (
          <div className="-mt-3 flex flex-wrap gap-1.5">
            {triggers.map((trigger) => (
              <button
                key={trigger.id}
                type="button"
                onClick={() => insertAtCursor(trigger.insertText)}
                className="animate-in fade-in-0 slide-in-from-bottom-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
              >
                {trigger.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">⌘/Ctrl + Enter to send</p>
          <Button
            variant="cta"
            onClick={handleSubmit}
            disabled={loading || text.trim().length === 0}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {LOADING_STAGES[loadingStage]}
              </>
            ) : (
              <>
                Send
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        {!loading && (
          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">What others have asked:</p>
              <div className="flex gap-1">
                {INDUSTRIES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setIndustry(option.id)}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                      industry === option.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/60"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {EXAMPLE_PROMPTS_BY_INDUSTRY[industry].map((example) => (
                <Tooltip key={example.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleExampleClick(example.scenario)}
                      className="space-y-1 rounded-xl border border-border bg-card p-2.5 text-left text-xs transition-colors hover:border-primary/60"
                    >
                      <p className="font-medium text-foreground">{example.label}</p>
                      <p className="line-clamp-2 text-muted-foreground">{example.scenario}</p>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-64">
                    <p className="text-xs">{example.scenario}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
