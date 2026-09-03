"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TypewriterText } from "./typewriter-text";
import AITextLoading from "@/components/kokonutui/ai-text-loading";
import type { ChoiceOption } from "@/lib/types";

// Same shimmering-text loading style used everywhere else a card is
// generating (rx-node.tsx's CARD_LOADING_STAGES) — kept as its own constant
// since this button's copy is about branching on the picked choice, not a
// generic "drafting" continuation.
const PICK_LOADING_STAGES = ["Thinking…", "Branching…"];

const STAGGER_MS = 220;
/** Matches the parent card's own slide-in-from-bottom-2 duration (rx-node.tsx)
 * — choices wait for the card itself to finish materializing before they do. */
const CARD_ENTRANCE_DELAY_MS = 300;

export function OptionPicker({
  question,
  options,
  picked,
  onSelectOption,
  onConfirm,
  disabled,
  noteDraft,
  onNoteDraftChange,
  onSubmitNote,
  notePlaceholder,
  downstreamCount = 0,
}: {
  question: string;
  options: ChoiceOption[];
  /** Index into `options`, or null before a pick — persisted on the node's
   *  own data (not local state) so a `refine_in_place` note can clear it
   *  when the option set regenerates. */
  picked: number | null;
  /** Clicking an option card — just changes which one is picked, no async
   *  work yet. */
  onSelectOption: (index: number) => void;
  /** "Select and continue" — commits the currently picked option. */
  onConfirm: () => void;
  disabled?: boolean;
  /** Free-text draft for the "Something else" option, owned by the card
   *  (rx-node.tsx) so it survives this component re-rendering. */
  noteDraft: string;
  onNoteDraftChange: (value: string) => void;
  /** Commits the free-text answer down the note pipeline (classifyNote →
   *  refine or branch), the same path the standalone note panel used to use. */
  onSubmitNote: () => void;
  notePlaceholder: string;
  /** Cards that would be replaced by a revision, warned about before the fact. */
  downstreamCount?: number;
}) {
  // "Something else" lives only in this component's state, never on
  // `nodeData.picked` — that field is an index into `options`, and writing a
  // past-the-end index to it would put an out-of-range value through
  // getOptionResponse. Keeping it local means the free-text choice needs no
  // changes to canvas-screen.tsx's option handling or to lib/mockAI.ts.
  const [freeText, setFreeText] = useState(false);
  // Radio semantics: choosing free text must visually clear the numbered
  // options even though `picked` may still hold their last value.
  const visiblePicked = freeText ? null : picked;
  const hasDraft = noteDraft.trim().length > 0;
  const canSubmit = freeText ? hasDraft : picked !== null;

  return (
    <div className="space-y-1.5 border-t border-border pt-2">
      <p className="text-xs font-medium text-foreground">{question}</p>
      <div className="flex flex-col gap-2">
        {options.map((option, index) => {
          const isPicked = visiblePicked === index;
          const startDelayMs = CARD_ENTRANCE_DELAY_MS + index * STAGGER_MS;
          return (
            <button
              key={index}
              type="button"
              disabled={disabled}
              onClick={() => {
                setFreeText(false);
                onSelectOption(index);
              }}
              aria-pressed={isPicked}
              style={{ animationDelay: `${startDelayMs}ms` }}
              className={cn(
                "nodrag animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both flex flex-col gap-1.5 rounded-[var(--radius-option)] p-2 text-left text-xs duration-300 ease-out transition-colors",
                isPicked && "bg-foreground/8",
                disabled && "cursor-not-allowed opacity-60"
              )}
            >
              <span className="flex items-start gap-2">
                <span className="relative mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full border border-foreground">
                  {isPicked && (
                    <span className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full bg-foreground" />
                  )}
                </span>
                {/* No underline on the picked title: the filled radio and the
                    row tint already say "chosen", and a third signal on the
                    same element read as decoration. */}
                <span className="font-medium text-foreground">
                  <TypewriterText
                    text={`${index + 1}. ${option.title}`}
                    startDelayMs={startDelayMs}
                  />
                </span>
              </span>
              <span className="pl-[18px] text-muted-foreground">
                <TypewriterText text={option.subtitle} startDelayMs={startDelayMs} />
              </span>
            </button>
          );
        })}

        {/* The free-text answer as the last choice, rather than a separate
            always-open note panel below the card. The picker asks the
            question; "Select and continue" answers it; there is one commit
            control per card instead of two competing ones. Not typewritten —
            unlike the options above it, this is a fixed UI affordance, not
            something the model wrote. */}
        <div
          className={cn(
            "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both flex flex-col gap-1.5 rounded-[var(--radius-option)] p-2 text-xs duration-300 ease-out transition-colors",
            freeText && "bg-foreground/8"
          )}
          style={{ animationDelay: `${CARD_ENTRANCE_DELAY_MS + options.length * STAGGER_MS}ms` }}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => setFreeText(true)}
            aria-pressed={freeText}
            className={cn(
              "nodrag flex items-start gap-2 text-left",
              disabled && "cursor-not-allowed opacity-60"
            )}
          >
            <span
              className={cn(
                "relative mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full border",
                freeText ? "border-foreground" : "border-dashed border-muted-foreground"
              )}
            >
              {freeText && (
                <span className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full bg-foreground" />
              )}
            </span>
            <span className="font-medium text-foreground">
              {options.length + 1}. Something else
            </span>
          </button>

          {freeText ? (
            <div className="space-y-1.5 pl-[18px]">
              <Textarea
                autoFocus
                value={noteDraft}
                onChange={(e) => onNoteDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    if (hasDraft) onSubmitNote();
                  }
                }}
                placeholder={notePlaceholder}
                rows={2}
                disabled={disabled}
                className="nodrag"
              />
              {downstreamCount > 0 && (
                <p className="text-[length:var(--text-meta)] text-muted-foreground/70">
                  Revising this will replace the {downstreamCount} card
                  {downstreamCount === 1 ? "" : "s"} below it.
                </p>
              )}
            </div>
          ) : (
            <span className="pl-[18px] text-muted-foreground">Tell me how you&apos;d put it.</span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-start pt-1">
        <Button
          size="sm"
          variant={canSubmit ? "cta" : "outline-cta"}
          className="nodrag"
          disabled={!canSubmit || disabled}
          onClick={freeText ? onSubmitNote : onConfirm}
        >
          {disabled && canSubmit ? (
            <AITextLoading
              texts={PICK_LOADING_STAGES}
              interval={700}
              className="text-[length:var(--text-label)] text-current"
            />
          ) : (
            <>
              {/* The verb tracks the active answer: you "select" a numbered
                  option, but you "send" free text. The label swapping when you
                  choose "Something else" is deliberate mode feedback, not
                  jitter — it confirms you've moved into write-mode. */}
              {freeText ? "Send and continue" : "Select and continue"}
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
