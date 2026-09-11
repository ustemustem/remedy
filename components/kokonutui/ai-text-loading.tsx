"use client";

/**
 * @author: @kokonutui
 * @description: AI Text Loading
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface AITextLoadingProps {
  texts?: string[];
  className?: string;
  interval?: number;
  /**
   * Opt-in subtle blur+fade transition (a shorter rise, plus a blur that masks
   * the crossfade). Off by default so the report/canvas loaders keep their
   * existing slide; the chat submit button turns it on for its "preparing"
   * feel — see components/chat-entry-screen.tsx and the .btn-thinking sweep.
   */
  blur?: boolean;
}

export default function AITextLoading({
  texts = [
    "Thinking...",
    "Processing...",
    "Analyzing...",
    "Computing...",
    "Almost...",
  ],
  className,
  interval = 1500,
  blur = false,
}: AITextLoadingProps) {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTextIndex((prevIndex) => (prevIndex + 1) % texts.length);
    }, interval);

    return () => clearInterval(timer);
  }, [interval, texts.length]);

  return (
    <div className="flex items-center justify-center">
      <motion.div
        animate={{ opacity: 1 }}
        className="relative w-full"
        initial={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            animate={{
              opacity: 1,
              y: 0,
              backgroundPosition: ["200% center", "-200% center"],
              ...(blur ? { filter: "blur(0px)" } : {}),
            }}
            className={cn(
              "flex min-w-max justify-center whitespace-nowrap bg-[length:200%_100%] bg-gradient-to-r from-neutral-950 via-neutral-400 to-neutral-950 bg-clip-text text-sm font-medium text-transparent dark:from-white dark:via-neutral-600 dark:to-white",
              className
            )}
            exit={blur ? { opacity: 0, y: -6, filter: "blur(3px)" } : { opacity: 0, y: -20 }}
            initial={blur ? { opacity: 0, y: 6, filter: "blur(3px)" } : { opacity: 0, y: 20 }}
            key={currentTextIndex}
            transition={{
              opacity: { duration: 0.3 },
              y: { duration: 0.3 },
              filter: { duration: 0.3 },
              backgroundPosition: {
                duration: 2.5,
                ease: "linear",
                repeat: Number.POSITIVE_INFINITY,
              },
            }}
          >
            {texts[currentTextIndex]}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
