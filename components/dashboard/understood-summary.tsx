"use client";

import { useEffect, useState } from "react";
import { getUnderstoodSummary } from "@/lib/mockAI";
import type { DashboardNeed } from "@/lib/graph";
import AITextLoading from "@/components/kokonutui/ai-text-loading";

const SUMMARY_LOADING_STAGES = ["Reading what you wrote…", "Summarizing…"];

export function UnderstoodSummary({ needs }: { needs: DashboardNeed[] }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [trackedNeeds, setTrackedNeeds] = useState(needs);

  if (needs !== trackedNeeds) {
    setTrackedNeeds(needs);
    setSummary(null);
  }

  useEffect(() => {
    let cancelled = false;
    getUnderstoodSummary(needs).then((result) => {
      if (!cancelled) setSummary(result);
    });
    return () => {
      cancelled = true;
    };
  }, [needs]);

  if (summary === null) {
    return (
      <AITextLoading
        texts={SUMMARY_LOADING_STAGES}
        interval={700}
        className="text-sm text-muted-foreground"
      />
    );
  }

  return <p className="text-sm text-foreground">{summary}</p>;
}
