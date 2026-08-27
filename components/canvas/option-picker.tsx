"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
}) {
  return (
    <div className="space-y-1.5 border-t border-border pt-2">
      <p className="text-xs font-medium text-foreground">{question}</p>
      <div className="flex flex-col gap-2">
        {options.map((option, index) => {
          const isPicked = picked === index;
          const startDelayMs = CARD_ENTRANCE_DELAY_MS + index * STAGGER_MS;
          return (
            <button
              key={index}
              type="button"
              disabled={disabled}
              onClick={() => onSelectOption(index)}
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
                <span
                  className={cn(
                    "bg-[image:linear-gradient(currentColor,currentColor)] bg-[position:0_calc(100%+2px)] bg-[length:0%_1px] bg-no-repeat font-medium text-foreground transition-[background-size] duration-300 ease-out",
                    isPicked && "bg-[length:100%_1px]"
                  )}
                >
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
      </div>
      <div className="flex items-center justify-end pt-1">
        <Button
          size="sm"
          variant="outline-cta"
          className="nodrag"
          disabled={picked === null || disabled}
          onClick={onConfirm}
        >
          {disabled && picked !== null ? (
            <AITextLoading
              texts={PICK_LOADING_STAGES}
              interval={700}
              className="text-[length:var(--text-label)] text-current"
            />
          ) : (
            <>
              Select and continue
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
