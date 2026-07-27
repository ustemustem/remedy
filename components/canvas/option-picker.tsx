"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TypewriterText } from "./typewriter-text";
import AITextLoading from "@/components/kokonutui/ai-text-loading";
import type { OptionSet } from "@/lib/types";

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
  optionSet,
  onPick,
  disabled,
}: {
  optionSet: OptionSet;
  onPick: (choiceId: string) => void;
  disabled?: boolean;
}) {
  const [pickedId, setPickedId] = useState<string | null>(null);

  return (
    <div className="space-y-1.5 border-t border-border pt-2">
      <p className="text-xs font-medium text-foreground">{optionSet.prompt}</p>
      <div className="flex flex-col gap-3">
        {optionSet.choices.map((choice, index) => {
          const isPicked = pickedId === choice.id;
          const startDelayMs = CARD_ENTRANCE_DELAY_MS + index * STAGGER_MS;
          return (
            <button
              key={choice.id}
              type="button"
              disabled={disabled}
              onClick={() => setPickedId(choice.id)}
              aria-pressed={isPicked}
              style={{ animationDelay: `${startDelayMs}ms` }}
              className={cn(
                "nodrag animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both space-y-1.5 rounded-[var(--radius-option)] border border-border bg-card p-2 text-left text-xs duration-300 ease-out transition-colors",
                "hover:border-primary/60",
                isPicked && "border-primary bg-primary/5",
                disabled && "cursor-not-allowed opacity-60"
              )}
            >
              <p className="font-medium text-foreground">
                <TypewriterText text={choice.label} startDelayMs={startDelayMs} />
              </p>
              <p className="text-muted-foreground">
                <TypewriterText text={choice.description} startDelayMs={startDelayMs} />
              </p>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between pt-1">
        <Button
          size="sm"
          variant="outline-cta"
          className="nodrag"
          disabled={!pickedId || disabled}
          onClick={() => pickedId && onPick(pickedId)}
        >
          {disabled && pickedId ? (
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
